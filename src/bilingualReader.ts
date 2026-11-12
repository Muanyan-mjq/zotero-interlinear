import {
  getAppearance,
  getCacheEngineTag,
  getDisplayMode,
  getEngine,
  getGlossaryEntries,
  getToggleShortcut,
  getToggleShortcutEnabled,
  getDisplayShortcut,
  getDisplayShortcutEnabled,
  getAutoTranslateOnOpen,
  getMaxBatchParagraphs,
  getMaxCharsPerRequest,
  getMaxConcurrent,
  getMaxConsecutiveErrors,
  getRequestGapMs,
  getRequestTimeoutMs,
  getScopeBody,
  getScopeCaptions,
  getScopeListItems,
  getScopeNotes,
  getScopeTitles,
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
  parseBatchResult,
  splitTextForRequest,
  type BatchInput,
} from "./translationPipeline";
import { isFailureText } from "./translationFailure";
import { applyGlossaryToTranslation } from "./glossary";
import { getTranslationProvider } from "./providers";
import { GoogleThrottleError } from "./providers/google";
import { CancellationToken } from "./cancellationToken";
import { matchesShortcut, parseShortcut } from "./shortcut";
import {
  buildTranslationCSS,
  resolveTextDirection,
  resolveUiFontFamily,
} from "./appearance";
import { buildDisplayModeCSS, DISPLAY_MODES, type DisplayMode } from "./displayMode";
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
import { registerToolbarHandlers } from "./toolbarEvents";
import { INTERLINEAR_ICON_DATA_URL } from "./interlinearIcon";
import { logError } from "./utils/log";
import {
  transition,
  isTranslationVisible,
  type ToggleState,
  type ToggleEvent,
  type ToggleTransition,
} from "./readerToggle";
import { whenSecretsReady } from "./secrets";
import {
  getActiveSDTView,
  getInternalReader,
  getReaderFrameDocument,
  getReaders,
  getSDTViewDocument,
  getSDTViews,
  setReadingMode,
} from "./zoteroCompat";

const TRANSLATION_CLASS = "interlinear-translation";
const SOURCE_CELL_CLASS = "interlinear-source";
const TOOLBAR_BUTTON_CLASS = "interlinear-toolbar-button";
const REFRESH_BUTTON_CLASS = "interlinear-refresh-button";
const DISPLAY_BUTTON_CLASS = "interlinear-display-button";
const PROGRESS_CLASS = "interlinear-progress";
const ERROR_NOTICE_CLASS = "interlinear-error-notice";
const STYLE_ID = "interlinear-style";
const PREFERENCES_PANE_ID = "interlinear-preferences";

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

interface InteractionWatcher {
  timeouts: ReturnType<typeof setTimeout>[];
  doc: Document | null;
  onLoad: ((event: Event) => void) | null;
  /** Observers watch for `#sdt-content` appearing after reading mode is enabled. */
  observers: MutationObserver[];
  observedDocs: Document[];
  onBootstrapKeyDown: ((event: KeyboardEvent) => void) | null;
}

const runStates = new WeakMap<object, RunState>();
const toggleStates = new WeakMap<object, ToggleState>();
const interactionControllers = new WeakMap<object, ReaderInteractions[]>();
const interactionWatchers = new WeakMap<object, InteractionWatcher>();
// Short bounded retries cover the reader's own mount sequence. Anything
// later is handled by the MutationObserver below and by ensureReadingMode(),
// which attaches the controller directly on every path that enables reading
// mode. No permanent polling loop, and no long-lived timers.
const INTERACTION_ATTACH_DELAYS_MS = [0, 150, 500, 1500, 3000, 6000, 10000];
const IFRAME_LOAD_RETRY_DELAYS_MS = [60, 400, 1200];
// Shared by the full-document scheduler and on-demand triggers so the same
// paragraph is never requested twice at once.
const paragraphRequests = new WeakMap<HTMLElement, Promise<void>>();
const errorNotices = new WeakMap<Document, { element: HTMLElement; timer: any }>();

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
  // Keys are decrypted asynchronously at startup; the provider reads them
  // synchronously, so make sure that has finished.
  await whenSecretsReady();
  const provider = getTranslationProvider(engine);
  const result = await provider.translate(text, {
    itemID,
    sourceLanguage: getSourceLanguage(),
    targetLanguage: getTargetLanguage(),
    timeoutMs: getRequestTimeoutMs(),
  });
  return {
    text: applyGlossaryToTranslation(result.text, getGlossaryEntries()),
    engineTag: getCacheEngineTag(),
  };
}

/**
 * Native batch path for providers that translate several segments in one
 * request (Google's multi-`q` endpoint). Returns null when the engine has no
 * such path so the caller falls back to marker batching.
 */
async function translateTextBatch(
  texts: string[],
  itemID: number,
  engine: TranslationEngine,
): Promise<{ texts: string[]; engineTag: string } | null> {
  await whenSecretsReady();
  const provider = getTranslationProvider(engine);
  if (!provider.translateBatch) return null;
  const results = await provider.translateBatch(texts, {
    itemID,
    sourceLanguage: getSourceLanguage(),
    targetLanguage: getTargetLanguage(),
    timeoutMs: getRequestTimeoutMs(),
  });
  const entries = getGlossaryEntries();
  return {
    texts: results.map((text) => applyGlossaryToTranslation(text, entries)),
    engineTag: getCacheEngineTag(),
  };
}

/** Cooldown carried by a rate-limit error, or 0 for ordinary failures. */
function getThrottleCooldownMs(error: unknown): number {
  if (error instanceof GoogleThrottleError) return Math.max(0, error.cooldownMs);
  return 0;
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


function getSDTDocument(reader: any): Document | null {
  try {
    return getSDTViewDocument(getActiveSDTView(reader));
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
  maybeAutoTranslate(reader);
}

export function cancelBilingualReading(reader: any): void {
  dispatchToggle(reader, "run-cancelled");
  cancelRun(reader);
}

export function isBilingualRunning(reader: any): boolean {
  return Boolean(runStates.get(reader)?.running);
}

function getToggleState(reader: any): ToggleState {
  const state = toggleStates.get(reader) || "empty";
  if (state === "empty" || state === "running") return state;
  // The reader can replace its SDT document (re-render, split view switch).
  // Without translation blocks the reader is untranslated again.
  try {
    const doc = getSDTDocument(reader);
    if (!doc?.querySelector(`.${TRANSLATION_CLASS}`)) {
      toggleStates.delete(reader);
      return "empty";
    }
  } catch (_) {
    toggleStates.delete(reader);
    return "empty";
  }
  return state;
}

function setTranslationsHidden(reader: any, hidden: boolean): void {
  const doc = getSDTDocument(reader);
  const content = doc?.querySelector("#sdt-content") as HTMLElement | null;
  if (!doc || !content) return;
  if (hidden) {
    // All display-mode CSS is scoped by data-interlinear-display, so removing
    // it restores the native layout (including side-by-side margins) while
    // the blocks and their results stay in the DOM.
    delete content.dataset.interlinearDisplay;
    content.dataset.interlinearHidden = "true";
  } else {
    delete content.dataset.interlinearHidden;
    content.dataset.interlinearDisplay = getDisplayMode();
  }
  // The layout MutationObserver does not watch data-* attributes.
  refreshReadingLayout(doc);
}

function markLoadingBlocksPaused(reader: any): void {
  const doc = getSDTDocument(reader);
  if (!doc) return;
  const blocks = Array.from(
    doc.querySelectorAll(`.${TRANSLATION_CLASS}[data-state="loading"]`),
  ) as HTMLElement[];
  for (const block of blocks) {
    setBlockState(block, "paused", getString("paragraph-paused"));
  }
}

function dispatchToggle(reader: any, event: ToggleEvent): ToggleTransition {
  const result = transition(getToggleState(reader), event);
  if (result.state === "empty") toggleStates.delete(reader);
  else toggleStates.set(reader, result.state);

  for (const effect of result.effects) {
    try {
      if (effect === "pause-run") {
        cancelRun(reader);
        markLoadingBlocksPaused(reader);
      } else if (effect === "hide") {
        setTranslationsHidden(reader, true);
      } else if (effect === "show") {
        setTranslationsHidden(reader, false);
      } else if (effect === "mark-paused") {
        markLoadingBlocksPaused(reader);
      }
      // start-run / resume-run / clear-translations need async orchestration
      // and are executed by the calling event handler.
    } catch (error) {
      logError(error as Error);
    }
  }
  updateToolbarProgress(reader);
  return result;
}

function reportToggleError(reader: any, error: any): void {
  if (isDeadObjectError(error) || isCancellationError(error)) return;
  dispatchToggle(reader, "reset");
  showError(reader, error?.message || String(error));
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
  dispatchToggle(reader, "run-finished");
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
  if (doc?.querySelector("#sdt-content")) {
    // Any path that turns reading mode on must make the per-paragraph
    // triggers available; otherwise only a full-document run attached them.
    ensureReaderInteractions(reader, doc);
    return doc;
  }

  if (!getInternalReader(reader)) {
    throw new Error(getString("error-reader-unavailable"));
  }
  if (!(await setReadingMode(reader, true))) {
    throw new Error(getString("error-reading-mode-unsupported"));
  }

  for (let i = 0; i < 150; i++) {
    doc = getSDTDocument(reader);
    if (doc?.querySelector("#sdt-content")) {
      ensureReaderInteractions(reader, doc);
      return doc;
    }
    await Zotero.Promise.delay(100);
  }

  throw new Error(getString("error-reading-mode-timeout"));
}

function installStyles(doc: Document): void {
  const appearance = getAppearance();
  const uiFont = appearance.uiFollowAppearance
    ? resolveUiFontFamily(appearance, getTargetLanguage())
    : "";
  const uiFontPx =
    appearance.fontSizeMode === "em"
      ? Math.round(appearance.fontSize * appearance.fontSizeEm)
      : appearance.fontSize;
  const uiFontSize = appearance.uiFollowAppearance ? `${uiFontPx}px` : "13px";
  const animation =
    appearance.stateAnimation && !appearance.reduceMotion
      ? `
    @keyframes interlinear-pulse {
      0%, 100% { opacity: 0.45; }
      50% { opacity: 0.85; }
    }
    .${TRANSLATION_CLASS}[data-state="loading"] {
      animation: interlinear-pulse 1.4s ease-in-out infinite;
    }
    @media (prefers-reduced-motion: reduce) {
      .${TRANSLATION_CLASS}[data-state="loading"] {
        animation: none;
      }
    }
    `
      : "";
  const css = `
:root {
  --interlinear-ui-font-family: ${uiFont || "inherit"};
  --interlinear-ui-font-size: ${uiFontSize};
  --interlinear-popup-max-width: ${appearance.popupMaxWidth}px;
}
${buildTranslationCSS(TRANSLATION_CLASS, appearance, "reader", {
  targetLanguage: getTargetLanguage(),
})}
${buildDisplayModeCSS(TRANSLATION_CLASS, SOURCE_CELL_CLASS, appearance.paragraphSpacing)}
    #sdt-content[data-interlinear-hidden="true"] .${TRANSLATION_CLASS} {
      display: none;
    }
    .${TRANSLATION_CLASS}[data-state="loading"] {
      opacity: 0.62;
    }
    .${TRANSLATION_CLASS}[data-state="error"],
    .${TRANSLATION_CLASS}[data-state="paused"] {
      opacity: 0.78;
    }
    .${TRANSLATION_CLASS} {
      user-select: text;
    }
${animation}
    .interlinear-source-hover {
      outline: 1px dashed currentColor;
      outline-offset: 2px;
    }
    .interlinear-selection-popup {
      position: fixed;
      z-index: 2147483000;
      min-width: 280px;
      max-width: var(--interlinear-popup-max-width, 420px);
      padding: 8px;
      border: 1px solid rgba(127, 127, 127, 0.45);
      border-radius: 6px;
      background: Canvas;
      color: CanvasText;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.28);
      font-family: var(--interlinear-ui-font-family, inherit);
      font-size: var(--interlinear-ui-font-size, 13px);
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
    .${TRANSLATION_CLASS}[data-state="error"],
    .${TRANSLATION_CLASS}[data-state="paused"] {
      cursor: pointer;
    }
    .${ERROR_NOTICE_CLASS} {
      position: fixed;
      top: 12px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2147483001;
      display: flex;
      align-items: flex-start;
      gap: 8px;
      max-width: min(680px, calc(100% - 32px));
      padding: 8px 10px;
      border: 1px solid rgba(179, 38, 30, 0.55);
      border-radius: 6px;
      background: Canvas;
      color: CanvasText;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.28);
      font-size: 13px;
      line-height: 1.5;
      white-space: pre-wrap;
    }
    .${ERROR_NOTICE_CLASS} .interlinear-error-notice-text {
      user-select: text;
    }
    .${ERROR_NOTICE_CLASS} .interlinear-error-notice-close {
      flex: none;
      padding: 0 4px;
      border: none;
      background: transparent;
      color: inherit;
      font-size: 16px;
      line-height: 1;
      cursor: pointer;
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
  // Hidden readers keep the native layout until the user shows translations.
  if (content.dataset.interlinearHidden === "true") return;
  content.dataset.interlinearDisplay = mode;
  refreshReadingLayout(doc);
}

function getDisplayModeLabel(mode: DisplayMode): string {
  switch (mode) {
    case "side-by-side":
      return getString("display-mode-side-by-side");
    case "target-only":
      return getString("display-mode-target-only");
    case "source-only":
      return getString("display-mode-source-only");
    default:
      return getString("display-mode-top-bottom");
  }
}

function cycleDisplayMode(reader: any, toolbarDoc?: Document): void {
  const index = DISPLAY_MODES.indexOf(getDisplayMode());
  setDisplayMode(DISPLAY_MODES[(index + 1) % DISPLAY_MODES.length]);
  refreshDisplayModes();
  updateDisplayButtonState(reader, toolbarDoc);
}

function updateDisplayButtonState(reader: any, toolbarDoc?: Document): void {  if (!toolbarDoc) {
    try {
      toolbarDoc = getReaderFrameDocument(reader) as Document | undefined;
    } catch (_) {
      toolbarDoc = undefined;
    }
  }
  const button = toolbarDoc?.querySelector(
    `.${DISPLAY_BUTTON_CLASS}`,
  ) as HTMLButtonElement | null;
  if (!button) return;
  const mode = getDisplayMode();
  button.dataset.mode = mode;
  const title = getString("toolbar-display-title", {
    args: { mode: getDisplayModeLabel(mode) },
  });
  button.title = title;
  button.setAttribute("aria-label", title);
}

/** Re-apply the display mode to readers that are already open. */
export function refreshDisplayModes(): void {
  const readers = getReaders();
  for (const reader of readers) {
    try {
      if (reader.type !== "pdf") continue;
      const doc = getSDTDocument(reader);
      if (doc?.querySelector("#sdt-content")) applyDisplayMode(doc);
      updateDisplayButtonState(reader);
    } catch (error) {
      logError(error as Error);
    }
  }
}

/** Re-apply appearance settings to readers that are already open. */
export function refreshTranslationStyles(): void {
  const readers = getReaders();
  for (const reader of readers) {
    try {
      if (reader.type !== "pdf") continue;
      const doc = getSDTDocument(reader);
      if (doc?.querySelector("#sdt-content")) {
        installStyles(doc);
        const direction = translationDirection();
        for (const block of Array.from(
          doc.querySelectorAll(`.${TRANSLATION_CLASS}`),
        ) as HTMLElement[]) {
          block.dir = direction;
        }
      }
    } catch (error) {
      logError(error as Error);
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
  const selectors: string[] = [];
  if (getScopeBody()) selectors.push("#sdt-content p[data-ref-path]");
  if (getScopeTitles()) {
    for (const tag of ["h1", "h2", "h3", "h4", "h5", "h6"]) {
      selectors.push(`#sdt-content ${tag}[data-ref-path]`);
    }
  }
  if (getScopeCaptions()) selectors.push("#sdt-content figcaption[data-ref-path]");
  if (getScopeNotes()) selectors.push("#sdt-content aside.sdt-note[data-ref-path]");
  if (getScopeListItems()) selectors.push("#sdt-content li[data-ref-path]");
  const selector = selectors.join(",");
  if (!selector) return [];

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

function translationDirection(): "ltr" | "rtl" {
  return resolveTextDirection(getAppearance().textDirection, getTargetLanguage());
}

function ensureTranslationBlock(doc: Document, paragraph: ReaderParagraph): HTMLDivElement | null {
  if (paragraph.block?.ownerDocument === doc && paragraph.block.parentNode) {
    paragraph.block.dir = translationDirection();
    return paragraph.block;
  }

  const source = paragraph.sourceElement;
  if (source.ownerDocument !== doc || !source.parentNode) return null;

  const direction = translationDirection();
  const sibling = source.nextElementSibling as HTMLDivElement | null;
  if (
    sibling?.classList.contains(TRANSLATION_CLASS) &&
    sibling.dataset.sourceRefPath === paragraph.refPath
  ) {
    source.classList.add(SOURCE_CELL_CLASS);
    sibling.dir = direction;
    paragraph.block = sibling;
    if (paragraph.translation && sibling.dataset.state !== "done") {
      setBlockState(sibling, "done", paragraph.translation);
    }
    return sibling;
  }

  const block = doc.createElement("div");
  block.className = TRANSLATION_CLASS;
  block.lang = getTargetLanguage();
  block.dir = direction;
  block.dataset.sourceRefPath = paragraph.refPath;
  if (paragraph.pageIndex !== undefined) {
    block.dataset.sourcePage = String(paragraph.pageIndex + 1);
  }

  if (paragraph.translation) {
    setBlockState(block, "done", paragraph.translation);
  } else {
    setBlockState(block, "loading", getString("paragraph-waiting"));
  }

  source.classList.add(SOURCE_CELL_CLASS);
  source.after(block);
  paragraph.block = block;
  return block;
}

/** On-demand triggers can run before any full translation installed reader UI. */
function prepareOnDemandReading(reader: any, doc: Document): void {
  installStyles(doc);
  applyDisplayMode(doc);
  observeReadingLayout(getActiveSDTView(reader), doc);
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
  if (content) {
    delete content.dataset.interlinearDisplay;
    delete content.dataset.interlinearHidden;
  }

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

/** Translate the paragraph under a shortcut / Alt+click / menu trigger. */
export function translateReaderParagraph(
  reader: any,
  source: HTMLElement,
  options: { force?: boolean } = {},
): Promise<void> {
  const pending = paragraphRequests.get(source);
  if (pending) return pending;

  const doc = source?.ownerDocument;
  if (!doc || !source.closest?.("#sdt-content")) return Promise.resolve();
  if (source.closest?.(`.${TRANSLATION_CLASS}`)) return Promise.resolve();

  const refPath = source.dataset?.refPath || "";
  const sourceText = (source.textContent || "").replace(/\s+/g, " ").trim();
  if (!refPath || sourceText.length < 2) return Promise.resolve();

  if (!options.force) {
    const existingBlock = source.nextElementSibling as HTMLElement | null;
    if (existingBlock?.classList?.contains(TRANSLATION_CLASS)) {
      const state = existingBlock.dataset.state;
      if (state === "loading" || state === "done") return Promise.resolve();
    }
  }

  const promise = requestReaderParagraph(
    reader,
    source,
    doc,
    refPath,
    sourceText,
    Boolean(options.force),
  );
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
  force = false,
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
    translation: force
      ? ""
      : loadCachedTranslation(
          itemKey,
          sourceText,
          engineTag,
          isFailureText,
          targetLanguage,
        ),
  };

  prepareOnDemandReading(reader, doc);
  const block = ensureTranslationBlock(doc, paragraph);
  if (!block) return;

  if (paragraph.translation) {
    setBlockState(block, "done", paragraph.translation);
    refreshReadingLayout(doc);
    dispatchToggle(reader, "paragraph-translated");
    return;
  }

  setBlockState(block, "loading", getString("paragraph-translating"));
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
      setBlockState(block, "done", response.text);
    }
    dispatchToggle(reader, "paragraph-translated");
  } catch (error: any) {
    if (block.isConnected) {
      setBlockState(
        block,
        "error",
        getString("paragraph-translate-failed", {
          args: { detail: String(error?.message || error) },
        }),
      );
    }
    throw error;
  } finally {
    refreshReadingLayout(doc);
  }
}

function ensureReaderInteractions(reader: any, doc: Document): void {
  const controllers = interactionControllers.get(reader) || [];
  for (let index = controllers.length - 1; index >= 0; index -= 1) {
    const entry = controllers[index];
    if (entry.doc === doc) return;
    if (isInteractionDocumentAlive(entry.doc)) continue;
    controllers.splice(index, 1);
    try {
      entry.controller.dispose();
    } catch (error) {
      logError(error as Error);
    }
  }

  const controller = attachReaderInteractions(
    doc,
    {
      translateSelection: (text) => translateSelectedText(reader, text),
      translateParagraph: (source, options) => {
        dispatchToggle(reader, "shortcut");
        return translateReaderParagraph(reader, source, options);
      },
    },
    {
      getShortcutSettings: () => ({
        enabled: getShortcutEnabled(),
        spec: getShortcutSpec(),
      }),
      getToggleShortcutSettings: () => ({
        enabled: getToggleShortcutEnabled(),
        spec: parseShortcut(getToggleShortcut()),
      }),
      getDisplayShortcutSettings: () => ({
        enabled: getDisplayShortcutEnabled(),
        spec: parseShortcut(getDisplayShortcut()),
      }),
      onToggleShortcut: () => {
        void toggleBilingualReading(reader);
      },
      onCycleDisplayShortcut: () => cycleDisplayMode(reader),
      getPopupWidth: () => getAppearance().popupMaxWidth,
    },
  );
  controllers.push({ doc, controller });
  interactionControllers.set(reader, controllers);
}

function isInteractionDocumentAlive(doc: Document): boolean {
  try {
    return !!doc.defaultView;
  } catch (_) {
    return false;
  }
}

function hasReaderInteractions(reader: any, doc: Document): boolean {
  return !!interactionControllers.get(reader)?.some((entry) => entry.doc === doc);
}

function getReaderSDTDocuments(reader: any): Document[] {
  const docs: Document[] = [];
  const views = [...getSDTViews(reader), getActiveSDTView(reader)];
  for (const view of views) {
    try {
      const doc = getSDTViewDocument(view);
      if (doc && !docs.includes(doc)) docs.push(doc);
    } catch (_) {
      // A split view's iframe may already have been destroyed.
    }
  }
  return docs;
}

function attachInteractionsToReaderDocument(reader: any, doc: Document): boolean {
  if (!doc.querySelector("#sdt-content")) return false;
  if (hasReaderInteractions(reader, doc)) return true;
  ensureReaderInteractions(reader, doc);
  return true;
}

function isReadingModeReady(reader: any): boolean {
  return getReaderSDTDocuments(reader).some((doc) => {
    try {
      return !!doc.querySelector("#sdt-content");
    } catch (_) {
      return false;
    }
  });
}

/**
 * Zotero opens PDFs in the plain PDF view and only creates `#sdt-content`
 * when reading mode is enabled. Watching both the outer reader document and
 * every SDT document means the controller attaches whenever reading mode is
 * turned on, including long after the reader mounted.
 */
function observeForContent(
  reader: any,
  state: InteractionWatcher,
  doc: Document,
): void {
  if (!doc || state.observedDocs.includes(doc)) return;
  const Observer = (globalThis as any).MutationObserver;
  if (typeof Observer !== "function") return;
  try {
    const observer = new Observer(() => {
      try {
        // Once this document has a controller there is nothing left to do.
        // Without this guard every reader DOM mutation would re-run the whole
        // attach scan, which is needless work on a live reader.
        if (hasReaderInteractions(reader, doc)) return;
        if (doc.querySelector("#sdt-content")) tryAttachInteractions(reader, state);
      } catch (_) {
        // The iframe can be torn down while a mutation is being delivered.
      }
    });
    observer.observe(doc.documentElement || doc, { childList: true, subtree: true });
    state.observedDocs.push(doc);
    state.observers.push(observer);
  } catch (_) {
    // Some test documents have no MutationObserver in their realm.
  }
}

function tryAttachInteractions(reader: any, state: InteractionWatcher): boolean {
  let attached = false;
  for (const doc of getReaderSDTDocuments(reader)) {
    try {
      observeForContent(reader, state, doc);
      if (attachInteractionsToReaderDocument(reader, doc)) attached = true;
    } catch (error) {
      logError(error as Error);
    }
  }
  try {
    const outerDoc = getReaderFrameDocument(reader);
    if (outerDoc) observeForContent(reader, state, outerDoc);
  } catch (_) {
    // The reader window can disappear while it is being inspected.
  }
  return attached;
}

function clearInteractionRetries(state: InteractionWatcher): void {
  for (const timeout of state.timeouts) {
    try {
      clearTimeout(timeout);
    } catch (_) {
      // The main window may already be shutting down.
    }
  }
  state.timeouts = [];
}

function scheduleInteractionRetries(
  reader: any,
  state: InteractionWatcher,
  delays: number[],
): void {
  clearInteractionRetries(state);
  for (const delay of delays) {
    state.timeouts.push(
      setTimeout(() => {
        try {
          if (tryAttachInteractions(reader, state)) clearInteractionRetries(state);
        } catch (error) {
          logError(error as Error);
        }
      }, delay),
    );
  }
}

/**
 * Attach the shortcut/selection controller as soon as a reader exposes
 * its SDT document. This must be re-entrant: a watcher created before reading
 * mode was enabled used to short-circuit every later attempt, which left
 * single-paragraph triggers dead until a full-document run attached them.
 */
export function watchReaderInteractions(reader: any): void {
  if (!reader || reader.type !== "pdf" || reader._isUninitialized) return;

  const existing = interactionWatchers.get(reader);
  if (existing) {
    tryAttachInteractions(reader, existing);
    scheduleInteractionRetries(reader, existing, INTERACTION_ATTACH_DELAYS_MS);
    return;
  }

  const state: InteractionWatcher = {
    timeouts: [],
    doc: null,
    onLoad: null,
    observers: [],
    observedDocs: [],
    onBootstrapKeyDown: null,
  };
  interactionWatchers.set(reader, state);

  tryAttachInteractions(reader, state);
  scheduleInteractionRetries(reader, state, INTERACTION_ATTACH_DELAYS_MS);

  try {
    const outerDoc = getReaderFrameDocument(reader) as Document | null;
    if (outerDoc) {
      state.doc = outerDoc;
      observeForContent(reader, state, outerDoc);
      state.onLoad = (event: Event) => {
        const target = event?.target as Element | null;
        if (target?.localName !== "iframe") return;
        tryAttachInteractions(reader, state);
        scheduleInteractionRetries(reader, state, IFRAME_LOAD_RETRY_DELAYS_MS);
      };
      outerDoc.addEventListener("load", state.onLoad, true);

      // In the plain PDF view there is no SDT document to listen on yet. Let
      // the single-paragraph shortcut switch into reading mode on demand,
      // without ever starting a full-document run.
      state.onBootstrapKeyDown = (event: KeyboardEvent) => {
        try {
          if (isReadingModeReady(reader)) return;
          if (!getInternalReader(reader) || !getShortcutEnabled()) return;
          const spec = getShortcutSpec();
          if (!spec || !matchesShortcut(event, spec)) return;
          event.preventDefault();
          event.stopPropagation();
          void enterParagraphTranslationMode(reader);
        } catch (_) {
          // A detached reader must never break the reader's own key handling.
        }
      };
      outerDoc.addEventListener("keydown", state.onBootstrapKeyDown, true);
    }
  } catch (_) {
    // The reader window can disappear while it is being inspected.
  }
}

function stopWatchingReaderInteractions(reader: any): void {
  const state = interactionWatchers.get(reader);
  if (!state) return;
  interactionWatchers.delete(reader);

  clearInteractionRetries(state);
  for (const observer of state.observers) {
    try {
      observer.disconnect();
    } catch (_) {
      // The observed document may already be gone.
    }
  }
  state.observers = [];
  state.observedDocs = [];

  if (state.doc) {
    if (state.onLoad) {
      try {
        state.doc.removeEventListener("load", state.onLoad, true);
      } catch (_) {
        // The reader document may already be gone.
      }
    }
    if (state.onBootstrapKeyDown) {
      try {
        state.doc.removeEventListener("keydown", state.onBootstrapKeyDown, true);
      } catch (_) {
        // The reader document may already be gone.
      }
    }
  }
}

function getNoticeDocument(reader: any): Document | null {
  try {
    const sdt = getSDTDocument(reader);
    if (sdt?.body || sdt?.documentElement) return sdt;
  } catch (_) {
    // The SDT view may not exist before reading mode is initialized.
  }
  try {
    const doc = getReaderFrameDocument(reader) as Document | undefined;
    if (doc?.body || doc?.documentElement) return doc;
  } catch (_) {
    // The reader may already be closed.
  }
  return null;
}

function clearNoticeTimer(doc: Document): void {
  const state = errorNotices.get(doc);
  if (!state?.timer) return;
  try {
    const win: any = doc.defaultView || Zotero.getMainWindow();
    win?.clearTimeout?.(state.timer);
  } catch (_) {
    // The iframe may have been replaced.
  }
}

function dismissErrorNotice(doc: Document): void {
  clearNoticeTimer(doc);
  const state = errorNotices.get(doc);
  errorNotices.delete(doc);
  try {
    state?.element.remove();
  } catch (_) {
    // The iframe may already be gone.
  }
}

/** Non-blocking replacement for window.alert: a dismissible in-reader toast. */
function showError(reader: any, message: string): void {
  try {
    logError(new Error(message));
  } catch (_) {
    // Outside Zotero there is nowhere to report.
  }

  const doc = getNoticeDocument(reader);
  const host = doc?.body || doc?.documentElement;
  if (!doc || !host) return;

  clearNoticeTimer(doc);
  let notice = doc.querySelector(`.${ERROR_NOTICE_CLASS}`) as HTMLElement | null;
  if (!notice) {
    notice = doc.createElement("div");
    notice.className = ERROR_NOTICE_CLASS;
    notice.setAttribute("role", "alert");

    const text = doc.createElement("span");
    text.className = "interlinear-error-notice-text";

    const close = doc.createElement("button");
    close.type = "button";
    close.className = "interlinear-error-notice-close";
    close.textContent = "×";
    close.title = getString("error-notice-close");
    close.setAttribute("aria-label", getString("error-notice-close"));
    close.addEventListener("click", () => dismissErrorNotice(doc));

    notice.append(text, close);
    host.append(notice);
  }

  const text = notice.querySelector(".interlinear-error-notice-text");
  if (text) text.textContent = message;

  try {
    const win: any = doc.defaultView || Zotero.getMainWindow();
    const timer = win?.setTimeout?.(() => dismissErrorNotice(doc), 12000);
    errorNotices.set(doc, { element: notice, timer });
  } catch (_) {
    errorNotices.set(doc, { element: notice, timer: null });
  }
}

function setBlockState(
  block: HTMLElement | null | undefined,
  state: "loading" | "done" | "error" | "paused",
  text: string,
): void {
  if (!block) return;
  block.dataset.state = state;
  block.textContent = text;
  if (state === "error" || state === "paused") {
    block.title = getString("paragraph-retry-title");
    block.setAttribute("role", "button");
    block.tabIndex = 0;
  } else {
    block.removeAttribute("title");
    block.removeAttribute("role");
    block.removeAttribute("tabindex");
  }
}

function markUnfinishedPaused(
  doc: Document,
  paragraphs: ReaderParagraph[],
  message?: string,
): void {
  const text = message || getString("paragraph-paused");
  for (const paragraph of paragraphs) {
    if (paragraph.translation) continue;
    const block = ensureTranslationBlock(doc, paragraph);
    if (!block || block.dataset.state === "error") continue;
    setBlockState(block, "paused", text);
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
  const maxItems = Math.max(1, getMaxBatchParagraphs());
  const maxChars = getMaxCharsPerRequest();
  const remaining = new Set<number>(pendingIndexes);
  let orderedIndexes = pendingIndexes.slice();
  let lastViewportPoll = Date.now();

  // Re-read geometry as the user pages through the document. Small documents
  // re-sort on every claim; large ones poll at most twice per second so the
  // queue does not spend its time measuring off-screen paragraphs.
  const reorderRemaining = () => {
    const now = Date.now();
    if (remaining.size > 120 && now - lastViewportPoll < 400) return;
    lastViewportPoll = now;
    orderedIndexes = Array.from(remaining).sort(
      (a, b) => getViewportDistance(paragraphs[a], doc) - getViewportDistance(paragraphs[b], doc),
    );
  };

  const claimNextJob = (): TranslationJobItem[] => {
    reorderRemaining();
    const job: TranslationJobItem[] = [];
    for (const index of orderedIndexes) {
      if (!remaining.has(index)) continue;
      const item: TranslationJobItem = {
        id: String(index),
        paragraphIndex: index,
        text: paragraphs[index].sourceText,
      };
      if (job.length) {
        const candidate = [...job, item];
        if (candidate.length > maxItems || buildBatchPayload(candidate).length > maxChars) break;
      }
      job.push(item);
      remaining.delete(index);
      if (job.length >= maxItems || buildBatchPayload(job).length > maxChars) break;
    }
    return job;
  };

  let completed = 0;
  let failureStreak = 0;
  let throttlePauses = 0;
  let lastCooldownAt = 0;
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

  const requestNativeBatch = async (
    texts: string[],
  ): Promise<{ texts: string[]; engineTag: string } | null> => {
    await waitForStartSlot();
    if (!isCurrentRun(reader, generation, doc)) throw new RunCancelledError();
    return raceWithTimeoutAndCancellation(
      translateTextBatch(texts, itemID, engine),
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

    // Prefer a native multi-segment request: one call for the whole job
    // instead of a marker prompt that the engine may translate away. If the
    // endpoint or a mirror answers with a shape the batch parser rejects,
    // fall back to the marker path instead of failing the job.
    try {
      const native = await requestNativeBatch(job.map((item) => item.text));
      if (native) {
        return job.map((item, index) => ({
          paragraphIndex: item.paragraphIndex,
          response: { text: native.texts[index], engineTag: native.engineTag },
        }));
      }
    } catch (error: any) {
      if (isCancellationError(error)) throw error;
      if (getThrottleCooldownMs(error) > 0) throw error;
      logError(error);
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
      setBlockState(liveBlock, "done", cached);
    }
    return true;
  };

  const worker = async () => {
    while (!aborted && isCurrentRun(reader, generation, doc)) {
      const scheduled = claimNextJob();
      if (!scheduled.length) return;
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
        setBlockState(
          block,
          "loading",
          getString("paragraph-translating-progress", {
            args: { done: completed, total: pendingIndexes.length },
          }),
        );
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
            setBlockState(liveBlock, "done", response.text);
          }
          completed += 1;
          setRunProgress(reader, generation, completed, pendingIndexes.length);
        }
        failureStreak = 0;
        throttlePauses = 0;
      } catch (error: any) {
        if (isCancellationError(error)) return;
        if (isDeadObjectError(error)) {
          aborted = true;
          cancelRun(reader);
          dispatchToggle(reader, "run-paused");
          return;
        }
        if (!isCurrentRun(reader, generation, doc)) return;

        // A rate-limit error is not a paragraph failure: requeue the job and
        // wait out the cooldown once, twice at most, so a throttling endpoint
        // pauses the run instead of painting every paragraph red.
        const cooldownMs = getThrottleCooldownMs(error);
        if (cooldownMs > 0 && throttlePauses < 3) {
          // Concurrent workers can hit the same throttle in the same second;
          // count it as one run-wide pause, not one per worker.
          const now = Date.now();
          if (now - lastCooldownAt > 1000) {
            throttlePauses += 1;
            lastCooldownAt = now;
          }
          const pauseMs = Math.min(cooldownMs, 60_000);
          for (const item of job) remaining.add(item.paragraphIndex);
          for (const item of job) {
            const liveBlock = paragraphs[item.paragraphIndex].block;
            if (liveBlock?.parentNode) {
              setBlockState(
                liveBlock,
                "paused",
                getString("paragraph-throttle-cooldown", {
                  args: { seconds: String(Math.max(1, Math.round(pauseMs / 1000))) },
                }),
              );
            }
          }
          try {
            await cancellableDelay(pauseMs, cancellation);
          } catch (cancelError: any) {
            if (isCancellationError(cancelError)) return;
          }
          continue;
        }

        failureStreak += 1;
        const failureDetail =
          cooldownMs > 0
            ? getString("paragraph-throttle-stopped", { args: { detail: String(error?.message || error) } })
            : getString("paragraph-translate-failed", {
                args: { detail: String(error?.message || error) },
              });
        for (const item of job) {
          const liveBlock = paragraphs[item.paragraphIndex].block;
          if (liveBlock?.parentNode) {
            setBlockState(liveBlock, "error", failureDetail);
          }
        }

        if (failureStreak >= maxErrors || cooldownMs > 0) {
          aborted = true;
          markUnfinishedPaused(
            doc,
            paragraphs,
            cooldownMs > 0 ? getString("paragraph-throttle-paused") : undefined,
          );
          cancelRun(reader);
          dispatchToggle(reader, "run-paused");
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

  await Promise.all(
    Array.from({ length: Math.min(concurrency, pendingIndexes.length) }, () => worker()),
  );

  finishRun(reader, generation);
}

async function prepareAndRun(reader: any): Promise<void> {
  const doc = await ensureReadingMode(reader);
  const root = getDocumentRoot(doc);
  if (!root) throw new Error(getString("error-reading-mode-page"));

  installStyles(doc);
  cancelRun(reader);

  applyDisplayMode(doc);
  ensureReaderInteractions(reader, doc);

  const itemID = Number(reader?.itemID || 0);
  const item = itemID ? Zotero.Items.get(itemID) : null;
  const itemKey = String(item?.key || reader?.itemKey || itemID || "reader");
  if (!itemID) throw new Error(getString("error-item-id-missing"));

  try {
    await (Zotero as any).SDT?.ensure?.(itemID, { isPriority: true });
  } catch (error) {
    logError(error as Error);
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

/**
 * Turn reading mode on and make the per-paragraph triggers live WITHOUT
 * starting a full-document run. After this, the shortcut, Alt-click
 * and the selection popup translate only the paragraph the user points at.
 * Deliberately does not dispatch a toggle event: an `empty` reader must keep
 * presenting the toolbar button as "translate the whole document".
 */
export async function enterParagraphTranslationMode(reader: any): Promise<void> {
  try {
    const doc = await ensureReadingMode(reader);
    if (!getDocumentRoot(doc)) throw new Error(getString("error-reading-mode-page"));
    // Only inject the styles so the Alt-hover outline is visible. Display modes
    // and the highlight-alignment observer are installed lazily by
    // prepareOnDemandReading() on the first real paragraph translation;
    // installing them early previously broke Zotero's native highlight layout.
    installStyles(doc);
    ensureReaderInteractions(reader, doc);
  } catch (error: any) {
    reportToggleError(reader, error);
  }
}

export async function toggleBilingualReading(reader: any): Promise<void> {
  try {
    const { effects } = dispatchToggle(reader, "toggle");
    if (effects.includes("start-run") || effects.includes("resume-run")) {
      await prepareAndRun(reader);
    }
  } catch (error: any) {
    reportToggleError(reader, error);
  }
}

export async function refreshBilingualReading(reader: any): Promise<void> {
  try {
    dispatchToggle(reader, "refresh");
    cancelRun(reader);
    const doc = await ensureReadingMode(reader);
    clearTranslations(doc);
    await Zotero.Promise.delay(30);
    await prepareAndRun(reader);
  } catch (error: any) {
    reportToggleError(reader, error);
  }
}

export function configureTranslation(reader: any): void {
  try {
    const preferencesWindow = Zotero.Utilities.Internal.openPreferences(PREFERENCES_PANE_ID);
    if (preferencesWindow) return;
  } catch (error) {
    logError(error as Error);
  }

  showError(reader, getString("settings-open-failed"));
}

function createToolbarButton(
  doc: Document,
  className: string,
  text: string,
  title: string,
): HTMLButtonElement {
  const button = doc.createElement("button");
  button.className = `toolbar-button ${className}`;
  button.type = "button";
  button.tabIndex = -1;
  button.title = title;
  button.setAttribute("aria-label", title);
  button.style.minWidth = "24px";
  button.style.paddingInline = "2px";
  button.style.display = "inline-flex";
  button.style.alignItems = "center";
  button.style.justifyContent = "center";
  if (text) {
    button.textContent = text;
    button.style.fontSize = "16px";
    button.style.lineHeight = "1";
    button.style.fontFamily = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  }
  return button;
}

function createInterlinearIcon(doc: Document): HTMLImageElement {
  // The reader document has a resource:// base URL, so chrome:// image URLs
  // never load. Embed the shipped icon as a data URI instead.
  const image = doc.createElement("img");
  image.src = INTERLINEAR_ICON_DATA_URL;
  image.alt = "";
  image.setAttribute("aria-hidden", "true");
  image.style.width = "16px";
  image.style.height = "16px";
  image.style.display = "block";
  image.style.pointerEvents = "none";
  return image;
}

function openBilingualToolbarMenu(
  reader: any,
  doc: Document,
  x: number,
  y: number,
): void {
  const running = isBilingualRunning(reader);
  const entries: ReaderMenuEntry[] = [
    {
      action: "paragraph-mode",
      label: getString("toolbar-menu-paragraph-mode"),
    },
    "separator",
    { action: "refresh", label: getString("toolbar-menu-refresh") },
    {
      action: "cancel",
      label: getString("toolbar-menu-cancel"),
      disabled: !running,
    },
    "separator",
    { action: "export", label: getString("toolbar-menu-export") },
    { action: "settings", label: getString("toolbar-menu-settings") },
  ];

  openReaderMenu(doc, {
    x,
    y,
    entries,
    onSelect: (action) => {
      if (action === "paragraph-mode") {
        void enterParagraphTranslationMode(reader);
      } else if (action === "refresh") {
        void refreshBilingualReading(reader);
      } else if (action === "cancel") {
        cancelBilingualReading(reader);
      } else if (action === "export") {
        void exportBilingualPDF(reader);
      } else if (action === "settings") {
        configureTranslation(reader);
      }
    },
  });
}

const autoTranslateAttempted = new WeakSet<object>();

async function showCachedTranslations(reader: any): Promise<void> {
  const doc = await ensureReadingMode(reader);
  const root = getDocumentRoot(doc);
  if (!root) return;
  installStyles(doc);
  applyDisplayMode(doc);
  ensureReaderInteractions(reader, doc);

  const itemID = Number(reader?.itemID || 0);
  if (!itemID) return;
  const item = Zotero.Items.get(itemID);
  const itemKey = String(item?.key || reader?.itemKey || itemID || "reader");
  const engineTag = getCacheEngineTag();
  const structure = getSDTStructure(reader);
  const paragraphs = collectParagraphs(doc, itemKey, engineTag, structure).filter(
    (paragraph) => Boolean(paragraph.translation),
  );
  if (!paragraphs.length) return;

  observeReadingLayout(getActiveSDTView(reader), doc);
  for (const paragraph of paragraphs) {
    const block = ensureTranslationBlock(doc, paragraph);
    if (block && paragraph.translation) {
      setBlockState(block, "done", paragraph.translation);
    }
  }
  if (getToggleState(reader) === "empty") {
    dispatchToggle(reader, "shortcut");
  }
  refreshReadingLayout(doc);
}

function maybeAutoTranslate(reader: any): void {
  const mode = getAutoTranslateOnOpen();
  if (mode === "off" || autoTranslateAttempted.has(reader)) return;
  autoTranslateAttempted.add(reader);
  if (getToggleState(reader) !== "empty") return;
  if (mode === "always") {
    void toggleBilingualReading(reader);
    return;
  }
  void showCachedTranslations(reader).catch((error) => logError(error as Error));
}

export function renderBilingualToolbarButtons(event: any): void {
  const { reader, doc, append } = event || {};
  if (!reader || reader.type !== "pdf" || !doc) return;

  watchReaderInteractions(reader);
  if (typeof append !== "function") return;

  registerToolbarHandlers(doc, TOOLBAR_BUTTON_CLASS, {
    onClick: () => void toggleBilingualReading(reader),
    onContextMenu: (contextEvent) =>
      openBilingualToolbarMenu(
        reader,
        doc,
        contextEvent.clientX,
        contextEvent.clientY,
      ),
  });
  registerToolbarHandlers(doc, REFRESH_BUTTON_CLASS, {
    onClick: () => void refreshBilingualReading(reader),
  });

  if (!doc.querySelector(`.${TOOLBAR_BUTTON_CLASS}`)) {
    const button = createToolbarButton(
      doc,
      TOOLBAR_BUTTON_CLASS,
      "",
      getString("toolbar-toggle-title"),
    );
    button.append(createInterlinearIcon(doc));
    append(button);
  }

  registerToolbarHandlers(doc, DISPLAY_BUTTON_CLASS, {
    onClick: () => cycleDisplayMode(reader, doc),
    onContextMenu: (contextEvent) =>
      openBilingualToolbarMenu(reader, doc, contextEvent.clientX, contextEvent.clientY),
  });

  if (!doc.querySelector(`.${DISPLAY_BUTTON_CLASS}`)) {
    append(createToolbarButton(doc, DISPLAY_BUTTON_CLASS, "◫", ""));
  }
  updateDisplayButtonState(reader, doc);

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
      ),
    );
  }

  updateToolbarProgress(reader);
}

function updateToolbarProgress(reader: any): void {
  let toolbarDoc: Document | undefined;
  try {
    toolbarDoc = getReaderFrameDocument(reader) as Document | undefined;
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
  const toggleState = getToggleState(reader);
  const visible = isTranslationVisible(toggleState);
  toggle.setAttribute("aria-pressed", String(visible));
  // A neutral translucent fill reads as "active" in both light and dark themes.
  toggle.style.background = visible ? "rgba(127, 127, 127, 0.28)" : "";
  toggle.style.borderRadius = visible ? "4px" : "";

  let title: string;
  if (running) {
    title = getString("toolbar-toggle-running-title", { args: { done, total } });
  } else if (toggleState === "hidden-paused") {
    title = getString("toolbar-toggle-resume-title");
  } else if (toggleState === "hidden") {
    title = getString("toolbar-toggle-show-title");
  } else if (toggleState === "shown" || toggleState === "shown-paused") {
    title = getString("toolbar-toggle-hide-title");
  } else {
    title = getString("toolbar-toggle-title");
  }
  toggle.title = title;
  toggle.setAttribute("aria-label", title);
}

export function cleanupBilingualReader(reader: any): void {
  cancelRun(reader);
  toggleStates.delete(reader);
  stopWatchingReaderInteractions(reader);

  const interactions = interactionControllers.get(reader);
  if (interactions) {
    interactionControllers.delete(reader);
    for (const entry of interactions) {
      try {
        entry.controller.dispose();
      } catch (error) {
        logError(error as Error);
      }
    }
  }

  for (const view of getSDTViews(reader)) {
    try {
      const doc = getSDTViewDocument(view);
      if (doc) clearTranslations(doc);
    } catch (_) {
      // A split view's iframe may already have been destroyed.
    }
  }

  let toolbarDoc: Document | undefined;
  try {
    toolbarDoc = getReaderFrameDocument(reader) as Document | undefined;
  } catch (_) {
    toolbarDoc = undefined;
  }

  closeReaderMenu(toolbarDoc);

  const buttons = toolbarDoc
    ? (Array.from(
        toolbarDoc.querySelectorAll(
          `.${TOOLBAR_BUTTON_CLASS}, .${DISPLAY_BUTTON_CLASS}, .${REFRESH_BUTTON_CLASS}, .${PROGRESS_CLASS}`,
        ),
      ) as HTMLElement[])
    : [];
  for (const button of buttons) {
    button.remove();
  }
}
