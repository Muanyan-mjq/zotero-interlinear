import { assert } from "chai";

function resolveRepoRoot(): string {
  const configured = Zotero.Prefs.get(
    "extensions.zotero.interlinear.test.repoRoot",
    true,
  );
  const fallback = (() => {
    try {
      return Services.dirsvc.get("CurWorkD", Components.interfaces.nsIFile).path;
    }
    catch (_) {
      return "";
    }
  })();
  return String(configured || fallback).replace(/\\/g, "/").replace(/\/+$/, "");
}

const REPO_ROOT = resolveRepoRoot();
const OUT_DIR = `${REPO_ROOT}/docs/dev/screenshots`;
const SCAFFOLD_DIR = `${REPO_ROOT}/.scaffold`;

function nativePath(path: string): string {
  return Zotero.isWin ? path.replace(/\//g, "\\") : path;
}

async function writeBytes(path: string, bytes: Uint8Array): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const file = Zotero.File.pathToFile(nativePath(path));
      const stream = Components.classes[
        "@mozilla.org/network/file-output-stream;1"
      ].createInstance(Components.interfaces.nsIFileOutputStream);
      stream.init(file, 0x02 | 0x08 | 0x20, 0o644, 0);
      const binary = Components.classes[
        "@mozilla.org/binaryoutputstream;1"
      ].createInstance(Components.interfaces.nsIBinaryOutputStream);
      binary.setOutputStream(stream);
      binary.writeByteArray(Array.from(bytes), bytes.length);
      binary.close();
      stream.close();
      return;
    }
    catch (error) {
      // Antivirus/indexers can briefly hold a freshly written PNG; retry.
      lastError = error;
      await Zotero.Promise.delay(400);
    }
  }
  throw lastError;
}

async function capture(
  win: any,
  name: string,
  outDir = OUT_DIR,
): Promise<void> {
  win.focus();
  await Zotero.Promise.delay(400);
  const canvas = win.document.createElementNS(
    "http://www.w3.org/1999/xhtml",
    "canvas",
  );
  const w = win.innerWidth;
  const h = win.innerHeight;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d") as any;
  ctx.drawWindow(win, 0, 0, w, h, "#ffffff");
  const data = canvas.toDataURL("image/png").split(",")[1];
  const bin = atob(data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  await writeBytes(`${outDir}/${name}.png`, bytes);
}

async function openPane(): Promise<any> {
  const win = Zotero.Utilities.Internal.openPreferences("interlinear-preferences");
  if (!win) {
    throw new Error(
      `openPreferences returned ${typeof win}; IOUtils=${typeof IOUtils}; Services=${typeof Services}`,
    );
  }
  for (let attempt = 0; attempt < 600; attempt++) {
    try {
      if (win.document?.getElementById("interlinear-engine")) return win;
    }
    catch (_) {
      // document may not be ready yet
    }
    await Zotero.Promise.delay(50);
  }
  throw new Error(
    `pane never loaded: href=${win.location?.href} readyState=${win.document?.readyState} hasPrefs=${typeof win.Zotero_Preferences}`,
  );
}

async function selectTab(win: any, tab: string): Promise<void> {
  const doc = win.document;
  const button = doc.getElementById(`interlinear-tab-${tab}`);
  assert.exists(button, `tab ${tab}`);
  button.click();
  await Zotero.Promise.delay(400);
}

function scrollIntoViewReliably(win: any, el: HTMLElement | null): void {
  if (!el) return;
  let node: any = el.parentElement;
  while (node && node !== win.document.documentElement) {
    if (
      node.clientHeight > 0 &&
      node.scrollHeight > node.clientHeight + 8 &&
      win.getComputedStyle(node).overflowY !== "visible"
    ) {
      node.scrollTop = Math.max(
        0,
        el.getBoundingClientRect().top -
          node.getBoundingClientRect().top +
          node.scrollTop -
          8,
      );
      return;
    }
    node = node.parentElement;
  }
  el.scrollIntoView({ block: "start" });
}

describe("gui capture", function () {
  it("captures real Zotero preference windows", async function () {
    this.timeout(180000);
    try {
      await runCaptures();
    }
    catch (error: any) {
      const info = JSON.stringify(
        { message: String(error?.message || error), stack: String(error?.stack) },
        null,
        2,
      );
      try {
        await Zotero.File.putContentsAsync(
          Zotero.File.pathToFile(nativePath(`${SCAFFOLD_DIR}/gui-error.json`)),
          info,
        );
      }
      catch (_) {
        // Diagnostics must never mask the original error.
      }
      const wrapped = new Error(info);
      Object.defineProperty(wrapped, "message", {
        value: info,
        enumerable: true,
      });
      throw wrapped;
    }
  });
});

async function runCaptures(): Promise<void> {
    const win = await openPane();
    const doc = win.document;
    try {
      win.resizeTo(1100, 860);
      await Zotero.Promise.delay(800);
      // Let font detection finish before the first appearance capture.
      await Zotero.Promise.delay(3000);

      for (const tab of ["service", "display", "appearance", "glossary", "advanced"]) {
        await selectTab(win, tab);
        await capture(win, `${tab}-gui`);
      }

      // Appearance: expand the color group and capture it.
      await selectTab(win, "appearance");
      const colorsTitle = doc.getElementById("interlinear-appearance-colors-title");
      const colorsDetails = colorsTitle?.closest("details");
      if (colorsDetails && !colorsDetails.open) {
        colorsDetails.open = true;
        await Zotero.Promise.delay(300);
      }
      colorsTitle?.scrollIntoView({ block: "start" });
      await capture(win, "appearance-colors-gui");

      // Open the custom color picker from the first color card. The button is
      // disabled while the text color follows the theme, so switch it off first.
      const pickerOpen = doc.getElementById(
        "interlinear-appearance-color-open-picker",
      ) as HTMLButtonElement | null;
      const inherit = doc.getElementById(
        "interlinear-appearance-color-inherit",
      ) as HTMLInputElement | null;
      const restoreInherit = Boolean(inherit?.checked);
      if (pickerOpen) {
        if (inherit?.checked) {
          inherit.checked = false;
          inherit.dispatchEvent(new (win as any).Event("change", { bubbles: true }));
          await Zotero.Promise.delay(300);
        }
        pickerOpen.scrollIntoView({ block: "center" });
        pickerOpen.click();
        await Zotero.Promise.delay(500);
        await capture(win, "appearance-picker-gui");
        doc.getElementById("interlinear-color-picker-close")?.click();
        await Zotero.Promise.delay(200);
        // Leave the form in its original theme-following state so later
        // captures do not inherit the picker's explicit #333333 color.
        if (restoreInherit && inherit) {
          inherit.checked = true;
          inherit.dispatchEvent(new (win as any).Event("change", { bubbles: true }));
          await Zotero.Promise.delay(300);
        }
      }

      // Expand all advanced appearance groups.
      for (const details of Array.from(doc.querySelectorAll("details"))) {
        details.open = true;
      }
      await Zotero.Promise.delay(300);
      const presetsTitle = doc.getElementById("interlinear-appearance-presets-title");
      presetsTitle?.scrollIntoView({ block: "start" });
      await capture(win, "appearance-presets-gui");
      const advancedSummary = doc.getElementById("interlinear-appearance-advanced-summary");
      advancedSummary?.scrollIntoView({ block: "start" });
      await capture(win, "appearance-advanced-gui");
      for (const details of Array.from(doc.querySelectorAll("details"))) {
        details.open = false;
      }

      // Narrow window.
      win.resizeTo(620, 860);
      await Zotero.Promise.delay(500);
      const tabsBar = doc.getElementById(
        "interlinear-settings-tabs",
      ) as HTMLElement | null;
      assert.exists(tabsBar);
      const tabEls = Array.from(
        doc.querySelectorAll(".interlinear-tab"),
      ) as HTMLElement[];
      assert.lengthOf(tabEls, 5);
      assert.equal(
        new Set(tabEls.map((tab) => tab.offsetTop)).size,
        1,
        "all five tabs must stay on one row",
      );
      const actionbar = doc.getElementById(
        "interlinear-settings-actionbar",
      ) as HTMLElement | null;
      assert.exists(actionbar);
      assert.equal(
        win.getComputedStyle(actionbar!).flexDirection,
        "column",
        "save actions must stack vertically",
      );
      assert.equal(
        win.getComputedStyle(tabsBar!).overflowX,
        "auto",
        "the tab strip must be horizontally scrollable instead of covering the action bar",
      );
      assert.isAtLeast(
        Number.parseFloat(win.getComputedStyle(tabsBar!).paddingBottom),
        8,
        "the scrollbar must have clearance below the tab labels",
      );
      assert.isAtMost(
        tabsBar!.getBoundingClientRect().right,
        actionbar!.getBoundingClientRect().left + 1,
        "tabs must be clipped before the action bar",
      );
      const saveButton = doc.getElementById(
        "interlinear-save",
      ) as HTMLElement | null;
      const statusEl = doc.getElementById(
        "interlinear-settings-status",
      ) as HTMLElement | null;
      assert.exists(saveButton);
      assert.exists(statusEl);
      if (statusEl!.textContent?.trim()) {
        assert.isAtLeast(
          saveButton!.getBoundingClientRect().top,
          statusEl!.getBoundingClientRect().bottom - 2,
          "save button must sit below the status text",
        );
      }
      const firstTab = tabEls[0];
      assert.isAtLeast(
        Number.parseFloat(win.getComputedStyle(firstTab).fontSize),
        15,
        "tab labels should use the larger 15px size",
      );

      // English labels are much longer; they must scroll, clear the
      // scrollbar, and stay reachable without being covered by the button.
      const originalLabels = tabEls.map((tab) => tab.textContent);
      ["Translation service", "Display & interaction", "Appearance", "Glossary", "Advanced"]
        .forEach((label, index) => {
          tabEls[index].textContent = label;
        });
      await Zotero.Promise.delay(200);
      assert.isAbove(
        tabsBar!.scrollWidth,
        tabsBar!.clientWidth + 1,
        "long English labels should overflow into the scrollbar",
      );
      tabsBar!.scrollLeft = tabsBar!.scrollWidth;
      await Zotero.Promise.delay(200);
      assert.isAtMost(
        tabEls[4].getBoundingClientRect().right,
        tabsBar!.getBoundingClientRect().right + 1,
        "the last tab must be reachable by scrolling",
      );
      await capture(win, "service-narrow-en", SCAFFOLD_DIR);
      tabEls.forEach((tab, index) => {
        tab.textContent = originalLabels[index];
      });
      tabsBar!.scrollLeft = 0;
      await Zotero.Promise.delay(200);
      await selectTab(win, "appearance");
      await capture(win, "appearance-narrow-gui");
      await selectTab(win, "service");
      await capture(win, "service-narrow-gui");

      // Explicit light theme; the preview must follow it in auto appearance.
      win.resizeTo(1100, 860);
      Services.prefs.setIntPref("browser.theme.toolbar-theme", 1);
      await Zotero.Promise.delay(1200);
      await selectTab(win, "appearance");
      doc
        .getElementById("interlinear-appearance-theme")
        ?.dispatchEvent(new (win as any).Event("change", { bubbles: true }));
      await Zotero.Promise.delay(400);
      scrollIntoViewReliably(
        win,
        doc.getElementById("interlinear-appearance-preview")?.closest(".interlinear-preview") as HTMLElement | null,
      );
      await capture(win, "appearance-light-gui");
      await selectTab(win, "service");
      await capture(win, "service-light-gui");

      // Dark theme.
      Services.prefs.setIntPref("browser.theme.toolbar-theme", 0);
      await Zotero.Promise.delay(1200);
      await selectTab(win, "appearance");
      doc
        .getElementById("interlinear-appearance-theme")
        ?.dispatchEvent(new (win as any).Event("change", { bubbles: true }));
      await Zotero.Promise.delay(400);
      scrollIntoViewReliably(
        win,
        doc.getElementById("interlinear-appearance-preview")?.closest(".interlinear-preview") as HTMLElement | null,
      );
      await capture(win, "appearance-dark-gui");
      await selectTab(win, "service");
      await capture(win, "service-dark-gui");
    }
    finally {
      Services.prefs.setIntPref("browser.theme.toolbar-theme", 2);
      win.close();
    }
}