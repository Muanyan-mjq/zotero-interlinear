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
  setEngine,
  setAppearance,
  setDisplayMode,
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
import { DEFAULT_APPEARANCE, type AppearanceSettings } from "../appearance";
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

const PROJECT_URL = "https://github.com/Muanyan-mjq/zotero-interlinear";

const HTML_NS = "http://www.w3.org/1999/xhtml";

type StatusState = "info" | "success" | "warning" | "error" | "running";
type FluentKey = Parameters<typeof getString>[0];

const COLOR_PRESETS = [
  "#c7354a",
  "#2f6fdf",
  "#1f8a4c",
  "#d97706",
  "#7c3aed",
  "#333333",
  "#f6f6f6",
  "#ffffff",
] as const;

const FONT_PRESETS: Array<{ labelKey: FluentKey; value: string }> = [
  { labelKey: "appearance-font-preset-inherit", value: "" },
  { labelKey: "appearance-font-preset-georgia", value: "Georgia, serif" },
  { labelKey: "appearance-font-preset-times", value: "Times New Roman, serif" },
  { labelKey: "appearance-font-preset-arial", value: "Arial, sans-serif" },
  { labelKey: "appearance-font-preset-yahei", value: "Microsoft YaHei, sans-serif" },
  { labelKey: "appearance-font-preset-simsun", value: "SimSun, serif" },
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

function setStatus(doc: Document, message: string, state: StatusState = "info"): void {
  const statuses = Array.from(
    doc.querySelectorAll(".interlinear-settings-status"),
  ) as HTMLElement[];
  for (const status of statuses) updateStatus(status, message, state);
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

function setSaveHint(doc: Document, message: string): void {
  updateStatus(
    getElement<HTMLElement>(doc, "interlinear-save-hint"),
    message,
    "warning",
  );
}

function markDirty(doc: Document): void {
  setSaveHint(doc, getString("settings-unsaved"));
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

function setColorControl(
  doc: Document,
  inputId: string,
  inheritId: string | null,
  raw: string,
  fallback: string,
): void {
  const input = getElement<HTMLInputElement>(doc, inputId);
  const inherit = inheritId ? getElement<HTMLInputElement>(doc, inheritId) : null;
  const hasValue = !!raw.trim();
  if (inherit) inherit.checked = !hasValue;
  if (input) {
    input.value = resolveColorForPicker(doc, raw, fallback);
    input.disabled = !!inherit && !hasValue;
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

function bindInheritToggle(doc: Document, inputId: string, inheritId: string): void {
  const inherit = getElement<HTMLInputElement>(doc, inheritId);
  const input = getElement<HTMLInputElement>(doc, inputId);
  inherit?.addEventListener("change", () => {
    if (input) input.disabled = !!inherit.checked;
  });
}

function renderColorPresets(
  doc: Document,
  containerId: string,
  inputId: string,
  inheritId: string | null,
): void {
  const container = getElement<HTMLElement>(doc, containerId);
  if (!container) return;
  const label = getString("appearance-color-preset-title");
  container.title = label;
  container.setAttribute("aria-label", label);
  const buttons = COLOR_PRESETS.map((color) => {
    const button = doc.createElementNS(HTML_NS, "button") as HTMLButtonElement;
    button.type = "button";
    button.className = "interlinear-color-preset";
    button.style.backgroundColor = color;
    button.title = color;
    button.setAttribute("aria-label", color);
    button.addEventListener("click", () => {
      const input = getElement<HTMLInputElement>(doc, inputId);
      if (input) {
        input.value = color;
        input.disabled = false;
      }
      const inherit = inheritId ? getElement<HTMLInputElement>(doc, inheritId) : null;
      if (inherit) inherit.checked = false;
      markDirty(doc);
    });
    return button;
  });
  container.replaceChildren(...buttons);
}

function fontPresetKey(value: string): string {
  return value.toLowerCase().replace(/\s+/gu, "");
}

function syncFontPresetState(doc: Document): void {
  const input = getElement<HTMLInputElement>(doc, "interlinear-appearance-font-family");
  const container = getElement<HTMLElement>(
    doc,
    "interlinear-appearance-font-family-presets",
  );
  if (!container) return;
  const current = fontPresetKey((input?.value || "").trim());
  const buttons = Array.from(
    container.querySelectorAll(".interlinear-font-preset"),
  ) as HTMLElement[];
  for (const button of buttons) {
    button.dataset.active = String(fontPresetKey(button.dataset.value || "") === current);
  }
}

function renderFontPresets(doc: Document): void {
  const container = getElement<HTMLElement>(
    doc,
    "interlinear-appearance-font-family-presets",
  );
  const input = getElement<HTMLInputElement>(doc, "interlinear-appearance-font-family");
  if (!container || !input) return;
  const label = getString("appearance-font-preset-title");
  container.title = label;
  container.setAttribute("aria-label", label);
  const buttons = FONT_PRESETS.map(({ labelKey, value }) => {
    const button = doc.createElementNS(HTML_NS, "button") as HTMLButtonElement;
    button.type = "button";
    button.className = "interlinear-font-preset";
    button.dataset.value = value;
    button.textContent = getString(labelKey);
    button.addEventListener("click", () => {
      input.value = value;
      syncFontPresetState(doc);
      markDirty(doc);
    });
    return button;
  });
  container.replaceChildren(...buttons);
  input.addEventListener("input", () => syncFontPresetState(doc));
  input.addEventListener("change", () => syncFontPresetState(doc));
  syncFontPresetState(doc);
}

function initializeAppearanceControls(doc: Document): void {
  const appearance = getAppearance();
  const colorControls: Array<{
    inputId: string;
    inheritId: string | null;
    presetsId: string;
    raw: string;
    fallback: string;
  }> = [
    {
      inputId: "interlinear-appearance-color",
      inheritId: "interlinear-appearance-color-inherit",
      presetsId: "interlinear-appearance-color-presets",
      raw: appearance.color,
      fallback: "#333333",
    },
    {
      inputId: "interlinear-appearance-background",
      inheritId: "interlinear-appearance-background-inherit",
      presetsId: "interlinear-appearance-background-presets",
      raw: appearance.background,
      fallback: "#f6f6f6",
    },
    {
      inputId: "interlinear-appearance-underline-color",
      inheritId: "interlinear-appearance-underline-color-inherit",
      presetsId: "interlinear-appearance-underline-color-presets",
      raw: appearance.underlineColor,
      fallback: "#333333",
    },
    {
      inputId: "interlinear-appearance-ribbon-color",
      inheritId: null,
      presetsId: "interlinear-appearance-ribbon-color-presets",
      raw: appearance.ribbonColor,
      fallback: DEFAULT_APPEARANCE.ribbonColor,
    },
  ];
  for (const control of colorControls) {
    setColorControl(
      doc,
      control.inputId,
      control.inheritId,
      control.raw,
      control.fallback,
    );
    if (control.inheritId) {
      bindInheritToggle(doc, control.inputId, control.inheritId);
    }
    renderColorPresets(doc, control.presetsId, control.inputId, control.inheritId);
  }

  getElement<HTMLButtonElement>(
    doc,
    "interlinear-appearance-ribbon-color-reset",
  )?.addEventListener("click", () => {
    const input = getElement<HTMLInputElement>(
      doc,
      "interlinear-appearance-ribbon-color",
    );
    if (input) input.value = DEFAULT_APPEARANCE.ribbonColor;
    markDirty(doc);
  });

  renderFontPresets(doc);
}

function registerSettingsNav(doc: Document): void {
  const buttons = Array.from(
    doc.querySelectorAll(".interlinear-nav-button"),
  ) as HTMLElement[];
  for (const button of buttons) {
    button.addEventListener("click", () => {
      const target = getElement<HTMLElement>(doc, button.dataset.target || "");
      if (!target) return;
      try {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (_) {
        target.scrollIntoView();
      }
    });
  }
}

function registerDirtyTracking(doc: Document, root: HTMLElement): void {
  const mark = () => markDirty(doc);
  root.addEventListener("change", mark);
  root.addEventListener("input", mark);
}

function updateBackendVisibility(doc: Document): void {
  const engine = getElement<HTMLSelectElement>(doc, "interlinear-engine")?.value;
  const ollamaSection = getElement<HTMLElement>(doc, "interlinear-ollama-section");
  const googleSection = getElement<HTMLElement>(doc, "interlinear-google-section");
  const openaiSection = getElement<HTMLElement>(doc, "interlinear-openai-section");
  const claudeSection = getElement<HTMLElement>(doc, "interlinear-claude-section");
  const geminiSection = getElement<HTMLElement>(doc, "interlinear-gemini-section");
  if (ollamaSection) ollamaSection.hidden = engine !== "ollama";
  if (googleSection) googleSection.hidden = engine !== "google";
  if (openaiSection) openaiSection.hidden = engine !== "openai";
  if (claudeSection) claudeSection.hidden = engine !== "claude";
  if (geminiSection) geminiSection.hidden = engine !== "gemini";
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
    ["interlinear-appearance-font-size-label", "appearance-font-size-label"],
    ["interlinear-appearance-font-size-help", "appearance-font-size-help"],
    ["interlinear-appearance-color-label", "appearance-color-label"],
    ["interlinear-appearance-color-inherit-label", "appearance-color-inherit-label"],
    ["interlinear-appearance-color-help", "appearance-color-help"],
    ["interlinear-appearance-font-family-label", "appearance-font-family-label"],
    ["interlinear-appearance-font-family-help", "appearance-font-family-help"],
    ["interlinear-appearance-line-height-label", "appearance-line-height-label"],
    ["interlinear-appearance-line-height-help", "appearance-line-height-help"],
    ["interlinear-appearance-paragraph-spacing-label", "appearance-paragraph-spacing-label"],
    ["interlinear-appearance-paragraph-spacing-help", "appearance-paragraph-spacing-help"],
    ["interlinear-appearance-background-label", "appearance-background-label"],
    ["interlinear-appearance-background-inherit-label", "appearance-background-inherit-label"],
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
    ["interlinear-appearance-underline-color-help", "appearance-underline-color-help"],
    ["interlinear-appearance-ribbon-label", "appearance-ribbon-label"],
    ["interlinear-appearance-ribbon-color-label", "appearance-ribbon-color-label"],
    ["interlinear-appearance-ribbon-color-reset", "appearance-ribbon-color-reset"],
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
    ["interlinear-nav-title", "settings-nav-title"],
    ["interlinear-nav-service", "settings-nav-service"],
    ["interlinear-nav-display", "settings-nav-display"],
    ["interlinear-nav-appearance", "settings-nav-appearance"],
    ["interlinear-nav-scope", "settings-nav-scope"],
    ["interlinear-nav-glossary", "settings-nav-glossary"],
    ["interlinear-nav-maintenance", "settings-nav-maintenance"],
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
    ["interlinear-save", "settings-save"],
    ["interlinear-save-bottom", "settings-save"],
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

function saveSettings(doc: Document): void {
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

  setAppearance({
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
    fontFamily: readInputText(doc, "interlinear-appearance-font-family"),
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
        ?.value as AppearanceSettings["theme"]) || "auto",
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
  });
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
  refreshTranslationStyles();
  refreshDisplayModes();

  setStatus(
    doc,
    shortcutValid
      ? getString("settings-saved")
      : getString("interaction-shortcut-invalid"),
    shortcutValid ? "success" : "warning",
  );
  setSaveHint(doc, "");
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
  fillLanguageOptions(doc, "interlinear-source-language", SOURCE_LANGUAGES, getSourceLanguage());
  fillLanguageOptions(doc, "interlinear-target-language", TARGET_LANGUAGES, getTargetLanguage());
  initializeAppearanceControls(doc);
  updateBackendVisibility(doc);
  updateCacheStatus(doc);
  registerProjectLink(doc);
  registerShortcutRecorder(doc);
  registerSettingsNav(doc);
  registerDirtyTracking(doc, root);

  hoverTranslate?.addEventListener("change", () => {
    if (hoverDelay) hoverDelay.disabled = !hoverTranslate.checked;
  });

  engine?.addEventListener("change", () => {
    updateBackendVisibility(doc);
    setStatus(doc, getString("settings-engine-pending"), "warning");
    markDirty(doc);
  });

  for (const id of ["interlinear-save", "interlinear-save-bottom"]) {
    getElement<HTMLButtonElement>(doc, id)?.addEventListener("click", () => {
      saveSettings(doc);
    });
  }

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
