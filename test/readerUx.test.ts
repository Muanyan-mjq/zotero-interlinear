import { assert } from "chai";
import {
  cleanupBilingualReader,
  renderBilingualToolbarButtons,
  toggleBilingualReading,
} from "../src/bilingualReader";
import { buildExportLayoutCSS, wrapExportPairs } from "../src/exportLayout";
import { createReaderHighlighter } from "../src/readerHighlight";
import { cleanupAllReadingLayouts } from "../src/readingLayout";
import { createScrollSync } from "../src/readerScrollSync";
import { exportBilingualPDF } from "../src/readerUI";
import { attachReaderInteractions } from "../src/readerInteractions";
import { renderTranslationFragment } from "../src/translationFormat";
import { getSDTDocuments } from "../src/zoteroCompat";

/**
 * Real-runtime probes for the reader UX batch. They run inside Zotero against a
 * real Gecko DOM so they catch wiring problems the pure Node tests cannot:
 * `CSS.highlights` ranges, live layout for scroll sync, and pair wrapping.
 */

function mainWindow(): any {
  return Zotero.getMainWindow() as any;
}

/** Restore a pref exactly: an unset key must be cleared, not set to "". */
function restorePref(key: string, value: unknown): void {
  if (value === undefined) Zotero.Prefs.clear(key, true);
  else Zotero.Prefs.set(key, value as any, true);
}

/** Text currently covered by the plugin's native highlight registry. */
function highlightText(win: any): string {
  try {
    const highlight = win?.CSS?.highlights?.get?.("interlinear-sync");
    if (!highlight) return "";
    const parts: string[] = [];
    for (const range of Array.from(highlight as any) as any[]) {
      parts.push(String(range?.toString?.() ?? ""));
    }
    return parts.join("");
  } catch (_) {
    return "";
  }
}

interface Frame {
  frame: any;
  doc: Document;
  win: any;
  close: () => void;
}

async function dumpProbe(name: string, error: any): Promise<void> {
  const payload = [
    `name: ${error?.name}`,
    `message: ${error?.message}`,
    `expected: ${String(error?.expected)}`,
    `actual: ${String(error?.actual)}`,
    `stack: ${String(error?.stack)}`,
  ].join("\n");
  const paths = [
    `C:\\Users\\darli\\AppData\\Local\\Temp\\interlinear-probe-${name}.txt`,
    `D:\\DeepLearning_Code\\project\\zotero-interlinear\\.scaffold\\interlinear-probe-${name}.txt`,
  ];
  for (const path of paths) {
    try {
      await IOUtils.write(
        path,
        new TextEncoder().encode(payload),
      );
      return;
    } catch (_) {
      // Try the next location.
    }
  }
}

async function makeFrame(): Promise<Frame> {
  try {
    return await buildFrame();
  } catch (error) {
    await dumpProbe("frame", error);
    throw error;
  }
}

async function buildFrame(): Promise<Frame> {
  const win = mainWindow();
  const frame = win.document.createElementNS(
    "http://www.w3.org/1999/xhtml",
    "iframe",
  ) as any;
  frame.setAttribute("width", "520");
  frame.setAttribute("height", "360");
  frame.style.cssText =
    "position:fixed;left:0;top:0;width:520px;height:360px;border:0;opacity:0.02;pointer-events:none;";
  const host = win.document.body || win.document.documentElement;
  if (!host) throw new Error("main window has no host element");
  host.append(frame);
  await Zotero.Promise.delay(60);

  let doc = frame.contentDocument as Document | null;
  if (!doc) throw new Error("iframe has no contentDocument");
  doc.open();
  doc.write(
    "<!doctype html><html><head><meta charset='utf-8'></head><body></body></html>",
  );
  doc.close();
  await Zotero.Promise.delay(100);
  doc = frame.contentDocument as Document | null;
  if (!doc || !frame.contentWindow) throw new Error("iframe document did not load");
  return { frame, doc, win: frame.contentWindow, close: () => frame.remove() };
}

function makeSourceAndBlock(
  doc: Document,
  refPath: string,
  sourceText: string,
  translationText: string,
): { source: HTMLElement; block: HTMLElement } {
  const source = doc.createElement("p");
  source.dataset.refPath = refPath;
  source.textContent = sourceText;
  const block = doc.createElement("div");
  block.className = "interlinear-translation";
  block.dataset.sourceRefPath = refPath;
  block.dataset.state = "done";
  block.textContent = translationText;
  return { source, block };
}

async function probeHighlight(): Promise<void> {
  const { doc, win, close } = await makeFrame();
  try {
    const content = doc.createElement("div");
    content.id = "sdt-content";
    const { source, block } = makeSourceAndBlock(
      doc,
      "0",
      "Alpha beta. Gamma delta. Epsilon zeta.",
      "阿尔法贝塔。伽马德尔塔。艾普西隆泽塔。",
    );
    content.append(source, block);
    doc.body.append(content);

    if (!win.CSS || !win.CSS.highlights) {
      throw new Error("CSS.highlights is unavailable in this window");
    }

    const highlighter = createReaderHighlighter();
    highlighter.register(doc);

    highlighter.showFromSource(source);
    if (!win.CSS.highlights.has("interlinear-sync")) {
      throw new Error("hover did not register a CSS highlight");
    }
    const all = Array.from(
      win.CSS.highlights.get("interlinear-sync") as any,
    ) as Range[];
    if (all.length !== 1) throw new Error(`hover ranges: ${all.length}`);
    if (all[0].toString() !== "阿尔法贝塔。伽马德尔塔。艾普西隆泽塔。") {
      throw new Error(`hover range text: ${all[0].toString()}`);
    }
    if ((block as any).dataset.interlinearSync) {
      throw new Error("API path fell back to the block tint");
    }

    const start = String(source.textContent).indexOf("Gamma");
    highlighter.showFromSource(source, { start, end: start + 5 });
    const ranges = Array.from(
      win.CSS.highlights.get("interlinear-sync") as any,
    ) as Range[];
    if (ranges.length !== 1) throw new Error(`selection ranges: ${ranges.length}`);
    const selected = ranges[0].toString();
    if (!selected.includes("伽马")) {
      throw new Error(`a word selection must reach the matching clause, got "${selected}"`);
    }
    if (selected.length >= "伽马德尔塔。".length + 4) {
      throw new Error(`a word selection must stay a sub-range, got "${selected}"`);
    }

    const extra = source
      .getAttributeNames()
      .filter((name) => name !== "data-ref-path");
    if (extra.length) throw new Error(`source gained attributes: ${extra.join(",")}`);

    highlighter.clear();
    if (win.CSS.highlights.has("interlinear-sync")) {
      throw new Error("highlight was not cleared");
    }
    highlighter.dispose();
  } finally {
    close();
  }
}

async function probeScrollSync(): Promise<void> {
  const first = await makeFrame();
  const second = await makeFrame();
  try {
    for (const { doc } of [first, second]) {
      const content = doc.createElement("div");
      content.id = "sdt-content";
      for (let index = 0; index < 8; index += 1) {
        const paragraph = doc.createElement("p");
        paragraph.dataset.refPath = String(index);
        paragraph.textContent = `Paragraph ${index} ${"word ".repeat(12)}`;
        paragraph.style.height = "400px";
        paragraph.style.margin = "0";
        content.append(paragraph);
      }
      doc.body.append(content);
      doc.body.style.margin = "0";
    }
    await Zotero.Promise.delay(150);

    // A chrome-hosted iframe is laid out but never painted, so Gecko neither
    // dispatches scroll events nor runs rAF inside it. Shim both so the real
    // listener -> measure -> write chain can still be exercised.
    for (const frame of [first, second]) {
      const view = frame.win;
      view.requestAnimationFrame = (callback: any) =>
        view.setTimeout(() => callback(0), 16);
      view.cancelAnimationFrame = (handle: any) => view.clearTimeout(handle);
    }
    const fireScroll = (doc: Document): void => {
      const EventCtor = (doc.defaultView as any).Event;
      doc.dispatchEvent(new EventCtor("scroll", { bubbles: true }));
    };

    const sync = createScrollSync([first.doc, second.doc]);
    sync.start();
    try {
      first.doc.defaultView.scrollTo(0, 700);
      await Zotero.Promise.delay(40);
      fireScroll(first.doc);
      await Zotero.Promise.delay(140);
      const forward = Number(second.doc.defaultView.scrollY);
      if (Math.abs(forward - 700) > 6) {
        throw new Error(`forward sync landed at ${forward}, expected ~700`);
      }

      second.doc.defaultView.scrollTo(0, 300);
      await Zotero.Promise.delay(40);
      fireScroll(second.doc);
      await Zotero.Promise.delay(140);
      const backward = Number(first.doc.defaultView.scrollY);
      if (Math.abs(backward - 300) > 6) {
        throw new Error(`backward sync landed at ${backward}, expected ~300`);
      }
    } finally {
      sync.dispose();
    }

    first.doc.defaultView.scrollTo(0, 0);
    await Zotero.Promise.delay(40);
    fireScroll(first.doc);
    await Zotero.Promise.delay(140);
    const afterDispose = Number(second.doc.defaultView.scrollY);
    if (Math.abs(afterDispose - 300) > 6) {
      throw new Error(`disposed sync still moved the peer to ${afterDispose}`);
    }
  } finally {
    first.close();
    second.close();
  }
}

function topVisibleRef(doc: Document): string | null {
  const nodes = Array.from(
    doc.querySelectorAll(
      "#sdt-content [data-ref-path], #sdt-content .interlinear-translation",
    ),
  );
  for (const node of nodes) {
    const element = node as HTMLElement;
    const rect = element.getBoundingClientRect();
    if (rect.height <= 0) continue;
    if (rect.bottom <= 0) continue;
    const refPath = element.dataset.refPath || element.dataset.sourceRefPath;
    if (refPath) return refPath;
  }
  return null;
}

async function probeDualView(): Promise<void> {
  const first = await makeFrame();
  const second = await makeFrame();
  const enginePref = "extensions.zotero.interlinear.engine";
  const sourcePref = "extensions.zotero.interlinear.language.source";
  const targetPref = "extensions.zotero.interlinear.language.target";
  const previousEngine = Zotero.Prefs.get(enginePref, true);
  const previousSource = Zotero.Prefs.get(sourcePref, true);
  const previousTarget = Zotero.Prefs.get(targetPref, true);
  const previousRequest = (Zotero.HTTP as any).request;
  let reader: any = null;
  try {
    for (const { doc } of [first, second]) {
      const content = doc.createElement("div");
      content.id = "sdt-content";
      for (let index = 0; index < 6; index += 1) {
        const paragraph = doc.createElement("p");
        paragraph.dataset.refPath = String(index);
        paragraph.textContent = `Paragraph ${index} original text for dual view.`;
        paragraph.style.height = "400px";
        paragraph.style.margin = "0";
        content.append(paragraph);
      }
      doc.body.append(content);
      doc.body.style.margin = "0";
    }

    const toolbarDoc =
      mainWindow().document.implementation.createHTMLDocument("toolbar");
    const internal: any = {
      _lastViewPrimary: true,
      _state: { splitType: null },
      _primarySDTView: {
        _iframeDocument: first.doc,
        getData: () => ({ structure: null }),
      },
      _secondaryView: null,
      _secondarySDTView: null,
      toggleVerticalSplit(enable: boolean) {
        if (enable) {
          internal._state.splitType = "vertical";
          internal._secondaryView = { secondary: true };
          internal._secondarySDTView = {
            _iframeDocument: second.doc,
            getData: () => ({ structure: null }),
          };
        } else {
          internal._state.splitType = null;
          internal._secondaryView = null;
          internal._secondarySDTView = null;
        }
      },
      async _setReadingMode() {
        return true;
      },
      focusView() {
        // No-op: the harness has no real split chrome to focus.
      },
    };
    reader = {
      type: "pdf",
      itemID: 2147483699,
      _iframeWindow: { document: toolbarDoc, alert: () => undefined },
      _internalReader: internal,
    };

    Zotero.Prefs.set(enginePref, "google", true);
    Zotero.Prefs.set(sourcePref, "en", true);
    Zotero.Prefs.set(targetPref, "zh-CN", true);
    // Long enough that the target pane can scroll on its own.
    const longTranslation = "这是一段用于验证双视图同步的较长译文。".repeat(30);
    let requests = 0;
    (Zotero.HTTP as any).request = async (
      _method: string,
      _url: string,
      options: any,
    ) => {
      requests += 1;
      const body = String(options?.body || "");
      const segments = new URLSearchParams(body).getAll("q");
      // `translate_a/t` answers one string per `q`, in order.
      const response = Array.from({ length: Math.max(1, segments.length) }, () => longTranslation);
      return { status: 200, response: JSON.stringify(response) };
    };

    await toggleBilingualReading(reader);
    const firstDone = first.doc.querySelectorAll(
      '.interlinear-translation[data-state="done"]',
    ).length;
    if (firstDone < 6) {
      const blocks = Array.from(
        first.doc.querySelectorAll(".interlinear-translation"),
      ).map((block) => (block as HTMLElement).dataset.state);
      throw new Error(
        `primary pane translated ${firstDone}/6 blocks; blocks=${JSON.stringify(
          blocks,
        )} requests=${requests} scope=${String(
          Zotero.Prefs.get("extensions.zotero.interlinear.scope", true),
        )} hidden=${(first.doc.querySelector("#sdt-content") as HTMLElement).dataset.interlinearHidden}`,
      );
    }

    renderBilingualToolbarButtons({
      reader,
      doc: toolbarDoc,
      append: (element: any) => toolbarDoc.body.append(element),
    });
    const button = toolbarDoc.querySelector(
      ".interlinear-split-button",
    ) as HTMLButtonElement | null;
    if (!button) throw new Error("split button was not rendered");
    button.click();
    await Zotero.Promise.delay(600);

    const firstContent = first.doc.querySelector("#sdt-content") as HTMLElement;
    const secondContent = second.doc.querySelector("#sdt-content") as HTMLElement;
    const state = {
      a: firstContent?.dataset.interlinearDisplay,
      aLock: firstContent?.dataset.interlinearDisplayLock,
      b: secondContent?.dataset.interlinearDisplay,
      bLock: secondContent?.dataset.interlinearDisplayLock,
      pressed: button.getAttribute("aria-pressed"),
      secondDone: second.doc.querySelectorAll(
        '.interlinear-translation[data-state="done"]',
      ).length,
      firstDoneNow: first.doc.querySelectorAll(
        '.interlinear-translation[data-state="done"]',
      ).length,
    };
    if (state.a !== "source-only" || state.aLock !== "source-only") {
      throw new Error(`primary pane layout wrong: ${JSON.stringify(state)}`);
    }
    if (state.b !== "target-only" || state.bLock !== "target-only") {
      throw new Error(`secondary pane layout wrong: ${JSON.stringify(state)}`);
    }
    if (state.secondDone < 6 || state.secondDone !== state.firstDoneNow) {
      throw new Error(`mirroring failed: ${JSON.stringify(state)}`);
    }
    if (state.pressed !== "true") {
      throw new Error(`split button state wrong: ${JSON.stringify(state)}`);
    }

    for (const frame of [first, second]) {
      const view = frame.win;
      view.requestAnimationFrame = (callback: any) =>
        view.setTimeout(() => callback(0), 16);
      view.cancelAnimationFrame = (handle: any) => view.clearTimeout(handle);
    }
    first.doc.defaultView.scrollTo(0, 900);
    await Zotero.Promise.delay(40);
    first.doc.dispatchEvent(
      new (first.doc.defaultView as any).Event("scroll", { bubbles: true }),
    );
    await Zotero.Promise.delay(160);
    const peerTop = topVisibleRef(second.doc);
    if (peerTop !== "2") {
      throw new Error(
        `sync put paragraph ${peerTop} on top (scrollY=${second.doc.defaultView.scrollY})`,
      );
    }

    button.click();
    await Zotero.Promise.delay(500);
    const after = {
      aLock: firstContent?.dataset.interlinearDisplayLock,
      pressed: button.getAttribute("aria-pressed"),
      splitType: internal._state.splitType,
    };
    if (after.aLock || after.pressed !== "false" || after.splitType) {
      throw new Error(`dual view did not close cleanly: ${JSON.stringify(after)}`);
    }
  } finally {
    if (reader) cleanupBilingualReader(reader);
    (Zotero.HTTP as any).request = previousRequest;
    restorePref(enginePref, previousEngine);
    restorePref(sourcePref, previousSource);
    restorePref(targetPref, previousTarget);
    first.close();
    second.close();
  }
}

async function probeExport(): Promise<void> {
  const doc =
    mainWindow().document.implementation.createHTMLDocument("export-source");
  const content = doc.createElement("div");
  content.id = "sdt-content";
  for (let index = 0; index < 3; index += 1) {
    const source = doc.createElement("p");
    source.dataset.refPath = String(index);
    source.textContent = `Export paragraph ${index}.`;
    const block = doc.createElement("div");
    block.className = "interlinear-translation";
    block.dataset.sourceRefPath = String(index);
    block.dataset.state = index === 2 ? "running" : "done";
    block.textContent = `导出段落 ${index}。`;
    content.append(source, block);
  }
  doc.body.append(content);

  const parent = new (Zotero.Item as any)("journalArticle");
  parent.setField("title", `Export probe ${Date.now()}`);
  await parent.saveTx();

  const sourceFile = Zotero.getTempDirectory();
  sourceFile.append(`interlinear-probe-source-${Date.now()}.pdf`);
  const minimalPdf = [
    "%PDF-1.4",
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 300]>>endobj",
    "trailer",
    "<<>>",
    "startxref",
    "0",
    "%%EOF",
    "",
  ].join("\n");
  await Zotero.File.putContentsAsync(sourceFile.path, minimalPdf);
  const attachment = await (Zotero.Attachments as any).importFromFile({
    file: sourceFile.path,
    parentItemID: parent.id,
  });

  const toolbarDoc = mainWindow().document.implementation.createHTMLDocument(
    "export-toolbar",
  );
  const messages: string[] = [];
  const reader: any = {
    type: "pdf",
    itemID: attachment.id,
    _iframeWindow: {
      document: toolbarDoc,
      alert: (message: string) => messages.push(message),
      confirm: () => true,
    },
    _internalReader: {
      _lastViewPrimary: true,
      _primarySDTView: {
        _iframeDocument: doc,
        getData: () => ({ structure: null }),
      },
    },
  };

  const before = parent.getAttachments().length;
  const run = exportBilingualPDF(reader);
  await Zotero.Promise.delay(120);
  const overlay = toolbarDoc.body.lastElementChild as HTMLElement | null;
  const buttons = overlay?.querySelectorAll("button") || [];
  if (!buttons.length) {
    throw new Error(`export dialog did not render (messages=${messages.join("|")})`);
  }
  // DISPLAY_MODES order: top-bottom first — the stacked pairs layout.
  (buttons[0] as HTMLButtonElement).click();
  await run;

  if (messages.some((message) => String(message).includes("error"))) {
    throw new Error(`export reported: ${messages.join(" | ")}`);
  }
  if (!messages.some((message) => String(message).includes("success"))) {
    throw new Error(`export did not confirm success: ${messages.join(" | ")}`);
  }

  const afterIds: number[] = parent.getAttachments();
  if (afterIds.length !== before + 1) {
    throw new Error(
      `expected one new attachment, got ${afterIds.length - before}`,
    );
  }
  const exportedId = afterIds.find((id) => id !== attachment.id);
  const exported = exportedId ? Zotero.Items.get(exportedId) : null;
  const exportedPath = String(exported?.getFilePath?.() || "");
  if (!exportedPath.toLowerCase().endsWith(".pdf")) {
    throw new Error(
      `exported file is not a PDF: [${exportedPath}] ids=${JSON.stringify(afterIds)}`,
    );
  }
  const bytes = await Zotero.File.getContentsAsync(exportedPath);
  if (!String(bytes).startsWith("%PDF")) {
    throw new Error("exported file is not a real PDF document");
  }
}

async function probeMasking(): Promise<void> {
  const { doc, close } = await makeFrame();
  const enginePref = "extensions.zotero.interlinear.engine";
  const sourcePref = "extensions.zotero.interlinear.language.source";
  const targetPref = "extensions.zotero.interlinear.language.target";
  const previousEngine = Zotero.Prefs.get(enginePref, true);
  const previousSource = Zotero.Prefs.get(sourcePref, true);
  const previousTarget = Zotero.Prefs.get(targetPref, true);
  const previousRequest = (Zotero.HTTP as any).request;
  let reader: any = null;
  try {
    const content = doc.createElement("div");
    content.id = "sdt-content";
    const paragraph = doc.createElement("p");
    paragraph.dataset.refPath = "0";
    paragraph.textContent =
      "The equation $E=mc^2$ and the command `npm test` must survive.";
    content.append(paragraph);
    doc.body.append(content);

    const toolbarDoc =
      mainWindow().document.implementation.createHTMLDocument("mask-toolbar");
    reader = {
      type: "pdf",
      itemID: 2147483701,
      _iframeWindow: {
        document: toolbarDoc,
        alert: () => undefined,
      },
      _internalReader: {
        _lastViewPrimary: true,
        _primarySDTView: {
          _iframeDocument: doc,
          getData: () => ({ structure: null }),
        },
      },
    };

    Zotero.Prefs.set(enginePref, "google", true);
    Zotero.Prefs.set(sourcePref, "en", true);
    Zotero.Prefs.set(targetPref, "zh-CN", true);
    const bodies: string[] = [];
    (Zotero.HTTP as any).request = async (
      _method: string,
      _url: string,
      options: any,
    ) => {
      const body = String(options?.body || "");
      bodies.push(body);
      const segments = new URLSearchParams(body).getAll("q");
      const translations = segments.map((segment) => {
        const tokens = segment.match(/⟦[^⟧]+⟧/gu) || [];
        return `译文 ${tokens.join(" 与 ")} 完成。`;
      });
      return { status: 200, response: JSON.stringify(translations) };
    };

    await toggleBilingualReading(reader);
    const block = doc.querySelector(
      '.interlinear-translation[data-state="done"]',
    ) as HTMLElement | null;
    if (!block) throw new Error("no translated block was rendered");

    const sent = bodies.map((body) => decodeURIComponent(body)).join("\n");
    if (sent.includes("$E=mc^2$")) {
      throw new Error("the formula was sent unmasked to the translator");
    }
    if (sent.includes("`npm test`")) {
      throw new Error("inline code was sent unmasked to the translator");
    }
    if (!sent.includes("⟦IL0⟧")) {
      throw new Error(`the formula token never reached the request: ${sent}`);
    }

    const math = block.querySelector(".interlinear-math") as HTMLElement | null;
    const code = block.querySelector("code") as HTMLElement | null;
    if (!math || !String(math.textContent).includes("E=mc^2")) {
      throw new Error(`formula was not restored: ${block.textContent}`);
    }
    if (!code || String(code.textContent).trim() !== "npm test") {
      throw new Error(`code was not restored: ${block.outerHTML}`);
    }
    if (String(block.textContent).includes("⟦")) {
      throw new Error(`token leaked into the reader: ${block.textContent}`);
    }
  } finally {
    if (reader) cleanupBilingualReader(reader);
    (Zotero.HTTP as any).request = previousRequest;
    restorePref(enginePref, previousEngine);
    restorePref(sourcePref, previousSource);
    restorePref(targetPref, previousTarget);
    close();
  }
}

/** Minimal single-page PDF so real split-view does not need a fixture library. */
function splitFixturePDF(): string {  const stream = "BT /F1 12 Tf 50 700 Td (Real split view fixture.) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += "xref\n0 6\n0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  return `${pdf}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
}

/**
 * The stub probe proves our split wiring, but it replaces Zotero's own
 * `toggleVerticalSplit`. This probe drives a real reader, a real toolbar
 * button and Zotero's real split + per-pane reading mode.
 */
async function probeRealSplit(): Promise<void> {
  const enginePref = "extensions.zotero.interlinear.engine";
  const sourcePref = "extensions.zotero.interlinear.language.source";
  const targetPref = "extensions.zotero.interlinear.language.target";
  const previousEngine = Zotero.Prefs.get(enginePref, true);
  const previousSource = Zotero.Prefs.get(sourcePref, true);
  const previousTarget = Zotero.Prefs.get(targetPref, true);
  const previousRequest = (Zotero.HTTP as any).request;
  const pdfFile = Zotero.getTempDirectory();
  pdfFile.append(`interlinear-real-split-${Date.now()}.pdf`);
  await Zotero.File.putContentsAsync(pdfFile, splitFixturePDF());
  let attachment: any = null;
  let reader: any = null;
  try {
    attachment = await (Zotero.Attachments as any).importFromFile({ file: pdfFile });
    reader = await (Zotero.Reader as any).open(attachment.id);
    await reader._initPromise;
    const internal = reader._internalReader;
    await internal._primaryView.initializedPromise;

    const structure = {
      metadata: { processor: { type: "pdf" }, languages: ["en"] },
      catalog: { outline: [], pages: [] },
      content: [
        { type: "paragraph", content: [{ text: "First paragraph of the split fixture." }] },
        { type: "paragraph", content: [{ text: "Second paragraph of the split fixture." }] },
      ],
    };
    internal._sdt = Components.utils.cloneInto(
      {
        structure,
        mapper: {
          sourceToSDTPosition: () =>
            Components.utils.cloneInto({ start: [1, 0, 0], end: [1, 20] }, reader._iframeWindow),
          sdtToSourcePosition: () =>
            Components.utils.cloneInto({ pageIndex: 0, rects: [[50, 690, 180, 705]] }, reader._iframeWindow),
        },
      },
      reader._iframeWindow,
      { cloneFunctions: true },
    );
    await internal._setReadingMode(true, true);
    const primary = internal._primarySDTView;
    await primary.initializedPromise;

    Zotero.Prefs.set(enginePref, "google", true);
    Zotero.Prefs.set(sourcePref, "en", true);
    Zotero.Prefs.set(targetPref, "zh-CN", true);
    (Zotero.HTTP as any).request = async (_method: string, url: string, options: any) => {
      const body = String(options?.body || "");
      const segments = body
        ? new URLSearchParams(body).getAll("q")
        : new URL(url).searchParams.getAll("q");
      const count = Math.max(1, segments.length);
      const translation = "第一部分内容。第二部分内容。第三部分内容。";
      return { status: 200, response: JSON.stringify(Array.from({ length: count }, () => translation)) };
    };

    // Hover the untouched, single-pane reader first: this exercises the
    // production interaction wiring (toolbar render -> attach -> highlight).
    await toggleBilingualReading(reader);
    const primaryDoc: Document = primary._iframeDocument;
    const translatedDeadline = Date.now() + 8000;
    while (Date.now() < translatedDeadline) {
      if (primaryDoc.querySelectorAll('.interlinear-translation[data-state="done"]').length >= 2) break;
      await Zotero.Promise.delay(100);
    }
    const sourceBlock = primaryDoc.querySelector('[data-ref-path="0"]') as HTMLElement | null;
    if (!sourceBlock) throw new Error("the real SDT document has no source paragraph");
    const block = primaryDoc.querySelector(
      '.interlinear-translation[data-source-ref-path="0"]',
    ) as HTMLElement | null;
    if (!block) throw new Error("the real SDT document has no translation for paragraph 0");
    const primaryWindow: any = primaryDoc.defaultView;
    const fullTranslation = String(block.textContent || "").replace(/\s+/gu, "");

    // The interaction layer listens on `mousemove` (capture) and resolves the
    // source block from `event.target`, so drive the real event, not mouseover.
    const move = (element: HTMLElement) =>
      element.dispatchEvent(
        new primaryWindow.MouseEvent("mousemove", {
          bubbles: true,
          cancelable: true,
          clientX: 10,
          clientY: 10,
        }),
      );

    move(sourceBlock);
    await Zotero.Promise.delay(200);
    if (!primaryWindow.CSS?.highlights?.has?.("interlinear-sync")) {
      throw new Error("hovering a real paragraph did not paint a native highlight");
    }
    const hoverText = highlightText(primaryWindow).replace(/\s+/gu, "");
    if (hoverText !== fullTranslation) {
      throw new Error(`hover on the source must tint the whole translation, got "${hoverText}"`);
    }

    // Selecting a prefix of the source must tint only the matching part.
    const selection: any = primaryWindow.getSelection();
    selection.removeAllRanges();
    // An unfocused iframe drops a programmatic selection, so focus the pane
    // first; the selection then behaves like a real mouse drag.
    try {
      (reader as any)._iframeWindow?.focus?.();
      primaryWindow.focus?.();
      primaryDoc.body?.focus?.();
    } catch (_) {
      // Detached frames cannot take focus.
    }
    const textNode = sourceBlock.firstChild as Text;
    const range = primaryDoc.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, Math.min(8, textNode.length));
    selection.addRange(range);
    if (selection.isCollapsed) selection.addRange(range);
    primaryDoc.dispatchEvent(new primaryWindow.Event("selectionchange"));
    await Zotero.Promise.delay(250);

    if (selection.isCollapsed) {
      // A background reader iframe drops programmatic selections in this host.
      // probeSelectionSync covers the same code path with an injected selection.
      await dumpProbe(
        "selection-collapsed",
        new Error("the reader iframe dropped the synthetic selection"),
      );
    }
    const selectionText = highlightText(primaryWindow).replace(/\s+/gu, "");
    if (!selection.isCollapsed) {
      if (!selectionText) {
        throw new Error(
          [
            "selecting source text painted nothing",
            `selected="${selection.toString()}"`,
            `blocks=${primaryDoc.querySelectorAll(".interlinear-translation[data-source-ref-path]").length}`,
            `display=${String(primaryDoc.querySelector("#sdt-content")?.getAttribute("data-interlinear-display"))}`,
            `hasHighlight=${String(primaryWindow.CSS?.highlights?.has?.("interlinear-sync"))}`,
          ].join(" | "),
        );
      }
      if (selectionText.length >= fullTranslation.length) {
        throw new Error(
          `a partial selection must map to a partial tint, got the whole translation "${selectionText}"`,
        );
      }
    }

    selection.removeAllRanges();
    primaryDoc.dispatchEvent(new primaryWindow.Event("selectionchange"));
    await Zotero.Promise.delay(150);

    // Hovering the translation must tint the source paragraph back.
    move(block);
    await Zotero.Promise.delay(250);
    const reverseText = highlightText(primaryWindow).replace(/\s+/gu, "");
    const sourceText = String(sourceBlock.textContent || "").replace(/\s+/gu, "");
    if (!reverseText) throw new Error("hovering the translation painted nothing on the source");
    if (reverseText !== sourceText) {
      throw new Error(`reverse hover must tint the source paragraph, got "${reverseText}"`);
    }

    const toolbarDoc: Document = reader._iframeWindow.document;
    let button: HTMLElement | null = null;
    const buttonDeadline = Date.now() + 8000;
    while (Date.now() < buttonDeadline) {
      button = toolbarDoc.querySelector(".interlinear-split-button") as HTMLElement | null;
      if (button) break;
      await Zotero.Promise.delay(100);
    }
    if (!button) throw new Error("the split button never rendered in the real reader toolbar");

    button.click();
    const splitDeadline = Date.now() + 25000;
    let secondary: Document | null = null;
    while (Date.now() < splitDeadline) {
      const docs = getSDTDocuments(reader);
      const candidate = docs[1] as Document | undefined;
      if (candidate?.querySelector("#sdt-content")) {
        secondary = candidate;
        break;
      }
      await Zotero.Promise.delay(200);
    }
    if (internal._state?.splitType !== "vertical") {
      throw new Error(`Zotero never opened a vertical split (splitType=${String(internal._state?.splitType)})`);
    }
    if (!secondary) throw new Error("the split opened but the second pane has no SDT document");

    const mirrorDeadline = Date.now() + 12000;
    while (Date.now() < mirrorDeadline) {
      const done = secondary.querySelectorAll('.interlinear-translation[data-state="done"]').length;
      if (done >= 2) break;
      await Zotero.Promise.delay(200);
    }
    const primaryDone = primary._iframeDocument.querySelectorAll(
      '.interlinear-translation[data-state="done"]',
    ).length;
    const secondaryDone = secondary.querySelectorAll(
      '.interlinear-translation[data-state="done"]',
    ).length;
    if (primaryDone < 2) throw new Error(`primary pane has ${primaryDone} translated blocks`);
    if (secondaryDone < 2) throw new Error(`secondary pane has ${secondaryDone} mirrored blocks`);
    if (secondary.querySelector("#sdt-content")?.getAttribute("data-interlinear-display") !== "target-only") {
      throw new Error("the secondary pane is not in target-only display mode");
    }

    // The translation pane must keep visual blocks (page crops, tables,
    // formulas) even though ordinary source paragraphs are hidden.
    const secondaryWindow: any = secondary.defaultView;
    const hiddenSource = secondary.querySelector('[data-ref-path="0"]') as HTMLElement | null;
    if (!hiddenSource) throw new Error("the secondary pane lost its source paragraphs");
    const hiddenDisplay = String(secondaryWindow.getComputedStyle(hiddenSource).display);
    if (hiddenDisplay !== "none") {
      throw new Error(`a plain source paragraph must stay hidden in the translation pane, got "${hiddenDisplay}"`);
    }
    const crop = secondary.createElement("figure");
    crop.className = "sdt-source-crop";
    hiddenSource.append(crop);
    await Zotero.Promise.delay(150);
    const cropDisplay = String(secondaryWindow.getComputedStyle(hiddenSource).display);
    crop.remove();
    if (cropDisplay === "none") {
      throw new Error("a source block carrying a page crop must stay visible in the translation pane");
    }

    // Close again through the same button; the split and both overlays go away.
    button = toolbarDoc.querySelector(".interlinear-split-button") as HTMLElement | null;
    if (!button) throw new Error("the split button vanished after the split opened");
    button.click();
    const closeDeadline = Date.now() + 10000;
    while (Date.now() < closeDeadline) {
      if (!internal._state?.splitType) break;
      await Zotero.Promise.delay(200);
    }
    if (internal._state?.splitType) throw new Error("the split never closed");
  } finally {
    if (reader) cleanupBilingualReader(reader);
    (Zotero.HTTP as any).request = previousRequest;
    restorePref(enginePref, previousEngine);
    restorePref(sourcePref, previousSource);
    restorePref(targetPref, previousTarget);
    try {
      reader?.close();
    } catch (_) {
      // The harness may have closed it already.
    }
    try {
      if (attachment) await attachment.eraseTx();
    } catch (_) {
      // Best-effort cleanup only.
    }
    try {
      if (pdfFile.exists()) pdfFile.remove(false);
    } catch (_) {
      // Best-effort cleanup only.
    }
  }
}

/**
 * A background reader iframe drops programmatic selections, so the selection
 * pipeline is driven with an injected selection over a real Gecko document:
 * every step (offset math, sentence mapping, native painting) is the shipped
 * one, only the browser's own drag gesture is replaced.
 */
async function probeSelectionSync(): Promise<void> {
  const { doc, close } = await makeFrame();
  const highlighter = createReaderHighlighter();
  let controller: any = null;
  try {
    const content = doc.createElement("div");
    content.id = "sdt-content";
    const source = doc.createElement("p");
    source.dataset.refPath = "0";
    source.textContent = "Alpha beta gamma delta epsilon zeta.";
    const block = doc.createElement("div");
    block.className = "interlinear-translation";
    block.dataset.sourceRefPath = "0";
    block.dataset.state = "done";
    block.textContent = "甲乙丙。丁戊己。庚辛壬。";
    content.append(source, block);
    doc.body.append(content);

    highlighter.register(doc);
    const win: any = doc.defaultView;
    let activeRange: Range | null = null;
    const injected = {
      isCollapsed: false,
      rangeCount: 1,
      getRangeAt: () => activeRange,
      toString: () => (activeRange ? activeRange.toString() : ""),
    };
    controller = attachReaderInteractions(
      doc,
      {
        translateSelection: (() => Promise.resolve()) as any,
        translateParagraph: (() => undefined) as any,
      },
      {
        getSelection: () => (activeRange ? (injected as any) : null),
        onSourceSelection: (element: HTMLElement, range: any) =>
          highlighter.showFromSource(element, range),
        onTranslationSelection: (element: HTMLElement, range: any) =>
          highlighter.showFromTranslation(element, range),
        onClearHighlight: () => highlighter.clear(),
      },
    );

    const textNodeOf = (element: HTMLElement) => element.firstChild as Text;
    const select = (element: HTMLElement, from: number, to: number) => {
      const range = doc.createRange();
      range.setStart(textNodeOf(element), from);
      range.setEnd(textNodeOf(element), to);
      activeRange = range;
      doc.dispatchEvent(new win.Event("selectionchange"));
    };

    select(source, 0, 8);
    await Zotero.Promise.delay(100);
    const forward = highlightText(win).replace(/\s+/gu, "");
    const full = String(block.textContent || "").replace(/\s+/gu, "");
    if (!forward) throw new Error("a source selection painted nothing in the translation");
    if (forward.length >= full.length) {
      throw new Error(`a source selection must map to a partial tint, got "${forward}"`);
    }

    select(block, 0, 4);
    await Zotero.Promise.delay(100);
    const reverse = highlightText(win);
    if (!reverse) throw new Error("a translation selection painted nothing on the source");
    if (!String(source.textContent).includes(reverse)) {
      throw new Error(`a translation selection must tint source text, got "${reverse}"`);
    }
  } finally {
    try {
      controller?.dispose();
    } catch (_) {
      // Detached documents cannot dispose cleanly.
    }
    highlighter.dispose();
    close();
  }
}

/**
 * Single-pane modes (top-bottom, side-by-side) keep both directions inside one
 * document. Hovering the translation must tint the source paragraph there too.
 */
async function probeSinglePaneHover(): Promise<void> {
  const { doc, close } = await makeFrame();
  const highlighter = createReaderHighlighter();
  let controller: any = null;
  try {
    const content = doc.createElement("div");
    content.id = "sdt-content";
    const source = doc.createElement("p");
    source.dataset.refPath = "0";
    source.textContent = "Source paragraph for the single pane.";
    const block = doc.createElement("div");
    block.className = "interlinear-translation";
    block.dataset.sourceRefPath = "0";
    block.dataset.state = "done";
    block.textContent = "单窗格译文。";
    content.append(source, block);
    doc.body.append(content);

    highlighter.register(doc);
    const win: any = doc.defaultView;
    controller = attachReaderInteractions(
      doc,
      {
        translateSelection: (() => Promise.resolve()) as any,
        translateParagraph: (() => undefined) as any,
      },
      {
        onSourceHover: (element: HTMLElement | null, origin?: string) => {
          if (!element) {
            highlighter.clear();
            return;
          }
          if (origin === "translation") highlighter.showSource(element);
          else highlighter.showFromSource(element);
        },
        onClearHighlight: () => highlighter.clear(),
      },
    );

    const move = (element: HTMLElement) =>
      element.dispatchEvent(
        new win.MouseEvent("mousemove", { bubbles: true, cancelable: true, clientX: 5, clientY: 5 }),
      );

    move(source);
    await Zotero.Promise.delay(120);
    if (!highlightText(win).includes("单窗格译文")) {
      throw new Error("hovering the source must tint the translation");
    }

    move(block);
    await Zotero.Promise.delay(120);
    const reverse = highlightText(win);
    if (!reverse.includes("Source paragraph")) {
      throw new Error(`hovering the translation must tint the source, got "${reverse}"`);
    }
  } finally {
    try {
      controller?.dispose();
    } catch (_) {
      // Detached documents cannot dispose cleanly.
    }
    highlighter.dispose();
    close();
  }
}

/** The two settings switches must silence their own gesture only. */
async function probeHighlightToggles(): Promise<void> {
  const { doc, close } = await makeFrame();
  const highlighter = createReaderHighlighter();
  let controller: any = null;
  try {
    const content = doc.createElement("div");
    content.id = "sdt-content";
    const source = doc.createElement("p");
    source.dataset.refPath = "1";
    source.textContent = "Toggle source text.";
    const block = doc.createElement("div");
    block.className = "interlinear-translation";
    block.dataset.sourceRefPath = "1";
    block.dataset.state = "done";
    block.textContent = "开关译文。";
    content.append(source, block);
    doc.body.append(content);

    highlighter.register(doc);
    const win: any = doc.defaultView;
    let hoverEnabled = true;
    let selectionEnabled = true;
    controller = attachReaderInteractions(
      doc,
      {
        translateSelection: (() => Promise.resolve()) as any,
        translateParagraph: (() => undefined) as any,
      },
      {
        isHoverHighlightEnabled: () => hoverEnabled,
        isSelectionHighlightEnabled: () => selectionEnabled,
        onSourceHover: (element: HTMLElement | null, origin?: string) => {
          if (!element) {
            highlighter.clear();
            return;
          }
          if (origin === "translation") highlighter.showSource(element);
          else highlighter.showFromSource(element);
        },
        onSourceSelection: (element: HTMLElement) => highlighter.showFromSource(element),
        onClearHighlight: () => highlighter.clear(),
      },
    );

    const move = (element: HTMLElement) =>
      element.dispatchEvent(
        new win.MouseEvent("mousemove", { bubbles: true, cancelable: true, clientX: 5, clientY: 5 }),
      );

    move(source);
    await Zotero.Promise.delay(100);
    if (!highlightText(win).includes("开关译文")) {
      throw new Error("hover highlight must work while enabled");
    }

    hoverEnabled = false;
    move(block);
    await Zotero.Promise.delay(100);
    if (highlightText(win).includes("Toggle source")) {
      throw new Error("hover highlight must not repaint once disabled");
    }

    hoverEnabled = true;
    move(source);
    await Zotero.Promise.delay(100);

    const range = doc.createRange();
    range.setStart(source.firstChild as Text, 0);
    range.setEnd(source.firstChild as Text, 6);
    win.getSelection = () => ({
      isCollapsed: false,
      rangeCount: 1,
      getRangeAt: () => range,
      toString: () => range.toString(),
    });
    selectionEnabled = false;
    doc.dispatchEvent(new win.Event("selectionchange"));
    await Zotero.Promise.delay(100);
    if (highlightText(win).includes("开关译文")) {
      throw new Error("a selection must not repaint once the selection switch is off");
    }

    selectionEnabled = true;
    doc.dispatchEvent(new win.Event("selectionchange"));
    await Zotero.Promise.delay(100);
    if (!highlightText(win)) throw new Error("the selection switch must restore the tint");
  } finally {
    try {
      controller?.dispose();
    } catch (_) {
      // Detached documents cannot dispose cleanly.
    }
    highlighter.dispose();
    close();
  }
}

describe("reader UX probes", function () {
  this.timeout(30000);

  afterEach(function () {
    // Probes observe throwaway documents; drop their layout observers so the
    // real-reader suites never inherit a stale entry.
    cleanupAllReadingLayouts();
  });

  it("paints a real CSS highlight for hover and a sub-range for selection", async function () {
    try {
      await probeHighlight();
    } catch (error) {
      await dumpProbe("highlight", error);
      throw error;
    }
  });

  it("falls back to a data attribute where CSS.highlights is missing", function () {
    const doc = mainWindow().document.implementation.createHTMLDocument(
      "highlight-fallback",
    );
    const content = doc.createElement("div");
    content.id = "sdt-content";
    const { source, block } = makeSourceAndBlock(
      doc,
      "0",
      "Alpha beta. Gamma delta.",
      "阿尔法。伽马。",
    );
    content.append(source, block);
    doc.body.append(content);

    const highlighter = createReaderHighlighter();
    highlighter.register(doc);
    highlighter.showFromSource(source);
    assert.equal((block as any).dataset.interlinearSync, "true");
    assert.deepEqual(
      source.getAttributeNames().filter((name) => name !== "data-ref-path"),
      [],
    );
    highlighter.clearFor(doc);
    assert.isUndefined((block as any).dataset.interlinearSync);
    highlighter.dispose();
  });

  it("renders model formatting as nodes and never as markup", function () {
    const doc = mainWindow().document.implementation.createHTMLDocument(
      "format-render",
    );
    const holder = doc.createElement("div");
    holder.append(
      renderTranslationFragment(
        doc,
        "**粗体** 与 *斜体* 与 `code` 与 $x^2$ 以及 <img src=x onerror=alert(1)>",
      ),
    );

    assert.exists(holder.querySelector("strong"));
    assert.exists(holder.querySelector("em"));
    assert.exists(holder.querySelector("code"));
    assert.exists(holder.querySelector(".interlinear-math"));
    assert.notExists(holder.querySelector("img"));
    assert.include(holder.textContent || "", "<img");
    assert.include(holder.textContent || "", "x^2");
    assert.notInclude(holder.textContent || "", "$x^2$");
  });

  it("wraps export pairs only for block-level sources", function () {
    const doc = mainWindow().document.implementation.createHTMLDocument(
      "export-pairs",
    );
    const content = doc.createElement("div");
    content.id = "sdt-content";
    const paragraph = doc.createElement("p");
    paragraph.className = "interlinear-source";
    paragraph.textContent = "Source paragraph.";
    const paragraphTranslation = doc.createElement("div");
    paragraphTranslation.className = "interlinear-translation";
    paragraphTranslation.dataset.state = "done";
    paragraphTranslation.textContent = "原文段落。";

    const list = doc.createElement("ul");
    const item = doc.createElement("li");
    item.className = "interlinear-source";
    item.textContent = "Source item.";
    const itemTranslation = doc.createElement("div");
    itemTranslation.className = "interlinear-translation";
    itemTranslation.dataset.state = "done";
    itemTranslation.textContent = "原文条目。";
    list.append(item, itemTranslation);

    content.append(paragraph, paragraphTranslation, list);
    doc.body.append(content);

    assert.equal(
      wrapExportPairs(content, "interlinear-translation", "interlinear-source"),
      1,
      "a list item must not be wrapped into a div pair",
    );
    const pair = content.querySelector(".interlinear-pair") as HTMLElement;
    assert.exists(pair);
    assert.equal(pair.children.length, 2);
    assert.equal(pair.children[0], paragraph);
    assert.equal(pair.children[1], paragraphTranslation);
    assert.equal(item.parentElement, list, "list nesting must survive");

    assert.match(
      buildExportLayoutCSS(
        "side-by-side",
        "interlinear-translation",
        "interlinear-source",
      ),
      /display:\s*flex/,
    );
    assert.match(
      buildExportLayoutCSS(
        "source-only",
        "interlinear-translation",
        "interlinear-source",
      ),
      /interlinear-translation\s*\{\s*display:\s*none/,
    );
  });

  it("keeps two real documents on the same paragraph while scrolling", async function () {
    try {
      await probeScrollSync();
    } catch (error) {
      await dumpProbe("scroll-sync", error);
      throw error;
    }
  });

  it("opens a real split, mirrors translations and syncs both panes", async function () {
    try {
      await probeDualView();
    } catch (error) {
      await dumpProbe("dual-view", error);
      throw error;
    }
  });

  it("prints a real bilingual PDF through the export dialog", async function () {
    this.timeout(60000);
    try {
      await probeExport();
    } catch (error) {
      await dumpProbe("export", error);
      throw error;
    }
  });

  it("masks formulas and code before the request and restores them in the block", async function () {
    try {
      await probeMasking();
    } catch (error) {
      await dumpProbe("masking", error);
      throw error;
    }
  });

  it("hovers both ways inside a single pane", async function () {
    try {
      await probeSinglePaneHover();
    } catch (error) {
      await dumpProbe("single-pane-hover", error);
      throw error;
    }
  });

  it("honors the hover and selection switches", async function () {
    try {
      await probeHighlightToggles();
    } catch (error) {
      await dumpProbe("highlight-toggles", error);
      throw error;
    }
  });

  it("maps a source selection onto the translation and back", async function () {
    try {
      await probeSelectionSync();
    } catch (error) {
      await dumpProbe("selection", error);
      throw error;
    }
  });

  it("opens a real Zotero split and mirrors a real translation into the second pane", async function () {
    this.timeout(90000);
    try {
      await probeRealSplit();
    } catch (error) {
      await dumpProbe("real-split", error);
      throw error;
    }
  });
});
