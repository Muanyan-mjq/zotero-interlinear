import { assert } from "chai";
import { config } from "../package.json";
import {
  refreshDisplayModes,
  toggleBilingualReading,
  translateReaderParagraph,
  translateSelectedText,
} from "../src/bilingualReader";
import { attachReaderInteractions } from "../src/readerInteractions";
import { parseShortcut } from "../src/shortcut";
import { renderReaderToolbar } from "../src/readerToolbar";
import { clearTranslationCache } from "../src/translationCache";
import { getCacheEngineTag, getDisplayMode } from "../src/settings";
import { collectChatContext } from "../src/chatContext";
import { getChatProvider } from "../src/providers";

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
        ["google", "openai", "claude", "gemini", "ollama"],
      );
      assert.equal(engine?.value, "google");
      assert.equal(skipLastPages?.value, "1");
      assert.isNotEmpty(
        win?.document
          .getElementById("interlinear-introduction")
          ?.textContent?.replace(/\s+/gu, " ")
          .trim(),
      );
      assert.isNotEmpty(
        win?.document
          .getElementById("interlinear-privacy-notice")
          ?.textContent?.replace(/\s+/gu, " ")
          .trim(),
      );
      const sourceLanguage = win?.document.getElementById(
        "interlinear-source-language",
      ) as HTMLSelectElement | null;
      const targetLanguage = win?.document.getElementById(
        "interlinear-target-language",
      ) as HTMLSelectElement | null;
      assert.equal(sourceLanguage?.options.length, 14);
      assert.equal(targetLanguage?.options.length, 13);
      assert.equal(sourceLanguage?.value, "auto");
      assert.equal(targetLanguage?.value, "zh-CN");
      const displayMode = win?.document.getElementById(
        "interlinear-display-mode",
      ) as HTMLSelectElement | null;
      assert.deepEqual(
        Array.from(displayMode?.options || []).map((option) => option.value),
        ["top-bottom", "side-by-side", "target-only", "source-only"],
      );
      assert.equal(displayMode?.value, "top-bottom");
      assert.isNotEmpty(
        win?.document
          .getElementById("interlinear-interaction-help")
          ?.textContent?.replace(/\s+/gu, " ")
          .trim(),
      );
      const hoverTranslate = win?.document.getElementById(
        "interlinear-hover-translate",
      ) as HTMLInputElement | null;
      const hoverDelay = win?.document.getElementById(
        "interlinear-hover-delay",
      ) as HTMLInputElement | null;
      const shortcutEnabled = win?.document.getElementById(
        "interlinear-shortcut-enabled",
      ) as HTMLInputElement | null;
      const shortcut = win?.document.getElementById(
        "interlinear-shortcut",
      ) as HTMLInputElement | null;
      assert.isTrue(hoverTranslate?.checked ?? false);
      assert.equal(hoverDelay?.value, "800");
      assert.isTrue(shortcutEnabled?.checked ?? false);
      assert.equal(shortcut?.value, "Alt+Enter");
      const googleBaseURL = win?.document.getElementById(
        "interlinear-google-base-url",
      ) as HTMLInputElement | null;
      assert.equal(googleBaseURL?.value, "https://translate.googleapis.com");
      assert.isFalse(
        win?.document.getElementById("interlinear-google-section")?.hidden ?? true,
      );
      assert.isTrue(
        win?.document.getElementById("interlinear-openai-section")?.hidden ?? false,
      );
      assert.isTrue(
        win?.document.getElementById("interlinear-claude-section")?.hidden ?? false,
      );
      assert.isTrue(
        win?.document.getElementById("interlinear-gemini-section")?.hidden ?? false,
      );
      assert.equal(
        (win?.document.getElementById("interlinear-claude-endpoint") as HTMLInputElement | null)
          ?.value,
        "https://api.anthropic.com/v1/messages",
      );
      assert.equal(
        (win?.document.getElementById("interlinear-claude-model") as HTMLInputElement | null)
          ?.value,
        "claude-sonnet-4-5",
      );
      assert.equal(
        (win?.document.getElementById("interlinear-gemini-base-url") as HTMLInputElement | null)
          ?.value,
        "https://generativelanguage.googleapis.com",
      );
      assert.equal(
        (win?.document.getElementById("interlinear-gemini-model") as HTMLInputElement | null)
          ?.value,
        "gemini-2.5-flash",
      );
      assert.exists(win?.document.getElementById("interlinear-test-claude"));
      assert.exists(win?.document.getElementById("interlinear-test-gemini"));
      const glossary = win?.document.getElementById(
        "interlinear-glossary",
      ) as HTMLTextAreaElement | null;
      assert.exists(glossary);
      assert.equal(glossary?.value, "");
      assert.isNotEmpty(
        win?.document
          .getElementById("interlinear-glossary-help")
          ?.textContent?.replace(/\s+/gu, " ")
          .trim(),
      );
      assert.exists(win?.document.getElementById("interlinear-glossary-import"));
      assert.exists(win?.document.getElementById("interlinear-glossary-export"));
      assert.notExists(win?.document.getElementById("interlinear-pdftranslate-section"));
      assert.notExists(win?.document.getElementById("interlinear-engine-pdftranslate"));
      assert.isFalse(
        Array.from(engine?.options || []).some((option) => option.value === "pdftranslate"),
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
    const modePref = "extensions.zotero.interlinear.displayMode";
    const previousMode = Zotero.Prefs.get(modePref, true);
    Zotero.Prefs.set(modePref, "top-bottom", true);
    try {
      const doc = Zotero.getMainWindow().document.implementation.createHTMLDocument("toolbar-test");
      const reader = { type: "pdf", itemID: 2147483644 };
      const append = (...elements: HTMLElement[]) => doc.body.append(...elements);

      renderReaderToolbar({ reader, doc, append });
      renderReaderToolbar({ reader, doc, append });

      assert.equal(doc.querySelectorAll(".interlinear-toolbar-button").length, 1);
      assert.equal(doc.querySelectorAll(".interlinear-display-button").length, 1);
      assert.equal(doc.querySelectorAll(".interlinear-refresh-button").length, 1);
      assert.equal(doc.querySelectorAll(".interlinear-export-button").length, 1);
      const toggle = doc.querySelector(".interlinear-toolbar-button");
      assert.equal(toggle?.textContent, "");
      const toggleIcon = toggle?.querySelector("img") as HTMLImageElement | null;
      assert.exists(toggleIcon);
      assert.match(String(toggleIcon?.src), /^data:image\/png;base64,/);
      assert.equal(toggleIcon?.style.width, "16px");
      assert.equal(toggleIcon?.style.height, "16px");
      const display = doc.querySelector(".interlinear-display-button") as HTMLButtonElement | null;
      assert.equal(display?.textContent, "◫");
      assert.isNotEmpty(display?.title || "");
      assert.equal(display?.getAttribute("aria-label"), display?.title);
      assert.equal(display?.dataset.mode, "top-bottom");
      display?.dispatchEvent(
        new (Zotero.getMainWindow() as any).MouseEvent("click", {
          bubbles: true,
          cancelable: true,
        }),
      );
      assert.equal(getDisplayMode(), "side-by-side");
      assert.equal(display?.dataset.mode, "side-by-side");
      assert.notEqual(display?.title, "");
      assert.equal(doc.querySelector(".interlinear-export-button")?.textContent, "🖨️");
      assert.notExists(doc.querySelector(".interlinear-settings-button"));
      assert.notExists(doc.querySelector(".interlinear-wordwise-button"));
    } finally {
      if (previousMode === undefined) Zotero.Prefs.clear(modePref, true);
      else Zotero.Prefs.set(modePref, previousMode, true);
    }
  });

  it("should save the engine and trailing-page settings from Zotero preferences", async function () {
    this.timeout(10000);
    const enginePref = "extensions.zotero.interlinear.engine";
    const skipPref = "extensions.zotero.interlinear.skipLastPages";
    const displayModePref = "extensions.zotero.interlinear.displayMode";
    const hoverPref = "extensions.zotero.interlinear.interaction.hoverTranslate";
    const hoverDelayPref = "extensions.zotero.interlinear.interaction.hoverDelayMs";
    const shortcutEnabledPref = "extensions.zotero.interlinear.interaction.shortcutEnabled";
    const shortcutPref = "extensions.zotero.interlinear.interaction.shortcut";
    const previousEngine = Zotero.Prefs.get(enginePref, true);
    const previousSkip = Zotero.Prefs.get(skipPref, true);
    const previousDisplayMode = Zotero.Prefs.get(displayModePref, true);
    const previousHover = Zotero.Prefs.get(hoverPref, true);
    const previousHoverDelay = Zotero.Prefs.get(hoverDelayPref, true);
    const previousShortcutEnabled = Zotero.Prefs.get(shortcutEnabledPref, true);
    const previousShortcut = Zotero.Prefs.get(shortcutPref, true);
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
      const displayMode = win?.document.getElementById(
        "interlinear-display-mode",
      ) as HTMLSelectElement;
      const hoverTranslate = win?.document.getElementById(
        "interlinear-hover-translate",
      ) as HTMLInputElement;
      const hoverDelay = win?.document.getElementById(
        "interlinear-hover-delay",
      ) as HTMLInputElement;
      const shortcutEnabled = win?.document.getElementById(
        "interlinear-shortcut-enabled",
      ) as HTMLInputElement;
      const shortcut = win?.document.getElementById(
        "interlinear-shortcut",
      ) as HTMLInputElement;

      engine.value = "ollama";
      engine.dispatchEvent(new win!.Event("change"));
      skipLastPages.value = "2";
      displayMode.value = "side-by-side";
      hoverTranslate.checked = false;
      hoverDelay.value = "1200";
      shortcutEnabled.checked = false;
      shortcut.value = "Ctrl+Shift+T";
      save.click();

      assert.equal(Zotero.Prefs.get(enginePref, true), "ollama");
      assert.equal(Zotero.Prefs.get(skipPref, true), 2);
      assert.equal(Zotero.Prefs.get(displayModePref, true), "side-by-side");
      assert.isFalse(Zotero.Prefs.get(hoverPref, true) as boolean);
      assert.equal(Zotero.Prefs.get(hoverDelayPref, true), 1200);
      assert.isFalse(Zotero.Prefs.get(shortcutEnabledPref, true) as boolean);
      assert.equal(Zotero.Prefs.get(shortcutPref, true), "Ctrl+Shift+T");
    } finally {
      win?.close();
      if (previousEngine === undefined) Zotero.Prefs.clear(enginePref, true);
      else Zotero.Prefs.set(enginePref, previousEngine, true);
      if (previousSkip === undefined) Zotero.Prefs.clear(skipPref, true);
      else Zotero.Prefs.set(skipPref, previousSkip, true);
      if (previousDisplayMode === undefined) Zotero.Prefs.clear(displayModePref, true);
      else Zotero.Prefs.set(displayModePref, previousDisplayMode, true);
      if (previousHover === undefined) Zotero.Prefs.clear(hoverPref, true);
      else Zotero.Prefs.set(hoverPref, previousHover, true);
      if (previousHoverDelay === undefined) Zotero.Prefs.clear(hoverDelayPref, true);
      else Zotero.Prefs.set(hoverDelayPref, previousHoverDelay, true);
      if (previousShortcutEnabled === undefined) {
        Zotero.Prefs.clear(shortcutEnabledPref, true);
      } else {
        Zotero.Prefs.set(shortcutEnabledPref, previousShortcutEnabled, true);
      }
      if (previousShortcut === undefined) Zotero.Prefs.clear(shortcutPref, true);
      else Zotero.Prefs.set(shortcutPref, previousShortcut, true);
    }
  });

  it("should save Claude and Gemini provider settings from Zotero preferences", async function () {
    this.timeout(10000);
    const keys = [
      "extensions.zotero.interlinear.engine",
      "extensions.zotero.interlinear.claude.endpoint",
      "extensions.zotero.interlinear.claude.model",
      "extensions.zotero.interlinear.claude.apiKey",
      "extensions.zotero.interlinear.claude.temperature",
      "extensions.zotero.interlinear.claude.prompt",
      "extensions.zotero.interlinear.gemini.baseUrl",
      "extensions.zotero.interlinear.gemini.model",
      "extensions.zotero.interlinear.gemini.apiKey",
      "extensions.zotero.interlinear.gemini.temperature",
      "extensions.zotero.interlinear.gemini.prompt",
    ];
    const previous = new Map<string, unknown>(
      keys.map((key) => [key, Zotero.Prefs.get(key, true)] as [string, unknown]),
    );
    const win = Zotero.Utilities.Internal.openPreferences("interlinear-preferences");
    assert.exists(win);
    const byId = (id: string) =>
      win?.document.getElementById(id) as
        | (HTMLInputElement & HTMLSelectElement & HTMLTextAreaElement)
        | null;

    try {
      for (let attempt = 0; attempt < 100; attempt++) {
        const root = win?.document.getElementById("interlinear-settings-root");
        if (root?.dataset.initialized === "true") break;
        await Zotero.Promise.delay(50);
      }

      const engine = byId("interlinear-engine");
      const save = win?.document.getElementById("interlinear-save") as HTMLButtonElement;
      assert.exists(engine);
      assert.exists(save);

      if (engine) {
        engine.value = "claude";
        engine.dispatchEvent(new win!.Event("change"));
      }
      assert.isFalse(
        win?.document.getElementById("interlinear-claude-section")?.hidden ?? true,
      );
      assert.isTrue(
        win?.document.getElementById("interlinear-gemini-section")?.hidden ?? false,
      );
      assert.isTrue(
        win?.document.getElementById("interlinear-openai-section")?.hidden ?? false,
      );
      if (engine) {
        engine.value = "gemini";
        engine.dispatchEvent(new win!.Event("change"));
      }
      assert.isFalse(
        win?.document.getElementById("interlinear-gemini-section")?.hidden ?? true,
      );
      assert.isTrue(
        win?.document.getElementById("interlinear-claude-section")?.hidden ?? false,
      );
      if (engine) {
        engine.value = "claude";
        engine.dispatchEvent(new win!.Event("change"));
      }

      const values: Array<[string, string]> = [
        ["interlinear-claude-endpoint", "https://api.anthropic.com/v1"],
        ["interlinear-claude-model", "claude-sonnet-4-5"],
        ["interlinear-claude-api-key", "claude-secret"],
        ["interlinear-claude-temperature", "0.5"],
        ["interlinear-claude-prompt", "Claude 自定义提示词。"],
        ["interlinear-gemini-base-url", "https://generativelanguage.googleapis.com"],
        ["interlinear-gemini-model", "gemini-2.5-pro"],
        ["interlinear-gemini-api-key", "gemini-secret"],
        ["interlinear-gemini-temperature", "0.3"],
        ["interlinear-gemini-prompt", "Gemini 自定义提示词。"],
      ];
      for (const [id, value] of values) {
        const input = byId(id);
        assert.exists(input, id);
        if (input) input.value = value;
      }
      save.click();

      assert.equal(Zotero.Prefs.get(keys[0], true), "claude");
      assert.equal(Zotero.Prefs.get(keys[1], true), "https://api.anthropic.com/v1/messages");
      assert.equal(Zotero.Prefs.get(keys[2], true), "claude-sonnet-4-5");
      assert.equal(Zotero.Prefs.get(keys[3], true), "claude-secret");
      assert.equal(Zotero.Prefs.get(keys[4], true), "0.5");
      assert.equal(Zotero.Prefs.get(keys[5], true), "Claude 自定义提示词。");
      assert.equal(Zotero.Prefs.get(keys[6], true), "https://generativelanguage.googleapis.com");
      assert.equal(Zotero.Prefs.get(keys[7], true), "gemini-2.5-pro");
      assert.equal(Zotero.Prefs.get(keys[8], true), "gemini-secret");
      assert.equal(Zotero.Prefs.get(keys[9], true), "0.3");
      assert.equal(Zotero.Prefs.get(keys[10], true), "Gemini 自定义提示词。");
    } finally {
      win?.close();
      for (const [key, value] of previous) {
        if (value === undefined) Zotero.Prefs.clear(key, true);
        else Zotero.Prefs.set(key, value as any, true);
      }
    }
  });

  it("should save glossary terms and include their hash in cache tags", async function () {
    this.timeout(10000);
    const glossaryPref = "extensions.zotero.interlinear.glossary";
    const enginePref = "extensions.zotero.interlinear.engine";
    const previousGlossary = Zotero.Prefs.get(glossaryPref, true);
    const previousEngine = Zotero.Prefs.get(enginePref, true);
    const win = Zotero.Utilities.Internal.openPreferences("interlinear-preferences");
    assert.exists(win);
    const byId = (id: string) =>
      win?.document.getElementById(id) as
        | (HTMLInputElement & HTMLSelectElement & HTMLTextAreaElement)
        | null;

    try {
      for (let attempt = 0; attempt < 100; attempt++) {
        const root = win?.document.getElementById("interlinear-settings-root");
        if (root?.dataset.initialized === "true") break;
        await Zotero.Promise.delay(50);
      }

      const textarea = byId("interlinear-glossary");
      const engine = byId("interlinear-engine");
      const save = win?.document.getElementById("interlinear-save") as HTMLButtonElement;
      assert.exists(textarea);
      assert.exists(engine);
      assert.exists(save);

      if (engine) {
        engine.value = "openai";
        engine.dispatchEvent(new win!.Event("change"));
      }
      if (textarea) {
        textarea.value = "source,target\ngene,基因\nprotein,蛋白质\n";
      }
      save.click();
      assert.include(String(Zotero.Prefs.get(glossaryPref, true)), "gene,基因");
      assert.equal(Zotero.Prefs.get(enginePref, true), "openai");

      const firstTag = getCacheEngineTag();
      assert.match(firstTag, /:g:[0-9a-f]{8}$/u);
      assert.notInclude(firstTag, "基因");

      if (textarea) {
        textarea.value = "gene,遗传因子\n";
      }
      save.click();
      const secondTag = getCacheEngineTag();
      assert.notEqual(firstTag, secondTag);
      assert.notInclude(secondTag, "遗传因子");

      if (engine) {
        engine.value = "google";
        engine.dispatchEvent(new win!.Event("change"));
      }
      save.click();
      const googleFirstTag = getCacheEngineTag();
      assert.match(googleFirstTag, /^google:/u);
      assert.match(googleFirstTag, /:g:[0-9a-f]{8}$/u);
      if (textarea) {
        textarea.value = "gene,基因\n";
      }
      save.click();
      const googleSecondTag = getCacheEngineTag();
      assert.notEqual(googleFirstTag, googleSecondTag);
    } finally {
      win?.close();
      for (const [key, value] of [
        [glossaryPref, previousGlossary],
        [enginePref, previousEngine],
      ] as Array<[string, unknown]>) {
        if (value === undefined) Zotero.Prefs.clear(key, true);
        else Zotero.Prefs.set(key, value as any, true);
      }
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
      assert.notInclude(cssAfter, "#ff0000");
      assert.notInclude(cssAfter, "body {");
    } finally {
      win?.close();
      (Zotero.Reader as any)._readers = originalReaders;
      for (const [key, value] of previous) {
        if (value === undefined) Zotero.Prefs.clear(key, true);
        else Zotero.Prefs.set(key, value as any, true);
      }
    }
  });

  it("should switch display modes without moving source nodes", async function () {
    this.timeout(10000);
    const enginePref = "extensions.zotero.interlinear.engine";
    const modePref = "extensions.zotero.interlinear.displayMode";
    const previousEngine = Zotero.Prefs.get(enginePref, true);
    const previousMode = Zotero.Prefs.get(modePref, true);
    const previousPDFTranslate = (Zotero as any).PDFTranslate;
    const previousRequest = Zotero.HTTP.request;
    const originalReaders = (Zotero.Reader as any)._readers;

    const doc = Zotero.getMainWindow().document.implementation.createHTMLDocument("display-test");
    const content = doc.createElement("div");
    content.id = "sdt-content";
    for (const [refPath, text] of [
      ["0", `First synthetic paragraph ${Date.now()}.`],
      ["1", `Second synthetic paragraph ${Date.now()}.`],
    ]) {
      const paragraph = doc.createElement("p");
      paragraph.dataset.refPath = refPath;
      paragraph.textContent = text;
      content.append(paragraph);
    }
    doc.body.append(content);

    const reader = {
      type: "pdf",
      itemID: 2147483640,
      _iframeWindow: { alert: () => undefined },
      _internalReader: {
        _lastViewPrimary: true,
        _primarySDTView: {
          _iframeDocument: doc,
          getData: () => ({ structure: null }),
        },
      },
    };
    (Zotero.Reader as any)._readers = [reader];

    try {
      // A removed backend stored by an old install must fall back to Google
      // instead of reaching for Translate for Zotero.
      Zotero.Prefs.set(enginePref, "pdftranslate", true);
      Zotero.Prefs.set(modePref, "top-bottom", true);
      let pdfTranslateCalls = 0;
      (Zotero as any).PDFTranslate = {
        api: {
          translate: async () => {
            pdfTranslateCalls += 1;
            return { status: "success", result: "不应被调用的译文。" };
          },
        },
      };
      (Zotero.HTTP as any).request = async () => ({
        status: 200,
        response: [[["显示模式集成测试译文。", "source", null, null]]],
      });

      await toggleBilingualReading(reader);
      assert.equal(pdfTranslateCalls, 0);

      const sources = Array.from(content.querySelectorAll("p[data-ref-path]")) as HTMLElement[];
      const blocks = Array.from(
        doc.querySelectorAll(".interlinear-translation"),
      ) as HTMLElement[];
      assert.equal(blocks.length, 2);
      for (const [index, source] of sources.entries()) {
        assert.isTrue(source.classList.contains("interlinear-source"));
        assert.equal(source.nextElementSibling, blocks[index]);
        assert.equal(blocks[index].dataset.sourceRefPath, source.dataset.refPath);
      }
      assert.equal(content.dataset.interlinearDisplay, "top-bottom");
      const css = doc.getElementById("interlinear-style")?.textContent || "";
      assert.include(css, 'data-interlinear-display="side-by-side"');
      assert.include(css, 'data-interlinear-display="target-only"');
      assert.include(css, 'data-interlinear-display="source-only"');
      assert.include(css, "display: inline-block;");
      assert.include(css, "width: 49%;");

      for (const mode of ["side-by-side", "target-only", "source-only", "top-bottom"]) {
        Zotero.Prefs.set(modePref, mode, true);
        refreshDisplayModes();
        assert.equal(content.dataset.interlinearDisplay, mode);
        assert.equal(sources[0].nextElementSibling, blocks[0]);
      }

      await toggleBilingualReading(reader);
      for (const source of sources) {
        assert.isFalse(source.classList.contains("interlinear-source"));
      }
      assert.isUndefined(content.dataset.interlinearDisplay);
      assert.equal(doc.querySelectorAll(".interlinear-translation").length, 0);
      assert.isTrue(sources[0].isConnected);
    } finally {
      clearTranslationCache();
      (Zotero.Reader as any)._readers = originalReaders;
      (Zotero as any).PDFTranslate = previousPDFTranslate;
      (Zotero.HTTP as any).request = previousRequest;
      if (previousEngine === undefined) Zotero.Prefs.clear(enginePref, true);
      else Zotero.Prefs.set(enginePref, previousEngine, true);
      if (previousMode === undefined) Zotero.Prefs.clear(modePref, true);
      else Zotero.Prefs.set(modePref, previousMode, true);
    }
  });

  it("should prioritize the viewport again after the user pages during a run", async function () {
    this.timeout(15000);
    const enginePref = "extensions.zotero.interlinear.engine";
    const concurrentPref = "extensions.zotero.interlinear.maxConcurrent";
    const batchPref = "extensions.zotero.interlinear.maxBatchParagraphs";
    const gapPref = "extensions.zotero.interlinear.requestGapMs";
    const previous = new Map<string, unknown>();
    for (const key of [enginePref, concurrentPref, batchPref, gapPref]) {
      previous.set(key, Zotero.Prefs.get(key, true));
    }
    const previousRequest = Zotero.HTTP.request;
    const originalReaders = (Zotero.Reader as any)._readers;

    const doc = Zotero.getMainWindow().document.implementation.createHTMLDocument("viewport-test");
    const content = doc.createElement("div");
    content.id = "sdt-content";
    const texts = ["Alpha viewport paragraph", "Beta far paragraph", "Gamma near paragraph"];
    const elements: HTMLElement[] = texts.map((text, index) => {
      const paragraph = doc.createElement("p");
      paragraph.dataset.refPath = String(index);
      paragraph.textContent = `${text} ${Date.now()}.`;
      content.append(paragraph);
      return paragraph;
    });
    doc.body.append(content);
    const rect = (top: number) => () =>
      ({ top, bottom: top + 10, left: 0, right: 100 }) as DOMRect;
    elements[0].getBoundingClientRect = rect(0);
    elements[1].getBoundingClientRect = rect(5000);
    elements[2].getBoundingClientRect = rect(6000);

    const reader = {
      type: "pdf",
      itemID: 2147483642,
      _iframeWindow: { alert: () => undefined },
      _internalReader: {
        _lastViewPrimary: true,
        _primarySDTView: {
          _iframeDocument: doc,
          getData: () => ({ structure: null }),
        },
      },
    };
    (Zotero.Reader as any)._readers = [reader];

    const bodies: string[] = [];
    const resolvers: Array<(value: any) => void> = [];
    (Zotero.HTTP as any).request = (_method: string, _url: string, options: any) => {
      bodies.push(String(options?.body || ""));
      return new Promise((resolve) => resolvers.push(resolve));
    };

    const waitFor = async (condition: () => boolean) => {
      for (let attempt = 0; attempt < 200; attempt++) {
        if (condition()) return;
        await Zotero.Promise.delay(20);
      }
      throw new Error("Timed out waiting for the next translation request");
    };
    const requestedText = (body: string) => new URLSearchParams(body).get("q") || "";

    try {
      clearTranslationCache();
      Zotero.Prefs.set(enginePref, "google", true);
      Zotero.Prefs.set(concurrentPref, 1, true);
      Zotero.Prefs.set(batchPref, 1, true);
      Zotero.Prefs.set(gapPref, 0, true);

      const run = toggleBilingualReading(reader);
      await waitFor(() => bodies.length === 1);
      assert.include(requestedText(bodies[0]), texts[0]);

      // Simulate paging away from Beta and onto Gamma while Alpha is in flight.
      elements[1].getBoundingClientRect = rect(10000);
      elements[2].getBoundingClientRect = rect(0);
      resolvers.shift()?.({ status: 200, response: [[["译文。", "", null, null]]] });

      await waitFor(() => bodies.length === 2);
      assert.include(requestedText(bodies[1]), texts[2]);
      resolvers.shift()?.({ status: 200, response: [[["译文。", "", null, null]]] });

      await waitFor(() => bodies.length === 3);
      assert.include(requestedText(bodies[2]), texts[1]);
      resolvers.shift()?.({ status: 200, response: [[["译文。", "", null, null]]] });

      await run;
    } finally {
      clearTranslationCache();
      (Zotero.Reader as any)._readers = originalReaders;
      (Zotero.HTTP as any).request = previousRequest;
      for (const [key, value] of previous) {
        if (value === undefined) Zotero.Prefs.clear(key, true);
        else Zotero.Prefs.set(key, value as any, true);
      }
    }
  });

  it("should report reader failures with a non-blocking in-reader notice", async function () {
    this.timeout(10000);
    const toolbarDoc =
      Zotero.getMainWindow().document.implementation.createHTMLDocument("notice-test");
    let alerts = 0;
    const reader = {
      type: "pdf",
      itemID: 2147483641,
      _iframeWindow: {
        document: toolbarDoc,
        alert: () => {
          alerts += 1;
        },
      },
      _internalReader: {},
    };

    await toggleBilingualReading(reader);

    const notice = toolbarDoc.querySelector(
      ".interlinear-error-notice",
    ) as HTMLElement | null;
    assert.exists(notice);
    assert.equal(notice?.getAttribute("role"), "alert");
    assert.isAbove((notice?.textContent || "").trim().length, 2);
    assert.equal(alerts, 0);

    // A second failure updates the existing toast instead of stacking a new one.
    await toggleBilingualReading(reader);
    assert.equal(toolbarDoc.querySelectorAll(".interlinear-error-notice").length, 1);

    const close = notice?.querySelector(
      ".interlinear-error-notice-close",
    ) as HTMLButtonElement | null;
    assert.exists(close);
    assert.isNotEmpty(close?.getAttribute("aria-label") || "");
    close?.dispatchEvent(
      new (Zotero.getMainWindow() as any).MouseEvent("click", { bubbles: true }),
    );
    assert.isNull(toolbarDoc.querySelector(".interlinear-error-notice"));
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

  it("should translate through Google with the selected language pair", async function () {
    this.timeout(10000);
    const enginePref = "extensions.zotero.interlinear.engine";
    const sourcePref = "extensions.zotero.interlinear.language.source";
    const targetPref = "extensions.zotero.interlinear.language.target";
    const glossaryPref = "extensions.zotero.interlinear.glossary";
    const previousEngine = Zotero.Prefs.get(enginePref, true);
    const previousSource = Zotero.Prefs.get(sourcePref, true);
    const previousTarget = Zotero.Prefs.get(targetPref, true);
    const previousGlossary = Zotero.Prefs.get(glossaryPref, true);
    const previousRequest = Zotero.HTTP.request;
    let requestedMethod = "";
    let requestedURL = "";
    let requestedBody = "";

    const doc = Zotero.getMainWindow().document.implementation.createHTMLDocument("google-test");
    const content = doc.createElement("div");
    content.id = "sdt-content";
    const paragraph = doc.createElement("p");
    paragraph.dataset.refPath = "0";
    paragraph.textContent = `A synthetic Google paragraph ${Date.now()}.`;
    content.append(paragraph);
    doc.body.append(content);

    const reader = {
      itemID: 2147483642,
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
      Zotero.Prefs.set(enginePref, "google", true);
      Zotero.Prefs.set(sourcePref, "en", true);
      Zotero.Prefs.set(targetPref, "zh-CN", true);
      Zotero.Prefs.set(glossaryPref, "source,target\ngene,基因\n", true);
      (Zotero.HTTP as any).request = async (
        method: string,
        url: string,
        options: any,
      ) => {
        requestedMethod = method;
        requestedURL = url;
        requestedBody = String(options?.body || "");
        return {
          status: 200,
          response: JSON.stringify([[["This gene is useful.", "source", null, null, 1]]]),
        };
      };

      await toggleBilingualReading(reader);

      const translated = doc.querySelector(".interlinear-translation");
      assert.equal(requestedMethod, "POST");
      assert.match(requestedURL, /translate_a\/single$/u);
      assert.include(requestedBody, "sl=en");
      assert.include(requestedBody, "tl=zh-CN");
      assert.equal(translated?.textContent, "This 基因 is useful.");
      assert.equal(translated?.getAttribute("data-state"), "done");
      assert.match(getCacheEngineTag(), /^google:/u);
      assert.include(getCacheEngineTag(), ":en>zh-CN");
      assert.match(getCacheEngineTag(), /:g:[0-9a-f]{8}$/u);
    } finally {
      await toggleBilingualReading(reader);
      clearTranslationCache();
      (Zotero.HTTP as any).request = previousRequest;
      for (const [key, value] of [
        [enginePref, previousEngine],
        [sourcePref, previousSource],
        [targetPref, previousTarget],
        [glossaryPref, previousGlossary],
      ] as Array<[string, unknown]>) {
        if (value === undefined) Zotero.Prefs.clear(key, true);
        else Zotero.Prefs.set(key, value, true);
      }
    }
  });

  it("should translate through OpenAI-compatible endpoints without leaking the key", async function () {
    this.timeout(10000);
    const enginePref = "extensions.zotero.interlinear.engine";
    const apiKeyPref = "extensions.zotero.interlinear.openai.apiKey";
    const glossaryPref = "extensions.zotero.interlinear.glossary";
    const previousEngine = Zotero.Prefs.get(enginePref, true);
    const previousApiKey = Zotero.Prefs.get(apiKeyPref, true);
    const previousGlossary = Zotero.Prefs.get(glossaryPref, true);
    const previousRequest = Zotero.HTTP.request;
    const secret = `sk-integration-${Date.now()}`;
    let requestedURL = "";
    let requestedHeaders: Record<string, string> = {};
    let requestedBody: any = null;

    const doc = Zotero.getMainWindow().document.implementation.createHTMLDocument("openai-test");
    const content = doc.createElement("div");
    content.id = "sdt-content";
    const paragraph = doc.createElement("p");
    paragraph.dataset.refPath = "0";
    paragraph.textContent = `A synthetic OpenAI paragraph ${Date.now()}.`;
    content.append(paragraph);
    doc.body.append(content);

    const reader = {
      itemID: 2147483641,
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
      Zotero.Prefs.set(enginePref, "openai", true);
      Zotero.Prefs.set(apiKeyPref, secret, true);
      Zotero.Prefs.set(glossaryPref, "gene\t基因", true);
      (Zotero.HTTP as any).request = async (
        _method: string,
        url: string,
        options: any,
      ) => {
        requestedURL = url;
        requestedHeaders = options?.headers || {};
        requestedBody = JSON.parse(String(options?.body || "{}"));
        return {
          status: 200,
          response: JSON.stringify({
            choices: [{ message: { content: "OpenAI 集成测试译文。" } }],
          }),
        };
      };

      await toggleBilingualReading(reader);

      const translated = doc.querySelector(".interlinear-translation");
      assert.match(requestedURL, /\/v1\/chat\/completions$/u);
      assert.equal(requestedHeaders.Authorization, `Bearer ${secret}`);
      assert.equal(requestedBody?.messages?.[1]?.content, paragraph.textContent);
      assert.include(requestedBody?.messages?.[0]?.content, "gene => 基因");
      assert.equal(translated?.textContent, "OpenAI 集成测试译文。");
      assert.match(getCacheEngineTag(), /:g:[0-9a-f]{8}$/u);
      assert.notInclude(getCacheEngineTag(), secret);
    } finally {
      await toggleBilingualReading(reader);
      clearTranslationCache();
      (Zotero.HTTP as any).request = previousRequest;
      for (const [key, value] of [
        [enginePref, previousEngine],
        [apiKeyPref, previousApiKey],
        [glossaryPref, previousGlossary],
      ] as Array<[string, unknown]>) {
        if (value === undefined) Zotero.Prefs.clear(key, true);
        else Zotero.Prefs.set(key, value, true);
      }
    }
  });

  it("should translate through Claude without leaking the key", async function () {
    this.timeout(10000);
    const enginePref = "extensions.zotero.interlinear.engine";
    const apiKeyPref = "extensions.zotero.interlinear.claude.apiKey";
    const endpointPref = "extensions.zotero.interlinear.claude.endpoint";
    const previousEngine = Zotero.Prefs.get(enginePref, true);
    const previousApiKey = Zotero.Prefs.get(apiKeyPref, true);
    const previousEndpoint = Zotero.Prefs.get(endpointPref, true);
    const previousRequest = Zotero.HTTP.request;
    const secret = `sk-ant-integration-${Date.now()}`;
    let requestedURL = "";
    let requestedHeaders: Record<string, string> = {};
    let requestedBody: any = null;

    const doc = Zotero.getMainWindow().document.implementation.createHTMLDocument("claude-test");
    const content = doc.createElement("div");
    content.id = "sdt-content";
    const paragraph = doc.createElement("p");
    paragraph.dataset.refPath = "0";
    paragraph.textContent = `A synthetic Claude paragraph ${Date.now()}.`;
    content.append(paragraph);
    doc.body.append(content);

    const reader = {
      itemID: 2147483639,
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
      Zotero.Prefs.set(enginePref, "claude", true);
      Zotero.Prefs.set(apiKeyPref, secret, true);
      Zotero.Prefs.set(endpointPref, "https://api.anthropic.com", true);
      (Zotero.HTTP as any).request = async (
        _method: string,
        url: string,
        options: any,
      ) => {
        requestedURL = url;
        requestedHeaders = options?.headers || {};
        requestedBody = JSON.parse(String(options?.body || "{}"));
        return {
          status: 200,
          response: JSON.stringify({
            content: [
              { type: "thinking", thinking: "hidden" },
              { type: "text", text: "Claude 集成测试译文。" },
            ],
          }),
        };
      };

      await toggleBilingualReading(reader);

      const translated = doc.querySelector(".interlinear-translation");
      assert.equal(requestedURL, "https://api.anthropic.com/v1/messages");
      assert.equal(requestedHeaders["x-api-key"], secret);
      assert.equal(requestedHeaders["anthropic-version"], "2023-06-01");
      assert.equal(requestedBody?.messages?.[0]?.content?.[0]?.text, paragraph.textContent);
      assert.include(requestedBody?.system || "", "源语言");
      assert.equal(translated?.textContent, "Claude 集成测试译文。");
      assert.match(getCacheEngineTag(), /^claude:/u);
      assert.notInclude(getCacheEngineTag(), secret);
    } finally {
      await toggleBilingualReading(reader);
      clearTranslationCache();
      (Zotero.HTTP as any).request = previousRequest;
      for (const [key, value] of [
        [enginePref, previousEngine],
        [apiKeyPref, previousApiKey],
        [endpointPref, previousEndpoint],
      ] as Array<[string, unknown]>) {
        if (value === undefined) Zotero.Prefs.clear(key, true);
        else Zotero.Prefs.set(key, value, true);
      }
    }
  });

  it("should translate through Gemini without leaking the key", async function () {
    this.timeout(10000);
    const enginePref = "extensions.zotero.interlinear.engine";
    const apiKeyPref = "extensions.zotero.interlinear.gemini.apiKey";
    const baseURLPref = "extensions.zotero.interlinear.gemini.baseUrl";
    const previousEngine = Zotero.Prefs.get(enginePref, true);
    const previousApiKey = Zotero.Prefs.get(apiKeyPref, true);
    const previousBaseURL = Zotero.Prefs.get(baseURLPref, true);
    const previousRequest = Zotero.HTTP.request;
    const secret = `AIza-integration-${Date.now()}`;
    let requestedURL = "";
    let requestedHeaders: Record<string, string> = {};
    let requestedBody: any = null;

    const doc = Zotero.getMainWindow().document.implementation.createHTMLDocument("gemini-test");
    const content = doc.createElement("div");
    content.id = "sdt-content";
    const paragraph = doc.createElement("p");
    paragraph.dataset.refPath = "0";
    paragraph.textContent = `A synthetic Gemini paragraph ${Date.now()}.`;
    content.append(paragraph);
    doc.body.append(content);

    const reader = {
      itemID: 2147483638,
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
      Zotero.Prefs.set(enginePref, "gemini", true);
      Zotero.Prefs.set(apiKeyPref, secret, true);
      Zotero.Prefs.set(baseURLPref, "https://generativelanguage.googleapis.com", true);
      (Zotero.HTTP as any).request = async (
        _method: string,
        url: string,
        options: any,
      ) => {
        requestedURL = url;
        requestedHeaders = options?.headers || {};
        requestedBody = JSON.parse(String(options?.body || "{}"));
        return {
          status: 200,
          response: JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ thought: true, text: "hidden" }, { text: "Gemini 集成测试译文。" }],
                },
              },
            ],
          }),
        };
      };

      await toggleBilingualReading(reader);

      const translated = doc.querySelector(".interlinear-translation");
      assert.equal(
        requestedURL,
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      );
      assert.equal(requestedHeaders["x-goog-api-key"], secret);
      assert.equal(requestedBody?.contents?.[0]?.parts?.[0]?.text, paragraph.textContent);
      assert.include(requestedBody?.systemInstruction?.parts?.[0]?.text || "", "源语言");
      assert.equal(translated?.textContent, "Gemini 集成测试译文。");
      assert.match(getCacheEngineTag(), /^gemini:/u);
      assert.notInclude(getCacheEngineTag(), secret);
    } finally {
      await toggleBilingualReading(reader);
      clearTranslationCache();
      (Zotero.HTTP as any).request = previousRequest;
      for (const [key, value] of [
        [enginePref, previousEngine],
        [apiKeyPref, previousApiKey],
        [baseURLPref, previousBaseURL],
      ] as Array<[string, unknown]>) {
        if (value === undefined) Zotero.Prefs.clear(key, true);
        else Zotero.Prefs.set(key, value, true);
      }
    }
  });

  it("should skip the configured number of trailing PDF pages", async function () {
    this.timeout(10000);
    const enginePref = "extensions.zotero.interlinear.engine";
    const skipPref = "extensions.zotero.interlinear.skipLastPages";
    const previousEngine = Zotero.Prefs.get(enginePref, true);
    const previousSkip = Zotero.Prefs.get(skipPref, true);
    const previousRequest = Zotero.HTTP.request;
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
      Zotero.Prefs.set(enginePref, "google", true);
      Zotero.Prefs.set(skipPref, 1, true);
      (Zotero.HTTP as any).request = async () => {
        requestCount += 1;
        return {
          status: 200,
          response: [[["第一页译文。", "source", null, null]]],
        };
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
      (Zotero.HTTP as any).request = previousRequest;
      if (previousEngine === undefined) Zotero.Prefs.clear(enginePref, true);
      else Zotero.Prefs.set(enginePref, previousEngine, true);
      if (previousSkip === undefined) Zotero.Prefs.clear(skipPref, true);
      else Zotero.Prefs.set(skipPref, previousSkip, true);
    }
  });

  it("should translate one paragraph and one selection on demand", async function () {
    this.timeout(10000);
    const enginePref = "extensions.zotero.interlinear.engine";
    const previousEngine = Zotero.Prefs.get(enginePref, true);
    const previousRequest = Zotero.HTTP.request;
    const requested: string[] = [];
    const stamp = Date.now();

    const doc = Zotero.getMainWindow().document.implementation.createHTMLDocument(
      "on-demand-test",
    );
    const content = doc.createElement("div");
    content.id = "sdt-content";
    const paragraph = doc.createElement("p");
    paragraph.dataset.refPath = "0";
    paragraph.textContent = `On demand paragraph ${stamp}.`;
    content.append(paragraph);
    doc.body.append(content);

    const reader = {
      itemID: 2147483639,
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
      Zotero.Prefs.set(enginePref, "google", true);
      (Zotero.HTTP as any).request = async (
        _method: string,
        _url: string,
        options: Record<string, any>,
      ) => {
        const text = new URLSearchParams(String(options?.body || "")).get("q") || "";
        requested.push(text);
        return {
          status: 200,
          response: [[[`译文：${text}`, text, null, null]]],
        };
      };

      await translateReaderParagraph(reader, paragraph);
      const block = paragraph.nextElementSibling as HTMLElement;
      assert.equal(block?.className, "interlinear-translation");
      assert.equal(block?.getAttribute("data-state"), "done");
      assert.equal(block?.textContent, `译文：On demand paragraph ${stamp}.`);
      assert.isTrue(paragraph.classList.contains("interlinear-source"));

      await translateReaderParagraph(reader, paragraph);
      assert.equal(requested.length, 1);

      const selected = await translateSelectedText(reader, `  Selected\n text ${stamp}.  `);
      assert.equal(requested.length, 2);
      assert.equal(requested[1], `Selected text ${stamp}.`);
      assert.equal(selected, `译文：Selected text ${stamp}.`);

      const cached = await translateSelectedText(reader, `Selected text ${stamp}.`);
      assert.equal(requested.length, 2);
      assert.equal(cached, `译文：Selected text ${stamp}.`);
    } finally {
      clearTranslationCache();
      (Zotero.HTTP as any).request = previousRequest;
      if (previousEngine === undefined) Zotero.Prefs.clear(enginePref, true);
      else Zotero.Prefs.set(enginePref, previousEngine, true);
    }
  });

  it("should open a selection popup and translate one paragraph from Alt triggers", async function () {
    this.timeout(10000);
    const doc = Zotero.getMainWindow().document.implementation.createHTMLDocument(
      "interaction-test",
    );
    const content = doc.createElement("div");
    content.id = "sdt-content";
    const first = doc.createElement("p");
    first.dataset.refPath = "0";
    first.textContent = "First paragraph for Alt triggers.";
    const second = doc.createElement("p");
    second.dataset.refPath = "1";
    second.textContent = "Second paragraph for the selection popup.";
    content.append(first, second);
    doc.body.append(content);

    let selectionText = "Selected   passage\nfor popup";
    let selectionNode: Node = first.firstChild || first;
    const selectedCalls: string[] = [];
    const paragraphCalls: string[] = [];
    const controller = attachReaderInteractions(
      doc,
      {
        translateSelection: async (text) => {
          selectedCalls.push(text);
          return "Popup translation.";
        },
        translateParagraph: async (source) => {
          paragraphCalls.push(source.dataset.refPath || "");
        },
      },
      {
        getSelection: () => ({
          toString: () => selectionText,
          isCollapsed: false,
          rangeCount: 1,
          getRangeAt: () => ({
            startContainer: selectionNode,
            commonAncestorContainer: selectionNode,
            getBoundingClientRect: () => ({
              left: 20,
              top: 30,
              right: 200,
              bottom: 44,
            }),
          }),
        }),
        setTimer: (callback) => callback(),
      },
    );

    try {
      const win = Zotero.getMainWindow() as any;
      first.dispatchEvent(new win.MouseEvent("mouseup", { bubbles: true }));

      const popup = doc.querySelector(".interlinear-selection-popup") as HTMLElement;
      assert.exists(popup);
      assert.isFalse(popup.hidden);
      const button = popup.querySelector(".interlinear-selection-translate") as HTMLButtonElement;
      assert.isNotEmpty(button?.textContent || "");
      button.click();

      for (let attempt = 0; attempt < 100; attempt++) {
        const result = popup.querySelector(".interlinear-selection-result");
        if (result?.getAttribute("data-state") === "done") break;
        await Zotero.Promise.delay(20);
      }
      assert.deepEqual(selectedCalls, ["Selected passage for popup"]);
      assert.equal(
        popup.querySelector(".interlinear-selection-result")?.textContent,
        "Popup translation.",
      );

      first.dispatchEvent(new win.MouseEvent("mousemove", { bubbles: true, altKey: true }));
      assert.isTrue(first.classList.contains("interlinear-source-hover"));
      first.dispatchEvent(new win.MouseEvent("click", { bubbles: true, altKey: true }));
      assert.deepEqual(paragraphCalls, ["0"]);
      assert.isFalse(first.classList.contains("interlinear-source-hover"));

      selectionText = "Second paragraph";
      selectionNode = second.firstChild || second;
      second.dispatchEvent(
        new win.KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          altKey: true,
          key: "Enter",
        }),
      );
      assert.deepEqual(paragraphCalls, ["0", "1"]);
    } finally {
      controller.dispose();
    }

    assert.notExists(doc.querySelector(".interlinear-selection-popup"));
    assert.isFalse(first.classList.contains("interlinear-source-hover"));
  });

  it("should translate on hover dwell and respect configurable shortcut settings", async function () {
    this.timeout(10000);
    const doc = Zotero.getMainWindow().document.implementation.createHTMLDocument(
      "interaction-settings-test",
    );
    const content = doc.createElement("div");
    content.id = "sdt-content";
    const first = doc.createElement("p");
    first.dataset.refPath = "0";
    first.textContent = "First paragraph for hover translation.";
    const second = doc.createElement("p");
    second.dataset.refPath = "1";
    second.textContent = "Second paragraph for the custom shortcut.";
    content.append(first, second);
    doc.body.append(content);

    let hoverSettings = { enabled: true, delayMs: 500 };
    let shortcutSettings = {
      enabled: true,
      spec: parseShortcut("Ctrl+Shift+T"),
    };
    let selection: any = null;
    const scheduled: Array<{ callback: () => void; delay: number }> = [];
    const paragraphCalls: string[] = [];
    const controller = attachReaderInteractions(
      doc,
      {
        translateSelection: async () => "",
        translateParagraph: async (source) => {
          paragraphCalls.push(source.dataset.refPath || "");
        },
      },
      {
        getSelection: () => selection,
        getHoverSettings: () => hoverSettings,
        getShortcutSettings: () => shortcutSettings,
        setHoverTimer: (callback, delay) => {
          scheduled.push({ callback, delay });
          return scheduled.length;
        },
        clearHoverTimer: () => undefined,
      },
    );

    try {
      const win = Zotero.getMainWindow() as any;
      first.dispatchEvent(
        new win.MouseEvent("mousemove", { bubbles: true, clientX: 10, clientY: 10 }),
      );
      assert.equal(scheduled.length, 1);
      assert.equal(scheduled[0].delay, 500);
      assert.isTrue(first.classList.contains("interlinear-source-hover-auto"));
      scheduled[0].callback();
      assert.deepEqual(paragraphCalls, ["0"]);
      assert.isTrue(first.classList.contains("interlinear-source-hover-auto"));

      second.dispatchEvent(
        new win.MouseEvent("mousemove", { bubbles: true, clientX: 20, clientY: 20 }),
      );
      assert.equal(scheduled.length, 2);
      content.dispatchEvent(new win.Event("scroll", { bubbles: true }));
      scheduled[1].callback();
      assert.deepEqual(paragraphCalls, ["0"]);

      hoverSettings = { enabled: false, delayMs: 500 };
      second.dispatchEvent(
        new win.MouseEvent("mousemove", { bubbles: true, clientX: 30, clientY: 30 }),
      );
      assert.equal(scheduled.length, 2);

      selection = {
        toString: () => "Second paragraph",
        isCollapsed: false,
        rangeCount: 1,
        getRangeAt: () => ({ startContainer: second.firstChild || second }),
      };
      second.dispatchEvent(
        new win.KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          altKey: true,
          key: "Enter",
        }),
      );
      assert.deepEqual(paragraphCalls, ["0"]);

      second.dispatchEvent(
        new win.KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
          shiftKey: true,
          key: "T",
        }),
      );
      assert.deepEqual(paragraphCalls, ["0", "1"]);

      shortcutSettings = { enabled: false, spec: parseShortcut("Ctrl+Shift+T") };
      first.dispatchEvent(
        new win.KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
          shiftKey: true,
          key: "T",
        }),
      );
      assert.deepEqual(paragraphCalls, ["0", "1"]);
    } finally {
      controller.dispose();
    }
  });

  it("should retry failed and paused paragraphs from the translation block", function () {
    const doc = Zotero.getMainWindow().document.implementation.createHTMLDocument("retry-test");
    const content = doc.createElement("div");
    content.id = "sdt-content";
    const source = doc.createElement("p");
    source.dataset.refPath = "0";
    source.textContent = "A paragraph whose translation failed.";
    const block = doc.createElement("div");
    block.className = "interlinear-translation";
    block.dataset.state = "error";
    block.textContent = "Translation failed: offline";
    content.append(source, block);
    doc.body.append(content);

    let collapsed = true;
    const calls: string[] = [];
    const controller = attachReaderInteractions(
      doc,
      {
        translateSelection: async () => "",
        translateParagraph: async (element) => {
          calls.push(element.dataset.refPath || "");
        },
      },
      {
        getSelection: () => ({
          toString: () => "selected error text",
          isCollapsed: collapsed,
          rangeCount: 1,
          getRangeAt: () => ({ startContainer: block }),
        }),
      },
    );

    try {
      const win = Zotero.getMainWindow() as any;
      block.dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true }));
      assert.deepEqual(calls, ["0"]);

      // Selecting text inside a failure message must not trigger a retry.
      collapsed = false;
      block.dataset.state = "paused";
      block.dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true }));
      assert.deepEqual(calls, ["0"]);

      collapsed = true;
      block.dispatchEvent(
        new win.KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter" }),
      );
      assert.deepEqual(calls, ["0", "0"]);
    } finally {
      controller.dispose();
    }
  });

  it("should show progress and cancel a running translation from the reader toolbar", async function () {
    this.timeout(10000);
    const enginePref = "extensions.zotero.interlinear.engine";
    const previousEngine = Zotero.Prefs.get(enginePref, true);
    const previousRequest = Zotero.HTTP.request;

    const doc = Zotero.getMainWindow().document.implementation.createHTMLDocument(
      "progress-test",
    );
    const content = doc.createElement("div");
    content.id = "sdt-content";
    const paragraph = doc.createElement("p");
    paragraph.dataset.refPath = "0";
    paragraph.textContent = `A paragraph that waits for progress ${Date.now()}.`;
    content.append(paragraph);
    doc.body.append(content);

    const toolbarDoc = Zotero.getMainWindow().document.implementation.createHTMLDocument(
      "toolbar-progress-test",
    );
    const reader = {
      type: "pdf",
      itemID: 2147483638,
      _iframeWindow: { document: toolbarDoc, alert: () => undefined },
      _internalReader: {
        _lastViewPrimary: true,
        _primarySDTView: {
          _iframeDocument: doc,
          getData: () => ({ structure: null }),
        },
      },
    };
    renderReaderToolbar({
      reader,
      doc: toolbarDoc,
      append: (...elements: HTMLElement[]) => toolbarDoc.body.append(...elements),
    });

    const progress = toolbarDoc.querySelector(".interlinear-progress") as HTMLElement;
    const toggle = toolbarDoc.querySelector(".interlinear-toolbar-button") as HTMLButtonElement;
    assert.exists(progress);
    assert.exists(toggle);
    assert.isTrue(progress.hidden);
    const idleTitle = toggle.title;
    assert.isNotEmpty(idleTitle);

    let resolveTranslation: (value: any) => void = () => undefined;
    let requested = false;
    (Zotero.HTTP as any).request = () => {
      requested = true;
      return new Promise((resolve) => {
        resolveTranslation = resolve;
      });
    };

    try {
      Zotero.Prefs.set(enginePref, "ollama", true);
      const run = toggleBilingualReading(reader);

      for (let attempt = 0; attempt < 200; attempt++) {
        if (!progress.hidden && progress.textContent === "0/1") break;
        await Zotero.Promise.delay(20);
      }
      assert.isTrue(requested);
      assert.isFalse(progress.hidden);
      assert.equal(progress.textContent, "0/1");
      assert.notEqual(toggle.title, idleTitle);

      await toggleBilingualReading(reader);
      assert.isTrue(progress.hidden);
      assert.equal(toggle.title, idleTitle);
      assert.equal(doc.querySelectorAll(".interlinear-translation").length, 0);

      resolveTranslation({
        status: 200,
        response: { message: { content: "late" } },
      });
      await run;

      (Zotero.HTTP as any).request = async () => ({
        status: 200,
        response: { message: { content: "完成后的译文。" } },
      });
      await toggleBilingualReading(reader);
      assert.equal(
        doc.querySelector(".interlinear-translation")?.textContent,
        "完成后的译文。",
      );
      assert.isTrue(progress.hidden);
      assert.equal(toggle.title, idleTitle);
    } finally {
      clearTranslationCache();
      (Zotero.HTTP as any).request = previousRequest;
      if (previousEngine === undefined) Zotero.Prefs.clear(enginePref, true);
      else Zotero.Prefs.set(enginePref, previousEngine, true);
    }
  });

  it("shrinks the reader toolbar icon and exposes every action from its context menu", function () {
    this.timeout(10000);
    const modePref = "extensions.zotero.interlinear.displayMode";
    const previousMode = Zotero.Prefs.get(modePref, true);
    const originalReaders = (Zotero.Reader as any)._readers;

    const doc = Zotero.getMainWindow().document.implementation.createHTMLDocument(
      "menu-sdt-test",
    );
    const content = doc.createElement("div");
    content.id = "sdt-content";
    doc.body.append(content);

    const toolbarDoc = Zotero.getMainWindow().document.implementation.createHTMLDocument(
      "menu-toolbar-test",
    );
    const reader = {
      type: "pdf",
      itemID: 2147483637,
      _iframeWindow: { document: toolbarDoc, alert: () => undefined },
      _internalReader: {
        _lastViewPrimary: true,
        _primarySDTView: {
          _iframeDocument: doc,
          getData: () => ({ structure: null }),
        },
      },
    };
    (Zotero.Reader as any)._readers = [reader];

    try {
      renderReaderToolbar({
        reader,
        doc: toolbarDoc,
        append: (...elements: HTMLElement[]) => toolbarDoc.body.append(...elements),
      });

      const toggle = toolbarDoc.querySelector(
        ".interlinear-toolbar-button",
      ) as HTMLButtonElement;
      const icon = toggle?.querySelector("img") as HTMLImageElement | null;
      assert.exists(icon);
      assert.match(String(icon?.src), /^data:image\/png;base64,/);
      assert.equal(icon?.style.width, "16px");
      assert.equal(icon?.style.height, "16px");

      const win = Zotero.getMainWindow() as any;
      toggle.dispatchEvent(
        new win.MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          clientX: 24,
          clientY: 32,
        }),
      );

      const menu = toolbarDoc.querySelector(".interlinear-reader-menu") as HTMLElement;
      assert.exists(menu);
      const actions = Array.from(menu.querySelectorAll("button[data-action]")).map(
        (button) => button.getAttribute("data-action"),
      );
      for (const action of [
        "toggle",
        "refresh",
        "cancel",
        "display:top-bottom",
        "display:side-by-side",
        "display:target-only",
        "display:source-only",
        "export",
        "chat",
        "settings",
      ]) {
        assert.include(actions, action);
      }

      const targetOnly = menu.querySelector(
        '[data-action="display:target-only"]',
      ) as HTMLButtonElement;
      targetOnly.click();
      assert.equal(getDisplayMode(), "target-only");
      assert.notExists(toolbarDoc.querySelector(".interlinear-reader-menu"));
    } finally {
      (Zotero.Reader as any)._readers = originalReaders;
      if (previousMode === undefined) Zotero.Prefs.clear(modePref, true);
      else Zotero.Prefs.set(modePref, previousMode, true);
    }
  });
});

describe("chat", function () {
  function createSdtDocument(texts: string[]) {
    const doc = Zotero.getMainWindow().document.implementation.createHTMLDocument(
      "chat-context-test",
    );
    const content = doc.createElement("div");
    content.id = "sdt-content";
    doc.body.append(content);
    const paragraphs = texts.map((text, index) => {
      const paragraph = doc.createElement("p");
      paragraph.dataset.refPath = `0/${index}`;
      paragraph.textContent = text;
      content.append(paragraph);
      return paragraph;
    });
    return { doc, paragraphs };
  }

  it("registers a reader-only chat section", function () {
    const data = (Zotero.ItemPaneManager as any).customSectionData;
    // Zotero namespaces custom pane IDs with the plugin ID before validation.
    const section = (data.options as any[]).find((option) =>
      String(option.paneID).endsWith("-interlinear-chat"),
    );
    assert.exists(section);
    assert.equal(section.pluginID, config.addonID);
    assert.equal(
      section.header.l10nID,
      `${config.addonRef}-item-section-chat-head-text`,
    );
    assert.include(section.bodyXHTML, "interlinear-chat-root");
    assert.include(section.bodyXHTML, "interlinear-chat-privacy");
    assert.include(section.bodyXHTML, "interlinear-actions-toggle");
    assert.include(section.bodyXHTML, "interlinear-action-toggle");
    assert.include(section.bodyXHTML, "interlinear-action-refresh");
    assert.include(section.bodyXHTML, "interlinear-action-cancel");
    assert.include(section.bodyXHTML, "interlinear-action-export");
    assert.include(section.bodyXHTML, "interlinear-action-settings");
    assert.include(section.bodyXHTML, "interlinear-display-mode");

    const states: boolean[] = [];
    const setEnabled = (value: boolean) => states.push(value);
    section.onItemChange({ tabType: "reader", setEnabled });
    section.onItemChange({ tabType: "library", setEnabled });
    assert.deepEqual(states, [true, false]);
  });

  it("collects document, selection and viewport context", function () {
    const { doc, paragraphs } = createSdtDocument([
      "第一段内容。",
      "第二段内容。",
      "第三段内容。",
    ]);

    const whole = collectChatContext(doc, "document");
    assert.exists(whole);
    assert.equal(whole?.paragraphCount, 3);
    assert.include(whole?.text, "第一段内容。");
    assert.include(whole?.text, "第三段内容。");

    const selected = collectChatContext(doc, "selection", {
      selection: { anchorNode: paragraphs[1].firstChild },
    });
    assert.exists(selected);
    assert.equal(selected?.paragraphCount, 1);
    assert.equal(selected?.text, "第二段内容。");

    paragraphs[0].getBoundingClientRect = () =>
      ({ top: -200, bottom: -50 }) as unknown as DOMRect;
    paragraphs[1].getBoundingClientRect = () =>
      ({ top: 10, bottom: 60 }) as unknown as DOMRect;
    paragraphs[2].getBoundingClientRect = () =>
      ({ top: 900, bottom: 960 }) as unknown as DOMRect;

    const page = collectChatContext(doc, "page", { viewportHeight: 500 });
    assert.exists(page);
    assert.equal(page?.paragraphCount, 1);
    assert.equal(page?.text, "第二段内容。");

    assert.isNull(collectChatContext(doc, "selection", { selection: null }));

    const emptyDoc = Zotero.getMainWindow().document.implementation.createHTMLDocument(
      "chat-empty-test",
    );
    assert.isNull(collectChatContext(emptyDoc, "document"));
  });

  it("truncates chat context at a paragraph boundary", function () {
    const { doc } = createSdtDocument(["甲".repeat(40), "乙".repeat(40)]);
    const result = collectChatContext(doc, "document", { limit: 50 });
    assert.exists(result);
    assert.isTrue(result?.truncated);
    assert.equal(result?.text, "甲".repeat(40));
  });

  it("exposes chat only for LLM-backed engines", function () {
    assert.isNull(getChatProvider("google"));
    for (const engine of ["openai", "claude", "gemini", "ollama"] as const) {
      assert.exists(getChatProvider(engine));
    }
  });

  it("sends chat turns with the glossary and extracts the reply", async function () {
    const enginePref = "extensions.zotero.interlinear.engine";
    const glossaryPref = "extensions.zotero.interlinear.glossary";
    const previousEngine = Zotero.Prefs.get(enginePref, true);
    const previousGlossary = Zotero.Prefs.get(glossaryPref, true);
    const originalRequest = (Zotero.HTTP as any).request;
    let captured: any = null;

    (Zotero.HTTP as any).request = async (
      method: string,
      url: string,
      options: any,
    ) => {
      captured = { method, url, options };
      const payload = JSON.stringify({ choices: [{ message: { content: "这是回答。" } }] });
      return {
        status: 200,
        statusText: "OK",
        responseType: "text",
        responseText: payload,
        response: payload,
      };
    };

    try {
      Zotero.Prefs.set(enginePref, "openai", true);
      Zotero.Prefs.set(glossaryPref, "gene\t基因", true);

      const provider = getChatProvider("openai");
      assert.exists(provider);
      const answer = await provider!.chat([
        { role: "user", content: "问题一" },
        { role: "assistant", content: "回答一" },
        { role: "user", content: "问题二" },
      ]);

      assert.equal(answer, "这是回答。");
      assert.equal(captured.method, "POST");
      assert.match(captured.url, /\/v1\/chat\/completions$/u);
      const body = JSON.parse(captured.options.body);
      assert.equal(body.messages[0].role, "system");
      assert.include(body.messages[0].content, "gene => 基因");
      assert.equal(body.messages.length, 4);
      assert.deepEqual(body.messages.slice(1), [
        { role: "user", content: "问题一" },
        { role: "assistant", content: "回答一" },
        { role: "user", content: "问题二" },
      ]);
      assert.isFalse(captured.options.body.includes("test-api-key"));
    } finally {
      (Zotero.HTTP as any).request = originalRequest;
      if (previousEngine === undefined) Zotero.Prefs.clear(enginePref, true);
      else Zotero.Prefs.set(enginePref, previousEngine, true);
      if (previousGlossary === undefined) Zotero.Prefs.clear(glossaryPref, true);
      else Zotero.Prefs.set(glossaryPref, previousGlossary, true);
    }
  });

  it("sends Gemini chat requests with the key in a header", async function () {
    const enginePref = "extensions.zotero.interlinear.engine";
    const keyPref = "extensions.zotero.interlinear.gemini.apiKey";
    const previousEngine = Zotero.Prefs.get(enginePref, true);
    const previousKey = Zotero.Prefs.get(keyPref, true);
    const originalRequest = (Zotero.HTTP as any).request;
    let captured: any = null;

    (Zotero.HTTP as any).request = async (
      method: string,
      url: string,
      options: any,
    ) => {
      captured = { method, url, options };
      const payload = JSON.stringify({
        candidates: [{ content: { parts: [{ text: "Gemini 回答" }] } }],
      });
      return {
        status: 200,
        statusText: "OK",
        responseType: "text",
        responseText: payload,
        response: payload,
      };
    };

    try {
      Zotero.Prefs.set(enginePref, "gemini", true);
      Zotero.Prefs.set(keyPref, "gemini-test-key", true);

      const provider = getChatProvider("gemini");
      assert.exists(provider);
      const answer = await provider!.chat([{ role: "user", content: "问题" }]);

      assert.equal(answer, "Gemini 回答");
      assert.match(captured.url, /:generateContent$/u);
      assert.equal(captured.options.headers["x-goog-api-key"], "gemini-test-key");
      assert.notInclude(captured.url, "gemini-test-key");
      const body = JSON.parse(captured.options.body);
      assert.deepEqual(body.contents, [{ role: "user", parts: [{ text: "问题" }] }]);
    } finally {
      (Zotero.HTTP as any).request = originalRequest;
      if (previousEngine === undefined) Zotero.Prefs.clear(enginePref, true);
      else Zotero.Prefs.set(enginePref, previousEngine, true);
      if (previousKey === undefined) Zotero.Prefs.clear(keyPref, true);
      else Zotero.Prefs.set(keyPref, previousKey, true);
    }
  });
});
