import { buildTranslationCSS } from "./appearance";
import { getAppearance, getTargetLanguage } from "./settings";
import { getString } from "./utils/locale";

const TRANSLATION_CLASS = "interlinear-translation";
const EXPORT_BUTTON_CLASS = "interlinear-export-button";
const PRINTER_EMOJI = "🖨️";

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

function getDialogWindow(reader: any): any {
  try {
    return reader?._iframeWindow || Zotero.getMainWindow();
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
  Zotero.logError(new Error(message));
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
  onClick: (button: HTMLButtonElement) => void,
): HTMLButtonElement {
  const button = doc.createElement("button");
  button.className = `toolbar-button ${className}`;
  button.type = "button";
  button.tabIndex = -1;
  button.textContent = emoji;
  button.title = title;
  button.setAttribute("aria-label", title);
  applyEmojiButtonStyle(button);

  button.addEventListener("click", (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick(button);
  });
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

function buildExportHTML(doc: Document, title: string): string {
  const sourceRoot = doc.querySelector("#sdt-content") as HTMLElement | null;
  if (!sourceRoot) throw new Error(getString("export-error-source"));

  const root = sourceRoot.cloneNode(true) as HTMLElement;
  const unfinishedBlocks = Array.from(
    root.querySelectorAll(`.${TRANSLATION_CLASS}:not([data-state="done"])`),
  ) as HTMLElement[];
  for (const block of unfinishedBlocks) block.remove();

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
  ${buildTranslationCSS(TRANSLATION_CLASS, getAppearance(), "print")}
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

  try {
    const loaded = await browser.load(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
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
  }
}

export async function exportBilingualPDF(reader: any): Promise<void> {
  const doc = getSDTDocument(reader);
  if (!doc?.querySelector("#sdt-content")) {
    showMessage(reader, getString("export-error-not-active"));
    return;
  }

  const { done, unfinished } = getTranslationStats(doc);
  if (!done) {
    showMessage(reader, getString("export-error-no-translations"));
    return;
  }

  if (
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
    const html = buildExportHTML(doc, attachmentTitle);
    await printHTMLToPDF(html, tempFile);
    importedAttachment = await importExportedPDF(tempFile, sourceAttachment);
  } catch (error: any) {
    Zotero.logError(error as Error);
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

  if (!doc.querySelector(`.${EXPORT_BUTTON_CLASS}`)) {
    append(
      createToolbarEmojiButton(
        doc,
        EXPORT_BUTTON_CLASS,
        PRINTER_EMOJI,
        getString("toolbar-export-title"),
        (button) => {
          if (button.disabled) return;
          button.disabled = true;
          void exportBilingualPDF(reader).finally(() => {
            button.disabled = false;
          });
        },
      ),
    );
  }
}

export function cleanupReaderUI(reader: any): void {
  let doc: Document | null = null;
  try {
    doc = reader?._iframeWindow?.document || null;
  } catch (_) {
    doc = null;
  }
  doc?.querySelector(`.${EXPORT_BUTTON_CLASS}`)?.remove();
}
