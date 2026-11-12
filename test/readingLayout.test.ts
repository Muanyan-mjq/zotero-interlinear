import { assert } from "chai";
import { cleanupReadingLayout, observeReadingLayout } from "../src/readingLayout";
import { toggleBilingualReading, cleanupBilingualReader } from "../src/bilingualReader";
import { clearTranslationCache } from "../src/translationCache";

function nativeTest(title: string, run: () => Promise<void>): void {
  it(title, async function () {
    try {
      await run();
    } catch (error: any) {
      // Scaffold's JSON reporter drops non-enumerable native Error fields.
      assert.fail(`${String(error)}\n${error?.stack || ""}`);
    }
  });
}

// A tiny generated PDF keeps this regression independent of users' libraries,
// translation services, SDT downloads, and copyrighted sample documents.
function samplePDF(): string {
  const stream = "BT /F1 12 Tf 50 700 Td (Synthetic reader layout test.) Tj ET";
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
  pdf += `xref\n0 6\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  return pdf + `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
}

describe("native Zotero reading-mode highlight layout", function () {
  this.timeout(30000);
  let attachment: any;
  let reader: any;
  let view: any;
  let doc: Document;
  let temporaryFile: any;
  let rafWindow: any;
  let originalRAF: any;
  let originalCAF: any;

  before(async function () {
    try {
      temporaryFile = Zotero.getTempDirectory();
      temporaryFile.append(`bilingual-layout-${Date.now()}.pdf`);
      await Zotero.File.putContentsAsync(temporaryFile, samplePDF());
      attachment = await Zotero.Attachments.importFromFile({ file: temporaryFile });
      reader = await Zotero.Reader.open(attachment.id);
      await reader._initPromise;
      const internal = reader._internalReader;
      await internal._primaryView.initializedPromise;

      // Exercise the shipped SDTView and annotation overlay. Only PDF-to-SDT
      // mapping is a fixture; the plugin does not alter that mapping in production.
      const structure = {
        metadata: { processor: { type: "pdf" }, languages: ["en"] },
        catalog: { outline: [], pages: [] },
        content: [
          {
            type: "paragraph",
            content: [{ text: "A source paragraph before the highlighted passage." }],
          },
          { type: "paragraph", content: [{ text: "Highlighted original text remains aligned." }] },
        ],
      };
      internal._sdt = Components.utils.cloneInto(
        {
          structure,
          mapper: {
            sourceToSDTPosition: () =>
              Components.utils.cloneInto(
                { start: [1, 0, 0], end: [1, 0, 25] },
                reader._iframeWindow,
              ),
            sdtToSourcePosition: () =>
              Components.utils.cloneInto(
                { pageIndex: 0, rects: [[50, 690, 180, 705]] },
                reader._iframeWindow,
              ),
          },
        },
        reader._iframeWindow,
        { cloneFunctions: true },
      );
      await internal._setReadingMode(true, true);
      view = internal._primarySDTView;
      await view.initializedPromise;
      doc = view._iframeDocument;
      // Headless/occluded reader windows can suspend requestAnimationFrame
      // entirely, which would leave the layout observer's scheduled refresh
      // pending forever. A timer-backed frame keeps the tests deterministic
      // while exercising the real observer and rAF scheduling code.
      rafWindow = doc.defaultView as any;
      originalRAF = rafWindow.requestAnimationFrame;
      originalCAF = rafWindow.cancelAnimationFrame;
      Object.defineProperty(rafWindow, "requestAnimationFrame", {
        configurable: true,
        writable: true,
        value: (callback: (time: number) => void) =>
          rafWindow.setTimeout(() => callback(Date.now()), 0),
      });
      Object.defineProperty(rafWindow, "cancelAnimationFrame", {
        configurable: true,
        writable: true,
        value: (id: number) => rafWindow.clearTimeout(id),
      });
      view.setAnnotations(
        Components.utils.cloneInto(
          [
            {
              id: "LAYOUT01",
              type: "highlight",
              color: "#a28ae5",
              text: "Highlighted original text",
              sortIndex: "00000|000000|00000",
              position: { pageIndex: 0, rects: [[50, 690, 180, 705]] },
            },
          ],
          reader._iframeWindow,
        ),
      );
      await Zotero.Promise.delay(250);
      view._handleViewUpdate(true);
    } catch (error: any) {
      assert.fail(`Native reading-mode fixture: ${String(error)}\n${error?.stack || ""}`);
    }
  });

  after(async function () {
    if (doc) cleanupReadingLayout(doc);
    if (rafWindow && originalRAF) rafWindow.requestAnimationFrame = originalRAF;
    if (rafWindow && originalCAF) rafWindow.cancelAnimationFrame = originalCAF;
    if (reader) reader.close();
    if (attachment) await attachment.eraseTx();
    if (temporaryFile?.exists()) temporaryFile.remove(false);
  });

  function alignmentError(): number {
    const path = view._annotationRenderRootEl.querySelector('[data-annotation-id="LAYOUT01"] path');
    assert.exists(path, "Zotero must display the native highlight");
    const range = view.toDisplayedRange({ pageIndex: 0, rects: [[50, 690, 180, 705]] });
    return Math.abs(path.getBoundingClientRect().top - range.getBoundingClientRect().top);
  }

  nativeTest(
    "reproduces stale coordinates and fixes insertion, text growth, resize, and removal",
    async function () {
      assert.isBelow(alignmentError(), 2);
      const block = doc.createElement("div");
      block.className = "interlinear-translation";
      block.style.cssText = "height:70px;line-height:20px";
      block.textContent = "等待翻译…";
      doc.querySelector('[data-ref-path="0"]')!.after(block);
      await Zotero.Promise.delay(100);
      assert.isAbove(alignmentError(), 40, "Without the fix, the cached highlight stays behind");

      observeReadingLayout(view, doc);
      await Zotero.Promise.delay(100);
      assert.isBelow(alignmentError(), 2, "Inserted translation must refresh native coordinates");

      block.style.height = "auto";
      block.textContent = "译文第一行\n译文第二行\n译文第三行\n译文第四行";
      block.style.whiteSpace = "pre-wrap";
      await Zotero.Promise.delay(100);
      assert.isBelow(alignmentError(), 2, "Completed translations must remain aligned");

      block.style.height = "130px";
      await Zotero.Promise.delay(100);
      assert.isBelow(alignmentError(), 2, "Later layout changes must remain aligned");

      // Step 4 block styles (padding, border, ribbon side, radius) must not
      // break the native highlight sync either.
      block.style.padding = "0.6em 1.2em";
      block.style.border = "2px double #999";
      block.style.borderRight = "6px dotted #2f6fdf";
      block.style.borderRadius = "10px";
      block.style.marginLeft = "1em";
      block.style.textIndent = "0.5em";
      await Zotero.Promise.delay(100);
      assert.isBelow(
        alignmentError(),
        2,
        "Custom block padding, borders and indentation must stay aligned",
      );

      block.remove();
      cleanupReadingLayout(doc);
      assert.isBelow(
        alignmentError(),
        2,
        "Turning bilingual display off restores original geometry",
      );
      assert.equal(
        view._annotations[0].position.rects[0][1],
        690,
        "Stored PDF coordinates stay unchanged",
      );
    },
  );

  nativeTest("does not redraw in a loop or after cleanup", async function () {
    let updates = 0;
    const original = view._handleViewUpdate;
    view._handleViewUpdate = (...args: any[]) => {
      updates++;
      return original.apply(view, args);
    };
    try {
      observeReadingLayout(view, doc);
      observeReadingLayout(view, doc);
      // Frames are timer-backed in this fixture, but the first refresh can
      // still be followed by one late echo from the view finishing its own
      // rendering. Wait for an actual quiet period instead of a fixed delay;
      // a redraw loop never reaches one.
      let settled = updates;
      let quietSince = Date.now();
      const deadline = Date.now() + 5000;
      let quiet = false;
      while (Date.now() < deadline) {
        await Zotero.Promise.delay(50);
        if (updates !== settled) {
          settled = updates;
          quietSince = Date.now();
        } else if (Date.now() - quietSince >= 400) {
          quiet = true;
          break;
        }
      }
      assert.isTrue(quiet, "Layout observation must settle instead of redrawing forever");
      assert.isAbove(settled, 0, "Observing must refresh the view at least once");
      await Zotero.Promise.delay(400);
      assert.equal(
        updates,
        settled,
        "Rendering the annotation overlay must not retrigger observation",
      );
      cleanupReadingLayout(doc);
      const stopped = updates;
      doc.querySelector('[data-ref-path="0"]')!.textContent += " More text after cleanup.";
      await Zotero.Promise.delay(150);
      assert.equal(updates, stopped);
    } finally {
      cleanupReadingLayout(doc);
      view._handleViewUpdate = original;
    }
  });

  nativeTest("keeps native highlights aligned when hiding and re-showing translations", async function () {
    const enginePref = "extensions.zotero.interlinear.engine";
    const batchPref = "extensions.zotero.interlinear.maxBatchParagraphs";
    const previousEngine = Zotero.Prefs.get(enginePref, true);
    const previousBatch = Zotero.Prefs.get(batchPref, true);
    const previousRequest = Zotero.HTTP.request;
    const previousSDT = (Zotero as any).SDT;

    try {
      clearTranslationCache();
      Zotero.Prefs.set(enginePref, "google", true);
      Zotero.Prefs.set(batchPref, 1, true);
      (Zotero as any).SDT = { ensure: async () => undefined };
      (Zotero.HTTP as any).request = async () => ({
        status: 200,
        response: [[["对齐测试译文。", "", null, null]]],
      });

      await toggleBilingualReading(reader);
      assert.isBelow(alignmentError(), 2, "Inserted translations must stay aligned");
      assert.isAbove(doc.querySelectorAll(".interlinear-translation").length, 0);

      await toggleBilingualReading(reader);
      assert.equal(doc.querySelector("#sdt-content")?.getAttribute("data-interlinear-hidden"), "true");
      assert.isBelow(alignmentError(), 2, "Hiding must recalculate native highlight coordinates");

      await toggleBilingualReading(reader);
      assert.isNull(doc.querySelector("#sdt-content")?.getAttribute("data-interlinear-hidden"));
      assert.isBelow(alignmentError(), 2, "Re-showing must recalculate highlight coordinates again");
      assert.equal(
        view._annotations[0].position.rects[0][1],
        690,
        "Stored PDF coordinates stay unchanged across hide/show",
      );
    } finally {
      cleanupBilingualReader(reader);
      clearTranslationCache();
      (Zotero as any).SDT = previousSDT;
      (Zotero.HTTP as any).request = previousRequest;
      if (previousEngine === undefined) Zotero.Prefs.clear(enginePref, true);
      else Zotero.Prefs.set(enginePref, previousEngine, true);
      if (previousBatch === undefined) Zotero.Prefs.clear(batchPref, true);
      else Zotero.Prefs.set(batchPref, previousBatch, true);
    }
  });
});
