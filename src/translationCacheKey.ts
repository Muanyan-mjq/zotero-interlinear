const BASE = "extensions.zotero.interlinear";
const CACHE_PREFIX = `${BASE}.cache.v4.`;
const LEGACY_CACHE_PREFIX = `${BASE}.cache.v3.`;

export interface TranslationCacheKeyInput {
  itemKey: string;
  sourceText: string;
  engineTag: string;
  targetLanguage: string;
}

export function fnv1aHash(text: string): string {
  let result = 2166136261;
  for (let i = 0; i < text.length; i++) {
    result = Math.imul(result ^ text.charCodeAt(i), 16777619);
  }
  return (result >>> 0).toString(16);
}

function safeItemKey(itemKey: string): string {
  return itemKey.replace(/[^a-z0-9_-]/giu, "_").slice(0, 64) || "reader";
}

function safeLanguage(targetLang: string): string {
  return targetLang.replace(/[^a-z0-9-]/giu, "_").slice(0, 24) || "und";
}

// Presentation-only settings (font, colors, spacing, direction) are deliberately
// absent: changing them must reuse cached translations instead of retranslating.
export function buildTranslationCacheKey(input: TranslationCacheKeyInput): string {
  return `${CACHE_PREFIX}${fnv1aHash(input.engineTag)}.${safeItemKey(
    input.itemKey,
  )}.${input.sourceText.length}.${fnv1aHash(
    input.sourceText,
  )}.${safeLanguage(input.targetLanguage)}`;
}

export function buildLegacyTranslationCacheKey(input: TranslationCacheKeyInput): string {
  return `${LEGACY_CACHE_PREFIX}${fnv1aHash(input.engineTag)}.${input.itemKey}.${fnv1aHash(
    input.sourceText,
  )}.${safeLanguage(input.targetLanguage)}`;
}
