import { buildTranslationCSS } from "./appearance";
import { getAppearance, getDisplayMode, getTargetLanguage } from "./settings";
import { DISPLAY_MODES, type DisplayMode } from "./displayMode";
import {
  buildExportLayoutCSS,
  wrapExportPairs,
} from "./exportLayout";
import { getString } from "./utils/locale";
import { registerToolbarHandlers } from "./toolbarEvents";
import { logError } from "./utils/log";
import {
  getActiveSDTView,
  getInternalReader,
  getReaderFrameDocument,
  getReaderFrameWindow,
  getSDTDocuments,
  getSDTViewDocument,
  getSDTViewForDocument,
  preloadSourceCrops,
} from "./zoteroCompat";

const TRANSLATION_CLASS = "interlinear-translation";
const SOURCE_CLASS = "interlinear-source";
const EXPORT_BUTTON_CLASS = "interlinear-export-button";
const PRINTER_EMOJI = "🖨️";


function getSDTDocument(reader: any): Document | null {
  try {
    return getSDTViewDocument(getActiveSDTView(reader));
  } catch (_) {
    return null;
  }
}

/**
 * A split view keeps the source in one pane and the translations in the other.
 * Choosing the pane that actually holds finished translations lets any export
 * layout work, whichever pane happens to be focused.
 */
function pickExportDocument(reader: any, layout: DisplayMode): Document | null {
  const active = getSDTDocument(reader);
  if (layout === "source-only" || !active) return active;
  const documents: Document[] = [];
  try {
    for (const doc of getSDTDocuments(reader)) {
      if (doc?.querySelector("#sdt-content")) documents.push(doc);
    }
  } catch (_) {
    // A torn-down split pane list is not fatal.
  }
  if (!documents.length) return active;
  const withTranslations = documents.filter(
    (doc) =>
      doc.querySelectorAll(`.${TRANSLATION_CLASS}[data-state="done"]`).length > 0,
  );
  return withTranslations[0] || active;
}

function getDialogWindow(reader: any): any {
  try {
    return getReaderFrameWindow(reader) || Zotero.getMainWindow();
  } catch (_) {
    return Zotero.getMainWindow();
  }
}

function showMessage(reader: any, message: string): void {
  const win = getDialogWindow(reader);
  if (win?.alert) {
    win.alert(message);
    return;
  }
  logError(new Error(message));
}

function confirmMessage(reader: any, message: string): boolean {
  const win = getDialogWindow(reader);
  return win?.confirm ? Boolean(win.confirm(message)) : true;
}

function applyEmojiButtonStyle(button: HTMLButtonElement): void {
  button.style.minWidth = "24px";
  button.style.paddingInline = "2px";
  button.style.fontSize = "16px";
  button.style.lineHeight = "1";
  button.style.fontFamily = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
}

function createToolbarEmojiButton(
  doc: Document,
  className: string,
  emoji: string,
  title: string,
): HTMLButtonElement {
  const button = doc.createElement("button");
  button.className = `toolbar-button ${className}`;
  button.type = "button";
  button.tabIndex = -1;
  button.textContent = emoji;
  button.title = title;
  button.setAttribute("aria-label", title);
  applyEmojiButtonStyle(button);
  button.style.display = "inline-flex";
  button.style.alignItems = "center";
  button.style.justifyContent = "center";
  return button;
}

function sanitizeFileName(value: string): string {
  const chars = Array.from(value).map((character) => {
    const code = character.charCodeAt(0);
    if (code < 32 || '\\/:*?"<>|'.includes(character)) return "_";
    return character;
  });
  const cleaned = chars.join("").replace(/\s+/g, " ").trim();
  return (cleaned || getString("export-default-title")).slice(0, 120);
}

function escapeHTML(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getTranslationStats(doc: Document): { done: number; unfinished: number } {
  const blocks = Array.from(doc.querySelectorAll(`.${TRANSLATION_CLASS}`)) as HTMLElement[];
  let done = 0;
  let unfinished = 0;
  for (const block of blocks) {
    if (block.dataset.state === "done" && (block.textContent || "").trim()) done += 1;
    else unfinished += 1;
  }
  return { done, unfinished };
}

function buildExportHTML(
  doc: Document,
  title: string,
  layout: DisplayMode,
): string {
  const sourceRoot = doc.querySelector("#sdt-content") as HTMLElement | null;
  if (!sourceRoot) throw new Error(getString("export-error-source"));

  const root = sourceRoot.cloneNode(true) as HTMLElement;
  const unfinishedBlocks = Array.from(
    root.querySelectorAll(`.${TRANSLATION_CLASS}:not([data-state="done"])`),
  ) as HTMLElement[];
  for (const block of unfinishedBlocks) block.remove();

  if (layout === "source-only") {
    for (const block of Array.from(
      root.querySelectorAll(`.${TRANSLATION_CLASS}`),
    ) as HTMLElement[]) {
      block.remove();
    }
  } else if (layout === "target-only") {
    for (const source of Array.from(
      root.querySelectorAll(`.${SOURCE_CLASS}`),
    ) as HTMLElement[]) {
      // A translation-only export still needs the page crops: figures, tables
      // and formula images have no textual translation to stand in for them.
      if (
        source.matches("figure, table, pre, img, svg, canvas") ||
        Boolean(source.querySelector("figure, table, pre, img, svg, canvas"))
      ) {
        continue;
      }
      source.remove();
    }
  } else {
    wrapExportPairs(root, TRANSLATION_CLASS, SOURCE_CLASS);
  }
  root.dataset.exportLayout = layout;

  const removable = Array.from(
    root.querySelectorAll("script, button, input, textarea, select"),
  ) as HTMLElement[];
  for (const element of removable) element.remove();

  const baseURI = doc.baseURI || "about:blank";
  const safeTitle = escapeHTML(title || getString("export-default-title"));
  const safeBaseURI = escapeHTML(baseURI);

  return `<!doctype html>
<html lang="${escapeHTML(getTargetLanguage())}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base href="${safeBaseURI}">
<title>${safeTitle}</title>
<style>
  @page {
    size: A4;
    margin: 16mm 17mm 17mm;
  }
  html, body {
    background: #fff;
    color: #111;
  }
  body {
    margin: 0 auto;
    max-width: 176mm;
    font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial,
      "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    font-size: 10.5pt;
    line-height: 1.55;
  }
  #sdt-content {
    width: auto !important;
    max-width: none !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  p, li, blockquote {
    orphans: 3;
    widows: 3;
  }
  h1, h2, h3, h4, h5, h6 {
    break-after: avoid-page;
    page-break-after: avoid;
    line-height: 1.3;
  }
  figure, table, pre {
    break-inside: avoid-page;
    page-break-inside: avoid;
  }
  img, svg, canvas {
    max-width: 100% !important;
    height: auto !important;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9pt;
  }
  th, td {
    border: 0.5pt solid #bbb;
    padding: 3pt 4pt;
    vertical-align: top;
  }
  a {
    color: inherit;
    text-decoration: none;
  }
  ${(() => {
    const appearance = getAppearance();
    const mode = appearance.exportMode === "print" ? "print" : "reader";
    return buildTranslationCSS(TRANSLATION_CLASS, appearance, mode, {
      targetLanguage: getTargetLanguage(),
      colorScheme: appearance.theme === "dark" ? "dark" : "light",
    });
  })()}
  ${buildExportLayoutCSS(layout, TRANSLATION_CLASS, SOURCE_CLASS)}
  .${TRANSLATION_CLASS}[data-state="done"]::before {
    content: "";
  }
</style>
</head>
<body>
${root.outerHTML}
</body>
</html>`;
}

async function waitForGeneratedFile(file: any): Promise<void> {
  for (let i = 0; i < 300; i++) {
    try {
      if (file.exists() && file.fileSize > 0) return;
    } catch (_) {
      // The file may not exist until the print job finishes flushing.
    }
    await Zotero.Promise.delay(100);
  }
  throw new Error(getString("export-error-no-output"));
}

async function importExportedPDF(tempFile: any, sourceAttachment: any): Promise<any> {
  const parentItemID = Number(sourceAttachment?.parentItemID || 0);
  if (!parentItemID) {
    throw new Error(getString("export-error-no-parent"));
  }

  const parentItem = Zotero.Items.get(parentItemID);
  const parentTitle = String(
    parentItem?.getField?.("title") || getString("export-default-title"),
  ).trim();
  const attachment = await (Zotero.Attachments as any).importFromFile({
    file: tempFile,
    parentItemID,
  });
  attachment.setField(
    "title",
    getString("export-attachment-title", {
      args: { title: parentTitle || getString("export-default-item") },
    }),
  );
  await attachment.saveTx();
  return attachment;
}

function getHiddenBrowserConstructor(): any {
  const chromeUtils = (globalThis as any).ChromeUtils;
  if (!chromeUtils?.importESModule) {
    throw new Error(getString("export-error-hidden-browser"));
  }
  const module = chromeUtils.importESModule("chrome://zotero/content/HiddenBrowser.mjs");
  if (!module?.HiddenBrowser) {
    throw new Error(getString("export-error-hidden-browser-missing"));
  }
  return module.HiddenBrowser;
}

async function printHTMLToPDF(html: string, tempFile: any): Promise<void> {
  const mainWindow = Zotero.getMainWindow() as any;
  const printUtils = mainWindow?.PrintUtils;
  if (!printUtils?.getPrintSettings) {
    throw new Error(getString("export-error-print-settings"));
  }

  const HiddenBrowser = getHiddenBrowserConstructor();
  const browser = new HiddenBrowser({ useHiddenFrame: false });

  // A `data:` URL doubles the document size once percent-encoded, and papers
  // with many figure crops reach tens of megabytes. Load from a temp file
  // instead so printing only pays for the real bytes.
  const htmlFile = tempFile.parent.clone();
  htmlFile.append(`${tempFile.leafName}.html`);
  try {
    if (htmlFile.exists()) htmlFile.remove(false);
  } catch (_) {
    // A timestamped file should normally not exist.
  }

  try {
    await Zotero.File.putContentsAsync(htmlFile, html);
    const fileUrl = encodeURI(`file:///${String(htmlFile.path).replace(/\\/gu, "/")}`);
    const loaded = await browser.load(fileUrl);
    if (!loaded) throw new Error(getString("export-error-page-load"));

    try {
      await browser.waitForDocument({ allowInteractiveAfter: 1500 });
    } catch (_) {
      // The data document is usually ready after load(); continue to print if
      // the readiness actor is unavailable in an older Zotero 10 build.
    }

    const browsingContext = browser.browsingContext;
    if (!browsingContext?.print) {
      throw new Error(getString("export-error-print-context"));
    }

    const settings = printUtils.getPrintSettings("", false);
    // nsIPrintSettings no longer exposes a `printToFile` property. Assigning
    // that obsolete expando on an XPCOM WrappedNative throws on Zotero 10.
    // outputDestination=1 is the supported way to select file output.
    settings.outputDestination = 1;
    settings.outputFormat = 2;
    settings.toFileName = tempFile.path;
    settings.printSilent = true;
    settings.printInColor = true;
    settings.printBGColors = true;
    settings.printBGImages = true;
    settings.shrinkToFit = true;
    settings.headerStrLeft = "";
    settings.headerStrCenter = "";
    settings.headerStrRight = "";
    settings.footerStrLeft = "";
    settings.footerStrCenter = "";
    settings.footerStrRight = "";

    await browsingContext.print(settings);
    await waitForGeneratedFile(tempFile);
  } finally {
    try {
      browser.destroy();
    } catch (_) {
      // Best-effort cleanup only.
    }
    try {
      if (htmlFile.exists()) htmlFile.remove(false);
    } catch (_) {
      // Best-effort cleanup only.
    }
  }
}

function displayModeLabel(mode: DisplayMode): string {
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

function chooseExportLayout(reader: any): Promise<DisplayMode | null> {
  const doc = getReaderFrameDocument(reader) as Document | null;
  if (!doc) return Promise.resolve(getDisplayMode());

  return new Promise((resolve) => {
    const overlay = doc.createElement("div");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;" +
      "justify-content:center;background:rgba(0,0,0,0.35);";
    const card = doc.createElement("div");
    card.style.cssText =
      "min-width:240px;max-width:340px;padding:14px;border-radius:8px;" +
      "background:Canvas;color:CanvasText;box-shadow:0 10px 30px rgba(0,0,0,0.35);" +
      'font-family:system-ui,sans-serif;font-size:13px;';
    const title = doc.createElement("div");
    title.textContent = getString("export-layout-title");
    title.style.cssText = "font-weight:600;margin-bottom:8px;";
    card.append(title);

    const finish = (mode?: DisplayMode) => {
      overlay.remove();
      doc.removeEventListener("keydown", onKey, true);
      resolve(mode ?? null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish();
    };

    const current = getDisplayMode();
    for (const mode of DISPLAY_MODES) {
      const button = doc.createElement("button");
      button.type = "button";
      button.textContent =
        mode === current
          ? `✓ ${displayModeLabel(mode)}`
          : displayModeLabel(mode);
      button.style.cssText =
        "display:block;width:100%;margin:4px 0;padding:6px 8px;text-align:start;" +
        "border:1px solid rgba(127,127,127,0.45);border-radius:5px;" +
        "background:ButtonFace;color:ButtonText;cursor:pointer;";
      button.addEventListener("click", () => finish(mode));
      card.append(button);
    }

    const cancel = doc.createElement("button");
    cancel.type = "button";
    cancel.textContent = getString("export-layout-cancel");
    cancel.style.cssText =
      "display:block;width:100%;margin-top:8px;padding:5px 8px;" +
      "border:none;border-radius:5px;background:transparent;" +
      "color:inherit;opacity:0.75;cursor:pointer;";
    cancel.addEventListener("click", () => finish());
    card.append(cancel);

    overlay.append(card);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) finish();
    });
    doc.addEventListener("keydown", onKey, true);
    (doc.body || doc.documentElement)?.append(overlay);
  });
}

export async function exportBilingualPDF(reader: any): Promise<void> {
  let doc = getSDTDocument(reader);
  if (!doc?.querySelector("#sdt-content")) {
    showMessage(reader, getString("export-error-not-active"));
    return;
  }

  const layout = await chooseExportLayout(reader);
  if (!layout) return;

  doc = pickExportDocument(reader, layout) || doc;
  const { done, unfinished } = getTranslationStats(doc);
  if (layout !== "source-only" && !done) {
    showMessage(reader, getString("export-error-no-translations"));
    return;
  }

  if (
    layout !== "source-only" &&
    unfinished > 0 &&
    !confirmMessage(
      reader,
      getString("export-confirm-partial", {
        args: { done: String(done), unfinished: String(unfinished) },
      }),
    )
  ) {
    return;
  }

  if (!confirmMessage(reader, getString("export-confirm-continue"))) {
    return;
  }

  const itemID = Number(reader?.itemID || 0);
  const sourceAttachment = itemID ? Zotero.Items.get(itemID) : null;
  if (!sourceAttachment) {
    showMessage(reader, getString("export-error-no-attachment"));
    return;
  }

  const parentItemID = Number((sourceAttachment as any).parentItemID || 0);
  const parentItem = parentItemID ? Zotero.Items.get(parentItemID) : null;
  const parentTitle = String(
    parentItem?.getField?.("title") ||
      sourceAttachment.getField?.("title") ||
      getString("export-default-item"),
  );
  const attachmentTitle = getString("export-attachment-title", {
    args: { title: parentTitle },
  });
  const fileName = sanitizeFileName(`${attachmentTitle}.pdf`);
  const tempFile = Zotero.getTempDirectory();
  tempFile.append(`interlinear-${Date.now()}-${fileName}`);

  try {
    if (tempFile.exists()) tempFile.remove(false);
  } catch (_) {
    // A timestamped file should normally not exist.
  }

  let importedAttachment: any = null;
  try {
    // Lazy page crops must have their data URLs before we clone the document.
    await preloadSourceCrops(getSDTViewForDocument(reader, doc) || getActiveSDTView(reader), 8000);
    await Zotero.Promise.delay(50);
    const html = buildExportHTML(doc, attachmentTitle, layout);
    await printHTMLToPDF(html, tempFile);
    importedAttachment = await importExportedPDF(tempFile, sourceAttachment);
  } catch (error: any) {
    logError(error as Error);
    showMessage(
      reader,
      getString("export-error-failed", {
        args: { detail: String(error?.message || error) },
      }),
    );
    return;
  } finally {
    try {
      if (tempFile.exists()) tempFile.remove(false);
    } catch (_) {
      // The imported Zotero attachment has already copied the file.
    }
  }

  if (importedAttachment) {
    showMessage(reader, getString("export-success"));
  }
}

export function renderReaderExportButton(event: any): void {
  const { reader, doc, append } = event || {};
  if (!reader || reader.type !== "pdf" || !doc || typeof append !== "function") return;

  registerToolbarHandlers(doc, EXPORT_BUTTON_CLASS, {
    onClick: (_event, button) => {
      if (button.disabled) return;
      button.disabled = true;
      void exportBilingualPDF(reader).finally(() => {
        button.disabled = false;
      });
    },
  });

  if (!doc.querySelector(`.${EXPORT_BUTTON_CLASS}`)) {
    append(
      createToolbarEmojiButton(
        doc,
        EXPORT_BUTTON_CLASS,
        PRINTER_EMOJI,
        getString("toolbar-export-title"),
      ),
    );
  }
}

export function cleanupReaderUI(reader: any): void {
  let doc: Document | null = null;
  try {
    doc = getReaderFrameDocument(reader);
  } catch (_) {
    doc = null;
  }
  doc?.querySelector(`.${EXPORT_BUTTON_CLASS}`)?.remove();
}
