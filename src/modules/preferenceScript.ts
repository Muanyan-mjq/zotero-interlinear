import {
  DEFAULT_GOOGLE_BASE_URL,
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
  DEFAULT_SKIP_LAST_PAGES,
  DEFAULT_SOURCE_LANGUAGE,
  DEFAULT_TARGET_LANGUAGE,
  SOURCE_LANGUAGES,
  TARGET_LANGUAGES,
  getAppearance,
  getEngine,
  getGoogleBaseURL,
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
  getSkipLastPages,
  getSourceLanguage,
  getTargetLanguage,
  setEngine,
  setAppearance,
  setGoogleBaseURL,
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
  setSkipLastPages,
  setSourceLanguage,
  setTargetLanguage,
  type TranslationEngine,
} from "../settings";
import { DEFAULT_APPEARANCE, type AppearanceSettings } from "../appearance";
import { getString } from "../utils/locale";
import { refreshTranslationStyles } from "../bilingualReader";
import { clearTranslationCache, getTranslationCacheStats } from "../translationCache";
import { testGoogleConnection, testOpenAIConnection } from "../providers";

const PROJECT_URL = "https://github.com/Muanyan-mjq/zotero-interlinear";

function getElement<T extends HTMLElement>(doc: Document, id: string): T | null {
  return doc.getElementById(id) as T | null;
}

function setStatus(doc: Document, message: string): void {
  const status = getElement<HTMLElement>(doc, "interlinear-settings-status");
  if (status) status.textContent = message;
}

function updateBackendVisibility(doc: Document): void {
  const engine = getElement<HTMLSelectElement>(doc, "interlinear-engine")?.value;
  const pdfSection = getElement<HTMLElement>(doc, "interlinear-pdftranslate-section");
  const ollamaSection = getElement<HTMLElement>(doc, "interlinear-ollama-section");
  const googleSection = getElement<HTMLElement>(doc, "interlinear-google-section");
  const openaiSection = getElement<HTMLElement>(doc, "interlinear-openai-section");
  if (pdfSection) pdfSection.hidden = engine !== "pdftranslate";
  if (ollamaSection) ollamaSection.hidden = engine !== "ollama";
  if (googleSection) googleSection.hidden = engine !== "google";
  if (openaiSection) openaiSection.hidden = engine !== "openai";
}

type FluentKey = Parameters<typeof getString>[0];

function fillProviderLabels(doc: Document): void {
  const entries: Array<[string, FluentKey]> = [
    ["interlinear-introduction", "settings-intro"],
    ["interlinear-privacy-notice", "settings-privacy-notice"],
    ["interlinear-engine-label", "provider-engine-label"],
    ["interlinear-engine-google", "provider-engine-google"],
    ["interlinear-engine-openai", "provider-engine-openai"],
    ["interlinear-engine-ollama", "provider-engine-ollama"],
    ["interlinear-engine-pdftranslate", "provider-engine-pdftranslate"],
    ["interlinear-language-title", "language-title"],
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
    ["interlinear-test-google", "provider-test-connection"],
    ["interlinear-test-openai", "provider-test-connection"],
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
    ["interlinear-appearance-color-help", "appearance-color-help"],
    ["interlinear-appearance-font-family-label", "appearance-font-family-label"],
    ["interlinear-appearance-font-family-help", "appearance-font-family-help"],
    ["interlinear-appearance-line-height-label", "appearance-line-height-label"],
    ["interlinear-appearance-line-height-help", "appearance-line-height-help"],
    ["interlinear-appearance-paragraph-spacing-label", "appearance-paragraph-spacing-label"],
    ["interlinear-appearance-paragraph-spacing-help", "appearance-paragraph-spacing-help"],
    ["interlinear-appearance-background-label", "appearance-background-label"],
    ["interlinear-appearance-background-help", "appearance-background-help"],
    ["interlinear-appearance-theme-label", "appearance-theme-label"],
    ["interlinear-appearance-theme-help", "appearance-theme-help"],
    ["interlinear-appearance-theme-auto", "appearance-theme-auto"],
    ["interlinear-appearance-theme-light", "appearance-theme-light"],
    ["interlinear-appearance-theme-dark", "appearance-theme-dark"],
    ["interlinear-appearance-underline-label", "appearance-underline-label"],
    ["interlinear-appearance-underline-color-label", "appearance-underline-color-label"],
    ["interlinear-appearance-underline-color-help", "appearance-underline-color-help"],
    ["interlinear-appearance-ribbon-label", "appearance-ribbon-label"],
    ["interlinear-appearance-ribbon-color-label", "appearance-ribbon-color-label"],
    ["interlinear-appearance-ribbon-color-help", "appearance-ribbon-color-help"],
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
    "ollama",
    "pdftranslate",
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
    color: readInputText(doc, "interlinear-appearance-color"),
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
    background: readInputText(doc, "interlinear-appearance-background"),
    theme:
      (getElement<HTMLSelectElement>(doc, "interlinear-appearance-theme")
        ?.value as AppearanceSettings["theme"]) || "auto",
    underline: readCheckbox(doc, "interlinear-appearance-underline"),
    underlineColor: readInputText(doc, "interlinear-appearance-underline-color"),
    ribbon: readCheckbox(doc, "interlinear-appearance-ribbon"),
    ribbonColor:
      readInputText(doc, "interlinear-appearance-ribbon-color") ||
      DEFAULT_APPEARANCE.ribbonColor,
  });
  refreshTranslationStyles();

  setStatus(doc, "设置已保存。返回正在阅读的 PDF 后点击 🔄 即可应用。 ");
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
  setStatus(doc, `正在连接 ${url} …`);
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
      setStatus(
        doc,
        hasModel
          ? `Ollama 连接成功，并检测到模型 ${model}。`
          : `Ollama 连接成功，但模型列表中未发现 ${model}。已检测：${models.slice(0, 8).join(", ")}`,
      );
    } else {
      setStatus(doc, "Ollama 连接成功。未读取到本地模型列表；云模型仍可能可以直接调用。");
    }
  } catch (error: any) {
    setStatus(doc, `Ollama 连接失败：${error?.message || String(error)}`);
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
  setStatus(doc, getString("provider-test-running"));
  try {
    const text = await testGoogleConnection(baseURL, targetLanguage);
    setStatus(doc, getString("provider-test-success", { args: { text } }));
  } catch (error: any) {
    setStatus(
      doc,
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
  setStatus(doc, getString("provider-test-running"));
  try {
    const text = await testOpenAIConnection({ endpoint, apiKey, model, temperature });
    setStatus(doc, getString("provider-test-success", { args: { text } }));
  } catch (error: any) {
    setStatus(
      doc,
      getString("provider-test-failed", {
        args: { detail: String(error?.message || error) },
      }),
    );
  } finally {
    if (button) button.disabled = false;
  }
}

function updateCacheStatus(doc: Document): void {
  const status = getElement<HTMLElement>(doc, "interlinear-cache-status");
  if (!status) return;
  const stats = getTranslationCacheStats();
  const sizeMiB = ((stats.chars * 2) / (1024 * 1024)).toFixed(1);
  status.textContent = `缓存 ${stats.entries} 段，约 ${sizeMiB} MiB（按 UTF-16 估算）。`;
}

function clearCache(doc: Document): void {
  const removed = clearTranslationCache();
  const sizeMiB = ((removed.chars * 2) / (1024 * 1024)).toFixed(1);
  setStatus(doc, `已清除 ${removed.entries} 个缓存项，约 ${sizeMiB} MiB。`);
  updateCacheStatus(doc);
}

function updatePDFTranslateStatus(doc: Document): void {
  const api = (Zotero as any).PDFTranslate?.api;
  const target = getElement<HTMLElement>(doc, "interlinear-pdftranslate-status");
  if (!target) return;

  if (!api?.translate) {
    target.textContent = "未检测到 Translate for Zotero。请先安装并启用该插件。";
    return;
  }

  let version = "";
  try {
    version = api.getVersion?.() || "";
  } catch (_) {
    version = "";
  }

  target.textContent = version
    ? `已检测到 Translate for Zotero ${version}。Interlinear 将固定跟随它当前的默认服务。`
    : "已检测到 Translate for Zotero。Interlinear 将固定跟随它当前的默认服务。";
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
  const appearanceColor = getElement<HTMLInputElement>(doc, "interlinear-appearance-color");
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
  const appearanceBackground = getElement<HTMLInputElement>(
    doc,
    "interlinear-appearance-background",
  );
  const appearanceTheme = getElement<HTMLSelectElement>(doc, "interlinear-appearance-theme");
  const appearanceUnderline = getElement<HTMLInputElement>(
    doc,
    "interlinear-appearance-underline",
  );
  const appearanceUnderlineColor = getElement<HTMLInputElement>(
    doc,
    "interlinear-appearance-underline-color",
  );
  const appearanceRibbon = getElement<HTMLInputElement>(doc, "interlinear-appearance-ribbon");
  const appearanceRibbonColor = getElement<HTMLInputElement>(
    doc,
    "interlinear-appearance-ribbon-color",
  );
  const googleBaseURL = getElement<HTMLInputElement>(doc, "interlinear-google-base-url");
  const openAIEndpoint = getElement<HTMLInputElement>(doc, "interlinear-openai-endpoint");
  const openAIModel = getElement<HTMLInputElement>(doc, "interlinear-openai-model");
  const openAIApiKey = getElement<HTMLInputElement>(doc, "interlinear-openai-api-key");
  const openAITemperature = getElement<HTMLInputElement>(
    doc,
    "interlinear-openai-temperature",
  );
  const openAIPrompt = getElement<HTMLTextAreaElement>(doc, "interlinear-openai-prompt");

  if (engine) engine.value = getEngine();
  if (url) url.value = getOllamaURL();
  if (model) model.value = getOllamaModel();
  if (googleBaseURL) googleBaseURL.value = getGoogleBaseURL();
  if (openAIEndpoint) openAIEndpoint.value = getOpenAIEndpoint();
  if (openAIModel) openAIModel.value = getOpenAIModel();
  if (openAIApiKey) openAIApiKey.value = getOpenAIApiKey();
  if (openAITemperature) openAITemperature.value = String(getOpenAITemperature());
  if (openAIPrompt) openAIPrompt.value = getOpenAIPrompt();
  if (skipLastPages) skipLastPages.value = String(getSkipLastPages());
  if (maxConcurrent) maxConcurrent.value = String(getMaxConcurrent());
  if (gap) gap.value = String(getRequestGapMs());
  if (maxChars) maxChars.value = String(getMaxCharsPerRequest());
  if (maxBatchParagraphs) maxBatchParagraphs.value = String(getMaxBatchParagraphs());
  if (maxErrors) maxErrors.value = String(getMaxConsecutiveErrors());
  if (requestTimeout) requestTimeout.value = String(getRequestTimeoutMs());
  const appearance = getAppearance();
  if (appearanceFontSize) appearanceFontSize.value = String(appearance.fontSize);
  if (appearanceColor) appearanceColor.value = appearance.color;
  if (appearanceFontFamily) appearanceFontFamily.value = appearance.fontFamily;
  if (appearanceLineHeight) appearanceLineHeight.value = String(appearance.lineHeight);
  if (appearanceParagraphSpacing) {
    appearanceParagraphSpacing.value = String(appearance.paragraphSpacing);
  }
  if (appearanceBackground) appearanceBackground.value = appearance.background;
  if (appearanceTheme) appearanceTheme.value = appearance.theme;
  if (appearanceUnderline) appearanceUnderline.checked = appearance.underline;
  if (appearanceUnderlineColor) appearanceUnderlineColor.value = appearance.underlineColor;
  if (appearanceRibbon) appearanceRibbon.checked = appearance.ribbon;
  if (appearanceRibbonColor) appearanceRibbonColor.value = appearance.ribbonColor;

  fillAppearanceLabels(doc);
  fillProviderLabels(doc);
  fillLanguageOptions(doc, "interlinear-source-language", SOURCE_LANGUAGES, getSourceLanguage());
  fillLanguageOptions(doc, "interlinear-target-language", TARGET_LANGUAGES, getTargetLanguage());
  updateBackendVisibility(doc);
  updatePDFTranslateStatus(doc);
  updateCacheStatus(doc);
  registerProjectLink(doc);

  engine?.addEventListener("change", () => {
    updateBackendVisibility(doc);
    setStatus(doc, "翻译后端已修改，点击“保存设置”后生效。");
  });

  getElement<HTMLButtonElement>(doc, "interlinear-save")?.addEventListener("click", () => {
    saveSettings(doc);
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

  getElement<HTMLButtonElement>(doc, "interlinear-clear-cache")?.addEventListener(
    "click",
    () => {
      clearCache(doc);
    },
  );
}
