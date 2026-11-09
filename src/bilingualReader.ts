import {
  getAppearance,
  getCacheEngineTag,
  getDisplayMode,
  getEngine,
  getHoverDelayMs,
  getHoverTranslateEnabled,
  getMaxBatchParagraphs,
  getMaxCharsPerRequest,
  getMaxConcurrent,
  getMaxConsecutiveErrors,
  getRequestGapMs,
  getRequestTimeoutMs,
  getShortcutEnabled,
  getShortcutSpec,
  getSkipLastPages,
  getSourceLanguage,
  getTargetLanguage,
  setDisplayMode,
  type TranslationEngine,
} from "./settings";
import {
  flushTranslationCacheIndex,
  loadCachedTranslation,
  saveCachedTranslation,
} from "./translationCache";
import {
  buildBatchPayload,
  packBatchItems,
  parseBatchResult,
  splitTextForRequest,
  type BatchInput,
} from "./translationPipeline";
import { isFailureText } from "./translationFailure";
import { getTranslationProvider } from "./providers";
import { CancellationToken } from "./cancellationToken";
import { buildTranslationCSS } from "./appearance";
import { buildDisplayModeCSS, type DisplayMode } from "./displayMode";
import {
  cleanupReadingLayout,
  observeReadingLayout,
  refreshReadingLayout,
} from "./readingLayout";
import {
  attachReaderInteractions,
  type InteractionController,
} from "./readerInteractions";
import {
  closeReaderMenu,
  openReaderMenu,
  type ReaderMenuEntry,
} from "./readerMenu";
import { exportBilingualPDF } from "./readerUI";
import { getString } from "./utils/locale";
import { config } from "../package.json";

const TRANSLATION_CLASS = "interlinear-translation";
const SOURCE_CELL_CLASS = "interlinear-source";
const TOOLBAR_BUTTON_CLASS = "interlinear-toolbar-button";
const REFRESH_BUTTON_CLASS = "interlinear-refresh-button";
const PROGRESS_CLASS = "interlinear-progress";
const STYLE_ID = "interlinear-style";
const PREFERENCES_PANE_ID = "interlinear-preferences";
const TOGGLE_ICON_URL = `chrome://${config.addonRef}/content/icons/icon20.png`;

interface ReaderParagraph {
  refPath: string;
  sourceText: string;
  sourceElement: HTMLElement;
  block?: HTMLDivElement;
  translation?: string;
  pageIndex?: number;
}

interface RunState {
  generation: number;
  running: boolean;
  cancellation?: CancellationToken;
  completed: number;
  total: number;
}

interface ReaderInteractions {
  doc: Document;
  controller: InteractionController;
}

const runStates = new WeakMap<object, RunState>();
const interactionControllers = new WeakMap<object, ReaderInteractions>();
// Shared by the full-document scheduler and on-demand triggers so the same
// paragraph is never requested twice at once.
const paragraphRequests = new WeakMap<HTMLElement, Promise<void>>();

function defaultRunState(): RunState {
  return { generation: 0, running: false, completed: 0, total: 0 };
}

interface TranslationResponse {
  text: string;
  engineTag: string;
}

interface TranslationJobItem extends BatchInput {
  paragraphIndex: number;
}

class RunCancelledError extends Error {
  constructor() {
    super("Translation cancelled.");
    this.name = "RunCancelledError";
  }
}

function isCancellationError(error: unknown): boolean {
  return (
    error instanceof RunCancelledError ||
    (error as any)?.name === "RunCancelledError"
  );
}

async function raceWithTimeoutAndCancellation<T>(
  request: Promise<T>,
  timeoutMs: number,
  cancellation: CancellationToken,
): Promise<T> {
  if (cancellation.cancelled) throw new RunCancelledError();

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let removeCancelListener: () => void = () => undefined;
    const cleanup = () => {
      clearTimeout(timeoutID);
      removeCancelListener();
    };
    const finish = (handler: (value: any) => void, value: any) => {
      if (settled) return;
      settled = true;
      cleanup();
      handler(value);
    };
    const onCancel = () => finish(reject, new RunCancelledError());

    const timeoutID = setTimeout(() => {
      finish(
        reject,
        new Error(
          getString("error-request-timeout", {
            args: { seconds: String(Math.round(timeoutMs / 1000)) },
          }),
        ),
      );
    }, timeoutMs);
    removeCancelListener = cancellation.onCancel(onCancel);

    request.then(
      (value) => finish(resolve, value),
      (error) => finish(reject, error),
    );
  });
}

async function cancellableDelay(
  milliseconds: number,
  cancellation: CancellationToken,
): Promise<void> {
  if (milliseconds <= 0) return;
  if (cancellation.cancelled) throw new RunCancelledError();

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    let removeCancelListener: () => void = () => undefined;
    const finish = (handler: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutID);
      removeCancelListener();
      handler();
    };
    const onCancel = () => finish(() => reject(new RunCancelledError()));

    const timeoutID = setTimeout(() => finish(resolve), milliseconds);
    removeCancelListener = cancellation.onCancel(onCancel);
  });
}

async function translateText(
  text: string,
  itemID: number,
  engine: TranslationEngine,
): Promise<TranslationResponse> {
  const provider = getTranslationProvider(engine);
  const result = await provider.translate(text, {
    itemID,
    sourceLanguage: getSourceLanguage(),
    targetLanguage: getTargetLanguage(),
    timeoutMs: getRequestTimeoutMs(),
  });
  return {
    text: result.text,
    engineTag: getCacheEngineTag(),
  };
}

async function translateTextLimited(
  text: string,
  request: (chunk: string) => Promise<TranslationResponse>,
): Promise<TranslationResponse> {
  const chunks = splitTextForRequest(text, getMaxCharsPerRequest());
  if (chunks.length === 1) {
    return request(chunks[0]);
  }

  const translated: string[] = [];
  let engineTag = "";
  for (const chunk of chunks) {
    const response = await request(chunk);
    translated.push(response.text);
    engineTag = response.engineTag;
  }
  return { text: translated.join(" ").trim(), engineTag };
}

function getInternalReader(reader: any): any {
  return reader?._internalReader || reader;
}

function getActiveSDTView(reader: any): any {
  const internal = getInternalReader(reader);
  if (!internal) return null;

  const primary = internal._lastViewPrimary !== false || !internal._secondaryView;
  return primary ? internal._primarySDTView : internal._secondarySDTView;
}

function getSDTDocument(reader: any): Document | null {
  try {
    const view = getActiveSDTView(reader);
    return view?._iframeDocument || view?._iframe?.contentDocument || null;
  } catch (_) {
    return null;
  }
}

function getSDTStructure(reader: any): any | null {
  try {
    const view = getActiveSDTView(reader);
    return view?.getData?.()?.structure || view?._structure || null;
  } catch (_) {
    return null;
  }
}

/** Exposed to the chat sidebar, which reads the same active SDT view. */
export function getReaderDocument(reader: any): Document | null {
  return getSDTDocument(reader);
}

function getDocumentRoot(doc: Document): HTMLElement | null {
  try {
    return doc.documentElement as HTMLElement | null;
  } catch (_) {
    return null;
  }
}

function isDeadObjectError(error: unknown): boolean {
  return /dead object|can't access dead object|cannot access dead object/i.test(String(error));
}

function nextGeneration(reader: any): number {
  const current = runStates.get(reader) || defaultRunState();
  current.cancellation?.cancel();
  current.generation += 1;
  current.running = true;
  current.completed = 0;
  current.total = 0;
  current.cancellation = new CancellationToken();
  runStates.set(reader, current);
  return current.generation;
}

function cancelRun(reader: any): void {
  const current = runStates.get(reader) || defaultRunState();
  current.cancellation?.cancel();
  current.generation += 1;
  current.running = false;
  current.completed = 0;
  current.total = 0;
  current.cancellation = undefined;
  runStates.set(reader, current);
  updateToolbarProgress(reader);
}

export function cancelBilingualReading(reader: any): void {
  cancelRun(reader);
}

export function isBilingualRunning(reader: any): boolean {
  return Boolean(runStates.get(reader)?.running);
}

function isCurrentRun(reader: any, generation: number, doc: Document): boolean {
  const state = runStates.get(reader);
  if (
    !state ||
    !state.running ||
    state.generation !== generation ||
    state.cancellation?.cancelled
  ) {
    return false;
  }

  try {
    return getSDTDocument(reader) === doc && !!doc.querySelector("#sdt-content");
  } catch (_) {
    return false;
  }
}

function getRunCancellation(reader: any, generation: number): CancellationToken {
  const state = runStates.get(reader);
  if (!state?.running || state.generation !== generation || !state.cancellation) {
    throw new RunCancelledError();
  }
  return state.cancellation;
}

function finishRun(reader: any, generation: number): void {
  const state = runStates.get(reader);
  if (!state || state.generation !== generation) return;
  state.running = false;
  state.cancellation = undefined;
  state.completed = 0;
  state.total = 0;
  updateToolbarProgress(reader);
}

function setRunProgress(
  reader: any,
  generation: number,
  completed: number,
  total: number,
): void {
  const state = runStates.get(reader);
  if (!state || state.generation !== generation) return;
  state.completed = completed;
  state.total = total;
  updateToolbarProgress(reader);
}

async function ensureReadingMode(reader: any): Promise<Document> {
  let doc = getSDTDocument(reader);
  if (doc?.querySelector("#sdt-content")) return doc;

  const internal = getInternalReader(reader);
  if (!internal) {
    throw new Error(getString("error-reader-unavailable"));
  }

  const primary = internal._lastViewPrimary !== false || !internal._secondaryView;
  if (typeof internal._setReadingMode === "function") {
    await internal._setReadingMode(primary, true);
  } else {
    throw new Error(getString("error-reading-mode-unsupported"));
  }

  for (let i = 0; i < 150; i++) {
    doc = getSDTDocument(reader);
    if (doc?.querySelector("#sdt-content")) return doc;
    await Zotero.Promise.delay(100);
  }

  throw new Error(getString("error-reading-mode-timeout"));
}

function installStyles(doc: Document): void {
  const appearance = getAppearance();
  const css = `
${buildTranslationCSS(TRANSLATION_CLASS, appearance, "reader")}
${buildDisplayModeCSS(TRANSLATION_CLASS, SOURCE_CELL_CLASS, appearance.paragraphSpacing)}
    .${TRANSLATION_CLASS}[data-state="loading"] {
      opacity: 0.62;
    }
    .${TRANSLATION_CLASS}[data-state="error"],
    .${TRANSLATION_CLASS}[data-state="paused"] {
      opacity: 0.78;
    }
    .interlinear-source-hover {
      outline: 1px dashed currentColor;
      outline-offset: 2px;
    }
    .interlinear-source-hover-auto {
      outline: 1px dotted currentColor;
      outline-offset: 3px;
    }
    .interlinear-selection-popup {
      position: fixed;
      z-index: 2147483000;
      min-width: 320px;
      max-width: 420px;
      padding: 8px;
      border: 1px solid rgba(127, 127, 127, 0.45);
      border-radius: 6px;
      background: Canvas;
      color: CanvasText;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.28);
      font-size: 13px;
      line-height: 1.5;
    }
    .interlinear-selection-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .interlinear-selection-popup button {
      padding: 3px 10px;
      border: 1px solid rgba(127, 127, 127, 0.45);
      border-radius: 4px;
      background: ButtonFace;
      color: ButtonText;
      cursor: pointer;
    }
    .interlinear-selection-popup button:disabled {
      opacity: 0.6;
      cursor: default;
    }
    .interlinear-selection-close {
      margin-left: auto;
      font-size: 16px;
      line-height: 1;
    }
    .interlinear-selection-result {
      margin-top: 6px;
      max-height: 220px;
      overflow: auto;
      white-space: pre-wrap;
      user-select: text;
    }
    .interlinear-selection-result[data-state="error"] {
      color: #b3261e;
    }
    .interlinear-progress {
      margin-inline: 4px;
      font-size: 11px;
      opacity: 0.75;
      white-space: nowrap;
    }
  `;

  let style = doc.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = doc.createElement("style");
    style.id = STYLE_ID;
    const target = doc.head || doc.documentElement;
    target?.append(style);
  }
  style.textContent = css;
}

/**
 * Switch layout without moving Zotero's source nodes. Source and translation
 * stay siblings, so native annotation ranges keep pointing at the same text.
 */
function applyDisplayMode(doc: Document, mode: DisplayMode = getDisplayMode()): void {
  const content = doc.querySelector("#sdt-content") as HTMLElement | null;
  if (!content) return;
  content.dataset.interlinearDisplay = mode;
  refreshReadingLayout(doc);
}

/** Re-apply the display mode to readers that are already open. */
export function refreshDisplayModes(): void {
  const readers = ((Zotero.Reader as any)._readers || []) as any[];
  for (const reader of readers) {
    try {
      if (reader.type !== "pdf") continue;
      const doc = getSDTDocument(reader);
      if (doc?.querySelector("#sdt-content")) applyDisplayMode(doc);
    } catch (error) {
      Zotero.logError(error as Error);
    }
  }
}

/** Re-apply appearance settings to readers that are already open. */
export function refreshTranslationStyles(): void {
  const readers = ((Zotero.Reader as any)._readers || []) as any[];
  for (const reader of readers) {
    try {
      if (reader.type !== "pdf") continue;
      const doc = getSDTDocument(reader);
      if (doc?.querySelector("#sdt-content")) installStyles(doc);
    } catch (error) {
      Zotero.logError(error as Error);
    }
  }
}

function isTranslatableElement(element: HTMLElement): boolean {
  if (element.closest(".sdt-reference")) return false;
  if (element.closest(`.${TRANSLATION_CLASS}`)) return false;
  if (element.hidden) return false;

  const tag = element.tagName.toLowerCase();
  if (
    tag === "li" &&
    element.querySelector(
      "p[data-ref-path], h1[data-ref-path], h2[data-ref-path], h3[data-ref-path], h4[data-ref-path], h5[data-ref-path], h6[data-ref-path]",
    )
  ) {
    return false;
  }
  return true;
}

function parseRefPath(refPath: string): number[] {
  return refPath
    .split(".")
    .map((part) => Number(part))
    .filter((part) => Number.isFinite(part));
}

function compareRefPath(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return a.length - b.length;
}

function getPageIndexForRef(structure: any, refPath: string): number | undefined {
  const ref = parseRefPath(refPath);
  if (!ref.length) return undefined;
  const pages = structure?.catalog?.pages;
  if (!Array.isArray(pages)) return undefined;

  for (let i = 0; i < pages.length; i++) {
    const range = pages[i]?.contentRange;
    if (!Array.isArray(range) || range.length !== 2) continue;
    const start = Array.isArray(range[0]) ? range[0] : [];
    const end = Array.isArray(range[1]) ? range[1] : [];
    if (
      start.length &&
      end.length &&
      compareRefPath(ref, start) >= 0 &&
      compareRefPath(ref, end) < 0
    ) {
      return i;
    }
  }
  return undefined;
}

function shouldSkipByPage(pageIndex: number | undefined, totalPages: number): boolean {
  const skipLastPages = getSkipLastPages();
  if (!skipLastPages || pageIndex === undefined || totalPages <= 0) return false;
  const firstSkippedPage = Math.max(0, totalPages - skipLastPages);
  return pageIndex >= firstSkippedPage;
}

function collectParagraphs(
  doc: Document,
  itemKey: string,
  engineTag: string,
  structure: any,
): ReaderParagraph[] {
  const selector = [
    "#sdt-content p[data-ref-path]",
    "#sdt-content h1[data-ref-path]",
    "#sdt-content h2[data-ref-path]",
    "#sdt-content h3[data-ref-path]",
    "#sdt-content h4[data-ref-path]",
    "#sdt-content h5[data-ref-path]",
    "#sdt-content h6[data-ref-path]",
    "#sdt-content figcaption[data-ref-path]",
    "#sdt-content aside.sdt-note[data-ref-path]",
    "#sdt-content li[data-ref-path]",
  ].join(",");

  const totalPages = Array.isArray(structure?.catalog?.pages) ? structure.catalog.pages.length : 0;
  const elements = Array.from(doc.querySelectorAll(selector)) as HTMLElement[];
  const paragraphs: ReaderParagraph[] = [];

  for (const element of elements) {
    if (!isTranslatableElement(element)) continue;

    const sourceText = (element.textContent || "").replace(/\s+/g, " ").trim();
    if (sourceText.length < 2) continue;

    const refPath = element.dataset.refPath || "";
    const pageIndex = getPageIndexForRef(structure, refPath);
    if (shouldSkipByPage(pageIndex, totalPages)) continue;

    paragraphs.push({
      refPath,
      sourceText,
      sourceElement: element,
      pageIndex,
      translation: loadCachedTranslation(
        itemKey,
        sourceText,
        engineTag,
        isFailureText,
        getTargetLanguage(),
      ),
    });
  }

  return paragraphs;
}

function ensureTranslationBlock(doc: Document, paragraph: ReaderParagraph): HTMLDivElement | null {
  if (paragraph.block?.ownerDocument === doc && paragraph.block.parentNode) {
    return paragraph.block;
  }

  const source = paragraph.sourceElement;
  if (source.ownerDocument !== doc || !source.parentNode) return null;

  const sibling = source.nextElementSibling as HTMLDivElement | null;
  if (
    sibling?.classList.contains(TRANSLATION_CLASS) &&
    sibling.dataset.sourceRefPath === paragraph.refPath
  ) {
    source.classList.add(SOURCE_CELL_CLASS);
    paragraph.block = sibling;
    return sibling;
  }

  const block = doc.createElement("div");
  block.className = TRANSLATION_CLASS;
  block.lang = getTargetLanguage();
  block.dataset.sourceRefPath = paragraph.refPath;
  if (paragraph.pageIndex !== undefined) {
    block.dataset.sourcePage = String(paragraph.pageIndex + 1);
  }

  if (paragraph.translation) {
    block.dataset.state = "done";
    block.textContent = paragraph.translation;
  } else {
    block.dataset.state = "loading";
    block.textContent = getString("paragraph-waiting");
  }

  source.classList.add(SOURCE_CELL_CLASS);
  source.after(block);
  paragraph.block = block;
  return block;
}

function clearTranslations(doc: Document): void {
  const nodes = Array.from(doc.querySelectorAll(`.${TRANSLATION_CLASS}`)) as HTMLElement[];
  for (const node of nodes) {
    try {
      node.remove();
    } catch (_) {
      // Reader may have replaced the SDT iframe while cleaning up.
    }
  }

  const sources = Array.from(
    doc.querySelectorAll(`.${SOURCE_CELL_CLASS}`),
  ) as HTMLElement[];
  for (const source of sources) {
    try {
      source.classList.remove(SOURCE_CELL_CLASS);
    } catch (_) {
      // Same iframe replacement case as above.
    }
  }

  const content = doc.querySelector("#sdt-content") as HTMLElement | null;
  if (content) delete content.dataset.interlinearDisplay;

  const root = getDocumentRoot(doc);
  if (root) delete root.dataset.interlinearRunning;
  cleanupReadingLayout(doc);
}

function getReaderItem(reader: any): { itemID: number; itemKey: string } {
  const itemID = Number(reader?.itemID || 0);
  if (!itemID) throw new Error(getString("reader-item-missing"));
  const item = Zotero.Items.get(itemID);
  return { itemID, itemKey: String(item?.key || reader?.itemKey || itemID) };
}

/** Translate only the user's selection and return the text for the popup. */
export async function translateSelectedText(reader: any, rawText: string): Promise<string> {
  const text = String(rawText || "")
    .replace(/\s+/gu, " ")
    .trim();
  if (text.length < 2) throw new Error(getString("selection-empty-translation"));

  const { itemID, itemKey } = getReaderItem(reader);
  const engine = getEngine();
  const engineTag = getCacheEngineTag();
  const targetLanguage = getTargetLanguage();
  const cached = loadCachedTranslation(
    itemKey,
    text,
    engineTag,
    isFailureText,
    targetLanguage,
  );
  if (cached) return cached;

  const response = await raceWithTimeoutAndCancellation(
    translateTextLimited(text, (chunk) => translateText(chunk, itemID, engine)),
    getRequestTimeoutMs(),
    new CancellationToken(),
  );
  if (!response.text?.trim()) throw new Error(getString("selection-empty-translation"));
  if (isFailureText(response.text)) throw new Error(response.text);

  saveCachedTranslation(
    itemKey,
    text,
    response.text,
    response.engineTag || engineTag,
    isFailureText,
    targetLanguage,
  );
  flushTranslationCacheIndex();
  return response.text;
}

/** Translate the paragraph under a hover / shortcut / Alt+click trigger. */
export function translateReaderParagraph(
  reader: any,
  source: HTMLElement,
): Promise<void> {
  const pending = paragraphRequests.get(source);
  if (pending) return pending;

  const doc = source?.ownerDocument;
  if (!doc || !source.closest?.("#sdt-content")) return Promise.resolve();
  if (source.closest?.(`.${TRANSLATION_CLASS}`)) return Promise.resolve();

  const refPath = source.dataset?.refPath || "";
  const sourceText = (source.textContent || "").replace(/\s+/g, " ").trim();
  if (!refPath || sourceText.length < 2) return Promise.resolve();

  const existingBlock = source.nextElementSibling as HTMLElement | null;
  if (existingBlock?.classList?.contains(TRANSLATION_CLASS)) {
    const state = existingBlock.dataset.state;
    if (state === "loading" || state === "done") return Promise.resolve();
  }

  const promise = requestReaderParagraph(reader, source, doc, refPath, sourceText);
  paragraphRequests.set(source, promise);
  const release = () => {
    if (paragraphRequests.get(source) === promise) paragraphRequests.delete(source);
  };
  void promise.then(release, release);
  return promise;
}

async function requestReaderParagraph(
  reader: any,
  source: HTMLElement,
  doc: Document,
  refPath: string,
  sourceText: string,
): Promise<void> {
  const { itemID, itemKey } = getReaderItem(reader);
  const engine = getEngine();
  const engineTag = getCacheEngineTag();
  const targetLanguage = getTargetLanguage();
  const paragraph: ReaderParagraph = {
    refPath,
    sourceText,
    sourceElement: source,
    pageIndex: getPageIndexForRef(getSDTStructure(reader), refPath),
    translation: loadCachedTranslation(
      itemKey,
      sourceText,
      engineTag,
      isFailureText,
      targetLanguage,
    ),
  };

  const block = ensureTranslationBlock(doc, paragraph);
  if (!block) return;

  if (paragraph.translation) {
    block.dataset.state = "done";
    block.textContent = paragraph.translation;
    refreshReadingLayout(doc);
    return;
  }

  block.dataset.state = "loading";
  block.textContent = getString("paragraph-translating");
  try {
    const response = await raceWithTimeoutAndCancellation(
      translateTextLimited(sourceText, (chunk) => translateText(chunk, itemID, engine)),
      getRequestTimeoutMs(),
      new CancellationToken(),
    );
    if (!response.text?.trim()) throw new Error(getString("selection-empty-translation"));
    if (isFailureText(response.text)) throw new Error(response.text);

    paragraph.translation = response.text;
    saveCachedTranslation(
      itemKey,
      sourceText,
      response.text,
      response.engineTag || engineTag,
      isFailureText,
      targetLanguage,
    );
    flushTranslationCacheIndex();
    if (block.isConnected) {
      block.dataset.state = "done";
      block.textContent = response.text;
    }
  } catch (error: any) {
    if (block.isConnected) {
      block.dataset.state = "error";
      block.textContent = getString("paragraph-translate-failed", {
        args: { detail: String(error?.message || error) },
      });
    }
    throw error;
  } finally {
    refreshReadingLayout(doc);
  }
}

function ensureReaderInteractions(reader: any, doc: Document): void {
  const existing = interactionControllers.get(reader);
  if (existing?.doc === doc) return;

  existing?.controller.dispose();
  const controller = attachReaderInteractions(
    doc,
    {
      translateSelection: (text) => translateSelectedText(reader, text),
      translateParagraph: (source) => translateReaderParagraph(reader, source),
    },
    {
      getHoverSettings: () => ({
        enabled: getHoverTranslateEnabled(),
        delayMs: getHoverDelayMs(),
      }),
      getShortcutSettings: () => ({
        enabled: getShortcutEnabled(),
        spec: getShortcutSpec(),
      }),
    },
  );
  interactionControllers.set(reader, { doc, controller });
}

function showError(reader: any, message: string): void {
  try {
    reader?._iframeWindow?.alert?.(message);
    return;
  } catch (_) {
    // Fall through to the Zotero main window.
  }

  try {
    Zotero.getMainWindow()?.alert(message);
  } catch (_) {
    Zotero.logError(new Error(message));
  }
}

function markUnfinishedPaused(doc: Document, paragraphs: ReaderParagraph[]): void {
  for (const paragraph of paragraphs) {
    if (paragraph.translation) continue;
    const block = ensureTranslationBlock(doc, paragraph);
    if (!block || block.dataset.state === "error") continue;
    block.dataset.state = "paused";
    block.textContent = getString("paragraph-paused");
  }
}

function getViewportDistance(paragraph: ReaderParagraph, doc: Document): number {
  try {
    const rect = paragraph.sourceElement.getBoundingClientRect();
    const viewportHeight = doc.defaultView?.innerHeight || 0;
    if (rect.bottom >= 0 && rect.top <= viewportHeight) return 0;
    if (rect.top > viewportHeight) return rect.top - viewportHeight;
    return Math.abs(rect.bottom);
  } catch (_) {
    return Number.MAX_SAFE_INTEGER;
  }
}

async function translateParagraphs(
  reader: any,
  doc: Document,
  itemID: number,
  itemKey: string,
  paragraphs: ReaderParagraph[],
  generation: number,
  engine: TranslationEngine,
  engineTag: string,
): Promise<void> {
  const maxErrors = getMaxConsecutiveErrors();
  const requestGapMs = getRequestGapMs();
  const requestTimeoutMs = getRequestTimeoutMs();
  const configuredConcurrent = getMaxConcurrent();
  // Local LLM servers and the free Google endpoint are rate sensitive; the
  // paid/remote relays can use the configured concurrency.
  const concurrency =
    engine === "ollama" ? 1 : engine === "google" ? Math.min(configuredConcurrent, 2) : configuredConcurrent;
  const pendingIndexes = paragraphs
    .map((paragraph, index) => (paragraph.translation ? -1 : index))
    .filter((index) => index >= 0);
  const viewportDistances = new Map(
    pendingIndexes.map((index) => [index, getViewportDistance(paragraphs[index], doc)]),
  );
  pendingIndexes.sort(
    (a, b) =>
      (viewportDistances.get(a) ?? Number.MAX_SAFE_INTEGER) -
      (viewportDistances.get(b) ?? Number.MAX_SAFE_INTEGER),
  );

  if (!pendingIndexes.length) {
    finishRun(reader, generation);
    return;
  }

  setRunProgress(reader, generation, 0, pendingIndexes.length);
  const cancellation = getRunCancellation(reader, generation);
  const jobItems: TranslationJobItem[] = pendingIndexes.map((paragraphIndex) => ({
    id: String(paragraphIndex),
    paragraphIndex,
    text: paragraphs[paragraphIndex].sourceText,
  }));
  const jobs = packBatchItems(jobItems, getMaxCharsPerRequest(), getMaxBatchParagraphs());

  let cursor = 0;
  let completed = 0;
  let failureStreak = 0;
  let aborted = false;
  let nextStartAt = Date.now();

  const waitForStartSlot = async () => {
    if (cancellation.cancelled) throw new RunCancelledError();
    if (requestGapMs <= 0) return;
    const now = Date.now();
    const scheduled = Math.max(now, nextStartAt);
    nextStartAt = scheduled + requestGapMs;
    const wait = scheduled - now;
    await cancellableDelay(wait, cancellation);
  };

  const request = async (text: string): Promise<TranslationResponse> => {
    await waitForStartSlot();
    if (!isCurrentRun(reader, generation, doc)) throw new RunCancelledError();
    return raceWithTimeoutAndCancellation(
      translateText(text, itemID, engine),
      requestTimeoutMs,
      cancellation,
    );
  };

  const translateJob = async (
    job: TranslationJobItem[],
  ): Promise<Array<{ paragraphIndex: number; response: TranslationResponse }>> => {
    if (job.length === 1) {
      const response = await translateTextLimited(job[0].text, request);
      return [{ paragraphIndex: job[0].paragraphIndex, response }];
    }

    const batchResponse = await request(buildBatchPayload(job));
    const parsed = parseBatchResult(batchResponse.text, job.length);
    if (parsed) {
      return job.map((item, index) => ({
        paragraphIndex: item.paragraphIndex,
        response: { text: parsed[index], engineTag: batchResponse.engineTag },
      }));
    }

    // Some engines translate or remove structural markers. Retrying these few
    // items individually is slower, but guarantees paragraph alignment.
    const fallback: Array<{ paragraphIndex: number; response: TranslationResponse }> = [];
    for (const item of job) {
      fallback.push({
        paragraphIndex: item.paragraphIndex,
        response: await translateTextLimited(item.text, request),
      });
    }
    return fallback;
  };

  const adoptCached = (paragraph: ReaderParagraph): boolean => {
    if (paragraph.translation) return true;
    const cached = loadCachedTranslation(
      itemKey,
      paragraph.sourceText,
      engineTag,
      isFailureText,
      getTargetLanguage(),
    );
    if (!cached) return false;
    paragraph.translation = cached;
    const liveBlock = ensureTranslationBlock(doc, paragraph);
    if (liveBlock?.parentNode) {
      liveBlock.dataset.state = "done";
      liveBlock.textContent = cached;
    }
    return true;
  };

  const worker = async () => {
    while (!aborted && isCurrentRun(reader, generation, doc)) {
      const slot = cursor++;
      if (slot >= jobs.length) return;
      const scheduled = jobs[slot];
      const busy: Array<{ item: TranslationJobItem; promise: Promise<void> }> = [];
      const job: TranslationJobItem[] = [];

      for (const item of scheduled) {
        const paragraph = paragraphs[item.paragraphIndex];
        if (adoptCached(paragraph)) {
          completed += 1;
          setRunProgress(reader, generation, completed, pendingIndexes.length);
          continue;
        }
        const pending = paragraphRequests.get(paragraph.sourceElement);
        if (pending) {
          busy.push({ item, promise: pending });
        } else {
          job.push(item);
        }
      }

      if (busy.length) {
        await Promise.allSettled(busy.map((entry) => entry.promise));
        if (!isCurrentRun(reader, generation, doc)) return;
        for (const { item } of busy) {
          const paragraph = paragraphs[item.paragraphIndex];
          if (adoptCached(paragraph)) {
            completed += 1;
            setRunProgress(reader, generation, completed, pendingIndexes.length);
          } else {
            job.push(item);
          }
        }
      }

      if (!job.length) continue;

      for (const item of job) {
        const block = ensureTranslationBlock(doc, paragraphs[item.paragraphIndex]);
        if (!block) continue;
        block.dataset.state = "loading";
        block.textContent = getString("paragraph-translating-progress", {
          args: { done: completed, total: pendingIndexes.length },
        });
      }

      let releaseJob: () => void = () => undefined;
      const shared = new Promise<void>((resolve) => {
        releaseJob = resolve;
      });
      for (const item of job) {
        paragraphRequests.set(paragraphs[item.paragraphIndex].sourceElement, shared);
      }

      try {
        const results = await translateJob(job);
        if (!isCurrentRun(reader, generation, doc)) return;

        for (const { paragraphIndex, response } of results) {
          const paragraph = paragraphs[paragraphIndex];
          paragraph.translation = response.text;
          saveCachedTranslation(
            itemKey,
            paragraph.sourceText,
            response.text,
            response.engineTag || engineTag,
            isFailureText,
            getTargetLanguage(),
          );

          const liveBlock = paragraph.block;
          if (liveBlock?.parentNode) {
            liveBlock.dataset.state = "done";
            liveBlock.textContent = response.text;
          }
          completed += 1;
          setRunProgress(reader, generation, completed, pendingIndexes.length);
        }
        failureStreak = 0;
      } catch (error: any) {
        if (isCancellationError(error)) return;
        if (isDeadObjectError(error)) {
          aborted = true;
          cancelRun(reader);
          return;
        }
        if (!isCurrentRun(reader, generation, doc)) return;

        failureStreak += 1;
        for (const item of job) {
          const liveBlock = paragraphs[item.paragraphIndex].block;
          if (liveBlock?.parentNode) {
            liveBlock.dataset.state = "error";
            liveBlock.textContent = getString("paragraph-translate-failed", {
              args: { detail: String(error?.message || error) },
            });
          }
        }

        if (failureStreak >= maxErrors) {
          aborted = true;
          markUnfinishedPaused(doc, paragraphs);
          cancelRun(reader);
          return;
        }
      } finally {
        releaseJob();
        for (const item of job) {
          const sourceElement = paragraphs[item.paragraphIndex].sourceElement;
          if (paragraphRequests.get(sourceElement) === shared) {
            paragraphRequests.delete(sourceElement);
          }
        }
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, () => worker()));

  finishRun(reader, generation);
}

async function prepareAndRun(reader: any, refresh: boolean): Promise<void> {
  const doc = await ensureReadingMode(reader);
  const root = getDocumentRoot(doc);
  if (!root) throw new Error(getString("error-reading-mode-page"));

  installStyles(doc);
  cancelRun(reader);

  if (refresh) {
    clearTranslations(doc);
  }

  applyDisplayMode(doc);
  ensureReaderInteractions(reader, doc);

  const itemID = Number(reader?.itemID || 0);
  const item = itemID ? Zotero.Items.get(itemID) : null;
  const itemKey = String(item?.key || reader?.itemKey || itemID || "reader");
  if (!itemID) throw new Error(getString("error-item-id-missing"));

  try {
    await (Zotero as any).SDT?.ensure?.(itemID, { isPriority: true });
  } catch (error) {
    Zotero.logError(error as Error);
  }

  const engine = getEngine();
  const engineTag = getCacheEngineTag();
  const structure = getSDTStructure(reader);
  const paragraphs = collectParagraphs(doc, itemKey, engineTag, structure);
  if (!paragraphs.length) {
    throw new Error(getString("error-no-paragraphs"));
  }

  observeReadingLayout(getActiveSDTView(reader), doc);
  for (const paragraph of paragraphs) {
    ensureTranslationBlock(doc, paragraph);
  }

  const generation = nextGeneration(reader);
  root.dataset.interlinearRunning = "true";
  try {
    await translateParagraphs(
      reader,
      doc,
      itemID,
      itemKey,
      paragraphs,
      generation,
      engine,
      engineTag,
    );
  } finally {
    flushTranslationCacheIndex();
    const liveRoot = getDocumentRoot(getSDTDocument(reader) || doc);
    if (liveRoot) delete liveRoot.dataset.interlinearRunning;
  }
}

export async function toggleBilingualReading(reader: any): Promise<void> {
  try {
    const doc = await ensureReadingMode(reader);

    if (doc.querySelector(`.${TRANSLATION_CLASS}`)) {
      cancelRun(reader);
      clearTranslations(doc);
      return;
    }

    await prepareAndRun(reader, false);
  } catch (error: any) {
    if (!isDeadObjectError(error) && !isCancellationError(error)) {
      showError(reader, error?.message || String(error));
    }
  }
}

export async function refreshBilingualReading(reader: any): Promise<void> {
  try {
    cancelRun(reader);
    const doc = await ensureReadingMode(reader);
    clearTranslations(doc);
    await Zotero.Promise.delay(30);
    await prepareAndRun(reader, false);
  } catch (error: any) {
    if (!isDeadObjectError(error) && !isCancellationError(error)) {
      showError(reader, error?.message || String(error));
    }
  }
}

export function configureTranslation(reader: any): void {
  try {
    const preferencesWindow = Zotero.Utilities.Internal.openPreferences(PREFERENCES_PANE_ID);
    if (preferencesWindow) return;
  } catch (error) {
    Zotero.logError(error as Error);
  }

  showError(reader, getString("settings-open-failed"));
}

function createToolbarButton(
  doc: Document,
  className: string,
  text: string,
  title: string,
  onClick: (event: Event) => void,
  iconURL?: string,
  onContextMenu?: (event: MouseEvent) => void,
): HTMLButtonElement {
  const button = doc.createElement("button");
  button.className = `toolbar-button ${className}`;
  button.type = "button";
  button.tabIndex = -1;
  button.title = title;
  button.setAttribute("aria-label", title);
  button.style.minWidth = "24px";
  button.style.paddingInline = "2px";
  if (iconURL) {
    const img = doc.createElement("img");
    img.src = iconURL;
    img.alt = "";
    img.draggable = false;
    img.style.width = "16px";
    img.style.height = "16px";
    img.style.display = "block";
    img.style.pointerEvents = "none";
    button.appendChild(img);
  } else {
    button.textContent = text;
    button.style.fontSize = "16px";
    button.style.lineHeight = "1";
    button.style.fontFamily = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  }
  button.addEventListener("click", (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick(event);
  });
  if (onContextMenu) {
    button.addEventListener("contextmenu", (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      onContextMenu(event);
    });
  }
  return button;
}

function revealChatPane(): boolean {
  const win = Zotero.getMainWindow() as any;
  const pane = win?.ZoteroContextPane;
  if (!pane || !win?.document) return false;

  try {
    pane.collapsed = false;
  } catch (_) {
    // Opening the pane is best-effort; the sidenav click below still works.
  }

  const buttons = Array.from(
    win.document.querySelectorAll(".btn[data-pane]"),
  ) as HTMLElement[];
  const button = buttons.find((candidate) =>
    String((candidate as any).dataset?.pane || "").endsWith("-interlinear-chat"),
  );
  if (!button) return false;
  button.click();
  return true;
}

function openBilingualToolbarMenu(
  reader: any,
  doc: Document,
  x: number,
  y: number,
): void {
  const running = isBilingualRunning(reader);
  const mode = getDisplayMode();
  const entries: ReaderMenuEntry[] = [
    { action: "toggle", label: getString("toolbar-menu-toggle") },
    { action: "refresh", label: getString("toolbar-menu-refresh") },
    {
      action: "cancel",
      label: getString("toolbar-menu-cancel"),
      disabled: !running,
    },
    "separator",
    {
      action: "display:top-bottom",
      label: getString("display-mode-top-bottom"),
      checked: mode === "top-bottom",
    },
    {
      action: "display:side-by-side",
      label: getString("display-mode-side-by-side"),
      checked: mode === "side-by-side",
    },
    {
      action: "display:target-only",
      label: getString("display-mode-target-only"),
      checked: mode === "target-only",
    },
    {
      action: "display:source-only",
      label: getString("display-mode-source-only"),
      checked: mode === "source-only",
    },
    "separator",
    { action: "export", label: getString("toolbar-menu-export") },
    { action: "chat", label: getString("toolbar-menu-chat") },
    { action: "settings", label: getString("toolbar-menu-settings") },
  ];

  openReaderMenu(doc, {
    x,
    y,
    entries,
    onSelect: (action) => {
      if (action === "toggle") {
        void toggleBilingualReading(reader);
      } else if (action === "refresh") {
        void refreshBilingualReading(reader);
      } else if (action === "cancel") {
        cancelBilingualReading(reader);
      } else if (action.startsWith("display:")) {
        setDisplayMode(action.slice("display:".length));
        refreshDisplayModes();
      } else if (action === "export") {
        void exportBilingualPDF(reader);
      } else if (action === "chat") {
        if (!revealChatPane()) {
          showError(reader, getString("toolbar-menu-chat-unavailable"));
        }
      } else if (action === "settings") {
        configureTranslation(reader);
      }
    },
  });
}

export function renderBilingualToolbarButtons(event: any): void {
  const { reader, doc, append } = event || {};
  if (!reader || reader.type !== "pdf" || !doc || typeof append !== "function") return;

  if (!doc.querySelector(`.${TOOLBAR_BUTTON_CLASS}`)) {
    append(
      createToolbarButton(
        doc,
        TOOLBAR_BUTTON_CLASS,
        "",
        getString("toolbar-toggle-title"),
        () => void toggleBilingualReading(reader),
        TOGGLE_ICON_URL,
        (event) => openBilingualToolbarMenu(reader, doc, event.clientX, event.clientY),
      ),
    );
  }

  if (!doc.querySelector(`.${PROGRESS_CLASS}`)) {
    const progress = doc.createElement("span") as HTMLSpanElement;
    progress.className = PROGRESS_CLASS;
    progress.hidden = true;
    append(progress);
  }

  if (!doc.querySelector(`.${REFRESH_BUTTON_CLASS}`)) {
    append(
      createToolbarButton(
        doc,
        REFRESH_BUTTON_CLASS,
        "🔄",
        getString("toolbar-refresh-title"),
        () => void refreshBilingualReading(reader),
      ),
    );
  }

  updateToolbarProgress(reader);
}

function updateToolbarProgress(reader: any): void {
  let toolbarDoc: Document | undefined;
  try {
    toolbarDoc = reader?._iframeWindow?.document as Document | undefined;
  } catch (_) {
    toolbarDoc = undefined;
  }
  if (!toolbarDoc) return;

  const state = runStates.get(reader);
  const running = !!state?.running;
  const done = state?.completed || 0;
  const total = state?.total || 0;

  const progress = toolbarDoc.querySelector(`.${PROGRESS_CLASS}`) as HTMLElement | null;
  if (progress) {
    progress.hidden = !(running && total > 0);
    progress.textContent = running && total > 0 ? `${done}/${total}` : "";
  }

  const toggle = toolbarDoc.querySelector(
    `.${TOOLBAR_BUTTON_CLASS}`,
  ) as HTMLButtonElement | null;
  if (!toggle) return;
  const title =
    running && total > 0
      ? getString("toolbar-toggle-running-title", { args: { done, total } })
      : getString("toolbar-toggle-title");
  toggle.title = title;
  toggle.setAttribute("aria-label", title);
}

export function cleanupBilingualReader(reader: any): void {
  cancelRun(reader);

  const interactions = interactionControllers.get(reader);
  if (interactions) {
    interactionControllers.delete(reader);
    try {
      interactions.controller.dispose();
    } catch (error) {
      Zotero.logError(error as Error);
    }
  }

  const internal = getInternalReader(reader);
  for (const view of [internal?._primarySDTView, internal?._secondarySDTView]) {
    try {
      const doc = view?._iframeDocument || view?._iframe?.contentDocument;
      if (doc) clearTranslations(doc);
    } catch (_) {
      // A split view's iframe may already have been destroyed.
    }
  }

  let toolbarDoc: Document | undefined;
  try {
    toolbarDoc = reader?._iframeWindow?.document as Document | undefined;
  } catch (_) {
    toolbarDoc = undefined;
  }

  closeReaderMenu(toolbarDoc);

  const buttons = toolbarDoc
    ? (Array.from(
        toolbarDoc.querySelectorAll(
          `.${TOOLBAR_BUTTON_CLASS}, .${REFRESH_BUTTON_CLASS}, .${PROGRESS_CLASS}`,
        ),
      ) as HTMLElement[])
    : [];
  for (const button of buttons) {
    button.remove();
  }
}
