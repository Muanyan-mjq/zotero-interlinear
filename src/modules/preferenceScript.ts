import {
  DEFAULT_CLAUDE_TEMPERATURE,
  DEFAULT_GEMINI_TEMPERATURE,
  DEFAULT_GOOGLE_BASE_URL,
  DEFAULT_HOVER_DELAY_MS,
  DEFAULT_MAX_CHARS_PER_REQUEST,
  DEFAULT_MAX_BATCH_PARAGRAPHS,
  DEFAULT_MAX_CONCURRENT,
  DEFAULT_MAX_CONSECUTIVE_ERRORS,
  DEFAULT_OLLAMA_MODEL,
  DEFAULT_OLLAMA_URL,
  DEFAULT_OPENAI_ENDPOINT,
  DEFAULT_OPENAI_MODEL,
  DEFAULT_OPENAI_PROMPT,
  DEFAULT_OPENAI_TEMPERATURE,
  DEFAULT_REQUEST_GAP_MS,
  DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_SHORTCUT,
  DEFAULT_SKIP_LAST_PAGES,
  DEFAULT_SOURCE_LANGUAGE,
  DEFAULT_TARGET_LANGUAGE,
  SOURCE_LANGUAGES,
  TARGET_LANGUAGES,
  getAppearance,
  getCachedFontDetection,
  getClaudeApiKey,
  getClaudeEndpoint,
  getClaudeModel,
  getClaudePrompt,
  getClaudeTemperature,
  getDisplayMode,
  getEngine,
  getGeminiApiKey,
  getGeminiBaseURL,
  getGeminiModel,
  getGeminiPrompt,
  getGeminiTemperature,
  getFontFavorites,
  getGlossaryText,
  getGoogleBaseURL,
  getHoverDelayMs,
  getHoverTranslateEnabled,
  getMaxCharsPerRequest,
  getMaxBatchParagraphs,
  getMaxConcurrent,
  getMaxConsecutiveErrors,
  getOllamaModel,
  getOllamaURL,
  getOpenAIApiKey,
  getOpenAIEndpoint,
  getOpenAIModel,
  getOpenAIPrompt,
  getOpenAITemperature,
  getRequestGapMs,
  getRequestTimeoutMs,
  getShortcut,
  getShortcutEnabled,
  getSkipLastPages,
  getSourceLanguage,
  getTargetLanguage,
  setClaudeApiKey,
  setClaudeEndpoint,
  setClaudeModel,
  setClaudePrompt,
  setClaudeTemperature,
  setCachedFontDetection,
  clearCachedFontDetection,
  setEngine,
  setAppearance,
  setDisplayMode,
  setFontFavorites,
  setGeminiApiKey,
  setGeminiBaseURL,
  setGeminiModel,
  setGeminiPrompt,
  setGeminiTemperature,
  setGlossaryText,
  setGoogleBaseURL,
  setHoverDelayMs,
  setHoverTranslateEnabled,
  setMaxCharsPerRequest,
  setMaxBatchParagraphs,
  setMaxConcurrent,
  setMaxConsecutiveErrors,
  setOllamaModel,
  setOllamaURL,
  setOpenAIApiKey,
  setOpenAIEndpoint,
  setOpenAIModel,
  setOpenAIPrompt,
  setOpenAITemperature,
  setRequestGapMs,
  setRequestTimeoutMs,
  setShortcut,
  setShortcutEnabled,
  setSkipLastPages,
  setSourceLanguage,
  setTargetLanguage,
  type TranslationEngine,
} from "../settings";
import {
  DEFAULT_APPEARANCE,
  FONT_STACK_MAX_FALLBACKS,
  buildFontStack,
  buildTranslationCSS,
  contrastRatio,
  isValidFontFamily,
  meetsContrastAA,
  normalizeFontStack,
  normalizeHexInput,
  parseFontStack,
  resolveEffectiveColor,
  resolveTextDirection,
  type AppearanceSettings,
  type AppearanceTheme,
  type FontGeneric,
  type FontStack,
} from "../appearance";
import {
  FONT_CANDIDATES,
  FONT_SAMPLE_TEXT,
  buildFontSections,
  filterFontCandidates,
  isFontDetected,
  normalizeFontFavorites,
  quoteFontName,
  type FontGroup,
  type FontMeasure,
} from "../fontCatalog";
import { buildDisplayModeCSS, normalizeDisplayMode } from "../displayMode";
import { parseGlossary, serializeGlossary } from "../glossary";
import {
  pickGlossaryFile,
  readGlossaryFile,
  writeGlossaryFile,
} from "../glossaryFiles";
import { getString } from "../utils/locale";
import { refreshDisplayModes, refreshTranslationStyles } from "../bilingualReader";
import { clearTranslationCache, getTranslationCacheStats } from "../translationCache";
import {
  formatShortcut,
  isValidShortcut,
  normalizeShortcut,
  shortcutFromEvent,
} from "../shortcut";
import {
  testClaudeConnection,
  testGeminiConnection,
  testGoogleConnection,
  testOpenAIConnection,
} from "../providers";
import { version as addonVersion } from "../../package.json";

const PROJECT_URL = "https://github.com/Muanyan-mjq/zotero-interlinear";

const HTML_NS = "http://www.w3.org/1999/xhtml";

type StatusState = "info" | "success" | "warning" | "error" | "running" | "saved" | "dirty";
type FluentKey = Parameters<typeof getString>[0];

interface ColorPreset {
  value: string;
  nameKey: FluentKey;
}

const TEXT_PRESETS: readonly ColorPreset[] = [
  { value: "#333333", nameKey: "color-name-ink" },
  { value: "#000000", nameKey: "color-name-black" },
  { value: "#5b6470", nameKey: "color-name-slate" },
  { value: "#c7354a", nameKey: "color-name-red" },
  { value: "#2f6fdf", nameKey: "color-name-blue" },
  { value: "#1f8a4c", nameKey: "color-name-green" },
  { value: "#d97706", nameKey: "color-name-amber" },
  { value: "#7c3aed", nameKey: "color-name-violet" },
];

const BACKGROUND_PRESETS: readonly ColorPreset[] = [
  { value: "#ffffff", nameKey: "color-name-white" },
  { value: "#f6f6f6", nameKey: "color-name-light" },
  { value: "#faf7f0", nameKey: "color-name-paper" },
  { value: "#fdf6e3", nameKey: "color-name-cream" },
  { value: "#2b2b2b", nameKey: "color-name-dark" },
  { value: "#1e1e1e", nameKey: "color-name-charcoal" },
];

const ACCENT_PRESETS: readonly ColorPreset[] = [
  { value: "#2f6fdf", nameKey: "color-name-blue" },
  { value: "#c7354a", nameKey: "color-name-red" },
  { value: "#1f8a4c", nameKey: "color-name-green" },
  { value: "#d97706", nameKey: "color-name-amber" },
  { value: "#7c3aed", nameKey: "color-name-violet" },
  { value: "#0ea5e9", nameKey: "color-name-sky" },
  { value: "#333333", nameKey: "color-name-ink" },
  { value: "#e8e8e8", nameKey: "color-name-silver" },
];

function getElement<T extends HTMLElement>(doc: Document, id: string): T | null {
  return doc.getElementById(id) as T | null;
}

function updateStatus(
  element: HTMLElement | null,
  message: string,
  state: StatusState,
): void {
  if (!element) return;
  element.textContent = message;
  if (message) element.dataset.state = state;
  else element.removeAttribute("data-state");
}

const statusTimers = new WeakMap<Document, any>();
const hintTimers = new WeakMap<Document, any>();

function clearStatusTimer(doc: Document): void {
  const timer = statusTimers.get(doc);
  if (timer) {
    try {
      doc.defaultView?.clearTimeout?.(timer);
    } catch (_) {
      // Window may already be closing.
    }
    statusTimers.delete(doc);
  }
}

function setStatus(doc: Document, message: string, state: StatusState = "info"): void {
  clearStatusTimer(doc);
  updateStatus(
    getElement<HTMLElement>(doc, "interlinear-settings-status"),
    message,
    state,
  );
}

function setTestStatus(
  doc: Document,
  provider: string,
  state: StatusState,
  message: string,
): void {
  updateStatus(
    getElement<HTMLElement>(doc, `interlinear-test-${provider}-status`),
    message,
    state,
  );
}

/** Save-state helper: success can restore to the idle "all changes saved" state. */
function setSaveState(
  doc: Document,
  state: StatusState,
  message: string,
  restoreAfterMs?: number,
): void {
  setStatus(doc, message, state);
  if (!restoreAfterMs) return;
  const win = doc.defaultView;
  if (!win?.setTimeout) return;
  const timer = win.setTimeout(() => {
    statusTimers.delete(doc);
    setSaveState(doc, "saved", getString("settings-status-saved"));
  }, restoreAfterMs);
  statusTimers.set(doc, timer);
}

function setSaveHint(doc: Document, message: string, restoreAfterMs?: number): void {
  const timer = hintTimers.get(doc);
  if (timer) {
    try {
      doc.defaultView?.clearTimeout?.(timer);
    } catch (_) {
      // Window may already be closing.
    }
    hintTimers.delete(doc);
  }
  updateStatus(getElement<HTMLElement>(doc, "interlinear-save-hint"), message, "warning");
  if (!message || !restoreAfterMs) return;
  const win = doc.defaultView;
  if (!win?.setTimeout) return;
  const next = win.setTimeout(() => {
    hintTimers.delete(doc);
    updateStatus(getElement<HTMLElement>(doc, "interlinear-save-hint"), "", "warning");
  }, restoreAfterMs);
  hintTimers.set(doc, next);
}

const dirtyTabs = new WeakMap<Document, Set<string>>();
const tabScrollPositions = new WeakMap<Document, Map<string, number>>();

function dirtyTabsFor(doc: Document): Set<string> {
  let set = dirtyTabs.get(doc);
  if (!set) {
    set = new Set();
    dirtyTabs.set(doc, set);
  }
  return set;
}

function markTabDirty(doc: Document, tab: string | undefined): void {
  if (!tab) return;
  dirtyTabsFor(doc).add(tab);
  const button = getElement<HTMLButtonElement>(doc, `interlinear-tab-${tab}`);
  if (button) button.dataset.dirty = "true";
}

function clearDirtyTabs(doc: Document): void {
  dirtyTabsFor(doc).clear();
  for (const button of Array.from(
    doc.querySelectorAll(".interlinear-tab"),
  ) as HTMLButtonElement[]) {
    delete button.dataset.dirty;
  }
}

function tabForTarget(target: EventTarget | null | undefined): string | undefined {
  const element = target as Element | null;
  const section = element?.closest?.(".interlinear-section[data-tab]");
  return section?.getAttribute("data-tab") || undefined;
}

function scrollHost(doc: Document): HTMLElement | null {
  return (doc.scrollingElement || doc.documentElement) as HTMLElement | null;
}

function currentScrollTop(doc: Document): number {
  const host = scrollHost(doc);
  return host?.scrollTop || doc.defaultView?.scrollY || 0;
}

function setScrollTop(doc: Document, value: number): void {
  const host = scrollHost(doc);
  if (host) host.scrollTop = value;
  try {
    doc.defaultView?.scrollTo?.(0, value);
  } catch (_) {
    // Some Gecko documents do not expose scrollTo; setting scrollTop is enough.
  }
}

function rememberTabScroll(doc: Document, tab: string): void {
  let positions = tabScrollPositions.get(doc);
  if (!positions) {
    positions = new Map();
    tabScrollPositions.set(doc, positions);
  }
  positions.set(tab, currentScrollTop(doc));
}

function restoreTabScroll(doc: Document, tab: string): void {
  const positions = tabScrollPositions.get(doc);
  const top = positions?.get(tab) ?? 0;
  const win = doc.defaultView;
  if (!win?.setTimeout) {
    setScrollTop(doc, top);
    return;
  }
  win.setTimeout(() => setScrollTop(doc, top), 0);
}

function markDirty(doc: Document, target?: EventTarget | null): void {
  const tab = tabForTarget(target);
  markTabDirty(doc, tab);
  setSaveState(doc, "dirty", getString("settings-unsaved"));
  setSaveHint(doc, "");
}

function parseRgbColor(value: string): string | null {
  const match = value.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/iu);
  if (!match) return null;
  const channels = match.slice(1, 4).map((channel) =>
    Math.min(255, Number(channel)).toString(16).padStart(2, "0"),
  );
  return `#${channels.join("")}`;
}

function expandHexColor(value: string): string | null {
  const match = value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/iu);
  if (!match) return null;
  const hex = match[1];
  const expanded =
    hex.length === 3 ? hex.split("").map((part) => part + part).join("") : hex;
  return `#${expanded.slice(0, 6)}`;
}

/** Native color inputs only accept #rrggbb, while stored values may be any CSS color. */
function resolveColorForPicker(doc: Document, value: string, fallback: string): string {
  const direct = expandHexColor(value) || parseRgbColor(value);
  if (direct) return direct;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  const root = doc.documentElement;
  if (!root) return fallback;
  try {
    const probe = doc.createElementNS(HTML_NS, "span") as HTMLElement;
    probe.style.color = trimmed;
    probe.style.display = "none";
    root.append(probe);
    const computed = doc.defaultView?.getComputedStyle(probe)?.color || "";
    probe.remove();
    return expandHexColor(computed) || parseRgbColor(computed) || fallback;
  } catch (_) {
    return fallback;
  }
}

function readColorControl(
  doc: Document,
  inputId: string,
  inheritId: string | null,
  fallback: string,
): string {
  const inherit = inheritId ? getElement<HTMLInputElement>(doc, inheritId) : null;
  if (inherit?.checked) return "";
  const value = getElement<HTMLInputElement>(doc, inputId)?.value.trim() || "";
  if (value) return value;
  return inheritId ? "" : fallback;
}

type ColorRole = "color" | "background" | "underline" | "ribbon";

interface ColorControlConfig {
  base: string;
  role: ColorRole;
  presets: readonly ColorPreset[];
  presetTitleKey: FluentKey;
  fallback: string;
  resetValue: string;
  hasInherit: boolean;
}

const COLOR_CONTROLS: readonly ColorControlConfig[] = [
  {
    base: "interlinear-appearance-color",
    role: "color",
    presets: TEXT_PRESETS,
    presetTitleKey: "appearance-text-preset-title",
    fallback: "#333333",
    resetValue: "",
    hasInherit: true,
  },
  {
    base: "interlinear-appearance-background",
    role: "background",
    presets: BACKGROUND_PRESETS,
    presetTitleKey: "appearance-background-preset-title",
    fallback: "#f6f6f6",
    resetValue: "",
    hasInherit: true,
  },
  {
    base: "interlinear-appearance-underline-color",
    role: "underline",
    presets: ACCENT_PRESETS,
    presetTitleKey: "appearance-accent-preset-title",
    fallback: "#333333",
    resetValue: "",
    hasInherit: true,
  },
  {
    base: "interlinear-appearance-ribbon-color",
    role: "ribbon",
    presets: ACCENT_PRESETS,
    presetTitleKey: "appearance-accent-preset-title",
    fallback: DEFAULT_APPEARANCE.ribbonColor,
    resetValue: DEFAULT_APPEARANCE.ribbonColor,
    hasInherit: false,
  },
];

function inheritIdFor(config: ColorControlConfig): string | null {
  return config.hasInherit ? `${config.base}-inherit` : null;
}

function storedColor(doc: Document, config: ColorControlConfig): string {
  return readColorControl(doc, config.base, inheritIdFor(config), "");
}

function syncHexFromPicker(doc: Document, config: ColorControlConfig): void {
  const picker = getElement<HTMLInputElement>(doc, config.base);
  const hex = getElement<HTMLInputElement>(doc, `${config.base}-hex`);
  if (picker && hex) hex.value = picker.value.toUpperCase();
}

function setControlDisabled(
  doc: Document,
  config: ColorControlConfig,
  disabled: boolean,
): void {
  const picker = getElement<HTMLInputElement>(doc, config.base);
  const hex = getElement<HTMLInputElement>(doc, `${config.base}-hex`);
  const container = getElement<HTMLElement>(doc, `${config.base}-presets`);
  if (picker) picker.disabled = disabled;
  if (hex) hex.disabled = disabled;
  if (container) {
    for (const button of Array.from(container.querySelectorAll("button"))) {
      (button as HTMLButtonElement).disabled = disabled;
    }
  }
}

function clearHexError(doc: Document, config: ColorControlConfig): void {
  updateStatus(getElement<HTMLElement>(doc, `${config.base}-error`), "", "info");
}

function applyStoredToControl(
  doc: Document,
  config: ColorControlConfig,
  stored: string,
): void {
  const picker = getElement<HTMLInputElement>(doc, config.base);
  const inherit = config.hasInherit
    ? getElement<HTMLInputElement>(doc, `${config.base}-inherit`)
    : null;
  const hasValue = !!stored.trim();
  if (inherit) inherit.checked = !hasValue;
  if (picker) picker.value = resolveColorForPicker(doc, stored, config.fallback);
  syncHexFromPicker(doc, config);
  setControlDisabled(doc, config, !!inherit && !hasValue);
  clearHexError(doc, config);
}

function renderControlPresets(doc: Document, config: ColorControlConfig): void {
  const container = getElement<HTMLElement>(doc, `${config.base}-presets`);
  const picker = getElement<HTMLInputElement>(doc, config.base);
  if (!container || !picker) return;
  const title = getString(config.presetTitleKey);
  container.title = title;
  container.setAttribute("aria-label", title);
  const buttons = config.presets.map((preset) => {
    const button = doc.createElementNS(HTML_NS, "button") as HTMLButtonElement;
    button.type = "button";
    button.className = "interlinear-color-preset";
    button.style.backgroundColor = preset.value;
    button.dataset.value = preset.value;
    const name = getString(preset.nameKey);
    button.title = `${name} (${preset.value})`;
    button.setAttribute("aria-label", `${name} (${preset.value})`);
    button.addEventListener("click", () => {
      picker.value = preset.value.toLowerCase();
      const inherit = config.hasInherit
        ? getElement<HTMLInputElement>(doc, `${config.base}-inherit`)
        : null;
      if (inherit) inherit.checked = false;
      setControlDisabled(doc, config, false);
      syncHexFromPicker(doc, config);
      clearHexError(doc, config);
      refreshColorUI(doc);
      markDirty(doc);
    });
    return button;
  });
  container.replaceChildren(...buttons);
}

function initColorControl(doc: Document, config: ColorControlConfig): void {
  const picker = getElement<HTMLInputElement>(doc, config.base);
  if (!picker) return;
  const inherit = config.hasInherit
    ? getElement<HTMLInputElement>(doc, `${config.base}-inherit`)
    : null;
  const hex = getElement<HTMLInputElement>(doc, `${config.base}-hex`);
  const reset = getElement<HTMLButtonElement>(doc, `${config.base}-reset`);

  const appearance = getAppearance();
  const stored =
    config.role === "color"
      ? appearance.color
      : config.role === "background"
        ? appearance.background
        : config.role === "underline"
          ? appearance.underlineColor
          : appearance.ribbonColor;
  applyStoredToControl(doc, config, stored);
  renderControlPresets(doc, config);

  if (hex) {
    hex.setAttribute("aria-label", getString("appearance-color-hex-label"));
    hex.placeholder = "#RRGGBB";
    hex.maxLength = 7;
    hex.spellcheck = false;
    hex.addEventListener("input", () => {
      const normalized = normalizeHexInput(hex.value);
      if (!normalized) return;
      picker.value = normalized.toLowerCase();
      hex.value = normalized;
      if (inherit) inherit.checked = false;
      setControlDisabled(doc, config, false);
      clearHexError(doc, config);
      refreshColorUI(doc);
      markDirty(doc);
    });
    hex.addEventListener("blur", () => {
      const normalized = normalizeHexInput(hex.value);
      if (normalized) {
        hex.value = normalized;
        clearHexError(doc, config);
        return;
      }
      if (hex.value.trim() !== "") {
        updateStatus(
          getElement<HTMLElement>(doc, `${config.base}-error`),
          getString("appearance-color-hex-invalid"),
          "error",
        );
      }
      hex.value = picker.value.toUpperCase();
    });
  }

  picker.addEventListener("input", () => {
    if (inherit) inherit.checked = false;
    setControlDisabled(doc, config, false);
    syncHexFromPicker(doc, config);
    clearHexError(doc, config);
    refreshColorUI(doc);
    markDirty(doc);
  });

  inherit?.addEventListener("change", () => {
    setControlDisabled(doc, config, inherit.checked);
    if (!inherit.checked) syncHexFromPicker(doc, config);
    clearHexError(doc, config);
    refreshColorUI(doc);
    markDirty(doc);
  });

  reset?.addEventListener("click", () => {
    applyStoredToControl(doc, config, config.resetValue);
    refreshColorUI(doc);
    markDirty(doc);
  });
}

function currentTheme(doc: Document): AppearanceTheme {
  return (
    (getElement<HTMLSelectElement>(doc, "interlinear-appearance-theme")
      ?.value as AppearanceTheme) || "auto"
  );
}

function effectivePreviewColor(
  doc: Document,
  config: ColorControlConfig,
  theme: AppearanceTheme,
): string {
  const stored = storedColor(doc, config);
  switch (config.role) {
    case "color":
      return resolveEffectiveColor(stored, theme, "color");
    case "background":
      return resolveEffectiveColor(stored, theme, "background");
    case "underline": {
      if (stored.trim()) return stored;
      const text = readColorControl(
        doc,
        "interlinear-appearance-color",
        "interlinear-appearance-color-inherit",
        "",
      );
      return resolveEffectiveColor(text, theme, "color");
    }
    case "ribbon":
      return stored.trim() || DEFAULT_APPEARANCE.ribbonColor;
  }
}

function refreshContrastWarning(doc: Document): void {
  const warning = getElement<HTMLElement>(
    doc,
    "interlinear-appearance-contrast-warning",
  );
  if (!warning) return;
  const text = readColorControl(
    doc,
    "interlinear-appearance-color",
    "interlinear-appearance-color-inherit",
    "",
  );
  const background = readColorControl(
    doc,
    "interlinear-appearance-background",
    "interlinear-appearance-background-inherit",
    "",
  );
  const ratio =
    text.trim() && background.trim() ? contrastRatio(text, background) : null;
  if (ratio !== null && !meetsContrastAA(ratio)) {
    updateStatus(
      warning,
      getString("appearance-contrast-warning", { args: { ratio } }),
      "warning",
    );
  } else {
    updateStatus(warning, "", "info");
  }
}

function refreshColorUI(doc: Document): void {
  const theme = currentTheme(doc);
  const inheritLabel = getString("appearance-color-preview-inherit");
  for (const config of COLOR_CONTROLS) {
    const preview = getElement<HTMLElement>(doc, `${config.base}-preview`);
    if (preview) {
      const effective = effectivePreviewColor(doc, config, theme);
      if (effective.trim()) {
        preview.style.backgroundColor = effective;
        preview.dataset.inherit = "false";
        preview.textContent = "";
        preview.title = effective;
        preview.setAttribute("aria-label", effective);
      } else {
        preview.style.backgroundColor = "";
        preview.dataset.inherit = "true";
        preview.textContent = "";
        preview.title = inheritLabel;
        preview.setAttribute("aria-label", inheritLabel);
      }
    }
    const picker = getElement<HTMLInputElement>(doc, config.base);
    const inherit = config.hasInherit
      ? getElement<HTMLInputElement>(doc, `${config.base}-inherit`)
      : null;
    const activeValue = inherit?.checked ? "" : (picker?.value || "").toLowerCase();
    const container = getElement<HTMLElement>(doc, `${config.base}-presets`);
    if (container) {
      for (const button of Array.from(
        container.querySelectorAll(".interlinear-color-preset"),
      )) {
        const element = button as HTMLElement;
        element.dataset.active = String(
          activeValue !== "" &&
            (element.dataset.value || "").toLowerCase() === activeValue,
        );
      }
    }
  }
  refreshContrastWarning(doc);
  refreshAppearancePreview(doc);
}

function readFontStackForm(doc: Document): FontStack {
  const state = fontUiStates.get(doc);
  if (state) return normalizeFontStack(state.stack);
  return parseFontStack(readInputText(doc, "interlinear-appearance-font-family"));
}

function readAppearanceForm(doc: Document): AppearanceSettings {
  const fontStack = readFontStackForm(doc);
  const direction = getElement<HTMLSelectElement>(
    doc,
    "interlinear-text-direction",
  )?.value;
  const sizeMode = getElement<HTMLSelectElement>(doc, "interlinear-font-size-mode")?.value;
  return {
    fontSize: readNumberInput(
      doc,
      "interlinear-appearance-font-size",
      DEFAULT_APPEARANCE.fontSize,
    ),
    color: readColorControl(
      doc,
      "interlinear-appearance-color",
      "interlinear-appearance-color-inherit",
      "#333333",
    ),
    fontFamily: buildFontStack(fontStack),
    fontStack,
    fontWeight: readNumberInput(
      doc,
      "interlinear-font-weight",
      DEFAULT_APPEARANCE.fontWeight,
    ),
    fontStyle: readCheckbox(doc, "interlinear-font-italic") ? "italic" : "normal",
    letterSpacing: readNumberInput(
      doc,
      "interlinear-letter-spacing",
      DEFAULT_APPEARANCE.letterSpacing,
    ),
    fontSizeMode: sizeMode === "em" ? "em" : "px",
    fontSizeEm: readNumberInput(
      doc,
      "interlinear-font-size-em",
      DEFAULT_APPEARANCE.fontSizeEm,
    ),
    autoFontByLanguage: readCheckbox(doc, "interlinear-font-auto-language"),
    textDirection: direction === "ltr" || direction === "rtl" ? direction : "auto",
    lineHeight: readNumberInput(
      doc,
      "interlinear-appearance-line-height",
      DEFAULT_APPEARANCE.lineHeight,
    ),
    paragraphSpacing: readNumberInput(
      doc,
      "interlinear-appearance-paragraph-spacing",
      DEFAULT_APPEARANCE.paragraphSpacing,
    ),
    background: readColorControl(
      doc,
      "interlinear-appearance-background",
      "interlinear-appearance-background-inherit",
      "#f6f6f6",
    ),
    theme:
      (getElement<HTMLSelectElement>(doc, "interlinear-appearance-theme")
        ?.value as AppearanceTheme) || "auto",
    underline: readCheckbox(doc, "interlinear-appearance-underline"),
    underlineColor: readColorControl(
      doc,
      "interlinear-appearance-underline-color",
      "interlinear-appearance-underline-color-inherit",
      "#333333",
    ),
    ribbon: readCheckbox(doc, "interlinear-appearance-ribbon"),
    ribbonColor: readColorControl(
      doc,
      "interlinear-appearance-ribbon-color",
      null,
      DEFAULT_APPEARANCE.ribbonColor,
    ),
  };
}

// Shadow DOM keeps the reader stylesheet from leaking into the preferences pane
// while system colors (Canvas/CanvasText) still inherit Zotero's theme.
function initializeAppearancePreview(doc: Document): void {
  const host = getElement<HTMLElement>(doc, "interlinear-appearance-preview");
  if (!host || host.shadowRoot) return;
  const shadow = host.attachShadow({ mode: "open" });
  const style = doc.createElementNS(HTML_NS, "style");
  const content = doc.createElementNS(HTML_NS, "div");
  content.id = "sdt-content";
  const source = doc.createElementNS(HTML_NS, "p");
  source.className = "interlinear-source";
  source.textContent = getString("appearance-preview-source");
  const block = doc.createElementNS(HTML_NS, "div") as HTMLElement;
  block.className = "interlinear-translation";
  block.dataset.state = "done";
  block.textContent = getString("appearance-preview-target");
  content.append(source, block);
  shadow.append(style, content);
}

function refreshAppearancePreview(doc: Document): void {
  const host = getElement<HTMLElement>(doc, "interlinear-appearance-preview");
  const shadow = host?.shadowRoot;
  if (!shadow) return;
  const style = shadow.querySelector("style");
  const content = shadow.getElementById("sdt-content");
  if (!style || !content) return;
  const appearance = readAppearanceForm(doc);
  const mode = normalizeDisplayMode(
    getElement<HTMLSelectElement>(doc, "interlinear-display-mode")?.value,
  );
  style.textContent = `${buildTranslationCSS(
    "interlinear-translation",
    appearance,
    "reader",
    { targetLanguage: getTargetLanguage() },
  )}\n${buildDisplayModeCSS(
    "interlinear-translation",
    "interlinear-source",
    appearance.paragraphSpacing,
  )}`;
  content.setAttribute("data-interlinear-display", mode);
  const block = shadow.querySelector<HTMLElement>(".interlinear-translation");
  if (block) {
    block.lang = getTargetLanguage();
    block.dir = resolveTextDirection(appearance.textDirection, getTargetLanguage());
  }
}

function clearFontError(doc: Document): void {
  const error = getElement<HTMLElement>(doc, "interlinear-appearance-font-family-error");
  if (error) error.textContent = "";
}

function validateFontInput(doc: Document): void {
  const input = getElement<HTMLInputElement>(doc, "interlinear-appearance-font-family");
  const error = getElement<HTMLElement>(doc, "interlinear-appearance-font-family-error");
  if (!input || !error) return;
  error.textContent = isValidFontFamily(input.value)
    ? ""
    : getString("appearance-font-family-invalid");
}

type FontDetectionState = "idle" | "scanning" | "cached" | "live" | "failed";

interface FontUiState {
  stack: FontStack;
  favorites: string[];
  detected: Set<string> | null;
  detectionState: FontDetectionState;
  scanToken: number;
  query: string;
  showAll: boolean;
}

const fontUiStates = new WeakMap<Document, FontUiState>();
const FONT_SCAN_CHUNK = 24;

function fontGroupCssFamily(group: FontGroup): string {
  if (group === "serif") return "serif";
  if (group === "mono") return "monospace";
  return "sans-serif";
}

function fontGroupLabel(group: FontGroup | "favorites"): string {
  switch (group) {
    case "favorites":
      return getString("font-group-favorites");
    case "sans":
      return getString("font-group-sans");
    case "serif":
      return getString("font-group-serif");
    case "mono":
      return getString("font-group-mono");
    case "zh":
      return getString("font-group-zh");
    case "ja-ko":
      return getString("font-group-ja-ko");
    default:
      return getString("font-group-other");
  }
}

function appendFontGroup(
  doc: Document,
  parent: ParentNode,
  label: string,
): HTMLElement {
  const group = doc.createElementNS(HTML_NS, "div") as HTMLElement;
  group.className = "interlinear-font-group";
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", label);
  const title = doc.createElementNS(HTML_NS, "div") as HTMLElement;
  title.className = "interlinear-font-group-label";
  title.textContent = label;
  group.append(title);
  parent.append(group);
  return group;
}

interface FontRowOptions {
  label: string;
  family: string;
  generic?: FontGeneric;
  sample: string;
  cssFamily: string;
  active: boolean;
  favorite?: boolean;
  undetected?: boolean;
}

function appendFontRow(
  doc: Document,
  parent: ParentNode,
  options: FontRowOptions,
): void {
  const row = doc.createElementNS(HTML_NS, "div") as HTMLElement;
  row.className = "interlinear-font-row";
  if (options.family) row.dataset.family = options.family;
  if (options.generic) row.dataset.generic = options.generic;
  if (options.undetected) row.dataset.undetected = "true";
  row.setAttribute("role", "option");
  row.setAttribute("aria-selected", String(options.active));

  const pick = doc.createElementNS(HTML_NS, "button") as HTMLButtonElement;
  pick.type = "button";
  pick.className = "interlinear-font-pick";
  pick.dataset.action = "pick";
  if (options.undetected) pick.title = getString("font-undetected");
  const name = doc.createElementNS(HTML_NS, "span") as HTMLElement;
  name.className = "interlinear-font-name";
  name.textContent = options.label;
  const sample = doc.createElementNS(HTML_NS, "span") as HTMLElement;
  sample.className = "interlinear-font-sample";
  sample.textContent = options.sample;
  sample.style.fontFamily = options.cssFamily;
  pick.append(name, sample);
  row.append(pick);

  if (options.family) {
    const star = doc.createElementNS(HTML_NS, "button") as HTMLButtonElement;
    star.type = "button";
    star.className = "interlinear-icon-button interlinear-font-favorite";
    star.dataset.action = "favorite";
    star.setAttribute("aria-pressed", String(Boolean(options.favorite)));
    const favoriteLabel = getString(
      options.favorite ? "font-favorite-remove" : "font-favorite-add",
      { args: { font: options.family } },
    );
    star.title = favoriteLabel;
    star.setAttribute("aria-label", favoriteLabel);
    star.textContent = options.favorite ? "★" : "☆";
    row.append(star);

    const add = doc.createElementNS(HTML_NS, "button") as HTMLButtonElement;
    add.type = "button";
    add.className = "interlinear-icon-button interlinear-font-fallback-add";
    add.dataset.action = "fallback";
    add.textContent = "+";
    const addLabel = getString("font-fallback-add", { args: { font: options.family } });
    add.title = addLabel;
    add.setAttribute("aria-label", addLabel);
    row.append(add);
  }

  parent.append(row);
}

function renderFontList(doc: Document): void {
  const state = fontUiStates.get(doc);
  const list = getElement<HTMLElement>(doc, "interlinear-font-list");
  if (!state || !list) return;
  const detected = state.detected && state.detected.size ? state.detected : null;
  const candidates = filterFontCandidates({
    query: state.query,
    detected,
    showAll: state.showAll,
    favorites: state.favorites,
  });
  const sections = buildFontSections(candidates, state.favorites);
  const fragment = doc.createDocumentFragment();

  const defaults = appendFontGroup(doc, fragment, getString("font-group-defaults"));
  appendFontRow(doc, defaults, {
    label: getString("appearance-font-option-inherit"),
    family: "",
    sample: getString("font-sample-inherit"),
    cssFamily: "inherit",
    active:
      !state.stack.primary && !state.stack.fallbacks.length && !state.stack.generic,
  });
  const genericRows: Array<{ generic: FontGeneric; labelKey: FluentKey }> = [
    { generic: "sans-serif", labelKey: "appearance-font-option-sans" },
    { generic: "serif", labelKey: "appearance-font-option-serif" },
    { generic: "monospace", labelKey: "appearance-font-option-mono" },
  ];
  for (const row of genericRows) {
    appendFontRow(doc, defaults, {
      label: getString(row.labelKey),
      family: "",
      generic: row.generic,
      sample: FONT_SAMPLE_TEXT.latin,
      cssFamily: row.generic,
      active:
        !state.stack.primary &&
        !state.stack.fallbacks.length &&
        state.stack.generic === row.generic,
    });
  }

  for (const section of sections) {
    const group = appendFontGroup(doc, fragment, fontGroupLabel(section.group));
    for (const candidate of section.fonts) {
      const key = candidate.family.toLowerCase();
      appendFontRow(doc, group, {
        label: candidate.family,
        family: candidate.family,
        sample: FONT_SAMPLE_TEXT[candidate.script],
        cssFamily: `${quoteFontName(candidate.family)}, ${fontGroupCssFamily(candidate.group)}`,
        active: state.stack.primary.toLowerCase() === key,
        favorite: state.favorites.some((favorite) => favorite.toLowerCase() === key),
        undetected: detected ? !detected.has(key) : false,
      });
    }
  }

  if (!sections.length) {
    const empty = doc.createElementNS(HTML_NS, "p") as HTMLElement;
    empty.className = "interlinear-help interlinear-font-empty";
    empty.textContent = getString("font-no-results");
    fragment.append(empty);
  }
  list.replaceChildren(fragment);
}

function updateFontDetectionStatus(doc: Document, done = 0): void {
  const state = fontUiStates.get(doc);
  const status = getElement<HTMLElement>(doc, "interlinear-font-detection-status");
  if (!state || !status) return;
  status.dataset.state = state.detectionState;
  switch (state.detectionState) {
    case "scanning":
      status.textContent = getString("font-detection-scanning", {
        args: { done, total: FONT_CANDIDATES.length },
      });
      break;
    case "cached":
    case "live":
      status.textContent =
        state.detected && state.detected.size
          ? getString(
              state.detectionState === "live"
                ? "font-detection-done"
                : "font-detection-cached",
              { args: { found: state.detected.size } },
            )
          : getString("font-detection-empty");
      break;
    case "failed":
      status.textContent = getString("font-detection-failed");
      break;
    default:
      status.textContent = "";
  }
}

function createCanvasMeasure(doc: Document): FontMeasure | null {
  try {
    const canvas = doc.createElementNS(HTML_NS, "canvas") as HTMLCanvasElement;
    const context = canvas.getContext("2d") as CanvasRenderingContext2D | null;
    if (!context) return null;
    return (family: string, text: string) => {
      context.font = `normal 16px ${family}`;
      return context.measureText(text).width;
    };
  } catch (_) {
    return null;
  }
}

function startFontDetection(doc: Document, force = false): void {
  const state = fontUiStates.get(doc);
  if (!state) return;
  if (!force) {
    const cached = getCachedFontDetection();
    if (cached) {
      state.detected = new Set(cached);
      state.detectionState = "cached";
      renderFontList(doc);
      updateFontDetectionStatus(doc);
      return;
    }
  }
  const measure = createCanvasMeasure(doc);
  if (!measure) {
    state.detected = null;
    state.detectionState = "failed";
    renderFontList(doc);
    updateFontDetectionStatus(doc);
    return;
  }

  const token = ++state.scanToken;
  state.detected = null;
  state.detectionState = "scanning";
  renderFontList(doc);
  updateFontDetectionStatus(doc, 0);

  const detected: string[] = [];
  let index = 0;
  const step = () => {
    if (fontUiStates.get(doc) !== state || state.scanToken !== token) return;
    const end = Math.min(index + FONT_SCAN_CHUNK, FONT_CANDIDATES.length);
    for (; index < end; index++) {
      if (isFontDetected(FONT_CANDIDATES[index], measure)) {
        detected.push(FONT_CANDIDATES[index].family);
      }
    }
    updateFontDetectionStatus(doc, index);
    if (index < FONT_CANDIDATES.length) {
      const win = doc.defaultView;
      if (win?.setTimeout) win.setTimeout(step, 0);
      else step();
      return;
    }
    state.detected = new Set(detected);
    state.detectionState = detected.length ? "live" : "failed";
    if (detected.length) setCachedFontDetection(detected);
    else clearCachedFontDetection();
    renderFontList(doc);
    updateFontDetectionStatus(doc, index);
  };
  const win = doc.defaultView;
  if (win?.setTimeout) win.setTimeout(step, 0);
  else step();
}

function makeFontChip(
  doc: Document,
  kind: "primary" | "fallback",
  name: string,
  index: number,
): HTMLElement {
  const chip = doc.createElementNS(HTML_NS, "span") as HTMLElement;
  chip.className = "interlinear-font-chip";
  chip.dataset.index = String(index);
  const label = doc.createElementNS(HTML_NS, "span") as HTMLElement;
  label.className = "interlinear-font-chip-label";
  label.textContent =
    kind === "primary"
      ? getString("font-chip-primary", { args: { font: name } })
      : name;
  chip.append(label);

  const appendButton = (action: string, text: string, labelKey: FluentKey) => {
    const button = doc.createElementNS(HTML_NS, "button") as HTMLButtonElement;
    button.type = "button";
    button.className = "interlinear-icon-button";
    button.dataset.action = action;
    button.dataset.index = String(index);
    button.textContent = text;
    const labelText = getString(labelKey, { args: { font: name } });
    button.title = labelText;
    button.setAttribute("aria-label", labelText);
    chip.append(button);
    return button;
  };

  if (kind === "fallback") {
    appendButton("move-up", "↑", "font-fallback-up").disabled = index === 0;
    appendButton("move-down", "↓", "font-fallback-down");
    appendButton("remove-fallback", "×", "font-fallback-remove");
  } else {
    appendButton("remove-primary", "×", "font-primary-remove");
  }
  return chip;
}

function syncFontStackUi(doc: Document, updateInput = true): void {
  const state = fontUiStates.get(doc);
  if (!state) return;
  const stackHost = getElement<HTMLElement>(doc, "interlinear-font-stack");
  if (stackHost) {
    const chips: HTMLElement[] = [];
    if (state.stack.primary) {
      chips.push(makeFontChip(doc, "primary", state.stack.primary, -1));
    }
    state.stack.fallbacks.forEach((name, index) => {
      chips.push(makeFontChip(doc, "fallback", name, index));
    });
    if (!chips.length) {
      const empty = doc.createElementNS(HTML_NS, "span") as HTMLElement;
      empty.className = "interlinear-font-stack-empty";
      empty.textContent = state.stack.generic
        ? getString("font-stack-generic-only", { args: { generic: state.stack.generic } })
        : getString("font-stack-inherit");
      chips.push(empty);
    }
    stackHost.replaceChildren(...chips);
  }
  const generic = getElement<HTMLSelectElement>(doc, "interlinear-font-generic");
  if (generic) generic.value = state.stack.generic;
  if (updateInput) {
    const input = getElement<HTMLInputElement>(doc, "interlinear-appearance-font-family");
    if (input) input.value = buildFontStack(state.stack);
    clearFontError(doc);
  }
  renderFontList(doc);
  refreshAppearancePreview(doc);
}

function setFontStack(doc: Document, next: Partial<FontStack>): void {
  const state = fontUiStates.get(doc);
  if (!state) return;
  state.stack = normalizeFontStack({ ...state.stack, ...next });
  syncFontStackUi(doc);
  markDirty(doc);
}

function addFontFallback(doc: Document, family: string): void {
  const state = fontUiStates.get(doc);
  if (!state || !family) return;
  const key = family.toLowerCase();
  if (!state.stack.primary) {
    setFontStack(doc, { primary: family });
    return;
  }
  if (state.stack.primary.toLowerCase() === key) return;
  if (state.stack.fallbacks.some((name) => name.toLowerCase() === key)) return;
  if (state.stack.fallbacks.length >= FONT_STACK_MAX_FALLBACKS) return;
  setFontStack(doc, { fallbacks: [...state.stack.fallbacks, family] });
}

function toggleFontFavorite(doc: Document, family: string): void {
  const state = fontUiStates.get(doc);
  if (!state || !family) return;
  const key = family.toLowerCase();
  const exists = state.favorites.some((name) => name.toLowerCase() === key);
  state.favorites = exists
    ? state.favorites.filter((name) => name.toLowerCase() !== key)
    : normalizeFontFavorites([...state.favorites, family]);
  setFontFavorites(state.favorites);
  renderFontList(doc);
}

function syncFontSizeMode(doc: Document): void {
  const mode = getElement<HTMLSelectElement>(doc, "interlinear-font-size-mode")?.value;
  const em = getElement<HTMLInputElement>(doc, "interlinear-font-size-em");
  if (em) em.disabled = mode !== "em";
}

function initFontControls(doc: Document): void {
  const appearance = getAppearance();
  const state: FontUiState = {
    stack: normalizeFontStack(appearance.fontStack),
    favorites: getFontFavorites(),
    detected: null,
    detectionState: "idle",
    scanToken: 0,
    query: "",
    showAll: false,
  };
  fontUiStates.set(doc, state);

  const setValue = (id: string, value: string) => {
    const element = getElement<HTMLInputElement | HTMLSelectElement>(doc, id);
    if (element) element.value = value;
  };
  setValue("interlinear-font-weight", String(appearance.fontWeight));
  setValue("interlinear-letter-spacing", String(appearance.letterSpacing));
  setValue("interlinear-font-size-mode", appearance.fontSizeMode);
  setValue("interlinear-font-size-em", String(appearance.fontSizeEm));
  setValue("interlinear-text-direction", appearance.textDirection);
  const italic = getElement<HTMLInputElement>(doc, "interlinear-font-italic");
  if (italic) italic.checked = appearance.fontStyle === "italic";
  const autoLanguage = getElement<HTMLInputElement>(doc, "interlinear-font-auto-language");
  if (autoLanguage) autoLanguage.checked = appearance.autoFontByLanguage;
  syncFontSizeMode(doc);
  syncFontStackUi(doc);
  validateFontInput(doc);

  const search = getElement<HTMLInputElement>(doc, "interlinear-font-search");
  if (search) {
    search.placeholder = getString("font-search-placeholder");
    search.addEventListener("input", () => {
      state.query = search.value;
      renderFontList(doc);
    });
  }
  const showAll = getElement<HTMLInputElement>(doc, "interlinear-font-show-all");
  showAll?.addEventListener("change", () => {
    state.showAll = showAll.checked;
    renderFontList(doc);
  });
  getElement<HTMLButtonElement>(doc, "interlinear-font-rescan")?.addEventListener(
    "click",
    () => {
      clearCachedFontDetection();
      startFontDetection(doc, true);
    },
  );

  getElement<HTMLElement>(doc, "interlinear-font-list")?.addEventListener(
    "click",
    (event) => {
      const button = (event.target as Element | null)?.closest?.(
        "[data-action]",
      ) as HTMLElement | null;
      const row = button?.closest(".interlinear-font-row") as HTMLElement | null;
      if (!button || !row) return;
      const family = row.dataset.family || "";
      const generic = row.dataset.generic as FontGeneric | undefined;
      switch (button.dataset.action) {
        case "favorite":
          toggleFontFavorite(doc, family);
          break;
        case "fallback":
          addFontFallback(doc, family);
          break;
        case "pick":
          if (generic) setFontStack(doc, { primary: "", fallbacks: [], generic });
          else if (family) setFontStack(doc, { primary: family });
          else setFontStack(doc, { primary: "", fallbacks: [], generic: "" });
          break;
      }
    },
  );

  getElement<HTMLElement>(doc, "interlinear-font-stack")?.addEventListener(
    "click",
    (event) => {
      const button = (event.target as Element | null)?.closest?.(
        "[data-action]",
      ) as HTMLElement | null;
      if (!button) return;
      const index = Number(button.dataset.index);
      const fallbacks = [...state.stack.fallbacks];
      switch (button.dataset.action) {
        case "remove-primary":
          if (fallbacks.length) {
            setFontStack(doc, { primary: fallbacks[0], fallbacks: fallbacks.slice(1) });
          } else {
            setFontStack(doc, { primary: "", fallbacks: [] });
          }
          break;
        case "remove-fallback":
          if (Number.isInteger(index) && index >= 0) {
            fallbacks.splice(index, 1);
            setFontStack(doc, { fallbacks });
          }
          break;
        case "move-up":
          if (Number.isInteger(index) && index > 0) {
            [fallbacks[index - 1], fallbacks[index]] = [
              fallbacks[index],
              fallbacks[index - 1],
            ];
            setFontStack(doc, { fallbacks });
          }
          break;
        case "move-down":
          if (Number.isInteger(index) && index >= 0 && index < fallbacks.length - 1) {
            [fallbacks[index], fallbacks[index + 1]] = [
              fallbacks[index + 1],
              fallbacks[index],
            ];
            setFontStack(doc, { fallbacks });
          }
          break;
      }
    },
  );

  getElement<HTMLSelectElement>(doc, "interlinear-font-generic")?.addEventListener(
    "change",
    (event) => {
      const value = (event.target as HTMLSelectElement).value as FontGeneric;
      setFontStack(doc, { generic: value });
    },
  );

  const input = getElement<HTMLInputElement>(doc, "interlinear-appearance-font-family");
  input?.addEventListener("input", () => {
    validateFontInput(doc);
    const value = input.value.trim();
    if (value && !isValidFontFamily(value)) return;
    state.stack = parseFontStack(value);
    syncFontStackUi(doc, false);
    markDirty(doc);
  });
  // Keep invalid text visible with its inline error; saving warns and keeps
  // the last valid stack rather than silently discarding what was typed.
  input?.addEventListener("blur", () => validateFontInput(doc));

  getElement<HTMLSelectElement>(doc, "interlinear-font-size-mode")?.addEventListener(
    "change",
    () => syncFontSizeMode(doc),
  );

  startFontDetection(doc);
}

function initializeAppearanceControls(doc: Document): void {
  for (const config of COLOR_CONTROLS) initColorControl(doc, config);

  getElement<HTMLSelectElement>(
    doc,
    "interlinear-appearance-theme",
  )?.addEventListener("change", () => {
    refreshColorUI(doc);
    markDirty(doc);
  });

  initFontControls(doc);
  refreshColorUI(doc);
}

type SettingsTab = "service" | "display" | "appearance" | "glossary" | "advanced";

const SETTINGS_TABS: readonly SettingsTab[] = [
  "service",
  "display",
  "appearance",
  "glossary",
  "advanced",
];

function isSettingsTab(value: string | undefined): value is SettingsTab {
  return SETTINGS_TABS.includes(value as SettingsTab);
}

function activeSettingsTab(doc: Document): SettingsTab {
  const tabs = getElement<HTMLElement>(doc, "interlinear-settings-tabs");
  const value = tabs?.dataset.activeTab;
  return isSettingsTab(value) ? value : "service";
}

/** Sections live in one tab each; provider sections additionally follow the engine. */
function syncSectionVisibility(doc: Document): void {
  const tab = activeSettingsTab(doc);
  const engine = getElement<HTMLSelectElement>(doc, "interlinear-engine")?.value;
  const sections = Array.from(
    doc.querySelectorAll(".interlinear-section[data-tab]"),
  ) as HTMLElement[];
  for (const section of sections) {
    const tabMatches = section.dataset.tab === tab;
    const engineMatches = !section.dataset.engine || section.dataset.engine === engine;
    section.hidden = !(tabMatches && engineMatches);
  }
}

function setActiveTab(
  doc: Document,
  tab: SettingsTab,
  options: { focus?: boolean } = {},
): void {
  const container = getElement<HTMLElement>(doc, "interlinear-settings-tabs");
  if (!container) return;
  const previous = activeSettingsTab(doc);
  if (previous !== tab) {
    rememberTabScroll(doc, previous);
    if (dirtyTabsFor(doc).has(previous)) {
      setSaveHint(doc, getString("settings-tab-unsaved-hint"), 4000);
    }
  }
  container.dataset.activeTab = tab;
  const buttons = Array.from(
    container.querySelectorAll(".interlinear-tab"),
  ) as HTMLButtonElement[];
  for (const button of buttons) {
    const selected = button.dataset.tab === tab;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
    if (selected && options.focus) button.focus();
  }
  syncSectionVisibility(doc);
  if (previous !== tab) restoreTabScroll(doc, tab);
}

function registerSettingsTabs(doc: Document): void {
  const container = getElement<HTMLElement>(doc, "interlinear-settings-tabs");
  if (!container) return;
  container.setAttribute("aria-label", getString("settings-tabs-label"));
  const buttons = Array.from(
    container.querySelectorAll(".interlinear-tab"),
  ) as HTMLButtonElement[];
  for (const button of buttons) {
    button.addEventListener("click", () => {
      const tab = button.dataset.tab;
      if (isSettingsTab(tab)) setActiveTab(doc, tab);
    });
    button.addEventListener("keydown", (event) => {
      const keyEvent = event as KeyboardEvent;
      const index = buttons.indexOf(button);
      let nextIndex: number | null = null;
      if (keyEvent.key === "ArrowRight") nextIndex = (index + 1) % buttons.length;
      else if (keyEvent.key === "ArrowLeft") {
        nextIndex = (index - 1 + buttons.length) % buttons.length;
      } else if (keyEvent.key === "Home") nextIndex = 0;
      else if (keyEvent.key === "End") nextIndex = buttons.length - 1;
      if (nextIndex === null) return;
      keyEvent.preventDefault();
      const next = buttons[nextIndex];
      const tab = next?.dataset.tab;
      if (isSettingsTab(tab)) setActiveTab(doc, tab, { focus: true });
    });
  }
  setActiveTab(doc, "service");
}

function registerSecretToggles(doc: Document): void {
  const show = getString("settings-show-secret");
  const hide = getString("settings-hide-secret");
  for (const button of Array.from(
    doc.querySelectorAll(".interlinear-secret-toggle"),
  ) as HTMLButtonElement[]) {
    const target = getElement<HTMLInputElement>(doc, button.dataset.target || "");
    if (!target) continue;
    button.textContent = show;
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => {
      const reveal = target.type === "password";
      target.type = reveal ? "text" : "password";
      button.textContent = reveal ? hide : show;
      button.setAttribute("aria-pressed", String(reveal));
      target.focus();
      try {
        target.setSelectionRange(target.value.length, target.value.length);
      } catch (_) {
        // Selection is a nicety; some input types reject it.
      }
    });
  }
}

function registerDirtyTracking(doc: Document): void {
  // Delegate on the document so every tab and every nested control is covered.
  const mark = (event: Event) => {
    // Browsing or searching the font catalog changes no saved setting.
    const target = event.target as HTMLElement | null;
    if (target?.id === "interlinear-font-search") return;
    markDirty(doc, event.target);
  };
  doc.addEventListener("change", mark);
  doc.addEventListener("input", mark);
}

function fillProviderLabels(doc: Document): void {
  const entries: Array<[string, FluentKey]> = [
    ["interlinear-introduction", "settings-intro"],
    ["interlinear-privacy-notice", "settings-privacy-notice"],
    ["interlinear-engine-label", "provider-engine-label"],
    ["interlinear-engine-google", "provider-engine-google"],
    ["interlinear-engine-openai", "provider-engine-openai"],
    ["interlinear-engine-claude", "provider-engine-claude"],
    ["interlinear-engine-gemini", "provider-engine-gemini"],
    ["interlinear-engine-ollama", "provider-engine-ollama"],
    ["interlinear-source-language-label", "language-source-label"],
    ["interlinear-target-language-label", "language-target-label"],
    ["interlinear-language-help", "language-help"],
    ["interlinear-google-title", "provider-google-title"],
    ["interlinear-google-base-label", "provider-google-base-label"],
    ["interlinear-google-base-help", "provider-google-base-help"],
    ["interlinear-google-help", "provider-google-help"],
    ["interlinear-openai-title", "provider-openai-title"],
    ["interlinear-openai-endpoint-label", "provider-openai-endpoint-label"],
    ["interlinear-openai-endpoint-help", "provider-openai-endpoint-help"],
    ["interlinear-openai-model-label", "provider-openai-model-label"],
    ["interlinear-openai-api-key-label", "provider-openai-api-key-label"],
    ["interlinear-openai-api-key-help", "provider-openai-api-key-help"],
    ["interlinear-openai-temperature-label", "provider-openai-temperature-label"],
    ["interlinear-openai-temperature-help", "provider-openai-temperature-help"],
    ["interlinear-openai-prompt-label", "provider-openai-prompt-label"],
    ["interlinear-openai-prompt-help", "provider-openai-prompt-help"],
    ["interlinear-claude-title", "provider-claude-title"],
    ["interlinear-claude-endpoint-label", "provider-claude-endpoint-label"],
    ["interlinear-claude-endpoint-help", "provider-claude-endpoint-help"],
    ["interlinear-claude-model-label", "provider-claude-model-label"],
    ["interlinear-claude-api-key-label", "provider-claude-api-key-label"],
    ["interlinear-claude-api-key-help", "provider-claude-api-key-help"],
    ["interlinear-claude-temperature-label", "provider-claude-temperature-label"],
    ["interlinear-claude-temperature-help", "provider-claude-temperature-help"],
    ["interlinear-claude-prompt-label", "provider-claude-prompt-label"],
    ["interlinear-claude-prompt-help", "provider-claude-prompt-help"],
    ["interlinear-gemini-title", "provider-gemini-title"],
    ["interlinear-gemini-base-label", "provider-gemini-base-label"],
    ["interlinear-gemini-base-help", "provider-gemini-base-help"],
    ["interlinear-gemini-model-label", "provider-gemini-model-label"],
    ["interlinear-gemini-api-key-label", "provider-gemini-api-key-label"],
    ["interlinear-gemini-api-key-help", "provider-gemini-api-key-help"],
    ["interlinear-gemini-temperature-label", "provider-gemini-temperature-label"],
    ["interlinear-gemini-temperature-help", "provider-gemini-temperature-help"],
    ["interlinear-gemini-prompt-label", "provider-gemini-prompt-label"],
    ["interlinear-gemini-prompt-help", "provider-gemini-prompt-help"],
    ["interlinear-glossary-title", "glossary-title"],
    ["interlinear-glossary-help", "glossary-help"],
    ["interlinear-glossary-import", "glossary-import"],
    ["interlinear-glossary-export", "glossary-export"],
    ["interlinear-test-google", "provider-test-connection"],
    ["interlinear-test-openai", "provider-test-connection"],
    ["interlinear-test-claude", "provider-test-connection"],
    ["interlinear-test-gemini", "provider-test-connection"],
  ];
  for (const [id, key] of entries) {
    const element = getElement<HTMLElement>(doc, id);
    if (element) element.textContent = getString(key);
  }
}

function languageName(code: string): string {
  return getString(`language-name-${code}` as FluentKey);
}

function fillLanguageOptions(
  doc: Document,
  id: string,
  codes: readonly string[],
  selected: string,
): void {
  const select = getElement<HTMLSelectElement>(doc, id);
  if (!select) return;
  const options = codes.map((code) => {
    const option = doc.createElementNS(
      "http://www.w3.org/1999/xhtml",
      "option",
    ) as HTMLOptionElement;
    option.value = code;
    option.textContent = languageName(code);
    return option;
  });
  select.replaceChildren(...options);
  select.value = selected;
}

function fillAppearanceLabels(doc: Document): void {
  const entries: Array<[string, Parameters<typeof getString>[0]]> = [
    ["interlinear-appearance-title", "appearance-title"],
    ["interlinear-appearance-type-title", "appearance-type-title"],
    ["interlinear-appearance-colors-title", "appearance-colors-title"],
    ["interlinear-appearance-preview-label", "appearance-preview-label"],
    ["interlinear-appearance-preview-help", "appearance-preview-help"],
    ["interlinear-appearance-font-size-label", "appearance-font-size-label"],
    ["interlinear-appearance-font-size-help", "appearance-font-size-help"],
    ["interlinear-appearance-color-label", "appearance-color-label"],
    ["interlinear-appearance-color-inherit-label", "appearance-color-inherit-label"],
    ["interlinear-appearance-color-inherit-help", "appearance-color-inherit-help"],
    ["interlinear-appearance-color-reset", "appearance-color-reset"],
    ["interlinear-appearance-color-help", "appearance-color-help"],
    ["interlinear-appearance-font-family-label", "appearance-font-family-label"],
    ["interlinear-font-advanced-label", "appearance-font-advanced-label"],
    ["interlinear-appearance-font-family-help", "appearance-font-family-help"],
    ["interlinear-font-advanced-help", "appearance-font-advanced-help"],
    ["interlinear-font-show-all-label", "font-show-all-label"],
    ["interlinear-font-rescan", "font-rescan"],
    ["interlinear-font-stack-label", "font-stack-label"],
    ["interlinear-font-generic-label", "font-generic-label"],
    ["interlinear-font-generic-none", "font-generic-none"],
    ["interlinear-font-generic-sans", "font-generic-sans"],
    ["interlinear-font-generic-serif", "font-generic-serif"],
    ["interlinear-font-generic-mono", "font-generic-mono"],
    ["interlinear-font-auto-language-label", "font-auto-language-label"],
    ["interlinear-font-auto-language-help", "font-auto-language-help"],
    ["interlinear-font-weight-label", "font-weight-label"],
    ["interlinear-font-italic-label", "font-italic-label"],
    ["interlinear-font-weight-help", "font-weight-help"],
    ["interlinear-letter-spacing-label", "font-letter-spacing-label"],
    ["interlinear-letter-spacing-help", "font-letter-spacing-help"],
    ["interlinear-text-direction-label", "font-direction-label"],
    ["interlinear-text-direction-auto", "font-direction-auto"],
    ["interlinear-text-direction-ltr", "font-direction-ltr"],
    ["interlinear-text-direction-rtl", "font-direction-rtl"],
    ["interlinear-text-direction-help", "font-direction-help"],
    ["interlinear-font-size-mode-label", "font-size-mode-label"],
    ["interlinear-font-size-mode-px", "font-size-mode-px"],
    ["interlinear-font-size-mode-em", "font-size-mode-em"],
    ["interlinear-font-size-mode-help", "font-size-mode-help"],
    ["interlinear-font-size-em-label", "font-size-em-label"],
    ["interlinear-font-size-em-unit", "unit-em"],
    ["interlinear-appearance-line-height-label", "appearance-line-height-label"],
    ["interlinear-appearance-line-height-help", "appearance-line-height-help"],
    ["interlinear-appearance-paragraph-spacing-label", "appearance-paragraph-spacing-label"],
    ["interlinear-appearance-paragraph-spacing-help", "appearance-paragraph-spacing-help"],
    ["interlinear-appearance-background-label", "appearance-background-label"],
    ["interlinear-appearance-background-inherit-label", "appearance-background-inherit-label"],
    ["interlinear-appearance-background-inherit-help", "appearance-background-inherit-help"],
    ["interlinear-appearance-background-reset", "appearance-color-reset"],
    ["interlinear-appearance-background-help", "appearance-background-help"],
    ["interlinear-appearance-theme-label", "appearance-theme-label"],
    ["interlinear-appearance-theme-help", "appearance-theme-help"],
    ["interlinear-appearance-theme-auto", "appearance-theme-auto"],
    ["interlinear-appearance-theme-light", "appearance-theme-light"],
    ["interlinear-appearance-theme-dark", "appearance-theme-dark"],
    ["interlinear-appearance-underline-label", "appearance-underline-label"],
    ["interlinear-appearance-underline-color-label", "appearance-underline-color-label"],
    [
      "interlinear-appearance-underline-color-inherit-label",
      "appearance-underline-color-inherit-label",
    ],
    [
      "interlinear-appearance-underline-color-inherit-help",
      "appearance-underline-color-inherit-help",
    ],
    ["interlinear-appearance-underline-color-reset", "appearance-color-reset"],
    ["interlinear-appearance-underline-color-help", "appearance-underline-color-help"],
    ["interlinear-appearance-ribbon-label", "appearance-ribbon-label"],
    ["interlinear-appearance-ribbon-color-label", "appearance-ribbon-color-label"],
    ["interlinear-appearance-ribbon-color-reset", "appearance-color-reset"],
    ["interlinear-appearance-ribbon-color-help", "appearance-ribbon-color-help"],
    ["interlinear-display-mode-title", "display-mode-title"],
    ["interlinear-display-mode-label", "display-mode-label"],
    ["interlinear-display-mode-top-bottom", "display-mode-top-bottom"],
    ["interlinear-display-mode-side-by-side", "display-mode-side-by-side"],
    ["interlinear-display-mode-target-only", "display-mode-target-only"],
    ["interlinear-display-mode-source-only", "display-mode-source-only"],
    ["interlinear-display-mode-help", "display-mode-help"],
    ["interlinear-interaction-title", "interaction-title"],
    ["interlinear-hover-translate-label", "interaction-hover-label"],
    ["interlinear-hover-delay-label", "interaction-hover-delay-label"],
    ["interlinear-hover-delay-unit", "interaction-hover-delay-unit"],
    ["interlinear-hover-help", "interaction-hover-help"],
    ["interlinear-shortcut-enabled-label", "interaction-shortcut-enabled-label"],
    ["interlinear-shortcut-label", "interaction-shortcut-label"],
    ["interlinear-shortcut-help", "interaction-shortcut-help"],
    ["interlinear-interaction-help", "interaction-help"],
  ];
  for (const [id, key] of entries) {
    const element = getElement<HTMLElement>(doc, id);
    if (element) element.textContent = getString(key);
  }
}

function fillStaticLabels(doc: Document): void {
  const entries: Array<[string, Parameters<typeof getString>[0]]> = [
    ["interlinear-service-title", "settings-service-title"],
    ["interlinear-tab-service", "settings-tab-service"],
    ["interlinear-tab-display", "settings-tab-display"],
    ["interlinear-tab-appearance", "settings-tab-appearance"],
    ["interlinear-tab-glossary", "settings-tab-glossary"],
    ["interlinear-tab-advanced", "settings-tab-advanced"],
    ["interlinear-about-title", "settings-about-title"],
    ["interlinear-page-title", "settings-page-title"],
    ["interlinear-skip-last-label", "settings-skip-last-label"],
    ["interlinear-skip-last-help", "settings-skip-last-help"],
    ["interlinear-page-note", "settings-page-note"],
    ["interlinear-speed-title", "settings-speed-title"],
    ["interlinear-max-concurrent-label", "settings-max-concurrent-label"],
    ["interlinear-max-concurrent-help", "settings-max-concurrent-help"],
    ["interlinear-request-gap-label", "settings-request-gap-label"],
    ["interlinear-request-gap-help", "settings-request-gap-help"],
    ["interlinear-max-chars-label", "settings-max-chars-label"],
    ["interlinear-max-chars-help", "settings-max-chars-help"],
    ["interlinear-max-batch-paragraphs-label", "settings-max-batch-label"],
    ["interlinear-max-batch-paragraphs-help", "settings-max-batch-help"],
    ["interlinear-request-timeout-label", "settings-timeout-label"],
    ["interlinear-request-timeout-help", "settings-timeout-help"],
    ["interlinear-max-errors-label", "settings-max-errors-label"],
    ["interlinear-max-errors-help", "settings-max-errors-help"],
    ["interlinear-appearance-font-size-unit", "unit-px"],
    ["interlinear-appearance-paragraph-spacing-unit", "unit-em"],
    ["interlinear-letter-spacing-unit", "unit-em"],
    ["interlinear-skip-last-pages-unit", "unit-pages"],
    ["interlinear-request-gap-unit", "unit-ms"],
    ["interlinear-request-timeout-unit", "unit-ms"],
    ["interlinear-max-chars-unit", "unit-chars"],
    ["interlinear-save", "settings-save"],
    ["interlinear-cache-title", "settings-cache-title"],
    ["interlinear-clear-cache", "settings-clear-cache"],
    ["interlinear-cache-help", "settings-cache-help"],
    ["interlinear-ollama-title", "settings-ollama-title"],
    ["interlinear-ollama-url-label", "settings-ollama-url-label"],
    ["interlinear-ollama-model-label", "settings-ollama-model-label"],
    ["interlinear-test-ollama", "settings-test-ollama"],
    ["interlinear-refresh-title", "settings-refresh-title"],
    ["interlinear-refresh-help", "settings-refresh-help"],
    ["interlinear-project-title", "settings-project-title"],
  ];
  for (const [id, key] of entries) {
    const element = getElement<HTMLElement>(doc, id);
    if (element) element.textContent = getString(key);
  }
}

function readNumberInput(doc: Document, id: string, fallback: number): number {
  const input = getElement<HTMLInputElement>(doc, id);
  const value = Number(input?.value);
  return Number.isFinite(value) ? value : fallback;
}

function readCheckbox(doc: Document, id: string): boolean {
  return !!getElement<HTMLInputElement>(doc, id)?.checked;
}

function readInputText(doc: Document, id: string, fallback = ""): string {
  const input = getElement<HTMLInputElement>(doc, id);
  return input ? input.value : fallback;
}

function saveSettings(doc: Document): string[] {
  const engineValue = getElement<HTMLSelectElement>(doc, "interlinear-engine")?.value;
  const validEngines: TranslationEngine[] = [
    "google",
    "openai",
    "claude",
    "gemini",
    "ollama",
  ];
  const engine = validEngines.includes(engineValue as TranslationEngine)
    ? (engineValue as TranslationEngine)
    : "google";
  const url =
    getElement<HTMLInputElement>(doc, "interlinear-ollama-url")?.value || DEFAULT_OLLAMA_URL;
  const model =
    getElement<HTMLInputElement>(doc, "interlinear-ollama-model")?.value ||
    DEFAULT_OLLAMA_MODEL;

  setEngine(engine);
  setSourceLanguage(
    getElement<HTMLSelectElement>(doc, "interlinear-source-language")?.value ||
      DEFAULT_SOURCE_LANGUAGE,
  );
  setTargetLanguage(
    getElement<HTMLSelectElement>(doc, "interlinear-target-language")?.value ||
      DEFAULT_TARGET_LANGUAGE,
  );
  setGoogleBaseURL(
    readInputText(doc, "interlinear-google-base-url") || DEFAULT_GOOGLE_BASE_URL,
  );
  setOpenAIEndpoint(
    readInputText(doc, "interlinear-openai-endpoint") || DEFAULT_OPENAI_ENDPOINT,
  );
  setOpenAIModel(readInputText(doc, "interlinear-openai-model") || DEFAULT_OPENAI_MODEL);
  setOpenAIApiKey(readInputText(doc, "interlinear-openai-api-key"));
  setOpenAIPrompt(readInputText(doc, "interlinear-openai-prompt") || DEFAULT_OPENAI_PROMPT);
  setOpenAITemperature(
    readNumberInput(doc, "interlinear-openai-temperature", DEFAULT_OPENAI_TEMPERATURE),
  );
  setClaudeEndpoint(
    readInputText(doc, "interlinear-claude-endpoint") || getClaudeEndpoint(),
  );
  setClaudeModel(readInputText(doc, "interlinear-claude-model") || getClaudeModel());
  setClaudeApiKey(readInputText(doc, "interlinear-claude-api-key"));
  setClaudePrompt(readInputText(doc, "interlinear-claude-prompt") || getClaudePrompt());
  setClaudeTemperature(
    readNumberInput(doc, "interlinear-claude-temperature", DEFAULT_CLAUDE_TEMPERATURE),
  );
  setGeminiBaseURL(readInputText(doc, "interlinear-gemini-base-url") || getGeminiBaseURL());
  setGeminiModel(readInputText(doc, "interlinear-gemini-model") || getGeminiModel());
  setGeminiApiKey(readInputText(doc, "interlinear-gemini-api-key"));
  setGeminiPrompt(readInputText(doc, "interlinear-gemini-prompt") || getGeminiPrompt());
  setGeminiTemperature(
    readNumberInput(doc, "interlinear-gemini-temperature", DEFAULT_GEMINI_TEMPERATURE),
  );
  setGlossaryText(readInputText(doc, "interlinear-glossary"));
  setOllamaURL(url);
  setOllamaModel(model);
  setSkipLastPages(
    readNumberInput(doc, "interlinear-skip-last-pages", DEFAULT_SKIP_LAST_PAGES),
  );
  setMaxConcurrent(readNumberInput(doc, "interlinear-max-concurrent", DEFAULT_MAX_CONCURRENT));
  setRequestGapMs(readNumberInput(doc, "interlinear-request-gap", DEFAULT_REQUEST_GAP_MS));
  setMaxCharsPerRequest(
    readNumberInput(doc, "interlinear-max-chars", DEFAULT_MAX_CHARS_PER_REQUEST),
  );
  setMaxBatchParagraphs(
    readNumberInput(doc, "interlinear-max-batch-paragraphs", DEFAULT_MAX_BATCH_PARAGRAPHS),
  );
  setMaxConsecutiveErrors(
    readNumberInput(doc, "interlinear-max-errors", DEFAULT_MAX_CONSECUTIVE_ERRORS),
  );
  setRequestTimeoutMs(
    readNumberInput(doc, "interlinear-request-timeout", DEFAULT_REQUEST_TIMEOUT_MS),
  );

  const warnings: string[] = [];
  const appearance = readAppearanceForm(doc);
  const fontInput = getElement<HTMLInputElement>(
    doc,
    "interlinear-appearance-font-family",
  );
  if (fontInput?.value.trim() && !isValidFontFamily(fontInput.value)) {
    // Invalid text never entered the stack, so the last valid font is saved.
    warnings.push(getString("appearance-font-family-invalid-save"));
  }
  setAppearance(appearance);
  syncFontStackUi(doc, true);
  setDisplayMode(
    getElement<HTMLSelectElement>(doc, "interlinear-display-mode")?.value ||
      getDisplayMode(),
  );
  setHoverTranslateEnabled(readCheckbox(doc, "interlinear-hover-translate"));
  setHoverDelayMs(
    readNumberInput(doc, "interlinear-hover-delay", DEFAULT_HOVER_DELAY_MS),
  );
  setShortcutEnabled(readCheckbox(doc, "interlinear-shortcut-enabled"));
  const shortcutInput = getElement<HTMLInputElement>(doc, "interlinear-shortcut");
  const rawShortcut = shortcutInput?.value.trim() || DEFAULT_SHORTCUT;
  const shortcutValid = isValidShortcut(rawShortcut);
  const normalizedShortcut = normalizeShortcut(rawShortcut);
  setShortcut(normalizedShortcut);
  if (shortcutInput) shortcutInput.value = normalizedShortcut;
  if (!shortcutValid) warnings.push(getString("interaction-shortcut-invalid"));
  refreshTranslationStyles();
  refreshDisplayModes();
  refreshAppearancePreview(doc);
  return warnings;
}

async function testOllama(doc: Document): Promise<void> {
  const url = (
    getElement<HTMLInputElement>(doc, "interlinear-ollama-url")?.value || DEFAULT_OLLAMA_URL
  ).replace(/\/+$/, "");
  const model =
    getElement<HTMLInputElement>(doc, "interlinear-ollama-model")?.value ||
    DEFAULT_OLLAMA_MODEL;

  const button = getElement<HTMLButtonElement>(doc, "interlinear-test-ollama");
  if (button?.disabled) return;
  if (button) button.disabled = true;
  setTestStatus(
    doc,
    "ollama",
    "running",
    getString("ollama-testing", { args: { url } }),
  );
  try {
    const xhr = await Zotero.HTTP.request("GET", `${url}/api/tags`, {
      responseType: "json",
      timeout: 15000,
    });
    if (!xhr || xhr.status < 200 || xhr.status >= 300) {
      throw new Error(`HTTP ${xhr?.status || "unknown"}`);
    }

    const response: any = xhr.response;
    const models = Array.isArray(response?.models)
      ? response.models
          .map((entry: any) => String(entry?.name || entry?.model || ""))
          .filter(Boolean)
      : [];
    const hasModel = models.includes(model);
    if (models.length) {
      setTestStatus(
        doc,
        "ollama",
        hasModel ? "success" : "warning",
        hasModel
          ? getString("ollama-test-success", { args: { model } })
          : getString("ollama-test-missing-model", {
              args: { model, models: models.slice(0, 8).join(", ") },
            }),
      );
    } else {
      setTestStatus(doc, "ollama", "warning", getString("ollama-test-no-model-list"));
    }
  } catch (error: any) {
    setTestStatus(
      doc,
      "ollama",
      "error",
      getString("ollama-test-failed", {
        args: { detail: String(error?.message || error) },
      }),
    );
  } finally {
    if (button) button.disabled = false;
  }
}

async function testGoogle(doc: Document): Promise<void> {
  const baseURL =
    readInputText(doc, "interlinear-google-base-url") || DEFAULT_GOOGLE_BASE_URL;
  const targetLanguage =
    getElement<HTMLSelectElement>(doc, "interlinear-target-language")?.value ||
    getTargetLanguage();

  const button = getElement<HTMLButtonElement>(doc, "interlinear-test-google");
  if (button?.disabled) return;
  if (button) button.disabled = true;
  setTestStatus(doc, "google", "running", getString("provider-test-running"));
  try {
    const text = await testGoogleConnection(baseURL, targetLanguage);
    setTestStatus(
      doc,
      "google",
      "success",
      getString("provider-test-success", { args: { text } }),
    );
  } catch (error: any) {
    setTestStatus(
      doc,
      "google",
      "error",
      getString("provider-test-failed", {
        args: { detail: String(error?.message || error) },
      }),
    );
  } finally {
    if (button) button.disabled = false;
  }
}

async function testOpenAI(doc: Document): Promise<void> {
  const endpoint =
    readInputText(doc, "interlinear-openai-endpoint") || DEFAULT_OPENAI_ENDPOINT;
  const model = readInputText(doc, "interlinear-openai-model") || DEFAULT_OPENAI_MODEL;
  const apiKey = readInputText(doc, "interlinear-openai-api-key");
  const temperature = readNumberInput(
    doc,
    "interlinear-openai-temperature",
    DEFAULT_OPENAI_TEMPERATURE,
  );

  const button = getElement<HTMLButtonElement>(doc, "interlinear-test-openai");
  if (button?.disabled) return;
  if (button) button.disabled = true;
  setTestStatus(doc, "openai", "running", getString("provider-test-running"));
  try {
    const text = await testOpenAIConnection({ endpoint, apiKey, model, temperature });
    setTestStatus(
      doc,
      "openai",
      "success",
      getString("provider-test-success", { args: { text } }),
    );
  } catch (error: any) {
    setTestStatus(
      doc,
      "openai",
      "error",
      getString("provider-test-failed", {
        args: { detail: String(error?.message || error) },
      }),
    );
  } finally {
    if (button) button.disabled = false;
  }
}

async function testClaude(doc: Document): Promise<void> {
  const endpoint =
    readInputText(doc, "interlinear-claude-endpoint") || getClaudeEndpoint();
  const model = readInputText(doc, "interlinear-claude-model") || getClaudeModel();
  const apiKey = readInputText(doc, "interlinear-claude-api-key") || getClaudeApiKey();
  const temperature = readNumberInput(
    doc,
    "interlinear-claude-temperature",
    DEFAULT_CLAUDE_TEMPERATURE,
  );

  const button = getElement<HTMLButtonElement>(doc, "interlinear-test-claude");
  if (button?.disabled) return;
  if (button) button.disabled = true;
  setTestStatus(doc, "claude", "running", getString("provider-test-running"));
  try {
    const text = await testClaudeConnection({ endpoint, apiKey, model, temperature });
    setTestStatus(
      doc,
      "claude",
      "success",
      getString("provider-test-success", { args: { text } }),
    );
  } catch (error: any) {
    setTestStatus(
      doc,
      "claude",
      "error",
      getString("provider-test-failed", {
        args: { detail: String(error?.message || error) },
      }),
    );
  } finally {
    if (button) button.disabled = false;
  }
}

async function testGemini(doc: Document): Promise<void> {
  const baseURL =
    readInputText(doc, "interlinear-gemini-base-url") || getGeminiBaseURL();
  const model = readInputText(doc, "interlinear-gemini-model") || getGeminiModel();
  const apiKey = readInputText(doc, "interlinear-gemini-api-key") || getGeminiApiKey();
  const temperature = readNumberInput(
    doc,
    "interlinear-gemini-temperature",
    DEFAULT_GEMINI_TEMPERATURE,
  );

  const button = getElement<HTMLButtonElement>(doc, "interlinear-test-gemini");
  if (button?.disabled) return;
  if (button) button.disabled = true;
  setTestStatus(doc, "gemini", "running", getString("provider-test-running"));
  try {
    const text = await testGeminiConnection({ baseURL, apiKey, model, temperature });
    setTestStatus(
      doc,
      "gemini",
      "success",
      getString("provider-test-success", { args: { text } }),
    );
  } catch (error: any) {
    setTestStatus(
      doc,
      "gemini",
      "error",
      getString("provider-test-failed", {
        args: { detail: String(error?.message || error) },
      }),
    );
  } finally {
    if (button) button.disabled = false;
  }
}

async function importGlossary(doc: Document): Promise<void> {
  const button = getElement<HTMLButtonElement>(doc, "interlinear-glossary-import");
  if (button?.disabled) return;
  if (button) button.disabled = true;
  try {
    const path = await pickGlossaryFile(
      "open",
      getString("glossary-file-import-title"),
    );
    if (!path) return;

    const entries = parseGlossary(await readGlossaryFile(path));
    const status = getElement<HTMLElement>(doc, "interlinear-glossary-status");
    if (entries.length === 0) {
      if (status) status.textContent = getString("glossary-status-empty");
      return;
    }

    const textarea = getElement<HTMLTextAreaElement>(doc, "interlinear-glossary");
    if (textarea) textarea.value = serializeGlossary(entries);
    if (status) {
      status.textContent = getString("glossary-status-imported", {
        args: { count: String(entries.length) },
      });
    }
  } catch (error: any) {
    const status = getElement<HTMLElement>(doc, "interlinear-glossary-status");
    if (status) {
      status.textContent = getString("glossary-status-error", {
        args: { detail: String(error?.message || error) },
      });
    }
  } finally {
    if (button) button.disabled = false;
  }
}

async function exportGlossary(doc: Document): Promise<void> {
  const button = getElement<HTMLButtonElement>(doc, "interlinear-glossary-export");
  if (button?.disabled) return;
  if (button) button.disabled = true;
  try {
    const textarea = getElement<HTMLTextAreaElement>(doc, "interlinear-glossary");
    const entries = parseGlossary(textarea?.value || "");
    const status = getElement<HTMLElement>(doc, "interlinear-glossary-status");
    if (entries.length === 0) {
      if (status) status.textContent = getString("glossary-status-empty");
      return;
    }

    const path = await pickGlossaryFile(
      "save",
      getString("glossary-file-export-title"),
    );
    if (!path) return;

    await writeGlossaryFile(path, serializeGlossary(entries));
    if (status) {
      status.textContent = getString("glossary-status-exported", {
        args: { count: String(entries.length) },
      });
    }
  } catch (error: any) {
    const status = getElement<HTMLElement>(doc, "interlinear-glossary-status");
    if (status) {
      status.textContent = getString("glossary-status-error", {
        args: { detail: String(error?.message || error) },
      });
    }
  } finally {
    if (button) button.disabled = false;
  }
}

function updateCacheStatus(doc: Document): void {
  const status = getElement<HTMLElement>(doc, "interlinear-cache-status");
  if (!status) return;
  const stats = getTranslationCacheStats();
  const sizeMiB = ((stats.chars * 2) / (1024 * 1024)).toFixed(1);
  status.textContent = getString("cache-status", {
    args: { entries: String(stats.entries), size: sizeMiB },
  });
}

function clearCache(doc: Document): void {
  const removed = clearTranslationCache();
  const sizeMiB = ((removed.chars * 2) / (1024 * 1024)).toFixed(1);
  setStatus(
    doc,
    getString("cache-cleared", {
      args: { entries: String(removed.entries), size: sizeMiB },
    }),
    "success",
  );
  updateCacheStatus(doc);
}

function registerProjectLink(doc: Document): void {
  getElement<HTMLAnchorElement>(doc, "interlinear-github-link")?.addEventListener(
    "click",
    (event) => {
      event.preventDefault();
      const launcher = (Zotero as any).launchURL;
      if (typeof launcher === "function") launcher(PROJECT_URL);
      else doc.defaultView?.open(PROJECT_URL, "_blank");
    },
  );
}

function registerShortcutRecorder(doc: Document): void {
  const input = getElement<HTMLInputElement>(doc, "interlinear-shortcut");
  if (!input) return;

  input.addEventListener("keydown", (event) => {
    const keyEvent = event as KeyboardEvent;
    if (keyEvent.key === "Tab") return;
    keyEvent.preventDefault();

    if (keyEvent.key === "Backspace" || keyEvent.key === "Delete") {
      input.value = DEFAULT_SHORTCUT;
      return;
    }

    const spec = shortcutFromEvent(keyEvent);
    if (spec) input.value = formatShortcut(spec);
  });

  input.addEventListener("focus", () => input.select());
}

export async function registerPrefsScripts(window: Window): Promise<void> {
  const doc = window.document;
  const root = getElement<HTMLElement>(doc, "interlinear-settings-root");
  if (!root || root.dataset.initialized === "true") return;
  root.dataset.initialized = "true";

  const engine = getElement<HTMLSelectElement>(doc, "interlinear-engine");
  const url = getElement<HTMLInputElement>(doc, "interlinear-ollama-url");
  const model = getElement<HTMLInputElement>(doc, "interlinear-ollama-model");
  const skipLastPages = getElement<HTMLInputElement>(doc, "interlinear-skip-last-pages");
  const maxConcurrent = getElement<HTMLInputElement>(doc, "interlinear-max-concurrent");
  const gap = getElement<HTMLInputElement>(doc, "interlinear-request-gap");
  const maxChars = getElement<HTMLInputElement>(doc, "interlinear-max-chars");
  const maxBatchParagraphs = getElement<HTMLInputElement>(
    doc,
    "interlinear-max-batch-paragraphs",
  );
  const maxErrors = getElement<HTMLInputElement>(doc, "interlinear-max-errors");
  const requestTimeout = getElement<HTMLInputElement>(doc, "interlinear-request-timeout");
  const appearanceFontSize = getElement<HTMLInputElement>(
    doc,
    "interlinear-appearance-font-size",
  );
  const appearanceFontFamily = getElement<HTMLInputElement>(
    doc,
    "interlinear-appearance-font-family",
  );
  const appearanceLineHeight = getElement<HTMLInputElement>(
    doc,
    "interlinear-appearance-line-height",
  );
  const appearanceParagraphSpacing = getElement<HTMLInputElement>(
    doc,
    "interlinear-appearance-paragraph-spacing",
  );
  const appearanceTheme = getElement<HTMLSelectElement>(doc, "interlinear-appearance-theme");
  const appearanceUnderline = getElement<HTMLInputElement>(
    doc,
    "interlinear-appearance-underline",
  );
  const appearanceRibbon = getElement<HTMLInputElement>(doc, "interlinear-appearance-ribbon");
  const googleBaseURL = getElement<HTMLInputElement>(doc, "interlinear-google-base-url");
  const openAIEndpoint = getElement<HTMLInputElement>(doc, "interlinear-openai-endpoint");
  const openAIModel = getElement<HTMLInputElement>(doc, "interlinear-openai-model");
  const openAIApiKey = getElement<HTMLInputElement>(doc, "interlinear-openai-api-key");
  const openAITemperature = getElement<HTMLInputElement>(
    doc,
    "interlinear-openai-temperature",
  );
  const openAIPrompt = getElement<HTMLTextAreaElement>(doc, "interlinear-openai-prompt");
  const claudeEndpoint = getElement<HTMLInputElement>(doc, "interlinear-claude-endpoint");
  const claudeModel = getElement<HTMLInputElement>(doc, "interlinear-claude-model");
  const claudeApiKey = getElement<HTMLInputElement>(doc, "interlinear-claude-api-key");
  const claudeTemperature = getElement<HTMLInputElement>(
    doc,
    "interlinear-claude-temperature",
  );
  const claudePrompt = getElement<HTMLTextAreaElement>(doc, "interlinear-claude-prompt");
  const geminiBaseURL = getElement<HTMLInputElement>(doc, "interlinear-gemini-base-url");
  const geminiModel = getElement<HTMLInputElement>(doc, "interlinear-gemini-model");
  const geminiApiKey = getElement<HTMLInputElement>(doc, "interlinear-gemini-api-key");
  const geminiTemperature = getElement<HTMLInputElement>(
    doc,
    "interlinear-gemini-temperature",
  );
  const geminiPrompt = getElement<HTMLTextAreaElement>(doc, "interlinear-gemini-prompt");
  const glossary = getElement<HTMLTextAreaElement>(doc, "interlinear-glossary");
  const displayMode = getElement<HTMLSelectElement>(doc, "interlinear-display-mode");
  const hoverTranslate = getElement<HTMLInputElement>(doc, "interlinear-hover-translate");
  const hoverDelay = getElement<HTMLInputElement>(doc, "interlinear-hover-delay");
  const shortcutEnabled = getElement<HTMLInputElement>(
    doc,
    "interlinear-shortcut-enabled",
  );
  const shortcutInput = getElement<HTMLInputElement>(doc, "interlinear-shortcut");

  if (engine) engine.value = getEngine();
  if (url) url.value = getOllamaURL();
  if (model) model.value = getOllamaModel();
  if (googleBaseURL) googleBaseURL.value = getGoogleBaseURL();
  if (openAIEndpoint) openAIEndpoint.value = getOpenAIEndpoint();
  if (openAIModel) openAIModel.value = getOpenAIModel();
  if (openAIApiKey) openAIApiKey.value = getOpenAIApiKey();
  if (openAITemperature) openAITemperature.value = String(getOpenAITemperature());
  if (openAIPrompt) openAIPrompt.value = getOpenAIPrompt();
  if (claudeEndpoint) claudeEndpoint.value = getClaudeEndpoint();
  if (claudeModel) claudeModel.value = getClaudeModel();
  if (claudeApiKey) claudeApiKey.value = getClaudeApiKey();
  if (claudeTemperature) claudeTemperature.value = String(getClaudeTemperature());
  if (claudePrompt) claudePrompt.value = getClaudePrompt();
  if (geminiBaseURL) geminiBaseURL.value = getGeminiBaseURL();
  if (geminiModel) geminiModel.value = getGeminiModel();
  if (geminiApiKey) geminiApiKey.value = getGeminiApiKey();
  if (geminiTemperature) geminiTemperature.value = String(getGeminiTemperature());
  if (geminiPrompt) geminiPrompt.value = getGeminiPrompt();
  if (glossary) glossary.value = getGlossaryText();
  if (displayMode) displayMode.value = getDisplayMode();
  if (hoverTranslate) hoverTranslate.checked = getHoverTranslateEnabled();
  if (hoverDelay) {
    hoverDelay.value = String(getHoverDelayMs());
    hoverDelay.disabled = !getHoverTranslateEnabled();
  }
  if (shortcutEnabled) shortcutEnabled.checked = getShortcutEnabled();
  if (shortcutInput) shortcutInput.value = getShortcut();
  if (skipLastPages) skipLastPages.value = String(getSkipLastPages());
  if (maxConcurrent) maxConcurrent.value = String(getMaxConcurrent());
  if (gap) gap.value = String(getRequestGapMs());
  if (maxChars) maxChars.value = String(getMaxCharsPerRequest());
  if (maxBatchParagraphs) maxBatchParagraphs.value = String(getMaxBatchParagraphs());
  if (maxErrors) maxErrors.value = String(getMaxConsecutiveErrors());
  if (requestTimeout) requestTimeout.value = String(getRequestTimeoutMs());
  const appearance = getAppearance();
  if (appearanceFontSize) appearanceFontSize.value = String(appearance.fontSize);
  if (appearanceFontFamily) appearanceFontFamily.value = appearance.fontFamily;
  if (appearanceLineHeight) appearanceLineHeight.value = String(appearance.lineHeight);
  if (appearanceParagraphSpacing) {
    appearanceParagraphSpacing.value = String(appearance.paragraphSpacing);
  }
  if (appearanceTheme) appearanceTheme.value = appearance.theme;
  if (appearanceUnderline) appearanceUnderline.checked = appearance.underline;
  if (appearanceRibbon) appearanceRibbon.checked = appearance.ribbon;

  fillAppearanceLabels(doc);
  fillProviderLabels(doc);
  fillStaticLabels(doc);
  const footerNote = getElement<HTMLElement>(doc, "interlinear-footer-note");
  if (footerNote) {
    footerNote.textContent = getString("settings-footer-note", {
      args: { version: addonVersion },
    });
  }
  fillLanguageOptions(doc, "interlinear-source-language", SOURCE_LANGUAGES, getSourceLanguage());
  fillLanguageOptions(doc, "interlinear-target-language", TARGET_LANGUAGES, getTargetLanguage());
  initializeAppearancePreview(doc);
  initializeAppearanceControls(doc);
  // Delegate on the document: the tab panels all live inside the page, but a
  // document-level listener also survives the pane being rebuilt.
  doc.addEventListener("input", () => refreshAppearancePreview(doc));
  doc.addEventListener("change", () => refreshAppearancePreview(doc));
  refreshAppearancePreview(doc);
  updateCacheStatus(doc);
  registerProjectLink(doc);
  registerShortcutRecorder(doc);
  registerSettingsTabs(doc);
  registerSecretToggles(doc);
  registerDirtyTracking(doc);
  setSaveState(doc, "saved", getString("settings-status-saved"));

  hoverTranslate?.addEventListener("change", () => {
    if (hoverDelay) hoverDelay.disabled = !hoverTranslate.checked;
  });

  engine?.addEventListener("change", () => {
    syncSectionVisibility(doc);
    markDirty(doc, engine);
  });

  getElement<HTMLButtonElement>(doc, "interlinear-save")?.addEventListener("click", () => {
    try {
      const warnings = saveSettings(doc);
      clearDirtyTabs(doc);
      setSaveHint(doc, "");
      if (warnings.length) {
        setSaveState(doc, "warning", warnings.join(" "), 5000);
      } else {
        setSaveState(doc, "success", getString("settings-status-success"), 2500);
      }
    } catch (error: any) {
      setSaveState(
        doc,
        "error",
        getString("settings-status-error", {
          args: { detail: String(error?.message || error) },
        }),
      );
    }
  });

  getElement<HTMLButtonElement>(doc, "interlinear-test-ollama")?.addEventListener(
    "click",
    () => {
      void testOllama(doc);
    },
  );

  getElement<HTMLButtonElement>(doc, "interlinear-test-google")?.addEventListener(
    "click",
    () => {
      void testGoogle(doc);
    },
  );

  getElement<HTMLButtonElement>(doc, "interlinear-test-openai")?.addEventListener(
    "click",
    () => {
      void testOpenAI(doc);
    },
  );

  getElement<HTMLButtonElement>(doc, "interlinear-test-claude")?.addEventListener(
    "click",
    () => {
      void testClaude(doc);
    },
  );

  getElement<HTMLButtonElement>(doc, "interlinear-test-gemini")?.addEventListener(
    "click",
    () => {
      void testGemini(doc);
    },
  );

  getElement<HTMLButtonElement>(doc, "interlinear-glossary-import")?.addEventListener(
    "click",
    () => {
      void importGlossary(doc);
    },
  );

  getElement<HTMLButtonElement>(doc, "interlinear-glossary-export")?.addEventListener(
    "click",
    () => {
      void exportGlossary(doc);
    },
  );

  getElement<HTMLButtonElement>(doc, "interlinear-clear-cache")?.addEventListener(
    "click",
    () => {
      clearCache(doc);
    },
  );
}
