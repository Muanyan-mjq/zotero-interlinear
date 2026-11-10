// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — appearance settings and translation-block stylesheet builder.

export type AppearanceTheme = "auto" | "light" | "dark";
export type FontGeneric = "" | "sans-serif" | "serif" | "monospace";
export type FontStyle = "normal" | "italic";
export type FontSizeMode = "px" | "em";
export type TextDirection = "auto" | "ltr" | "rtl";

export interface FontStack {
  primary: string;
  fallbacks: string[];
  generic: FontGeneric;
}

export interface AppearanceSettings {
  fontSize: number;
  color: string;
  fontFamily: string;
  /** Structured font stack; `fontFamily` is the sanitized CSS string derived from it. */
  fontStack: FontStack;
  fontWeight: number;
  fontStyle: FontStyle;
  letterSpacing: number;
  fontSizeMode: FontSizeMode;
  fontSizeEm: number;
  autoFontByLanguage: boolean;
  textDirection: TextDirection;
  lineHeight: number;
  paragraphSpacing: number;
  background: string;
  theme: AppearanceTheme;
  underline: boolean;
  underlineColor: string;
  ribbon: boolean;
  ribbonColor: string;
}

export const FONT_SIZE_MIN = 10;
export const FONT_SIZE_MAX = 32;
export const LINE_HEIGHT_MIN = 1;
export const LINE_HEIGHT_MAX = 2.5;
export const PARAGRAPH_SPACING_MIN = 0;
export const PARAGRAPH_SPACING_MAX = 3;
export const DEFAULT_RIBBON_COLOR = "#2f6fdf";
export const FONT_WEIGHT_MIN = 100;
export const FONT_WEIGHT_MAX = 900;
export const LETTER_SPACING_MIN = -0.05;
export const LETTER_SPACING_MAX = 0.3;
export const FONT_SIZE_EM_MIN = 0.9;
export const FONT_SIZE_EM_MAX = 1.2;
export const FONT_STACK_MAX_FALLBACKS = 6;

export const DEFAULT_FONT_STACK: FontStack = {
  primary: "",
  fallbacks: [],
  generic: "",
};

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  fontSize: 16,
  // Empty means "inherit", so the reader follows Zotero's light/dark theme.
  color: "",
  fontFamily: "",
  fontStack: { ...DEFAULT_FONT_STACK, fallbacks: [] },
  fontWeight: 400,
  fontStyle: "normal",
  letterSpacing: 0,
  fontSizeMode: "px",
  fontSizeEm: 1,
  autoFontByLanguage: true,
  textDirection: "auto",
  lineHeight: 1.75,
  paragraphSpacing: 1.25,
  background: "",
  theme: "auto",
  underline: false,
  underlineColor: "",
  ribbon: true,
  ribbonColor: DEFAULT_RIBBON_COLOR,
};

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/iu;
const RGB_COLOR =
  /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\)$/iu;
const NAMED_COLOR = /^[a-z]+$/iu;
// Family names may contain spaces, Unicode letters (CJK font names) and generic
// keywords. Reject every character that could end a declaration or open a rule.
const FONT_NAME = /^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u;
const FONT_GENERIC_FAMILIES = new Set(["sans-serif", "serif", "monospace"]);
const FONT_ALL_GENERIC_TOKENS = new Set([
  ...FONT_GENERIC_FAMILIES,
  "cursive",
  "fantasy",
  "system-ui",
  "ui-sans-serif",
  "ui-serif",
  "ui-monospace",
]);
const FONT_NAME_MAX_LENGTH = 80;

/** Accept only tokens that cannot terminate a declaration or open a rule. */
export function isValidColor(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return HEX_COLOR.test(trimmed) || RGB_COLOR.test(trimmed) || NAMED_COLOR.test(trimmed);
}

function normalizeOptionalColor(raw: unknown): string {
  const value = typeof raw === "string" ? raw.trim() : "";
  return isValidColor(value) ? value : "";
}

export const CONTRAST_AA_MIN = 4.5;

const HEX_INPUT = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/iu;

/** Normalize a typed #RGB / #RRGGBB token to uppercase #RRGGBB, or null if invalid. */
export function normalizeHexInput(raw: string): string | null {
  const match = raw.trim().match(HEX_INPUT);
  if (!match) return null;
  const hex = match[1];
  const expanded =
    hex.length === 3 ? hex.split("").map((part) => part + part).join("") : hex;
  return `#${expanded.toUpperCase()}`;
}

export function hexToRgb(value: string): { r: number; g: number; b: number } | null {
  const hex = normalizeHexInput(value);
  if (!hex) return null;
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function channelLuminance(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(rgb: { r: number; g: number; b: number }): number {
  return (
    0.2126 * channelLuminance(rgb.r) +
    0.7152 * channelLuminance(rgb.g) +
    0.0722 * channelLuminance(rgb.b)
  );
}

/** WCAG contrast ratio of two hex colors (2 decimals), or null if either is not hex. */
export function contrastRatio(foreground: string, background: string): number | null {
  const fg = hexToRgb(foreground);
  const bg = hexToRgb(background);
  if (!fg || !bg) return null;
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
}

export function meetsContrastAA(ratio: number): boolean {
  return ratio >= CONTRAST_AA_MIN;
}

const THEME_PALETTE: Record<AppearanceTheme, { color: string; background: string }> = {
  dark: { color: "#e8e8e8", background: "#2b2b2b" },
  light: { color: "#222", background: "#f6f6f6" },
  auto: { color: "", background: "" },
};

/** Effective reader color for previews: explicit wins, inherit resolves to the theme palette. */
export function resolveEffectiveColor(
  stored: string,
  theme: AppearanceTheme,
  role: "color" | "background",
): string {
  const trimmed = stored.trim();
  if (trimmed) return trimmed;
  return THEME_PALETTE[theme][role];
}

/** A single family name that cannot escape a CSS declaration. */
export function isValidFontName(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > FONT_NAME_MAX_LENGTH) return false;
  if (/url\s*\(|expression|\p{Cc}/iu.test(trimmed)) return false;
  return FONT_NAME.test(trimmed);
}

function normalizeFontName(value: unknown): string {
  return typeof value === "string" && isValidFontName(value) ? value.trim() : "";
}

function normalizeGeneric(value: unknown): FontGeneric {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return FONT_GENERIC_FAMILIES.has(normalized) ? (normalized as FontGeneric) : "";
}

/** Parse a CSS font-family string into a structured stack, dropping unsafe tokens. */
export function parseFontStack(value: unknown): FontStack {
  if (typeof value !== "string") return { ...DEFAULT_FONT_STACK, fallbacks: [] };
  const tokens = value
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
  let generic: FontGeneric = "";
  if (tokens.length && FONT_GENERIC_FAMILIES.has(tokens[tokens.length - 1].toLowerCase())) {
    generic = tokens.pop()!.toLowerCase() as FontGeneric;
  }
  const names: string[] = [];
  for (const token of tokens) {
    const name = normalizeFontName(token);
    if (name) names.push(name);
    if (names.length >= FONT_STACK_MAX_FALLBACKS + 1) break;
  }
  return {
    primary: names[0] || "",
    fallbacks: names.slice(1),
    generic,
  };
}

/** Build a safe CSS font-family value from a structured stack. */
export function buildFontStack(input?: Partial<FontStack> | null): string {
  const stack = normalizeFontStack(input);
  const names: string[] = [];
  if (stack.primary) names.push(stack.primary);
  for (const fallback of stack.fallbacks) {
    if (fallback) names.push(fallback);
  }
  if (stack.generic) names.push(stack.generic);
  return names.join(", ");
}

export function normalizeFontStack(input?: Partial<FontStack> | null): FontStack {
  const primary = normalizeFontName(input?.primary);
  const seen = new Set(primary ? [primary.toLowerCase()] : []);
  const fallbacks: string[] = [];
  const rawFallbacks = Array.isArray(input?.fallbacks) ? input.fallbacks : [];
  for (const raw of rawFallbacks) {
    const name = normalizeFontName(raw);
    const key = name.toLowerCase();
    if (!name || seen.has(key) || fallbacks.length >= FONT_STACK_MAX_FALLBACKS) continue;
    seen.add(key);
    fallbacks.push(name);
  }
  return { primary, fallbacks, generic: normalizeGeneric(input?.generic) };
}

/**
 * Validate an advanced font-family string. Returns the normalized CSS string,
 * or null when any token is unsafe or empty.
 */
export function normalizeFontFamilyInput(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const tokens = trimmed.split(",").map((token) => token.trim());
  if (tokens.some((token) => !token)) return null;
  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (FONT_ALL_GENERIC_TOKENS.has(lower)) continue;
    if (!isValidFontName(token)) return null;
  }
  const stack = parseFontStack(trimmed);
  const built = buildFontStack(stack);
  return built || null;
}

function normalizeFontFamily(raw: unknown): string {
  return normalizeFontFamilyInput(raw) ?? "";
}

/** Empty (inherit) or a stack of tokens that cannot break out of a CSS declaration. */
export function isValidFontFamily(value: string): boolean {
  return normalizeFontFamilyInput(value) !== null;
}

/** Language-specific fallback stacks used when the user has no explicit font. */
export const AUTO_FONT_STACKS: Readonly<Record<string, FontStack>> = {
  // Chinese intentionally inherits the reader font: the reader already picks a
  // sane CJK stack, and this keeps the existing default appearance unchanged.
  "zh-CN": { primary: "", fallbacks: [], generic: "" },
  "zh-TW": { primary: "", fallbacks: [], generic: "" },
  ja: {
    primary: "Hiragino Sans",
    fallbacks: ["Yu Gothic", "Noto Sans CJK JP", "Meiryo"],
    generic: "sans-serif",
  },
  ko: {
    primary: "Apple SD Gothic Neo",
    fallbacks: ["Malgun Gothic", "Noto Sans CJK KR"],
    generic: "sans-serif",
  },
  ar: {
    primary: "Geeza Pro",
    fallbacks: ["Noto Naskh Arabic", "Amiri", "Arial"],
    generic: "serif",
  },
  he: {
    primary: "Arial Hebrew",
    fallbacks: ["Noto Sans Hebrew", "David"],
    generic: "sans-serif",
  },
  fa: {
    primary: "Geeza Pro",
    fallbacks: ["Noto Naskh Arabic", "Amiri", "Tahoma"],
    generic: "serif",
  },
  ur: {
    primary: "Noto Nastaliq Urdu",
    fallbacks: ["Noto Naskh Arabic", "Arial"],
    generic: "serif",
  },
  th: {
    primary: "Thonburi",
    fallbacks: ["Noto Sans Thai", "Ayuthaya"],
    generic: "sans-serif",
  },
  hi: {
    primary: "Kohinoor Devanagari",
    fallbacks: ["Noto Sans Devanagari", "Mangal"],
    generic: "sans-serif",
  },
};

const RTL_LANGUAGES = new Set([
  "ar",
  "arc",
  "ckb",
  "dv",
  "fa",
  "he",
  "ku",
  "ps",
  "sd",
  "ug",
  "ur",
  "yi",
]);

function normalizeLanguageCode(language: string | undefined): string {
  return (language || "").trim().replace(/_/gu, "-").toLowerCase();
}

/** Auto stack for a target language; returns an empty stack when it should inherit. */
export function resolveAutoFontStack(language?: string): FontStack {
  const code = normalizeLanguageCode(language);
  if (!code || code === "auto") return { ...DEFAULT_FONT_STACK, fallbacks: [] };
  const exact = AUTO_FONT_STACKS[code];
  if (exact) return { ...exact, fallbacks: [...exact.fallbacks] };
  const base = code.split("-")[0];
  const baseStack = AUTO_FONT_STACKS[base];
  return baseStack
    ? { ...baseStack, fallbacks: [...baseStack.fallbacks] }
    : { ...DEFAULT_FONT_STACK, fallbacks: [] };
}

export function isRtlLanguage(language?: string): boolean {
  const code = normalizeLanguageCode(language);
  return RTL_LANGUAGES.has(code) || RTL_LANGUAGES.has(code.split("-")[0]);
}

export function resolveTextDirection(
  mode: TextDirection | undefined,
  language?: string,
): "ltr" | "rtl" {
  if (mode === "ltr" || mode === "rtl") return mode;
  return isRtlLanguage(language) ? "rtl" : "ltr";
}

function normalizeFontWeight(raw: unknown): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) return DEFAULT_APPEARANCE.fontWeight;
  return Math.min(FONT_WEIGHT_MAX, Math.max(FONT_WEIGHT_MIN, Math.round(value / 100) * 100));
}

function normalizeLetterSpacing(raw: unknown): number {
  return clampNumber(
    raw,
    DEFAULT_APPEARANCE.letterSpacing,
    LETTER_SPACING_MIN,
    LETTER_SPACING_MAX,
  );
}

function normalizeFontSizeMode(raw: unknown): FontSizeMode {
  return raw === "em" ? "em" : "px";
}

function normalizeFontSizeEm(raw: unknown): number {
  return clampNumber(raw, DEFAULT_APPEARANCE.fontSizeEm, FONT_SIZE_EM_MIN, FONT_SIZE_EM_MAX);
}

function normalizeTextDirection(raw: unknown): TextDirection {
  return raw === "ltr" || raw === "rtl" ? raw : "auto";
}

export const FONT_CUSTOM_VALUE = "custom";

// Firefox 115 has no reliable local-font enumeration API, so the selector offers
// curated cross-platform stacks (each ending in a generic family) plus custom.
export const FONT_STACK_PRESETS: readonly string[] = [
  "",
  "Arial, Helvetica, PingFang SC, Microsoft YaHei, sans-serif",
  "Georgia, serif",
  "Consolas, Menlo, Courier New, monospace",
];

function fontFamilyKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/gu, "");
}

/** Select-option value for a stored stack: matching preset, inherit (""), or custom. */
export function resolveFontSelection(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const key = fontFamilyKey(trimmed);
  const match = FONT_STACK_PRESETS.find((preset) => fontFamilyKey(preset) === key);
  return match !== undefined ? match : FONT_CUSTOM_VALUE;
}

function clampNumber(raw: unknown, fallback: number, min: number, max: number): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.round(Math.min(max, Math.max(min, value)) * 100) / 100;
}

function normalizeTheme(raw: unknown): AppearanceTheme {
  return raw === "light" || raw === "dark" ? raw : "auto";
}

export function normalizeAppearance(
  input?: Partial<AppearanceSettings> | null,
): AppearanceSettings {
  const rawSize = Number(input?.fontSize);
  const fontSize = Number.isFinite(rawSize)
    ? Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round(rawSize)))
    : DEFAULT_APPEARANCE.fontSize;
  const rawColor = typeof input?.color === "string" ? input.color.trim() : "";
  const rawRibbon = typeof input?.ribbonColor === "string" ? input.ribbonColor.trim() : "";
  let fontStack = normalizeFontStack(input?.fontStack);
  const stackIsEmpty =
    !fontStack.primary && fontStack.fallbacks.length === 0 && !fontStack.generic;
  if (stackIsEmpty && input?.fontFamily) {
    fontStack = parseFontStack(input.fontFamily);
  }
  const fontFamily = buildFontStack(fontStack) || normalizeFontFamily(input?.fontFamily);
  return {
    fontSize,
    color: isValidColor(rawColor) ? rawColor : DEFAULT_APPEARANCE.color,
    fontFamily,
    fontStack,
    fontWeight: normalizeFontWeight(input?.fontWeight),
    fontStyle: input?.fontStyle === "italic" ? "italic" : "normal",
    letterSpacing: normalizeLetterSpacing(input?.letterSpacing),
    fontSizeMode: normalizeFontSizeMode(input?.fontSizeMode),
    fontSizeEm: normalizeFontSizeEm(input?.fontSizeEm),
    autoFontByLanguage:
      typeof input?.autoFontByLanguage === "boolean"
        ? input.autoFontByLanguage
        : DEFAULT_APPEARANCE.autoFontByLanguage,
    textDirection: normalizeTextDirection(input?.textDirection),
    lineHeight: clampNumber(
      input?.lineHeight,
      DEFAULT_APPEARANCE.lineHeight,
      LINE_HEIGHT_MIN,
      LINE_HEIGHT_MAX,
    ),
    paragraphSpacing: clampNumber(
      input?.paragraphSpacing,
      DEFAULT_APPEARANCE.paragraphSpacing,
      PARAGRAPH_SPACING_MIN,
      PARAGRAPH_SPACING_MAX,
    ),
    background: normalizeOptionalColor(input?.background),
    theme: normalizeTheme(input?.theme),
    underline: typeof input?.underline === "boolean" ? input.underline : false,
    underlineColor: normalizeOptionalColor(input?.underlineColor),
    ribbon: typeof input?.ribbon === "boolean" ? input.ribbon : DEFAULT_APPEARANCE.ribbon,
    ribbonColor:
      isValidColor(rawRibbon) && rawRibbon ? rawRibbon : DEFAULT_APPEARANCE.ribbonColor,
  };
}

function points(px: number): number {
  return Number((px * 0.75).toFixed(2));
}

function readerColors(settings: AppearanceSettings): { color: string; background: string } {
  return {
    color: resolveEffectiveColor(settings.color, settings.theme, "color"),
    background: resolveEffectiveColor(settings.background, settings.theme, "background"),
  };
}

/**
 * Single source of the translation-block stylesheet for both the live reader
 * and the printable export. User-supplied values are normalized first so a
 * malformed color or font size can never inject extra CSS.
 */
export function buildTranslationCSS(
  className: string,
  input: Partial<AppearanceSettings> | null | undefined,
  mode: "reader" | "print",
  context: { targetLanguage?: string } = {},
): string {
  const settings = normalizeAppearance(input);
  const underline = settings.underline
    ? `  text-decoration: underline${mode === "print" ? " !important" : ""};\n${
        settings.underlineColor
          ? `  text-decoration-color: ${settings.underlineColor}${
              mode === "print" ? " !important" : ""
            };\n`
          : ""
      }`
    : "";
  const explicitFont = buildFontStack(settings.fontStack);
  const autoFont = settings.autoFontByLanguage
    ? buildFontStack(resolveAutoFontStack(context.targetLanguage))
    : "";
  const fontFamily = explicitFont || autoFont || settings.fontFamily;
  const fontFamilyRule = fontFamily ? `  font-family: ${fontFamily};\n` : "";
  const fontWeightRule =
    settings.fontWeight !== DEFAULT_APPEARANCE.fontWeight
      ? `  font-weight: ${settings.fontWeight};\n`
      : "";
  const fontStyleRule = settings.fontStyle === "italic" ? "  font-style: italic;\n" : "";
  const letterSpacingRule =
    settings.letterSpacing !== 0 ? `  letter-spacing: ${settings.letterSpacing}em;\n` : "";
  const direction = resolveTextDirection(settings.textDirection, context.targetLanguage);
  const directionRule =
    direction === "rtl"
      ? "  direction: rtl;\n  text-align: start;\n"
      : settings.textDirection === "ltr"
        ? "  direction: ltr;\n"
        : "";
  const readerFontSize =
    settings.fontSizeMode === "em"
      ? `${settings.fontSizeEm}em`
      : `${settings.fontSize}px`;
  const printFontSizePx =
    settings.fontSizeMode === "em"
      ? settings.fontSize * settings.fontSizeEm
      : settings.fontSize;

  if (mode === "print") {
    // The export is meant for paper: a dark reader theme must not bleed into it.
    return `.${className} {
  margin: 0.18em 0 ${settings.paragraphSpacing}em !important;
  padding: 0.12em 0 0.12em 0.78em !important;
  border-left: ${settings.ribbon ? `2.2pt solid ${settings.ribbonColor}` : "none"} !important;
  color: ${settings.color || "#222"} !important;
  background: transparent !important;
${fontFamilyRule}${fontWeightRule}${fontStyleRule}${letterSpacingRule}${directionRule}  font-size: ${points(printFontSizePx)}pt !important;
  line-height: ${settings.lineHeight} !important;
${underline}  break-inside: avoid-page;
  page-break-inside: avoid;
}`;
  }

  const { color, background } = readerColors(settings);
  return `.${className} {
  box-sizing: border-box;
  border-left: ${settings.ribbon ? `4px solid ${settings.ribbonColor}` : "none"};
  margin: 0.65em 0 ${settings.paragraphSpacing}em;
  padding: 0.45em 0.95em;
${fontFamilyRule}${fontWeightRule}${fontStyleRule}${letterSpacingRule}${directionRule}  line-height: ${settings.lineHeight};
  font-size: ${readerFontSize};
${color ? `  color: ${color};\n` : ""}${background ? `  background: ${background};\n` : ""}${underline}  white-space: pre-wrap;
  overflow-wrap: anywhere;
}`;
}
