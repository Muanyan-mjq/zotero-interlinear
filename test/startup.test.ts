import { assert } from "chai";
import { config } from "../package.json";
import { toggleBilingualReading } from "../src/bilingualReader";
import { renderReaderToolbar } from "../src/readerToolbar";
import { clearTranslationCache } from "../src/translationCache";

describe("startup", function () {
  it("should have plugin instance defined", function () {
    assert.isNotEmpty(Zotero[config.addonInstance]);
  });

  it("should register the preferences pane", function () {
    const pane = Zotero.PreferencePanes.pluginPanes.find(
      (entry) => entry.id === "interlinear-preferences",
    );

    assert.exists(pane);
    assert.equal(pane?.pluginID, config.addonID);
    assert.match(pane?.src || "", /content\/preferences\.xhtml$/u);
  });

  it("should load the preferences controls", async function () {
    this.timeout(10000);
    const win = Zotero.Utilities.Internal.openPreferences("interlinear-preferences");
    assert.exists(win);

    try {
      for (let attempt = 0; attempt < 100; attempt++) {
        if (win?.document.getElementById("interlinear-engine")) break;
        await Zotero.Promise.delay(50);
      }

      assert.exists(win?.document.getElementById("interlinear-engine"));
      const engine = win?.document.getElementById(
        "interlinear-engine",
      ) as HTMLSelectElement | null;
      const skipLastPages = win?.document.getElementById(
        "interlinear-skip-last-pages",
      ) as HTMLInputElement | null;

      assert.deepEqual(
        Array.from(engine?.options || []).map((option) => option.value),
        ["pdftranslate", "ollama"],
      );
      assert.equal(engine?.value, "pdftranslate");
      assert.equal(skipLastPages?.value, "1");
      assert.equal(
        win?.document
          .getElementById("interlinear-introduction")
          ?.textContent?.replace(/\s+/gu, " ")
          .trim(),
        "Interlinear 在 Zotero 10 新 PDF 阅读模式中按段落显示英文原文和中文译文。默认使用 Translate for Zotero（推荐使用google，其次必应）；Ollama 作为可选后端保留。",
      );
      assert.notExists(win?.document.getElementById("interlinear-pdftranslate-service"));
      assert.include(
        win?.document.getElementById("interlinear-pdftranslate-policy")?.textContent || "",
        "固定跟随 Translate for Zotero 当前默认服务",
      );
      assert.exists(win?.document.getElementById("interlinear-save"));
      assert.equal(
        (win?.document.getElementById("interlinear-github-link") as HTMLAnchorElement | null)
          ?.href,
        "https://github.com/Muanyan-mjq/zotero-interlinear",
      );
    } finally {
      win?.close();
    }
  });

  it("should render every reader toolbar icon once without post-render DOM rewrites", function () {
    const doc = Zotero.getMainWindow().document.implementation.createHTMLDocument("toolbar-test");
    const reader = { type: "pdf", itemID: 2147483644 };
    const append = (...elements: HTMLElement[]) => doc.body.append(...elements);

    renderReaderToolbar({ reader, doc, append });
    renderReaderToolbar({ reader, doc, append });

    assert.equal(doc.querySelectorAll(".interlinear-toolbar-button").length, 1);
    assert.equal(doc.querySelectorAll(".interlinear-refresh-button").length, 1);
    assert.equal(doc.querySelectorAll(".interlinear-export-button").length, 1);
    const toggle = doc.querySelector(".interlinear-toolbar-button");
    assert.equal(toggle?.textContent, "");
    const toggleIcon = toggle?.querySelector("img") as HTMLImageElement | null;
    assert.exists(toggleIcon);
    assert.match(toggleIcon?.src || "", /content\/icons\/icon20\.png$/u);
    assert.equal(doc.querySelector(".interlinear-export-button")?.textContent, "🖨️");
    assert.notExists(doc.querySelector(".interlinear-settings-button"));
    assert.notExists(doc.querySelector(".interlinear-wordwise-button"));
  });

  it("should save the engine and trailing-page settings from Zotero preferences", async function () {
    this.timeout(10000);
    const enginePref = "extensions.zotero.interlinear.engine";
    const skipPref = "extensions.zotero.interlinear.skipLastPages";
    const previousEngine = Zotero.Prefs.get(enginePref, true);
    const previousSkip = Zotero.Prefs.get(skipPref, true);
    const win = Zotero.Utilities.Internal.openPreferences("interlinear-preferences");
    assert.exists(win);

    try {
      for (let attempt = 0; attempt < 100; attempt++) {
        if (win?.document.getElementById("interlinear-save")) break;
        await Zotero.Promise.delay(50);
      }

      const engine = win?.document.getElementById("interlinear-engine") as HTMLSelectElement;
      const skipLastPages = win?.document.getElementById(
        "interlinear-skip-last-pages",
      ) as HTMLInputElement;
      const save = win?.document.getElementById("interlinear-save") as HTMLButtonElement;

      engine.value = "ollama";
      engine.dispatchEvent(new win!.Event("change"));
      skipLastPages.value = "2";
      save.click();

      assert.equal(Zotero.Prefs.get(enginePref, true), "ollama");
      assert.equal(Zotero.Prefs.get(skipPref, true), 2);
    } finally {
      win?.close();
      if (previousEngine === undefined) Zotero.Prefs.clear(enginePref, true);
      else Zotero.Prefs.set(enginePref, previousEngine, true);
      if (previousSkip === undefined) Zotero.Prefs.clear(skipPref, true);
      else Zotero.Prefs.set(skipPref, previousSkip, true);
    }
  });

  it("should save appearance settings and re-apply them to open readers", async function () {
    this.timeout(10000);
    const appearancePrefs = [
      "extensions.zotero.interlinear.appearance.fontSize",
      "extensions.zotero.interlinear.appearance.color",
      "extensions.zotero.interlinear.appearance.fontFamily",
      "extensions.zotero.interlinear.appearance.lineHeightPercent",
      "extensions.zotero.interlinear.appearance.paragraphSpacing",
      "extensions.zotero.interlinear.appearance.background",
      "extensions.zotero.interlinear.appearance.theme",
      "extensions.zotero.interlinear.appearance.underline",
      "extensions.zotero.interlinear.appearance.underlineColor",
      "extensions.zotero.interlinear.appearance.ribbon",
      "extensions.zotero.interlinear.appearance.ribbonColor",
    ];
    const fontSizePref = appearancePrefs[0];
    const colorPref = appearancePrefs[1];
    const previous = new Map<string, unknown>(
      appearancePrefs.map((key) => [key, Zotero.Prefs.get(key, true)] as [string, unknown]),
    );
    const originalReaders = (Zotero.Reader as any)._readers;

    const doc = Zotero.getMainWindow().document.implementation.createHTMLDocument(
      "appearance-test",
    );
    const content = doc.createElement("div");
    content.id = "sdt-content";
    doc.body.append(content);
    const reader = {
      type: "pdf",
      itemID: 2147483643,
      _internalReader: {
        _lastViewPrimary: true,
        _primarySDTView: { _iframeDocument: doc, getData: () => ({ structure: null }) },
      },
    };
    (Zotero.Reader as any)._readers = [reader];

    const win = Zotero.Utilities.Internal.openPreferences("interlinear-preferences");
    assert.exists(win);
    const byId = (id: string) =>
      win?.document.getElementById(id) as
        | (HTMLInputElement & HTMLSelectElement)
        | null;

    try {
      for (let attempt = 0; attempt < 100; attempt++) {
        if (win?.document.getElementById("interlinear-appearance-font-size")) break;
        await Zotero.Promise.delay(50);
      }

      const fontSize = byId("interlinear-appearance-font-size");
      const color = byId("interlinear-appearance-color");
      const fontFamily = byId("interlinear-appearance-font-family");
      const lineHeight = byId("interlinear-appearance-line-height");
      const paragraphSpacing = byId("interlinear-appearance-paragraph-spacing");
      const background = byId("interlinear-appearance-background");
      const theme = byId("interlinear-appearance-theme");
      const underline = byId("interlinear-appearance-underline");
      const underlineColor = byId("interlinear-appearance-underline-color");
      const ribbon = byId("interlinear-appearance-ribbon");
      const ribbonColor = byId("interlinear-appearance-ribbon-color");
      const save = win?.document.getElementById("interlinear-save") as HTMLButtonElement;
      assert.exists(fontSize);
      assert.exists(color);
      assert.exists(fontFamily);
      assert.exists(lineHeight);
      assert.exists(paragraphSpacing);
      assert.exists(background);
      assert.exists(theme);
      assert.exists(underline);
      assert.exists(underlineColor);
      assert.exists(ribbon);
      assert.exists(ribbonColor);
      assert.exists(save);
      assert.equal(fontSize?.value, "16");
      assert.equal(color?.value, "");
      assert.equal(fontFamily?.value, "");
      assert.equal(lineHeight?.value, "1.75");
      assert.equal(paragraphSpacing?.value, "1.25");
      assert.equal(background?.value, "");
      assert.equal(theme?.value, "auto");
      assert.equal(underline?.checked, false);
      assert.equal(ribbon?.checked, true);
      assert.equal(ribbonColor?.value, "#c7354a");

      if (fontSize) fontSize.value = "20";
      if (color) color.value = "#ff0000";
      if (fontFamily) fontFamily.value = "Georgia, serif";
      if (lineHeight) lineHeight.value = "2";
      if (paragraphSpacing) paragraphSpacing.value = "2";
      if (background) background.value = "#101010";
      if (theme) theme.value = "dark";
      if (underline) underline.checked = true;
      if (underlineColor) underlineColor.value = "#00ff00";
      if (ribbon) ribbon.checked = false;
      save.click();

      assert.equal(Zotero.Prefs.get(fontSizePref, true), 20);
      assert.equal(Zotero.Prefs.get(colorPref, true), "#ff0000");
      assert.equal(Zotero.Prefs.get(appearancePrefs[2], true), "Georgia, serif");
      assert.equal(Zotero.Prefs.get(appearancePrefs[3], true), 200);
      assert.equal(Zotero.Prefs.get(appearancePrefs[4], true), 200);
      assert.equal(Zotero.Prefs.get(appearancePrefs[5], true), "#101010");
      assert.equal(Zotero.Prefs.get(appearancePrefs[6], true), "dark");
      assert.equal(Zotero.Prefs.get(appearancePrefs[7], true), true);
      assert.equal(Zotero.Prefs.get(appearancePrefs[8], true), "#00ff00");
      assert.equal(Zotero.Prefs.get(appearancePrefs[9], true), false);
      const style = doc.getElementById("interlinear-style") as HTMLStyleElement | null;
      assert.exists(style);
      const css = style?.textContent || "";
      assert.match(css, /font-size: 20px;/u);
      assert.match(css, /color: #ff0000;/u);
      assert.match(css, /background: #101010;/u);
      assert.match(css, /font-family: Georgia, serif;/u);
      assert.match(css, /line-height: 2;/u);
      assert.match(css, /margin: 0\.65em 0 2em;/u);
      assert.match(css, /text-decoration: underline;/u);
      assert.match(css, /text-decoration-color: #00ff00;/u);
      assert.match(css, /border-left: none;/u);

      if (theme) theme.value = "auto";
      if (color) color.value = "red; } body { display: none";
      save.click();
      assert.equal(Zotero.Prefs.get(colorPref, true), "");
      const cssAfter = doc.getElementById("interlinear-style")?.textContent || "";
      assert.isFalse(/^\s*color:/mu.test(cssAfter));
      assert.isFalse(/body/u.test(cssAfter));
    } finally {
      win?.close();
      (Zotero.Reader as any)._readers = originalReaders;
      for (const [key, value] of previous) {
        if (value === undefined) Zotero.Prefs.clear(key, true);
        else Zotero.Prefs.set(key, value as any, true);
      }
    }
  });

  it("should translate through Translate for Zotero without AbortController", async function () {
    this.timeout(10000);
    const prefKey = "extensions.zotero.interlinear.engine";
    const obsoleteServicePref = "extensions.zotero.interlinear.pdftranslate.service";
    const previousEngine = Zotero.Prefs.get(prefKey, true);
    const previousObsoleteService = Zotero.Prefs.get(obsoleteServicePref, true);
    const previousPDFTranslate = (Zotero as any).PDFTranslate;
    let shownError = "";
    let requestedOptions: Record<string, any> | undefined;

    const doc = Zotero.getMainWindow().document.implementation.createHTMLDocument("reader-test");
    const content = doc.createElement("div");
    content.id = "sdt-content";
    const paragraph = doc.createElement("p");
    paragraph.dataset.refPath = "0";
    paragraph.textContent = `A synthetic paragraph for translation ${Date.now()}.`;
    content.append(paragraph);
    doc.body.append(content);

    const reader = {
      itemID: 2147483647,
      _iframeWindow: {
        alert(message: string) {
          shownError = message;
        },
      },
      _internalReader: {
        _lastViewPrimary: true,
        _primarySDTView: {
          _iframeDocument: doc,
          getData: () => ({ structure: null }),
        },
      },
    };

    try {
      Zotero.Prefs.set(prefKey, "pdftranslate", true);
      // A service saved by an older Bilingual Reader must no longer override
      // Translate for Zotero's current default.
      Zotero.Prefs.set(obsoleteServicePref, "legacy-service", true);
      (Zotero as any).PDFTranslate = {
        api: {
          translate: async (_text: string, options: Record<string, any>) => {
            requestedOptions = options;
            return {
              status: "success",
              result: "集成测试译文。",
              service: "integration-test",
            };
          },
        },
      };

      await toggleBilingualReading(reader);

      const translated = doc.querySelector(".interlinear-translation");
      assert.equal(shownError, "");
      assert.equal(translated?.textContent, "集成测试译文。");
      assert.equal(translated?.getAttribute("data-state"), "done");
      assert.notProperty(requestedOptions, "service");
    } finally {
      await toggleBilingualReading(reader);
      clearTranslationCache();
      (Zotero as any).PDFTranslate = previousPDFTranslate;
      if (previousEngine === undefined) {
        Zotero.Prefs.clear(prefKey, true);
      } else {
        Zotero.Prefs.set(prefKey, previousEngine, true);
      }
      if (previousObsoleteService === undefined) {
        Zotero.Prefs.clear(obsoleteServicePref, true);
      } else {
        Zotero.Prefs.set(obsoleteServicePref, previousObsoleteService, true);
      }
    }
  });

  it("should translate through the selected Ollama engine", async function () {
    this.timeout(10000);
    const enginePref = "extensions.zotero.interlinear.engine";
    const previousEngine = Zotero.Prefs.get(enginePref, true);
    const previousRequest = Zotero.HTTP.request;
    let requestedURL = "";

    const doc = Zotero.getMainWindow().document.implementation.createHTMLDocument("ollama-test");
    const content = doc.createElement("div");
    content.id = "sdt-content";
    const paragraph = doc.createElement("p");
    paragraph.dataset.refPath = "0";
    paragraph.textContent = `A synthetic Ollama paragraph ${Date.now()}.`;
    content.append(paragraph);
    doc.body.append(content);

    const reader = {
      itemID: 2147483645,
      _iframeWindow: { alert: () => undefined },
      _internalReader: {
        _lastViewPrimary: true,
        _primarySDTView: {
          _iframeDocument: doc,
          getData: () => ({ structure: null }),
        },
      },
    };

    try {
      Zotero.Prefs.set(enginePref, "ollama", true);
      (Zotero.HTTP as any).request = async (_method: string, url: string) => {
        requestedURL = url;
        return {
          status: 200,
          response: { message: { content: "Ollama 集成测试译文。" } },
        };
      };

      await toggleBilingualReading(reader);

      const translated = doc.querySelector(".interlinear-translation");
      assert.match(requestedURL, /\/api\/chat$/u);
      assert.equal(translated?.textContent, "Ollama 集成测试译文。");
      assert.equal(translated?.getAttribute("data-state"), "done");
    } finally {
      await toggleBilingualReading(reader);
      clearTranslationCache();
      (Zotero.HTTP as any).request = previousRequest;
      if (previousEngine === undefined) Zotero.Prefs.clear(enginePref, true);
      else Zotero.Prefs.set(enginePref, previousEngine, true);
    }
  });

  it("should skip the configured number of trailing PDF pages", async function () {
    this.timeout(10000);
    const enginePref = "extensions.zotero.interlinear.engine";
    const skipPref = "extensions.zotero.interlinear.skipLastPages";
    const previousEngine = Zotero.Prefs.get(enginePref, true);
    const previousSkip = Zotero.Prefs.get(skipPref, true);
    const previousPDFTranslate = (Zotero as any).PDFTranslate;
    let requestCount = 0;

    const doc = Zotero.getMainWindow().document.implementation.createHTMLDocument("range-test");
    const content = doc.createElement("div");
    content.id = "sdt-content";
    for (const [refPath, text] of [
      ["0", "Paragraph on the first page."],
      ["1", "Paragraph on the final page."],
    ]) {
      const paragraph = doc.createElement("p");
      paragraph.dataset.refPath = refPath;
      paragraph.textContent = text;
      content.append(paragraph);
    }
    doc.body.append(content);

    const structure = {
      catalog: {
        pages: [{ contentRange: [[0], [1]] }, { contentRange: [[1], [2]] }],
      },
    };
    const reader = {
      itemID: 2147483646,
      _iframeWindow: { alert: () => undefined },
      _internalReader: {
        _lastViewPrimary: true,
        _primarySDTView: {
          _iframeDocument: doc,
          getData: () => ({ structure }),
        },
      },
    };

    try {
      Zotero.Prefs.set(enginePref, "pdftranslate", true);
      Zotero.Prefs.set(skipPref, 1, true);
      (Zotero as any).PDFTranslate = {
        api: {
          translate: async () => {
            requestCount += 1;
            return {
              status: "success",
              result: "第一页译文。",
              service: "integration-test",
            };
          },
        },
      };

      await toggleBilingualReading(reader);

      const translations = doc.querySelectorAll(".interlinear-translation");
      assert.equal(requestCount, 1);
      assert.equal(translations.length, 1);
      assert.equal(translations[0].textContent, "第一页译文。");
      assert.equal(content.querySelector('[data-ref-path="1"]')?.nextElementSibling, null);
    } finally {
      await toggleBilingualReading(reader);
      clearTranslationCache();
      (Zotero as any).PDFTranslate = previousPDFTranslate;
      if (previousEngine === undefined) Zotero.Prefs.clear(enginePref, true);
      else Zotero.Prefs.set(enginePref, previousEngine, true);
      if (previousSkip === undefined) Zotero.Prefs.clear(skipPref, true);
      else Zotero.Prefs.set(skipPref, previousSkip, true);
    }
  });
});
