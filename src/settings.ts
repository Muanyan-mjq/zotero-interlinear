import {
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  normalizeAppearance,
  type AppearanceSettings,
} from "./appearance";

export type { AppearanceSettings } from "./appearance";

const BASE = "extensions.zotero.interlinear";
const LEGACY_BASE = "extensions.zotero.bilingualreader";

export type TranslationEngine = "pdftranslate" | "ollama";

export const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";
export const DEFAULT_OLLAMA_MODEL = "gpt-oss:20b";
export const DEFAULT_REQUEST_GAP_MS = 250;
export const DEFAULT_MAX_CONCURRENT = 2;
export const DEFAULT_MAX_CHARS_PER_REQUEST = 2800;
export const DEFAULT_MAX_BATCH_PARAGRAPHS = 6;
export const DEFAULT_MAX_CONSECUTIVE_ERRORS = 3;
export const DEFAULT_REQUEST_TIMEOUT_MS = 60000;
export const DEFAULT_SKIP_LAST_PAGES = 1;

const ENGINE_PREF = `${BASE}.engine`;
const OLLAMA_URL_PREF = `${BASE}.ollama.url`;
const OLLAMA_MODEL_PREF = `${BASE}.ollama.model`;
const REQUEST_GAP_PREF = `${BASE}.requestGapMs`;
const MAX_CONCURRENT_PREF = `${BASE}.maxConcurrent`;
const MAX_CHARS_PREF = `${BASE}.maxCharsPerRequest`;
const MAX_BATCH_PARAGRAPHS_PREF = `${BASE}.maxBatchParagraphs`;
const MAX_ERRORS_PREF = `${BASE}.maxConsecutiveErrors`;
const REQUEST_TIMEOUT_PREF = `${BASE}.requestTimeoutMs`;
const SKIP_LAST_PAGES_PREF = `${BASE}.skipLastPages`;
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
  return getStringPref(ENGINE_PREF, "pdftranslate") === "ollama" ? "ollama" : "pdftranslate";
}

export function setEngine(engine: TranslationEngine): void {
  setStringPref(ENGINE_PREF, engine);
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

export function getAppearance(): AppearanceSettings {
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
  const settings = normalizeAppearance({ ...getAppearance(), ...input });
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
}

export function getResolvedPDFTranslateService(): string {
  try {
    const current = (Zotero.Prefs as any).get(
      "extensions.zotero.ZoteroPDFTranslate.translateSource",
      true,
    );
    return typeof current === "string" ? current.trim() : "";
  } catch (_) {
    return "";
  }
}

export function getCacheEngineTag(actualPDFTranslateService?: string): string {
  if (getEngine() === "ollama") {
    return `ollama:${getOllamaURL()}:${getOllamaModel()}`;
  }
  return `pdftranslate:${
    actualPDFTranslateService || getResolvedPDFTranslateService() || "default"
  }`;
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
