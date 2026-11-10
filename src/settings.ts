import {
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  buildFontStack,
  normalizeAppearance,
  parseFontStack,
  type AppearanceSettings,
} from "./appearance";
import {
  FONT_DETECTION_CACHE_MAX_FONTS,
  FONT_DETECTION_CACHE_VERSION,
  normalizeFontFavorites,
  parseFontDetectionCache,
} from "./fontCatalog";
import {
  DEFAULT_CLAUDE_ENDPOINT,
  normalizeClaudeEndpoint,
} from "./providers/claudeProtocol";
import {
  DEFAULT_GEMINI_BASE_URL,
  DEFAULT_GEMINI_MODEL,
  normalizeGeminiModel,
} from "./providers/geminiProtocol";
import { DEFAULT_GOOGLE_BASE_URL, normalizeGoogleEndpoint } from "./providers/googleProtocol";
import { normalizeChatCompletionsEndpoint } from "./providers/openaiProtocol";
import { buildLanguageDirective } from "./providers/prompts";
import type { ProviderId } from "./providers/types";
import {
  DEFAULT_DISPLAY_MODE,
  normalizeDisplayMode,
  type DisplayMode,
} from "./displayMode";
import {
  buildGlossaryDirective,
  glossaryHash,
  parseGlossary,
  type GlossaryEntry,
} from "./glossary";
import {
  DEFAULT_SHORTCUT,
  normalizeShortcut,
  parseShortcut,
  type ShortcutSpec,
} from "./shortcut";

export type { AppearanceSettings } from "./appearance";
export type { DisplayMode } from "./displayMode";
export { DEFAULT_GOOGLE_BASE_URL, DEFAULT_DISPLAY_MODE };

const BASE = "extensions.zotero.interlinear";
const LEGACY_BASE = "extensions.zotero.bilingualreader";

export type TranslationEngine = ProviderId;

export const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";
export const DEFAULT_OLLAMA_MODEL = "gpt-oss:20b";
export const DEFAULT_OPENAI_ENDPOINT = "http://127.0.0.1:11434/v1/chat/completions";
export const DEFAULT_OPENAI_MODEL = "gpt-oss:20b";
export const DEFAULT_OPENAI_TEMPERATURE = 0.2;
export const DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-5";
export const DEFAULT_CLAUDE_TEMPERATURE = 0.2;
export const DEFAULT_CLAUDE_MAX_TOKENS = 4096;
export const DEFAULT_GEMINI_TEMPERATURE = 0.2;
export { DEFAULT_GEMINI_MODEL };
export const DEFAULT_OPENAI_PROMPT = `你是学术论文翻译专家。把用户提供的段落准确翻译为指定的目标语言。

要求：
1. 只输出译文，不要解释、总结或添加原文没有的内容。
2. 保持学术语体，术语使用领域通行译法并前后一致。
3. 原样保留数字、单位、公式、变量、基因/蛋白/药物名称、文献引用和图表编号。
4. 若原文含 [[BRSEG_0000]] 这类分段标记，必须逐字保留并保持顺序，不得翻译、删除或合并段落。
5. 被标记分隔的段落逐段翻译，输出顺序与输入一致。`;
export const DEFAULT_SOURCE_LANGUAGE = "auto";
export const DEFAULT_TARGET_LANGUAGE = "zh-CN";
export const SOURCE_LANGUAGES = [
  "auto",
  "en",
  "zh-CN",
  "zh-TW",
  "ja",
  "ko",
  "fr",
  "de",
  "es",
  "ru",
  "pt",
  "it",
  "ar",
  "hi",
] as const;
export const TARGET_LANGUAGES = SOURCE_LANGUAGES.filter(
  (code) => code !== "auto",
) as readonly string[];
export const DEFAULT_REQUEST_GAP_MS = 250;
export const DEFAULT_MAX_CONCURRENT = 2;
export const DEFAULT_MAX_CHARS_PER_REQUEST = 2800;
export const DEFAULT_MAX_BATCH_PARAGRAPHS = 6;
export const DEFAULT_MAX_CONSECUTIVE_ERRORS = 3;
export const DEFAULT_REQUEST_TIMEOUT_MS = 60000;
export const DEFAULT_SKIP_LAST_PAGES = 1;
export const DEFAULT_HOVER_TRANSLATE = true;
export const DEFAULT_HOVER_DELAY_MS = 800;
export const HOVER_DELAY_MIN_MS = 200;
export const HOVER_DELAY_MAX_MS = 5000;
export const DEFAULT_SHORTCUT_ENABLED = true;
export { DEFAULT_SHORTCUT };

const ENGINE_PREF = `${BASE}.engine`;
const OLLAMA_URL_PREF = `${BASE}.ollama.url`;
const OLLAMA_MODEL_PREF = `${BASE}.ollama.model`;
const GOOGLE_BASE_URL_PREF = `${BASE}.google.baseUrl`;
const OPENAI_ENDPOINT_PREF = `${BASE}.openai.endpoint`;
const OPENAI_MODEL_PREF = `${BASE}.openai.model`;
const OPENAI_API_KEY_PREF = `${BASE}.openai.apiKey`;
const OPENAI_PROMPT_PREF = `${BASE}.openai.prompt`;
const OPENAI_TEMPERATURE_PREF = `${BASE}.openai.temperature`;
const CLAUDE_ENDPOINT_PREF = `${BASE}.claude.endpoint`;
const CLAUDE_MODEL_PREF = `${BASE}.claude.model`;
const CLAUDE_API_KEY_PREF = `${BASE}.claude.apiKey`;
const CLAUDE_PROMPT_PREF = `${BASE}.claude.prompt`;
const CLAUDE_TEMPERATURE_PREF = `${BASE}.claude.temperature`;
const GEMINI_BASE_URL_PREF = `${BASE}.gemini.baseUrl`;
const GEMINI_MODEL_PREF = `${BASE}.gemini.model`;
const GEMINI_API_KEY_PREF = `${BASE}.gemini.apiKey`;
const GEMINI_PROMPT_PREF = `${BASE}.gemini.prompt`;
const GEMINI_TEMPERATURE_PREF = `${BASE}.gemini.temperature`;
const LANGUAGE_SOURCE_PREF = `${BASE}.language.source`;
const LANGUAGE_TARGET_PREF = `${BASE}.language.target`;
const REQUEST_GAP_PREF = `${BASE}.requestGapMs`;
const MAX_CONCURRENT_PREF = `${BASE}.maxConcurrent`;
const MAX_CHARS_PREF = `${BASE}.maxCharsPerRequest`;
const MAX_BATCH_PARAGRAPHS_PREF = `${BASE}.maxBatchParagraphs`;
const MAX_ERRORS_PREF = `${BASE}.maxConsecutiveErrors`;
const REQUEST_TIMEOUT_PREF = `${BASE}.requestTimeoutMs`;
const SKIP_LAST_PAGES_PREF = `${BASE}.skipLastPages`;
const HOVER_TRANSLATE_PREF = `${BASE}.interaction.hoverTranslate`;
const HOVER_DELAY_PREF = `${BASE}.interaction.hoverDelayMs`;
const SHORTCUT_ENABLED_PREF = `${BASE}.interaction.shortcutEnabled`;
const SHORTCUT_PREF = `${BASE}.interaction.shortcut`;
const APPEARANCE_FONT_SIZE_PREF = `${BASE}.appearance.fontSize`;
const APPEARANCE_COLOR_PREF = `${BASE}.appearance.color`;
const APPEARANCE_FONT_FAMILY_PREF = `${BASE}.appearance.fontFamily`;
const APPEARANCE_LINE_HEIGHT_PREF = `${BASE}.appearance.lineHeightPercent`;
const APPEARANCE_PARAGRAPH_SPACING_PREF = `${BASE}.appearance.paragraphSpacing`;
const APPEARANCE_BACKGROUND_PREF = `${BASE}.appearance.background`;
const APPEARANCE_THEME_PREF = `${BASE}.appearance.theme`;
const APPEARANCE_UNDERLINE_PREF = `${BASE}.appearance.underline`;
const APPEARANCE_UNDERLINE_COLOR_PREF = `${BASE}.appearance.underlineColor`;
const APPEARANCE_RIBBON_PREF = `${BASE}.appearance.ribbon`;
const APPEARANCE_RIBBON_COLOR_PREF = `${BASE}.appearance.ribbonColor`;
const APPEARANCE_V2_PREF = `${BASE}.appearance.v2`;
const APPEARANCE_SCHEMA_PREF = `${BASE}.appearance.schema`;
const APPEARANCE_SCHEMA_VERSION = 2;
const FONT_FAVORITES_PREF = `${BASE}.appearance.fontFavorites`;
const FONT_DETECTION_PREF = `${BASE}.appearance.fontDetection`;
const DISPLAY_MODE_PREF = `${BASE}.displayMode`;
const GLOSSARY_PREF = `${BASE}.glossary`;

function getStringPref(key: string, fallback: string): string {
  const value = (Zotero.Prefs as any).get(key, true);
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function getRawStringPref(key: string): string {
  const value = (Zotero.Prefs as any).get(key, true);
  return typeof value === "string" ? value : "";
}

function setStringPref(key: string, value: string): void {
  (Zotero.Prefs as any).set(key, value, true);
}

function getBoolPref(key: string, fallback: boolean): boolean {
  const value = (Zotero.Prefs as any).get(key, true);
  return typeof value === "boolean" ? value : fallback;
}

function setBoolPref(key: string, value: boolean): void {
  (Zotero.Prefs as any).set(key, !!value, true);
}

function getNumberPref(key: string, fallback: number, min: number, max: number): number {
  const raw = (Zotero.Prefs as any).get(key, true);
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function setNumberPref(key: string, value: number, min: number, max: number): void {
  const normalized = Math.min(max, Math.max(min, Math.round(value)));
  (Zotero.Prefs as any).set(key, normalized, true);
}

export function getEngine(): TranslationEngine {
  const value = getStringPref(ENGINE_PREF, "google");
  return value === "ollama" ||
    value === "openai" ||
    value === "claude" ||
    value === "gemini"
    ? value
    : "google";
}

export function setEngine(engine: TranslationEngine): void {
  setStringPref(ENGINE_PREF, engine);
}

export function getSourceLanguage(): string {
  const value = getStringPref(LANGUAGE_SOURCE_PREF, DEFAULT_SOURCE_LANGUAGE);
  return (SOURCE_LANGUAGES as readonly string[]).includes(value)
    ? value
    : DEFAULT_SOURCE_LANGUAGE;
}

export function setSourceLanguage(language: string): void {
  setStringPref(
    LANGUAGE_SOURCE_PREF,
    (SOURCE_LANGUAGES as readonly string[]).includes(language)
      ? language
      : DEFAULT_SOURCE_LANGUAGE,
  );
}

export function getTargetLanguage(): string {
  const value = getStringPref(LANGUAGE_TARGET_PREF, DEFAULT_TARGET_LANGUAGE);
  return TARGET_LANGUAGES.includes(value) ? value : DEFAULT_TARGET_LANGUAGE;
}

export function setTargetLanguage(language: string): void {
  setStringPref(
    LANGUAGE_TARGET_PREF,
    TARGET_LANGUAGES.includes(language) ? language : DEFAULT_TARGET_LANGUAGE,
  );
}

export function getOllamaURL(): string {
  return getStringPref(OLLAMA_URL_PREF, DEFAULT_OLLAMA_URL).replace(/\/+$/, "");
}

export function setOllamaURL(url: string): void {
  setStringPref(OLLAMA_URL_PREF, url.trim().replace(/\/+$/, "") || DEFAULT_OLLAMA_URL);
}

export function getOllamaModel(): string {
  return getStringPref(OLLAMA_MODEL_PREF, DEFAULT_OLLAMA_MODEL);
}

export function setOllamaModel(model: string): void {
  setStringPref(OLLAMA_MODEL_PREF, model.trim() || DEFAULT_OLLAMA_MODEL);
}

export function getGoogleBaseURL(): string {
  return getStringPref(GOOGLE_BASE_URL_PREF, DEFAULT_GOOGLE_BASE_URL);
}

export function setGoogleBaseURL(url: string): void {
  setStringPref(GOOGLE_BASE_URL_PREF, url.trim() || DEFAULT_GOOGLE_BASE_URL);
}

export function getOpenAIEndpoint(): string {
  return getStringPref(OPENAI_ENDPOINT_PREF, DEFAULT_OPENAI_ENDPOINT);
}

export function setOpenAIEndpoint(endpoint: string): void {
  setStringPref(
    OPENAI_ENDPOINT_PREF,
    normalizeChatCompletionsEndpoint(endpoint) || DEFAULT_OPENAI_ENDPOINT,
  );
}

export function getOpenAIModel(): string {
  return getStringPref(OPENAI_MODEL_PREF, DEFAULT_OPENAI_MODEL);
}

export function setOpenAIModel(model: string): void {
  setStringPref(OPENAI_MODEL_PREF, model.trim() || DEFAULT_OPENAI_MODEL);
}

export function getOpenAIApiKey(): string {
  return getRawStringPref(OPENAI_API_KEY_PREF).trim();
}

export function setOpenAIApiKey(apiKey: string): void {
  setStringPref(OPENAI_API_KEY_PREF, apiKey.trim());
}

export function getOpenAIPrompt(): string {
  return (
    getRawStringPref(OPENAI_PROMPT_PREF).trim() || DEFAULT_OPENAI_PROMPT
  );
}

export function setOpenAIPrompt(prompt: string): void {
  setStringPref(OPENAI_PROMPT_PREF, prompt.trim() || DEFAULT_OPENAI_PROMPT);
}

export function getOpenAITemperature(): number {
  const value = Number(getStringPref(OPENAI_TEMPERATURE_PREF, String(DEFAULT_OPENAI_TEMPERATURE)));
  if (!Number.isFinite(value)) return DEFAULT_OPENAI_TEMPERATURE;
  return Math.min(2, Math.max(0, value));
}

export function setOpenAITemperature(value: number): void {
  const normalized = Number.isFinite(value)
    ? Math.min(2, Math.max(0, value))
    : DEFAULT_OPENAI_TEMPERATURE;
  setStringPref(OPENAI_TEMPERATURE_PREF, String(normalized));
}

/** The user-editable prompt plus the languages selected for this run. */
export function getOpenAISystemPrompt(): string {
  return appendGlossaryDirective(`${getOpenAIPrompt()}\n\n${buildLanguageDirective(
    getSourceLanguage(),
    getTargetLanguage(),
  )}`);
}

export function getClaudeEndpoint(): string {
  return getStringPref(CLAUDE_ENDPOINT_PREF, DEFAULT_CLAUDE_ENDPOINT);
}

export function setClaudeEndpoint(endpoint: string): void {
  setStringPref(
    CLAUDE_ENDPOINT_PREF,
    normalizeClaudeEndpoint(endpoint) || DEFAULT_CLAUDE_ENDPOINT,
  );
}

export function getClaudeModel(): string {
  return getStringPref(CLAUDE_MODEL_PREF, DEFAULT_CLAUDE_MODEL);
}

export function setClaudeModel(model: string): void {
  setStringPref(CLAUDE_MODEL_PREF, model.trim() || DEFAULT_CLAUDE_MODEL);
}

export function getClaudeApiKey(): string {
  return getRawStringPref(CLAUDE_API_KEY_PREF).trim();
}

export function setClaudeApiKey(apiKey: string): void {
  setStringPref(CLAUDE_API_KEY_PREF, apiKey.trim());
}

export function getClaudePrompt(): string {
  return getRawStringPref(CLAUDE_PROMPT_PREF).trim() || DEFAULT_OPENAI_PROMPT;
}

export function setClaudePrompt(prompt: string): void {
  setStringPref(CLAUDE_PROMPT_PREF, prompt.trim() || DEFAULT_OPENAI_PROMPT);
}

export function getClaudeTemperature(): number {
  const value = Number(
    getStringPref(CLAUDE_TEMPERATURE_PREF, String(DEFAULT_CLAUDE_TEMPERATURE)),
  );
  if (!Number.isFinite(value)) return DEFAULT_CLAUDE_TEMPERATURE;
  return Math.min(1, Math.max(0, value));
}

export function setClaudeTemperature(value: number): void {
  const normalized = Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : DEFAULT_CLAUDE_TEMPERATURE;
  setStringPref(CLAUDE_TEMPERATURE_PREF, String(normalized));
}

export function getClaudeSystemPrompt(): string {
  return appendGlossaryDirective(`${getClaudePrompt()}\n\n${buildLanguageDirective(
    getSourceLanguage(),
    getTargetLanguage(),
  )}`);
}

export function getGeminiBaseURL(): string {
  return getStringPref(GEMINI_BASE_URL_PREF, DEFAULT_GEMINI_BASE_URL).replace(
    /\/+$/u,
    "",
  );
}

export function setGeminiBaseURL(url: string): void {
  setStringPref(
    GEMINI_BASE_URL_PREF,
    url.trim().replace(/\/+$/u, "") || DEFAULT_GEMINI_BASE_URL,
  );
}

export function getGeminiModel(): string {
  return (
    normalizeGeminiModel(getStringPref(GEMINI_MODEL_PREF, DEFAULT_GEMINI_MODEL)) ||
    DEFAULT_GEMINI_MODEL
  );
}

export function setGeminiModel(model: string): void {
  setStringPref(
    GEMINI_MODEL_PREF,
    normalizeGeminiModel(model) || DEFAULT_GEMINI_MODEL,
  );
}

export function getGeminiApiKey(): string {
  return getRawStringPref(GEMINI_API_KEY_PREF).trim();
}

export function setGeminiApiKey(apiKey: string): void {
  setStringPref(GEMINI_API_KEY_PREF, apiKey.trim());
}

export function getGeminiPrompt(): string {
  return getRawStringPref(GEMINI_PROMPT_PREF).trim() || DEFAULT_OPENAI_PROMPT;
}

export function setGeminiPrompt(prompt: string): void {
  setStringPref(GEMINI_PROMPT_PREF, prompt.trim() || DEFAULT_OPENAI_PROMPT);
}

export function getGeminiTemperature(): number {
  const value = Number(
    getStringPref(GEMINI_TEMPERATURE_PREF, String(DEFAULT_GEMINI_TEMPERATURE)),
  );
  if (!Number.isFinite(value)) return DEFAULT_GEMINI_TEMPERATURE;
  return Math.min(2, Math.max(0, value));
}

export function setGeminiTemperature(value: number): void {
  const normalized = Number.isFinite(value)
    ? Math.min(2, Math.max(0, value))
    : DEFAULT_GEMINI_TEMPERATURE;
  setStringPref(GEMINI_TEMPERATURE_PREF, String(normalized));
}

export function getGeminiSystemPrompt(): string {
  return appendGlossaryDirective(`${getGeminiPrompt()}\n\n${buildLanguageDirective(
    getSourceLanguage(),
    getTargetLanguage(),
  )}`);
}

export function getRequestGapMs(): number {
  return getNumberPref(REQUEST_GAP_PREF, DEFAULT_REQUEST_GAP_MS, 0, 5000);
}

export function setRequestGapMs(value: number): void {
  setNumberPref(REQUEST_GAP_PREF, value, 0, 5000);
}

export function getMaxConcurrent(): number {
  return getNumberPref(MAX_CONCURRENT_PREF, DEFAULT_MAX_CONCURRENT, 1, 3);
}

export function setMaxConcurrent(value: number): void {
  setNumberPref(MAX_CONCURRENT_PREF, value, 1, 3);
}

export function getMaxCharsPerRequest(): number {
  return getNumberPref(MAX_CHARS_PREF, DEFAULT_MAX_CHARS_PER_REQUEST, 500, 8000);
}

export function setMaxCharsPerRequest(value: number): void {
  setNumberPref(MAX_CHARS_PREF, value, 500, 8000);
}

export function getMaxBatchParagraphs(): number {
  return getNumberPref(MAX_BATCH_PARAGRAPHS_PREF, DEFAULT_MAX_BATCH_PARAGRAPHS, 1, 12);
}

export function setMaxBatchParagraphs(value: number): void {
  setNumberPref(MAX_BATCH_PARAGRAPHS_PREF, value, 1, 12);
}

export function getMaxConsecutiveErrors(): number {
  return getNumberPref(MAX_ERRORS_PREF, DEFAULT_MAX_CONSECUTIVE_ERRORS, 1, 20);
}

export function setMaxConsecutiveErrors(value: number): void {
  setNumberPref(MAX_ERRORS_PREF, value, 1, 20);
}

export function getRequestTimeoutMs(): number {
  return getNumberPref(REQUEST_TIMEOUT_PREF, DEFAULT_REQUEST_TIMEOUT_MS, 5000, 300000);
}

export function setRequestTimeoutMs(value: number): void {
  setNumberPref(REQUEST_TIMEOUT_PREF, value, 5000, 300000);
}

export function getSkipLastPages(): number {
  return getNumberPref(SKIP_LAST_PAGES_PREF, DEFAULT_SKIP_LAST_PAGES, 0, 50);
}

export function setSkipLastPages(value: number): void {
  setNumberPref(SKIP_LAST_PAGES_PREF, value, 0, 50);
}

export function getHoverTranslateEnabled(): boolean {
  return getBoolPref(HOVER_TRANSLATE_PREF, DEFAULT_HOVER_TRANSLATE);
}

export function setHoverTranslateEnabled(value: boolean): void {
  setBoolPref(HOVER_TRANSLATE_PREF, value);
}

export function getHoverDelayMs(): number {
  return getNumberPref(
    HOVER_DELAY_PREF,
    DEFAULT_HOVER_DELAY_MS,
    HOVER_DELAY_MIN_MS,
    HOVER_DELAY_MAX_MS,
  );
}

export function setHoverDelayMs(value: number): void {
  setNumberPref(HOVER_DELAY_PREF, value, HOVER_DELAY_MIN_MS, HOVER_DELAY_MAX_MS);
}

export function getShortcutEnabled(): boolean {
  return getBoolPref(SHORTCUT_ENABLED_PREF, DEFAULT_SHORTCUT_ENABLED);
}

export function setShortcutEnabled(value: boolean): void {
  setBoolPref(SHORTCUT_ENABLED_PREF, value);
}

export function getShortcut(): string {
  return normalizeShortcut(getRawStringPref(SHORTCUT_PREF));
}

export function setShortcut(value: string): void {
  setStringPref(SHORTCUT_PREF, normalizeShortcut(value));
}

export function getShortcutSpec(): ShortcutSpec | null {
  return parseShortcut(getShortcut());
}

export function getAppearance(): AppearanceSettings {
  const stored = getRawStringPref(APPEARANCE_V2_PREF);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === "object") {
        return normalizeAppearance(parsed as Partial<AppearanceSettings>);
      }
    } catch (_) {
      // Fall through to the legacy per-field prefs.
    }
  }
  return normalizeAppearance({
    fontSize: getNumberPref(APPEARANCE_FONT_SIZE_PREF, 16, FONT_SIZE_MIN, FONT_SIZE_MAX),
    color: getRawStringPref(APPEARANCE_COLOR_PREF),
    fontFamily: getRawStringPref(APPEARANCE_FONT_FAMILY_PREF),
    lineHeight: getNumberPref(APPEARANCE_LINE_HEIGHT_PREF, 175, 100, 250) / 100,
    paragraphSpacing: getNumberPref(APPEARANCE_PARAGRAPH_SPACING_PREF, 125, 0, 300) / 100,
    background: getRawStringPref(APPEARANCE_BACKGROUND_PREF),
    theme: getRawStringPref(APPEARANCE_THEME_PREF) as AppearanceSettings["theme"],
    underline: getBoolPref(APPEARANCE_UNDERLINE_PREF, false),
    underlineColor: getRawStringPref(APPEARANCE_UNDERLINE_COLOR_PREF),
    ribbon: getBoolPref(APPEARANCE_RIBBON_PREF, true),
    ribbonColor: getRawStringPref(APPEARANCE_RIBBON_COLOR_PREF),
  });
}

export function setAppearance(input: Partial<AppearanceSettings>): void {
  const merged = { ...getAppearance(), ...input };
  // A caller that only changes the CSS font-family string still gets a
  // structured stack, so the next read and the stack UI agree.
  if (input.fontFamily !== undefined && input.fontStack === undefined) {
    merged.fontStack = parseFontStack(input.fontFamily);
    merged.fontFamily = buildFontStack(merged.fontStack);
  }
  const settings = normalizeAppearance(merged);
  setNumberPref(APPEARANCE_FONT_SIZE_PREF, settings.fontSize, FONT_SIZE_MIN, FONT_SIZE_MAX);
  setStringPref(APPEARANCE_COLOR_PREF, settings.color);
  setStringPref(APPEARANCE_FONT_FAMILY_PREF, settings.fontFamily);
  setNumberPref(
    APPEARANCE_LINE_HEIGHT_PREF,
    Math.round(settings.lineHeight * 100),
    100,
    250,
  );
  setNumberPref(
    APPEARANCE_PARAGRAPH_SPACING_PREF,
    Math.round(settings.paragraphSpacing * 100),
    0,
    300,
  );
  setStringPref(APPEARANCE_BACKGROUND_PREF, settings.background);
  setStringPref(APPEARANCE_THEME_PREF, settings.theme);
  setBoolPref(APPEARANCE_UNDERLINE_PREF, settings.underline);
  setStringPref(APPEARANCE_UNDERLINE_COLOR_PREF, settings.underlineColor);
  setBoolPref(APPEARANCE_RIBBON_PREF, settings.ribbon);
  setStringPref(APPEARANCE_RIBBON_COLOR_PREF, settings.ribbonColor);
  setStringPref(APPEARANCE_V2_PREF, JSON.stringify(settings));
  setNumberPref(APPEARANCE_SCHEMA_PREF, APPEARANCE_SCHEMA_VERSION, 1, 99);
}

export function getFontFavorites(): string[] {
  const stored = getRawStringPref(FONT_FAVORITES_PREF);
  if (!stored) return [];
  try {
    return normalizeFontFavorites(JSON.parse(stored));
  } catch (_) {
    return [];
  }
}

export function setFontFavorites(value: readonly string[]): void {
  setStringPref(FONT_FAVORITES_PREF, JSON.stringify(normalizeFontFavorites(value)));
}

export function getCachedFontDetection(): string[] | null {
  return parseFontDetectionCache(getRawStringPref(FONT_DETECTION_PREF));
}

export function setCachedFontDetection(fonts: readonly string[]): void {
  setStringPref(
    FONT_DETECTION_PREF,
    JSON.stringify({
      version: FONT_DETECTION_CACHE_VERSION,
      at: Date.now(),
      fonts: fonts.slice(0, FONT_DETECTION_CACHE_MAX_FONTS),
    }),
  );
}

export function clearCachedFontDetection(): void {
  try {
    (Zotero.Prefs as any).clear(FONT_DETECTION_PREF, true);
  } catch (_) {
    // The preference may already have been removed.
  }
}

export function getDisplayMode(): DisplayMode {
  return normalizeDisplayMode(getRawStringPref(DISPLAY_MODE_PREF));
}

export function setDisplayMode(mode: string): void {
  setStringPref(DISPLAY_MODE_PREF, normalizeDisplayMode(mode));
}

export function getGlossaryText(): string {
  return getRawStringPref(GLOSSARY_PREF);
}

export function setGlossaryText(text: string): void {
  setStringPref(GLOSSARY_PREF, text.replace(/\r\n?/gu, "\n"));
}

let glossaryEntriesCache: { text: string; entries: GlossaryEntry[] } | null = null;

export function getGlossaryEntries(): GlossaryEntry[] {
  const text = getGlossaryText();
  if (glossaryEntriesCache?.text !== text) {
    glossaryEntriesCache = { text, entries: parseGlossary(text) };
  }
  return glossaryEntriesCache.entries;
}

export function getGlossaryDirective(): string {
  return buildGlossaryDirective(getGlossaryEntries());
}

export function getGlossaryHash(): string {
  return glossaryHash(getGlossaryEntries());
}

/** The glossary consumes prompt space only for LLM-backed providers. */
function appendGlossaryDirective(prompt: string): string {
  const directive = getGlossaryDirective();
  return directive ? `${prompt}\n\n${directive}` : prompt;
}

function glossaryTag(): string {
  const hash = getGlossaryHash();
  return hash ? `:g:${hash}` : "";
}

function hashTag(text: string): string {
  let result = 2166136261;
  for (let i = 0; i < text.length; i++) {
    result = Math.imul(result ^ text.charCodeAt(i), 16777619);
  }
  return (result >>> 0).toString(16);
}

function languageTag(): string {
  const source = getSourceLanguage();
  const target = getTargetLanguage();
  // Keep the historical tag for the default pair so existing caches still hit.
  return source === DEFAULT_SOURCE_LANGUAGE && target === DEFAULT_TARGET_LANGUAGE
    ? ""
    : `:${source}>${target}`;
}

export function getCacheEngineTag(): string {
  const engine = getEngine();
  const language = languageTag();
  const glossary = glossaryTag();
  if (engine === "ollama") {
    return `ollama:${getOllamaURL()}:${getOllamaModel()}${language}${glossary}`;
  }
  if (engine === "openai") {
    // The API key is intentionally absent: rotating a key must not invalidate
    // translations, and cache keys must never carry secrets.
    return `openai:${normalizeChatCompletionsEndpoint(getOpenAIEndpoint())}:${getOpenAIModel()}:${hashTag(
      `${getOpenAIPrompt()}\u0000${getOpenAITemperature()}`,
    )}${language}${glossary}`;
  }
  if (engine === "claude") {
    return `claude:${normalizeClaudeEndpoint(getClaudeEndpoint())}:${getClaudeModel()}:${hashTag(
      `${getClaudePrompt()}\u0000${getClaudeTemperature()}`,
    )}${language}${glossary}`;
  }
  if (engine === "gemini") {
    return `gemini:${getGeminiBaseURL()}:${getGeminiModel()}:${hashTag(
      `${getGeminiPrompt()}\u0000${getGeminiTemperature()}`,
    )}${language}${glossary}`;
  }
  // Google is also the fallback cache namespace for removed backend values.
  return `google:${normalizeGoogleEndpoint(getGoogleBaseURL())}${language}${glossary}`;
}

/**
 * v0.1.3 passed already-qualified keys without Zotero's `global` flag. Zotero
 * therefore stored them under `extensions.zotero.extensions.zotero...`.
 * Move that branch once so existing user settings and caches are not lost.
 */
export function migrateLegacyPreferences(): void {
  const rootBranch = (Zotero.Prefs as any).rootBranch;
  if (!rootBranch?.getChildList) return;

  for (const base of [LEGACY_BASE, BASE]) {
    const malformedPrefix = `extensions.zotero.${base}.`;
    const keys = rootBranch.getChildList(malformedPrefix, {}) || [];
    for (const malformedKey of keys) {
      const correctedKey = malformedKey.slice("extensions.zotero.".length);
      try {
        if (!rootBranch.prefHasUserValue(correctedKey)) {
          switch (rootBranch.getPrefType(malformedKey)) {
            case rootBranch.PREF_BOOL:
              rootBranch.setBoolPref(correctedKey, rootBranch.getBoolPref(malformedKey));
              break;
            case rootBranch.PREF_INT:
              rootBranch.setIntPref(correctedKey, rootBranch.getIntPref(malformedKey));
              break;
            case rootBranch.PREF_STRING:
              rootBranch.setStringPref(correctedKey, rootBranch.getStringPref(malformedKey));
              break;
            default:
              break;
          }
        }
        rootBranch.clearUserPref(malformedKey);
      } catch (error) {
        Zotero.logError(error as Error);
      }
    }
  }

  migrateLegacyBranch(rootBranch);
}

/**
 * Copy Bilingual Reader prefs into the Interlinear branch once. The legacy
 * branch is left intact: the original plugin may still be installed, and
 * clearing its prefs would destroy its state.
 */
function migrateLegacyBranch(rootBranch: any): void {
  const markerKey = `${BASE}.migratedFromBilingualReader`;
  try {
    if (rootBranch.prefHasUserValue(markerKey)) return;
  } catch (_) {
    return;
  }
  const legacyPrefix = `${LEGACY_BASE}.`;
  const keys = rootBranch.getChildList(legacyPrefix, {}) || [];
  for (const legacyKey of keys) {
    const targetKey = `${BASE}.${legacyKey.slice(legacyPrefix.length)}`;
    try {
      if (rootBranch.prefHasUserValue(targetKey)) continue;
      switch (rootBranch.getPrefType(legacyKey)) {
        case rootBranch.PREF_BOOL:
          rootBranch.setBoolPref(targetKey, rootBranch.getBoolPref(legacyKey));
          break;
        case rootBranch.PREF_INT:
          rootBranch.setIntPref(targetKey, rootBranch.getIntPref(legacyKey));
          break;
        case rootBranch.PREF_STRING: {
          let value = rootBranch.getStringPref(legacyKey);
          // The cache index stores full pref keys; repoint them at the new
          // branch or every migrated entry would be filtered out as foreign.
          if (legacyKey === `${LEGACY_BASE}.cache.v4.index`) {
            value = rewriteCacheIndexKeys(value);
          }
          rootBranch.setStringPref(targetKey, value);
          break;
        }
        default:
          break;
      }
    } catch (error) {
      Zotero.logError(error as Error);
    }
  }
  try {
    rootBranch.setBoolPref(markerKey, true);
  } catch (error) {
    Zotero.logError(error as Error);
  }
}

function rewriteCacheIndexKeys(raw: string): string {
  try {
    const entries = JSON.parse(raw);
    if (!Array.isArray(entries)) return raw;
    for (const entry of entries) {
      if (typeof entry?.key === "string" && entry.key.startsWith(`${LEGACY_BASE}.`)) {
        entry.key = `${BASE}.${entry.key.slice(LEGACY_BASE.length + 1)}`;
      }
    }
    return JSON.stringify(entries);
  } catch (_) {
    return raw;
  }
}
