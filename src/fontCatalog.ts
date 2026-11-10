// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — local font candidates, detection and filtering helpers.

export type FontGroup = "sans" | "serif" | "mono" | "zh" | "ja-ko" | "other";
export type FontScript = "latin" | "zh" | "ja" | "ko" | "ar" | "he" | "th" | "hi";

export interface FontCandidate {
  family: string;
  group: FontGroup;
  script: FontScript;
}

export interface FontSection {
  group: FontGroup | "favorites";
  fonts: FontCandidate[];
}

export const FONT_GROUP_ORDER: readonly FontGroup[] = [
  "sans",
  "serif",
  "mono",
  "zh",
  "ja-ko",
  "other",
];

export const FONT_SCRIPTS: readonly FontScript[] = [
  "latin",
  "zh",
  "ja",
  "ko",
  "ar",
  "he",
  "th",
  "hi",
];

export const FONT_SAMPLE_TEXT: Readonly<Record<FontScript, string>> = {
  latin: "Handgloves 0123",
  zh: "字体样张 永和九年",
  ja: "日本語の見本 いろは",
  ko: "한글 글꼴 견본",
  ar: "نموذج الخط العربي",
  he: "דוגמת גופן עברית",
  th: "ตัวอย่างแบบอักษรไทย",
  hi: "देवनागरी फ़ॉन्ट नमूना",
};

/** Generic families used as metric baselines when probing installed fonts. */
export const GENERIC_BASELINES: readonly string[] = ["monospace", "serif", "sans-serif"];

/** Minimum width difference (CSS px) before a probe counts as installed. */
export const FONT_DETECTION_MIN_DIFF_PX = 0.5;

export const FONT_FAVORITES_MAX = 24;
export const FONT_DETECTION_CACHE_VERSION = 1;
export const FONT_DETECTION_CACHE_MAX_FONTS = 512;
export const FONT_DETECTION_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Kept in sync with appearance.ts. This module is loaded directly by the Node
// unit tests, which cannot resolve extensionless TypeScript imports.
const SAFE_FONT_NAME = /^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u;
const SAFE_FONT_NAME_MAX_LENGTH = 80;

function isValidFontName(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > SAFE_FONT_NAME_MAX_LENGTH) return false;
  if (/url\s*\(|expression|\p{Cc}/iu.test(trimmed)) return false;
  return SAFE_FONT_NAME.test(trimmed);
}

type CandidateSeed = [family: string, group: FontGroup, script?: FontScript];

const CANDIDATE_SEEDS: readonly CandidateSeed[] = [
  // Cross-platform sans-serif.
  ["Arial", "sans"],
  ["Arial Black", "sans"],
  ["Arial Narrow", "sans"],
  ["Avenir", "sans"],
  ["Avenir Next", "sans"],
  ["Bahnschrift", "sans"],
  ["Calibri", "sans"],
  ["Candara", "sans"],
  ["Cantarell", "sans"],
  ["Corbel", "sans"],
  ["DejaVu Sans", "sans"],
  ["Droid Sans", "sans"],
  ["Ebrima", "sans"],
  ["Fira Sans", "sans"],
  ["Franklin Gothic Medium", "sans"],
  ["FreeSans", "sans"],
  ["Futura", "sans"],
  ["Geneva", "sans"],
  ["Gill Sans", "sans"],
  ["Gotham", "sans"],
  ["Helvetica", "sans"],
  ["Helvetica Neue", "sans"],
  ["IBM Plex Sans", "sans"],
  ["Inter", "sans"],
  ["Lato", "sans"],
  ["Liberation Sans", "sans"],
  ["Lucida Grande", "sans"],
  ["Lucida Sans Unicode", "sans"],
  ["Microsoft Sans Serif", "sans"],
  ["Montserrat", "sans"],
  ["Noto Sans", "sans"],
  ["Open Sans", "sans"],
  ["Optima", "sans"],
  ["PT Sans", "sans"],
  ["Raleway", "sans"],
  ["Roboto", "sans"],
  ["Segoe UI", "sans"],
  ["Segoe UI Variable", "sans"],
  ["Seravek", "sans"],
  ["SF Pro", "sans"],
  ["SF Pro Display", "sans"],
  ["SF Pro Text", "sans"],
  ["Source Sans Pro", "sans"],
  ["Tahoma", "sans"],
  ["Trebuchet MS", "sans"],
  ["Ubuntu", "sans"],
  ["Verdana", "sans"],
  // Serif.
  ["Athelas", "serif"],
  ["Baskerville", "serif"],
  ["Bitter", "serif"],
  ["Bodoni 72", "serif"],
  ["Cambria", "serif"],
  ["Charter", "serif"],
  ["Constantia", "serif"],
  ["Crimson Text", "serif"],
  ["DejaVu Serif", "serif"],
  ["Didot", "serif"],
  ["Droid Serif", "serif"],
  ["FreeSerif", "serif"],
  ["Georgia", "serif"],
  ["Hoefler Text", "serif"],
  ["Iowan Old Style", "serif"],
  ["Liberation Serif", "serif"],
  ["Lora", "serif"],
  ["Merriweather", "serif"],
  ["Noto Serif", "serif"],
  ["Palatino", "serif"],
  ["Palatino Linotype", "serif"],
  ["PT Serif", "serif"],
  ["Rockwell", "serif"],
  ["Sitka", "serif"],
  ["Skia", "serif"],
  ["Source Serif Pro", "serif"],
  ["Superclarendon", "serif"],
  ["Times", "serif"],
  ["Times New Roman", "serif"],
  ["Trattatello", "serif"],
  // Monospace.
  ["Andale Mono", "mono"],
  ["Cascadia Code", "mono"],
  ["Cascadia Mono", "mono"],
  ["Consolas", "mono"],
  ["Courier", "mono"],
  ["Courier New", "mono"],
  ["DejaVu Sans Mono", "mono"],
  ["Droid Sans Mono", "mono"],
  ["Fira Code", "mono"],
  ["Fira Mono", "mono"],
  ["IBM Plex Mono", "mono"],
  ["JetBrains Mono", "mono"],
  ["Liberation Mono", "mono"],
  ["Lucida Console", "mono"],
  ["Menlo", "mono"],
  ["Monaco", "mono"],
  ["Noto Sans Mono", "mono"],
  ["PT Mono", "mono"],
  ["Roboto Mono", "mono"],
  ["SF Mono", "mono"],
  ["Source Code Pro", "mono"],
  ["Ubuntu Mono", "mono"],
  // Chinese.
  ["AR PL UKai CN", "zh", "zh"],
  ["AR PL UMing CN", "zh", "zh"],
  ["Baoli SC", "zh", "zh"],
  ["BiauKai", "zh", "zh"],
  ["DengXian", "zh", "zh"],
  ["FandolHei", "zh", "zh"],
  ["FandolSong", "zh", "zh"],
  ["FangSong", "zh", "zh"],
  ["Hannotate SC", "zh", "zh"],
  ["HanziPen SC", "zh", "zh"],
  ["Heiti SC", "zh", "zh"],
  ["Hiragino Sans GB", "zh", "zh"],
  ["KaiTi", "zh", "zh"],
  ["Kaiti SC", "zh", "zh"],
  ["Lantinghei SC", "zh", "zh"],
  ["Libian SC", "zh", "zh"],
  ["LiSong Pro", "zh", "zh"],
  ["Microsoft JhengHei", "zh", "zh"],
  ["Microsoft YaHei", "zh", "zh"],
  ["MingLiU", "zh", "zh"],
  ["MingLiU-ExtB", "zh", "zh"],
  ["Noto Sans CJK SC", "zh", "zh"],
  ["Noto Sans CJK TC", "zh", "zh"],
  ["Noto Serif CJK SC", "zh", "zh"],
  ["NSimSun", "zh", "zh"],
  ["PingFang HK", "zh", "zh"],
  ["PingFang SC", "zh", "zh"],
  ["PingFang TC", "zh", "zh"],
  ["PMingLiU", "zh", "zh"],
  ["SimHei", "zh", "zh"],
  ["SimSun", "zh", "zh"],
  ["SimSun-ExtB", "zh", "zh"],
  ["Songti SC", "zh", "zh"],
  ["Songti TC", "zh", "zh"],
  ["Source Han Sans SC", "zh", "zh"],
  ["Source Han Serif SC", "zh", "zh"],
  ["STHeiti", "zh", "zh"],
  ["STKaiti", "zh", "zh"],
  ["STSong", "zh", "zh"],
  ["Wawati SC", "zh", "zh"],
  ["Weibei SC", "zh", "zh"],
  ["WenQuanYi Micro Hei", "zh", "zh"],
  ["WenQuanYi Zen Hei", "zh", "zh"],
  ["Xingkai SC", "zh", "zh"],
  ["Yuanti SC", "zh", "zh"],
  ["Yuppy SC", "zh", "zh"],
  // Japanese and Korean.
  ["Apple SD Gothic Neo", "ja-ko", "ko"],
  ["AppleGothic", "ja-ko", "ko"],
  ["AppleMyungjo", "ja-ko", "ko"],
  ["Batang", "ja-ko", "ko"],
  ["BIZ UDGothic", "ja-ko", "ja"],
  ["BIZ UDMincho", "ja-ko", "ja"],
  ["Dotum", "ja-ko", "ko"],
  ["Gulim", "ja-ko", "ko"],
  ["Gungsuh", "ja-ko", "ko"],
  ["Hiragino Kaku Gothic ProN", "ja-ko", "ja"],
  ["Hiragino Mincho ProN", "ja-ko", "ja"],
  ["Kosugi Maru", "ja-ko", "ja"],
  ["M PLUS 1p", "ja-ko", "ja"],
  ["Malgun Gothic", "ja-ko", "ko"],
  ["Meiryo", "ja-ko", "ja"],
  ["MS Gothic", "ja-ko", "ja"],
  ["MS Mincho", "ja-ko", "ja"],
  ["MS PGothic", "ja-ko", "ja"],
  ["MS UI Gothic", "ja-ko", "ja"],
  ["Nanum Gothic", "ja-ko", "ko"],
  ["Nanum Myeongjo", "ja-ko", "ko"],
  ["Noto Sans CJK JP", "ja-ko", "ja"],
  ["Noto Sans CJK KR", "ja-ko", "ko"],
  ["Noto Sans JP", "ja-ko", "ja"],
  ["Noto Sans KR", "ja-ko", "ko"],
  ["Noto Serif CJK JP", "ja-ko", "ja"],
  ["Noto Serif CJK KR", "ja-ko", "ko"],
  ["Noto Serif JP", "ja-ko", "ja"],
  ["Noto Serif KR", "ja-ko", "ko"],
  ["Sawarabi Mincho", "ja-ko", "ja"],
  ["Yu Gothic", "ja-ko", "ja"],
  ["Yu Mincho", "ja-ko", "ja"],
  // Arabic, Hebrew, Thai, Devanagari, symbols and fallbacks.
  ["Al Nile", "other", "ar"],
  ["Almarai", "other", "ar"],
  ["Amiri", "other", "ar"],
  ["Arial Hebrew", "other", "he"],
  ["Arial Unicode MS", "other"],
  ["Ayuthaya", "other", "th"],
  ["Baghdad", "other", "ar"],
  ["Cairo", "other", "ar"],
  ["Damascus", "other", "ar"],
  ["David", "other", "he"],
  ["Diwan Kufi", "other", "ar"],
  ["Farisi", "other", "ar"],
  ["FrankRuehl", "other", "he"],
  ["Garuda", "other", "th"],
  ["Geeza Pro", "other", "ar"],
  ["Gulzar", "other", "ar"],
  ["Jameel Noori Nastaleeq", "other", "ar"],
  ["Kinnari", "other", "th"],
  ["Kohinoor Devanagari", "other", "hi"],
  ["KufiStandardGK", "other", "ar"],
  ["Lohit Devanagari", "other", "hi"],
  ["Loma", "other", "th"],
  ["Mangal", "other", "hi"],
  ["Marlett", "other"],
  ["Miriam", "other", "he"],
  ["Mishafi", "other", "ar"],
  ["Myanmar Text", "other"],
  ["Nadeem", "other", "ar"],
  ["Narkisim", "other", "he"],
  ["Norasi", "other", "th"],
  ["Noto Color Emoji", "other"],
  ["Noto Kufi Arabic", "other", "ar"],
  ["Noto Naskh Arabic", "other", "ar"],
  ["Noto Nastaliq Urdu", "other", "ar"],
  ["Noto Rashi Hebrew", "other", "he"],
  ["Noto Sans Arabic", "other", "ar"],
  ["Noto Sans Devanagari", "other", "hi"],
  ["Noto Sans Hebrew", "other", "he"],
  ["Noto Sans Thai", "other", "th"],
  ["Padauk", "other"],
  ["Sathu", "other", "th"],
  ["Scheherazade New", "other", "ar"],
  ["Segoe UI Emoji", "other"],
  ["Segoe UI Historic", "other"],
  ["Segoe UI Symbol", "other"],
  ["Silom", "other", "th"],
  ["Symbol", "other"],
  ["Symbola", "other"],
  ["Tajawal", "other", "ar"],
  ["Thonburi", "other", "th"],
  ["TLwgMono", "other", "th"],
  ["Umpush", "other", "th"],
  ["Waree", "other", "th"],
  ["Webdings", "other"],
  ["Wingdings", "other"],
];

export const FONT_CANDIDATES: readonly FontCandidate[] = CANDIDATE_SEEDS.map(
  ([family, group, script]) => ({
    family,
    group,
    script: script || "latin",
  }),
);

export function quoteFontName(family: string): string {
  return `"${family.replace(/\\/gu, "\\\\").replace(/"/gu, '\\"')}"`;
}

export type FontMeasure = (fontFamily: string, text: string) => number;

function baselineWidths(script: FontScript, measure: FontMeasure): number[] {
  const text = FONT_SAMPLE_TEXT[script];
  return GENERIC_BASELINES.map((generic) => measure(generic, text));
}

function isBaselineEqual(width: number, baselines: readonly number[]): boolean {
  return baselines.some(
    (baseline) => Math.abs(width - baseline) <= FONT_DETECTION_MIN_DIFF_PX,
  );
}

/** A candidate counts as installed when its metrics differ from every generic. */
export function isFontDetected(
  candidate: Pick<FontCandidate, "family" | "script">,
  measure: FontMeasure,
  baselines?: readonly number[],
): boolean {
  const text = FONT_SAMPLE_TEXT[candidate.script];
  const base = baselines || baselineWidths(candidate.script, measure);
  try {
    const width = measure(`${quoteFontName(candidate.family)}, monospace`, text);
    return Number.isFinite(width) && !isBaselineEqual(width, base);
  } catch (_) {
    return false;
  }
}

export function detectAvailableFonts(
  candidates: readonly FontCandidate[],
  measure: FontMeasure,
): string[] {
  const baselines = new Map<FontScript, number[]>();
  const detected: string[] = [];
  for (const candidate of candidates) {
    let base = baselines.get(candidate.script);
    if (!base) {
      base = baselineWidths(candidate.script, measure);
      baselines.set(candidate.script, base);
    }
    if (isFontDetected(candidate, measure, base)) detected.push(candidate.family);
  }
  return detected;
}

function toLowerCaseSet(
  values: ReadonlySet<string> | readonly string[] | null | undefined,
): Set<string> | null {
  if (!values) return null;
  return new Set(Array.from(values, (value) => value.toLowerCase()));
}

export interface FontFilterOptions {
  query?: string;
  detected?: ReadonlySet<string> | readonly string[] | null;
  showAll?: boolean;
  favorites?: readonly string[];
}

export function filterFontCandidates(
  options: FontFilterOptions = {},
): FontCandidate[] {
  const query = (options.query || "").trim().toLowerCase();
  const detected = toLowerCaseSet(options.detected);
  const favorites = toLowerCaseSet(options.favorites) || new Set<string>();
  return FONT_CANDIDATES.filter((candidate) => {
    if (!options.showAll && detected) {
      const key = candidate.family.toLowerCase();
      if (!detected.has(key) && !favorites.has(key)) return false;
    }
    if (!query) return true;
    return candidate.family.toLowerCase().includes(query);
  });
}

/** Favorites first, then fixed groups with favorite entries removed. */
export function buildFontSections(
  candidates: readonly FontCandidate[],
  favorites: readonly string[] = [],
): FontSection[] {
  const favoriteNames = normalizeFontFavorites(favorites);
  const favoriteKeys = new Set(favoriteNames.map((name) => name.toLowerCase()));
  const byFamily = new Map(
    candidates.map((candidate) => [candidate.family.toLowerCase(), candidate]),
  );
  const favoriteFonts: FontCandidate[] = [];
  for (const name of favoriteNames) {
    const candidate = byFamily.get(name.toLowerCase());
    if (candidate) favoriteFonts.push(candidate);
  }
  const sections: FontSection[] = [];
  if (favoriteFonts.length) {
    sections.push({ group: "favorites", fonts: favoriteFonts });
  }
  for (const group of FONT_GROUP_ORDER) {
    const fonts = candidates.filter(
      (candidate) =>
        candidate.group === group && !favoriteKeys.has(candidate.family.toLowerCase()),
    );
    if (fonts.length) sections.push({ group, fonts });
  }
  return sections;
}

export function normalizeFontFavorites(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of raw) {
    if (typeof value !== "string") continue;
    const name = value.trim();
    const key = name.toLowerCase();
    if (!isValidFontName(name) || seen.has(key)) continue;
    seen.add(key);
    result.push(name);
    if (result.length >= FONT_FAVORITES_MAX) break;
  }
  return result;
}

interface FontDetectionCacheShape {
  version?: unknown;
  at?: unknown;
  fonts?: unknown;
}

/**
 * Return the cached font list when the cache is fresh and well-formed,
 * otherwise null so the caller re-scans.
 */
export function parseFontDetectionCache(raw: unknown, now = Date.now()): string[] | null {
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const cache = value as FontDetectionCacheShape;
  if (cache.version !== FONT_DETECTION_CACHE_VERSION) return null;
  if (typeof cache.at !== "number" || !Number.isFinite(cache.at)) return null;
  if (cache.at > now || now - cache.at > FONT_DETECTION_CACHE_TTL_MS) return null;
  if (!Array.isArray(cache.fonts)) return null;
  if (cache.fonts.length > FONT_DETECTION_CACHE_MAX_FONTS) return null;
  const seen = new Set<string>();
  const fonts: string[] = [];
  for (const value of cache.fonts) {
    if (typeof value !== "string") continue;
    const name = value.trim();
    const key = name.toLowerCase();
    if (!isValidFontName(name) || seen.has(key)) continue;
    seen.add(key);
    fonts.push(name);
  }
  return fonts;
}
