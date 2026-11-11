// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — appearance settings and translation-block stylesheet builder.

export type AppearanceTheme = "auto" | "light" | "dark";
export type FontGeneric = "" | "sans-serif" | "serif" | "monospace";
export type FontStyle = "normal" | "italic";
export type FontSizeMode = "px" | "em";
export type TextDirection = "auto" | "ltr" | "rtl";
export type ColorMode = "theme" | "single" | "split";
export type ColorScheme = "light" | "dark";
export type ColorRole =
  | "text"
  | "background"
  | "underline"
  | "ribbon"
  | "border"
  | "divider"
  | "source"
  | "loading"
  | "error";
export type TextDecoration = "underline" | "overline" | "line-through";
export type DecorationStyle = "solid" | "double" | "dotted" | "dashed" | "wavy";
export type BorderStyle = "solid" | "dashed" | "dotted" | "double";
export type RibbonPosition = "left" | "right";
export type TextAlign = "start" | "justify" | "center";

export interface ThemeColor {
  mode: ColorMode;
  light: string;
  dark: string;
}

export type ColorSettings = Record<ColorRole, ThemeColor>;

export interface FontStack {
  primary: string;
  fallbacks: string[];
  generic: FontGeneric;
}

export interface AppearanceSettings {
  fontSize: number;
  color: string;
  /** Structured per-theme colors; the flat color fields are derived for compatibility. */
  colors: ColorSettings;
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
  textDecoration: TextDecoration[];
  textDecorationStyle: DecorationStyle;
  /** 0 means auto; 1–8 px otherwise. */
  textDecorationThickness: number;
  /** -1 means auto; 0–12 px otherwise. */
  textUnderlineOffset: number;
  textDecorationSkipInk: "auto" | "none";
  divider: boolean;
  dividerStyle: BorderStyle;
  dividerWidth: number;
  dividerOffset: number;
  ribbonPosition: RibbonPosition;
  ribbonWidth: number;
  ribbonStyle: BorderStyle;
  ribbonRadius: number;
  ribbonPadding: number;
  blockPaddingY: number;
  blockPaddingX: number;
  blockRadius: number;
  blockBorderWidth: number;
  blockBorderStyle: BorderStyle;
  blockIndent: number;
  firstLineIndent: number;
  textAlign: TextAlign;
  /** 0 means no maximum; 40–100 ch otherwise. */
  maxWidthCh: number;
  opacity: number;
  sourceDim: number;
  sourceGap: number;
  uiFollowAppearance: boolean;
  popupMaxWidth: number;
  exportMode: "reader" | "print";
  stateAnimation: boolean;
  reduceMotion: boolean;
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
export const RECENT_COLORS_MAX = 12;
export const SAVED_COLORS_MAX = 24;
export const COLOR_LIST_MAX_LENGTH = 4096;

export const COLOR_ROLES: readonly ColorRole[] = [
  "text",
  "background",
  "underline",
  "ribbon",
  "border",
  "divider",
  "source",
  "loading",
  "error",
];

/** Theme-mode defaults; an empty value means "let the reader inherit". */
export const THEME_ROLE_COLORS: Readonly<
  Record<ColorRole, Readonly<Record<ColorScheme, string>>>
> = {
  text: { light: "", dark: "" },
  background: { light: "", dark: "" },
  underline: { light: "", dark: "" },
  ribbon: { light: "#2f6fdf", dark: "#4f8ff0" },
  border: { light: "#d9d9d9", dark: "#4a4a4a" },
  divider: { light: "#d9d9d9", dark: "#4a4a4a" },
  source: { light: "#666666", dark: "#a8a8a8" },
  loading: { light: "#666666", dark: "#a8a8a8" },
  error: { light: "#c7354a", dark: "#ff8a9a" },
};

export const THEME_PREVIEW_PALETTE: Readonly<
  Record<ColorScheme, { text: string; background: string }>
> = {
  light: { text: "#222", background: "#f6f6f6" },
  dark: { text: "#e8e8e8", background: "#2b2b2b" },
};

function themeColor(
  mode: ColorMode,
  light: string,
  dark: string,
): ThemeColor {
  return { mode, light, dark };
}

export const DEFAULT_COLORS: ColorSettings = {
  text: themeColor("theme", "", ""),
  background: themeColor("theme", "", ""),
  underline: themeColor("theme", "", ""),
  ribbon: themeColor("single", DEFAULT_RIBBON_COLOR, DEFAULT_RIBBON_COLOR),
  border: themeColor("theme", "", ""),
  divider: themeColor("theme", "", ""),
  source: themeColor("theme", "", ""),
  loading: themeColor("theme", "", ""),
  error: themeColor("theme", "", ""),
};

export const DEFAULT_FONT_STACK: FontStack = {
  primary: "",
  fallbacks: [],
  generic: "",
};

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  fontSize: 16,
  // Empty means "inherit", so the reader follows Zotero's light/dark theme.
  color: "",
  colors: {
    text: themeColor("theme", "", ""),
    background: themeColor("theme", "", ""),
    underline: themeColor("theme", "", ""),
    ribbon: themeColor("single", DEFAULT_RIBBON_COLOR, DEFAULT_RIBBON_COLOR),
    border: themeColor("theme", "", ""),
    divider: themeColor("theme", "", ""),
    source: themeColor("theme", "", ""),
    loading: themeColor("theme", "", ""),
    error: themeColor("theme", "", ""),
  },
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
  textDecoration: [],
  textDecorationStyle: "solid",
  textDecorationThickness: 0,
  textUnderlineOffset: -1,
  textDecorationSkipInk: "auto",
  divider: false,
  dividerStyle: "solid",
  dividerWidth: 1,
  dividerOffset: 0,
  ribbonPosition: "left",
  ribbonWidth: 4,
  ribbonStyle: "solid",
  ribbonRadius: 0,
  ribbonPadding: 0,
  blockPaddingY: 0.45,
  blockPaddingX: 0.95,
  blockRadius: 0,
  blockBorderWidth: 0,
  blockBorderStyle: "solid",
  blockIndent: 0,
  firstLineIndent: 0,
  textAlign: "start",
  maxWidthCh: 0,
  opacity: 100,
  sourceDim: 100,
  sourceGap: 0.65,
  uiFollowAppearance: true,
  popupMaxWidth: 380,
  exportMode: "reader",
  stateAnimation: false,
  reduceMotion: false,
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
// Keep in sync with fontCatalog.ts. Legacy symbol/dingbat faces map ASCII to
// Greek letters or pictographs, so a saved stack containing one would render
// every label as gibberish in the reader and chat.
const NON_TEXT_FONT_FAMILIES = new Set([
  "bookshelf symbol 7",
  "marlett",
  "ms reference specialty",
  "symbol",
  "webdings",
  "wingdings",
  "wingdings 2",
  "wingdings 3",
]);

function isNonTextFontFamily(value: string): boolean {
  return NON_TEXT_FONT_FAMILIES.has(value.trim().toLowerCase());
}

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

const HEX_TOKEN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/iu;
const RGB_FUNCTION =
  /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/iu;
const HSL_FUNCTION =
  /^hsla?\(\s*([\d.]+)(?:deg)?\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*([\d.]+)\s*)?\)$/iu;

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

function clampChannel(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function clampAlpha(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Expand a HEX token to uppercase #RRGGBB or #RRGGBBAA, or null. */
export function normalizeColorToken(raw: string): string | null {
  const match = raw.trim().match(HEX_TOKEN);
  if (!match) return null;
  const hex = match[0].slice(1);
  const expanded =
    hex.length === 3 ? hex.split("").map((part) => part + part).join("") : hex;
  return `#${expanded.toUpperCase()}`;
}

export function rgbaToHex(rgba: Rgba): string {
  const base = [rgba.r, rgba.g, rgba.b]
    .map((channel) => clampChannel(channel).toString(16).padStart(2, "0"))
    .join("");
  const alpha = clampAlpha(rgba.a);
  if (alpha >= 1) return `#${base.toUpperCase()}`;
  return `#${base.toUpperCase()}${Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase()}`;
}

export function parseColorToRgba(raw: unknown): Rgba | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value) return null;
  const token = normalizeColorToken(value);
  if (token) {
    const hex = token.slice(1);
    const channel = (index: number) => parseInt(hex.slice(index, index + 2), 16);
    return {
      r: channel(0),
      g: channel(2),
      b: channel(4),
      a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
    };
  }
  const rgb = value.match(RGB_FUNCTION);
  if (rgb) {
    return {
      r: clampChannel(Number(rgb[1])),
      g: clampChannel(Number(rgb[2])),
      b: clampChannel(Number(rgb[3])),
      a: clampAlpha(rgb[4] === undefined ? 1 : Number(rgb[4])),
    };
  }
  const hsl = value.match(HSL_FUNCTION);
  if (hsl) {
    return hslToRgba({
      h: Number(hsl[1]),
      s: Number(hsl[2]),
      l: Number(hsl[3]),
      a: hsl[4] === undefined ? 1 : Number(hsl[4]),
    });
  }
  return null;
}

export function hslToRgba(input: {
  h: number;
  s: number;
  l: number;
  a?: number;
}): Rgba {
  const h = ((Number(input.h) % 360) + 360) % 360;
  const s = Math.min(100, Math.max(0, Number(input.s))) / 100;
  const l = Math.min(100, Math.max(0, Number(input.l))) / 100;
  const a = clampAlpha(input.a === undefined ? 1 : Number(input.a));
  const channel = (offset: number): number => {
    const k = (offset + h / 30) % 12;
    const amount = s * Math.min(l, 1 - l);
    return clampChannel(255 * (l - amount * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return { r: channel(0), g: channel(8), b: channel(4), a };
}

export function rgbaToHsl(rgba: Rgba): { h: number; s: number; l: number; a: number } {
  const r = clampChannel(rgba.r) / 255;
  const g = clampChannel(rgba.g) / 255;
  const b = clampChannel(rgba.b) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (delta > 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return {
    h: Math.round(h * 10) / 10,
    s: Math.round(s * 1000) / 10,
    l: Math.round(l * 1000) / 10,
    a: clampAlpha(rgba.a),
  };
}

export function compositeRgba(foreground: Rgba, background: Rgba): Rgba {
  const alpha = clampAlpha(foreground.a);
  const backdrop = clampAlpha(background.a);
  const outAlpha = alpha + backdrop * (1 - alpha);
  if (outAlpha <= 0) return { r: 0, g: 0, b: 0, a: 0 };
  return {
    r: clampChannel((foreground.r * alpha + background.r * backdrop * (1 - alpha)) / outAlpha),
    g: clampChannel((foreground.g * alpha + background.g * backdrop * (1 - alpha)) / outAlpha),
    b: clampChannel((foreground.b * alpha + background.b * backdrop * (1 - alpha)) / outAlpha),
    a: outAlpha,
  };
}

function luminanceOf(rgba: Rgba): number {
  return (
    0.2126 * channelLuminance(rgba.r) +
    0.7152 * channelLuminance(rgba.g) +
    0.0722 * channelLuminance(rgba.b)
  );
}

function ratioBetween(foreground: Rgba, background: Rgba): number {
  const l1 = luminanceOf(foreground);
  const l2 = luminanceOf(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
}

/** WCAG ratio after compositing translucent text and background over a page base. */
export function contrastRatioOver(
  foreground: string,
  background: string,
  base: string,
): number | null {
  const fg = parseColorToRgba(foreground);
  const bg = parseColorToRgba(background);
  const page = parseColorToRgba(base);
  if (!fg || !bg || !page) return null;
  const solidBackground = compositeRgba(bg, page);
  const solidForeground = compositeRgba(fg, solidBackground);
  return ratioBetween(solidForeground, solidBackground);
}

function cloneThemeColor(color: ThemeColor): ThemeColor {
  return { mode: color.mode, light: color.light, dark: color.dark };
}

/**
 * Accept the legacy flat color string or the structured {mode, light, dark}.
 * Invalid sides fall back to the supplied default, never to raw CSS.
 */
export function normalizeThemeColor(
  raw: unknown,
  fallback: ThemeColor = { mode: "theme", light: "", dark: "" },
): ThemeColor {
  const base = cloneThemeColor(fallback);
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return { mode: "theme", light: "", dark: "" };
    if (!isValidColor(trimmed)) return base;
    return { mode: "single", light: trimmed, dark: trimmed };
  }
  if (!raw || typeof raw !== "object") return base;
  const input = raw as Partial<ThemeColor>;
  const mode: ColorMode =
    input.mode === "theme" || input.mode === "single" || input.mode === "split"
      ? input.mode
      : base.mode;
  const side = (key: "light" | "dark"): string => {
    const value = input[key];
    if (typeof value !== "string") return base[key];
    const trimmed = value.trim();
    if (!trimmed) return "";
    return isValidColor(trimmed) ? trimmed : base[key];
  };
  return { mode, light: side("light"), dark: side("dark") };
}

/** Effective CSS color for one scheme; empty means inherit from the reader. */
export function resolveThemeColor(
  color: ThemeColor,
  scheme: ColorScheme,
  role: ColorRole,
): string {
  if (color.mode === "theme") return THEME_ROLE_COLORS[role][scheme];
  if (color.mode === "single") return color.light;
  return scheme === "dark" ? color.dark : color.light;
}

export function normalizeColorList(raw: unknown, max: number): string[] {
  if (!Array.isArray(raw) || max <= 0) return [];
  const seen = new Set<string>();
  const colors: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string") continue;
    const token = normalizeColorToken(entry);
    if (!token || seen.has(token)) continue;
    seen.add(token);
    colors.push(token);
    if (colors.length >= max) break;
  }
  return colors;
}

export function pushColorUnique(
  raw: unknown,
  color: string,
  max: number,
): string[] {
  const token = normalizeColorToken(color);
  const list = normalizeColorList(raw, max);
  if (!token) return list;
  return normalizeColorList([token, ...list], max);
}

const PALETTE_HUES = [0, 25, 50, 90, 150, 200, 260, 320] as const;
const PALETTE_LIGHTNESS = [88, 74, 58, 42, 26] as const;

/** Five lightness rows over eight hues; every swatch is a six-digit hex. */
export function buildColorPalette(): string[][] {
  return PALETTE_LIGHTNESS.map((lightness) =>
    PALETTE_HUES.map((hue) =>
      rgbaToHex(hslToRgba({ h: hue, s: 72, l: lightness, a: 1 })),
    ),
  );
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
  if (typeof value !== "string" || !isValidFontName(value)) return "";
  const name = value.trim();
  return isNonTextFontFamily(name) ? "" : name;
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

export function resolveUiFontFamily(
  input: Partial<AppearanceSettings> | null | undefined,
  targetLanguage?: string,
): string {
  const settings = normalizeAppearance(input);
  const explicit = buildFontStack(settings.fontStack);
  if (explicit) return explicit;
  if (settings.autoFontByLanguage) {
    const auto = buildFontStack(resolveAutoFontStack(targetLanguage));
    if (auto) return auto;
  }
  return settings.fontFamily;
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

const DECORATIONS = new Set<TextDecoration>(["underline", "overline", "line-through"]);

function normalizeTextDecorations(raw: unknown, legacyUnderline: unknown): TextDecoration[] {
  const list = Array.isArray(raw)
    ? raw.filter((entry): entry is TextDecoration =>
        DECORATIONS.has(entry as TextDecoration),
      )
    : [];
  if (list.length === 0 && legacyUnderline === true) return ["underline"];
  return Array.from(new Set(list));
}

function normalizeDecorationStyle(raw: unknown): DecorationStyle {
  return raw === "double" || raw === "dotted" || raw === "dashed" || raw === "wavy"
    ? raw
    : "solid";
}

function normalizeBorderStyle(raw: unknown): BorderStyle {
  return raw === "dashed" || raw === "dotted" || raw === "double" ? raw : "solid";
}

function normalizeRibbonPosition(raw: unknown): RibbonPosition {
  return raw === "right" ? "right" : "left";
}

function normalizeTextAlign(raw: unknown): TextAlign {
  return raw === "justify" || raw === "center" ? raw : "start";
}

function clampRange(raw: unknown, fallback: number, min: number, max: number): number {
  return clampNumber(raw, fallback, min, max);
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

function normalizeColors(
  rawColors: unknown,
  legacy: Partial<Record<ColorRole, string>>,
): ColorSettings {
  const source =
    rawColors && typeof rawColors === "object"
      ? (rawColors as Record<string, unknown>)
      : {};
  const colors = {} as ColorSettings;
  for (const role of COLOR_ROLES) {
    const candidate = source[role] !== undefined ? source[role] : legacy[role];
    colors[role] = normalizeThemeColor(candidate, DEFAULT_COLORS[role]);
  }
  return colors;
}

/**
 * The flat fields are still written to the legacy per-field prefs and read by
 * older integrations. A theme-mode color is stored as empty, except the ribbon
 * whose historical default must stay visible to old code.
 */
function colorToLegacy(color: ThemeColor, role: ColorRole): string {
  if (color.mode === "theme") {
    return role === "ribbon" ? THEME_ROLE_COLORS.ribbon.light : "";
  }
  return color.light;
}

export function normalizeAppearance(
  input?: Partial<AppearanceSettings> | null,
): AppearanceSettings {
  const rawSize = Number(input?.fontSize);
  const fontSize = Number.isFinite(rawSize)
    ? Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round(rawSize)))
    : DEFAULT_APPEARANCE.fontSize;
  let fontStack = normalizeFontStack(input?.fontStack);
  const stackIsEmpty =
    !fontStack.primary && fontStack.fallbacks.length === 0 && !fontStack.generic;
  if (stackIsEmpty && input?.fontFamily) {
    fontStack = parseFontStack(input.fontFamily);
  }
  const fontFamily = buildFontStack(fontStack) || normalizeFontFamily(input?.fontFamily);
  const colors = normalizeColors(input?.colors, {
    text: typeof input?.color === "string" ? input.color.trim() : undefined,
    background:
      typeof input?.background === "string" ? input.background.trim() : undefined,
    underline:
      typeof input?.underlineColor === "string" ? input.underlineColor.trim() : undefined,
    ribbon:
      typeof input?.ribbonColor === "string" ? input.ribbonColor.trim() : undefined,
  });
  const textDecoration = normalizeTextDecorations(input?.textDecoration, input?.underline);
  const rawMaxWidth = Number(input?.maxWidthCh);
  const maxWidthCh = Number.isFinite(rawMaxWidth) && rawMaxWidth > 0
    ? Math.min(100, Math.max(40, Math.round(rawMaxWidth)))
    : 0;
  return {
    fontSize,
    color: colorToLegacy(colors.text, "text"),
    colors,
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
    background: colorToLegacy(colors.background, "background"),
    theme: normalizeTheme(input?.theme),
    underline: textDecoration.includes("underline"),
    underlineColor: colorToLegacy(colors.underline, "underline"),
    ribbon: typeof input?.ribbon === "boolean" ? input.ribbon : DEFAULT_APPEARANCE.ribbon,
    ribbonColor:
      colorToLegacy(colors.ribbon, "ribbon") || DEFAULT_APPEARANCE.ribbonColor,
    textDecoration,
    textDecorationStyle: normalizeDecorationStyle(input?.textDecorationStyle),
    textDecorationThickness: clampRange(
      input?.textDecorationThickness,
      DEFAULT_APPEARANCE.textDecorationThickness,
      0,
      8,
    ),
    textUnderlineOffset: clampRange(
      input?.textUnderlineOffset,
      DEFAULT_APPEARANCE.textUnderlineOffset,
      -1,
      12,
    ),
    textDecorationSkipInk: input?.textDecorationSkipInk === "none" ? "none" : "auto",
    divider: typeof input?.divider === "boolean" ? input.divider : false,
    dividerStyle: normalizeBorderStyle(input?.dividerStyle),
    dividerWidth: clampRange(
      input?.dividerWidth,
      DEFAULT_APPEARANCE.dividerWidth,
      1,
      6,
    ),
    dividerOffset: clampRange(
      input?.dividerOffset,
      DEFAULT_APPEARANCE.dividerOffset,
      0,
      2,
    ),
    ribbonPosition: normalizeRibbonPosition(input?.ribbonPosition),
    ribbonWidth: clampRange(
      input?.ribbonWidth,
      DEFAULT_APPEARANCE.ribbonWidth,
      1,
      12,
    ),
    ribbonStyle: normalizeBorderStyle(input?.ribbonStyle),
    ribbonRadius: clampRange(
      input?.ribbonRadius,
      DEFAULT_APPEARANCE.ribbonRadius,
      0,
      8,
    ),
    ribbonPadding: clampRange(
      input?.ribbonPadding,
      DEFAULT_APPEARANCE.ribbonPadding,
      0,
      2,
    ),
    blockPaddingY: clampRange(
      input?.blockPaddingY,
      DEFAULT_APPEARANCE.blockPaddingY,
      0,
      2,
    ),
    blockPaddingX: clampRange(
      input?.blockPaddingX,
      DEFAULT_APPEARANCE.blockPaddingX,
      0,
      2,
    ),
    blockRadius: clampRange(input?.blockRadius, DEFAULT_APPEARANCE.blockRadius, 0, 16),
    blockBorderWidth: clampRange(
      input?.blockBorderWidth,
      DEFAULT_APPEARANCE.blockBorderWidth,
      0,
      4,
    ),
    blockBorderStyle: normalizeBorderStyle(input?.blockBorderStyle),
    blockIndent: clampRange(input?.blockIndent, DEFAULT_APPEARANCE.blockIndent, 0, 4),
    firstLineIndent: clampRange(
      input?.firstLineIndent,
      DEFAULT_APPEARANCE.firstLineIndent,
      0,
      4,
    ),
    textAlign: normalizeTextAlign(input?.textAlign),
    maxWidthCh,
    opacity: clampRange(input?.opacity, DEFAULT_APPEARANCE.opacity, 40, 100),
    sourceDim: clampRange(input?.sourceDim, DEFAULT_APPEARANCE.sourceDim, 40, 100),
    sourceGap: clampRange(input?.sourceGap, DEFAULT_APPEARANCE.sourceGap, 0, 2),
    uiFollowAppearance:
      typeof input?.uiFollowAppearance === "boolean"
        ? input.uiFollowAppearance
        : DEFAULT_APPEARANCE.uiFollowAppearance,
    popupMaxWidth: clampRange(
      input?.popupMaxWidth,
      DEFAULT_APPEARANCE.popupMaxWidth,
      280,
      720,
    ),
    exportMode: input?.exportMode === "print" ? "print" : "reader",
    stateAnimation:
      typeof input?.stateAnimation === "boolean"
        ? input.stateAnimation
        : DEFAULT_APPEARANCE.stateAnimation,
    reduceMotion:
      typeof input?.reduceMotion === "boolean"
        ? input.reduceMotion
        : DEFAULT_APPEARANCE.reduceMotion,
  };
}

function points(px: number): number {
  return Number((px * 0.75).toFixed(2));
}

/**
 * Resolve one role for a concrete scheme. Theme-mode text and background stay
 * empty in auto mode so the reader can inherit its own colors; everywhere else
 * the theme palette or role default is written explicitly.
 */
function cssColorForRole(
  settings: AppearanceSettings,
  role: ColorRole,
  scheme: ColorScheme,
  explicitScheme: boolean,
): string {
  const color = settings.colors[role];
  if (color.mode === "theme") {
    if (role === "text" || role === "background") {
      return explicitScheme ? THEME_PREVIEW_PALETTE[scheme][role] : "";
    }
    return THEME_ROLE_COLORS[role][scheme];
  }
  return resolveThemeColor(color, scheme, role);
}

/** Dark value to emit in a :root[data-color-scheme=dark] override, if any. */
function darkColorForRole(settings: AppearanceSettings, role: ColorRole): string | null {
  const color = settings.colors[role];
  if (color.mode === "theme") {
    if (role === "text" || role === "background" || role === "underline") return null;
    const light = THEME_ROLE_COLORS[role].light;
    const dark = THEME_ROLE_COLORS[role].dark;
    return dark && dark !== light ? dark : null;
  }
  if (color.mode !== "split") return null;
  const light = resolveThemeColor(color, "light", role);
  const dark = resolveThemeColor(color, "dark", role);
  return dark && dark !== light ? dark : null;
}

function explicitTextColor(settings: AppearanceSettings): string {
  const color = settings.colors.text;
  if (color.mode === "theme") return "#222";
  return color.light || "#222";
}

function decorationRules(
  settings: AppearanceSettings,
  mode: "reader" | "print",
  scheme: ColorScheme,
  explicitScheme: boolean,
): string {
  if (!settings.textDecoration.length) return "";
  const important = mode === "print" ? " !important" : "";
  let css = `  text-decoration: ${settings.textDecoration.join(" ")}${important};\n`;
  if (settings.textDecorationStyle !== "solid") {
    css += `  text-decoration-style: ${settings.textDecorationStyle}${important};\n`;
  }
  if (settings.textDecorationThickness > 0) {
    css += `  text-decoration-thickness: ${settings.textDecorationThickness}px${important};\n`;
  }
  if (
    settings.textDecoration.includes("underline") &&
    settings.textUnderlineOffset >= 0
  ) {
    css += `  text-underline-offset: ${settings.textUnderlineOffset}px${important};\n`;
  }
  if (
    settings.textDecoration.includes("underline") &&
    settings.textDecorationSkipInk === "none"
  ) {
    css += `  text-decoration-skip-ink: none${important};\n`;
  }
  if (settings.colors.underline.mode !== "theme") {
    const color =
      mode === "print"
        ? settings.colors.underline.light
        : cssColorForRole(settings, "underline", scheme, explicitScheme);
    if (color) css += `  text-decoration-color: ${color}${important};\n`;
  }
  return css;
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
  context: {
    targetLanguage?: string;
    colorScheme?: ColorScheme;
    sourceClassName?: string;
  } = {},
): string {
  const settings = normalizeAppearance(input);
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

  const forcedScheme = context.colorScheme !== undefined;
  const scheme: ColorScheme =
    context.colorScheme || (settings.theme === "dark" ? "dark" : "light");
  const explicitScheme = forcedScheme || settings.theme !== "auto";
  const followReaderScheme = !forcedScheme && settings.theme === "auto";

  if (mode === "print") {
    const printScheme: ColorScheme = "light";
    const ribbonColor = resolveThemeColor(settings.colors.ribbon, printScheme, "ribbon");
    const borderColor = resolveThemeColor(settings.colors.border, printScheme, "border");
    const dividerColor = resolveThemeColor(settings.colors.divider, printScheme, "divider");
    const printRibbonWidth =
      settings.ribbonWidth === DEFAULT_APPEARANCE.ribbonWidth &&
      settings.ribbonStyle === "solid"
        ? "2.2pt"
        : `${points(settings.ribbonWidth)}pt`;
    const ribbonSide =
      settings.ribbonPosition === "right" ? "border-right" : "border-left";
    const borderLines: string[] = [];
    if (settings.blockBorderWidth > 0) {
      borderLines.push(
        `  border: ${settings.blockBorderWidth}px ${settings.blockBorderStyle} ${borderColor} !important;\n`,
      );
    }
    if (settings.ribbon) {
      borderLines.push(
        `  ${ribbonSide}: ${printRibbonWidth} ${settings.ribbonStyle} ${ribbonColor} !important;\n`,
      );
    } else if (settings.blockBorderWidth === 0) {
      borderLines.push("  border-left: none !important;\n");
    }
    if (settings.divider) {
      borderLines.push(
        `  border-bottom: ${settings.dividerWidth}px ${settings.dividerStyle} ${dividerColor} !important;\n`,
      );
    }
    const dividerPadding = settings.divider
      ? `  padding-bottom: ${(0.12 + settings.dividerOffset).toFixed(2)}em !important;\n`
      : "";
    const extras: string[] = [];
    if (settings.textAlign !== "start") {
      extras.push(`  text-align: ${settings.textAlign} !important;\n`);
    }
    if (settings.firstLineIndent > 0) {
      extras.push(`  text-indent: ${settings.firstLineIndent}em !important;\n`);
    }
    if (settings.maxWidthCh > 0) {
      extras.push(`  max-width: ${settings.maxWidthCh}ch !important;\n`);
    }
    if (settings.blockRadius > 0) {
      extras.push(`  border-radius: ${settings.blockRadius}px !important;\n`);
    }
    return `.${className} {
  margin: 0.18em 0 ${settings.paragraphSpacing}em !important;
  padding: 0.12em 0 0.12em 0.78em !important;
${borderLines.join("")}  color: ${explicitTextColor(settings)} !important;
  background: transparent !important;
${fontFamilyRule}${fontWeightRule}${fontStyleRule}${letterSpacingRule}${directionRule}  font-size: ${points(printFontSizePx)}pt !important;
  line-height: ${settings.lineHeight} !important;
${decorationRules(settings, "print", printScheme, true)}${dividerPadding}${extras.join("")}  break-inside: avoid-page;
  page-break-inside: avoid;
}`;
  }

  const color = cssColorForRole(settings, "text", scheme, explicitScheme);
  const background = cssColorForRole(settings, "background", scheme, explicitScheme);
  const ribbonColor = cssColorForRole(settings, "ribbon", scheme, explicitScheme);
  const borderColor = cssColorForRole(settings, "border", scheme, explicitScheme);
  const dividerColor = cssColorForRole(settings, "divider", scheme, explicitScheme);
  const ribbonSide =
    settings.ribbonPosition === "right" ? "border-right" : "border-left";

  const borderLines: string[] = [];
  if (settings.blockBorderWidth > 0) {
    borderLines.push(
      `  border: ${settings.blockBorderWidth}px ${settings.blockBorderStyle} ${borderColor};\n`,
    );
  }
  if (settings.ribbon) {
    borderLines.push(
      `  ${ribbonSide}: ${settings.ribbonWidth}px ${settings.ribbonStyle} ${ribbonColor || "#2f6fdf"};\n`,
    );
  } else if (settings.blockBorderWidth === 0) {
    borderLines.push("  border-left: none;\n");
  }
  if (settings.divider) {
    borderLines.push(
      `  border-bottom: ${settings.dividerWidth}px ${settings.dividerStyle} ${dividerColor};\n`,
    );
  }

  const defaultPadding =
    settings.blockPaddingY === DEFAULT_APPEARANCE.blockPaddingY &&
    settings.blockPaddingX === DEFAULT_APPEARANCE.blockPaddingX &&
    settings.ribbonPadding === 0;
  let paddingLine = "  padding: 0.45em 0.95em;\n";
  if (!defaultPadding) {
    const inlineStart =
      settings.blockPaddingX +
      (settings.ribbon && settings.ribbonPosition === "left"
        ? settings.ribbonPadding
        : 0);
    const inlineEnd =
      settings.blockPaddingX +
      (settings.ribbon && settings.ribbonPosition === "right"
        ? settings.ribbonPadding
        : 0);
    const blockEnd = settings.blockPaddingY + (settings.divider ? settings.dividerOffset : 0);
    paddingLine = `  padding: ${settings.blockPaddingY}em ${inlineEnd}em ${blockEnd}em ${inlineStart}em;\n`;
  } else if (settings.divider) {
    paddingLine += `  padding-bottom: ${(DEFAULT_APPEARANCE.blockPaddingY + settings.dividerOffset).toFixed(2)}em;\n`;
  }

  const sourceGap =
    settings.sourceGap === DEFAULT_APPEARANCE.sourceGap
      ? "0.65em"
      : `${settings.sourceGap}em`;

  const extras: string[] = [];
  if (settings.blockRadius > 0) {
    extras.push(`  border-radius: ${settings.blockRadius}px;\n`);
  }
  if (settings.ribbon && settings.ribbonRadius > 0) {
    extras.push(`  border-top-${settings.ribbonPosition}-radius: ${settings.ribbonRadius}px;\n`);
    extras.push(`  border-bottom-${settings.ribbonPosition}-radius: ${settings.ribbonRadius}px;\n`);
  }
  if (settings.blockIndent > 0) {
    extras.push(`  margin-inline-start: ${settings.blockIndent}em;\n`);
  }
  if (settings.firstLineIndent > 0) {
    extras.push(`  text-indent: ${settings.firstLineIndent}em;\n`);
  }
  if (settings.textAlign !== "start") {
    extras.push(`  text-align: ${settings.textAlign};\n`);
  }
  if (settings.maxWidthCh > 0) {
    extras.push(`  max-width: ${settings.maxWidthCh}ch;\n`);
  }
  if (settings.opacity < 100) {
    extras.push(`  opacity: ${Number((settings.opacity / 100).toFixed(2))};\n`);
  }

  let css = `.${className} {
  box-sizing: border-box;
${borderLines.join("")}  margin: ${sourceGap} 0 ${settings.paragraphSpacing}em;
${paddingLine}${fontFamilyRule}${fontWeightRule}${fontStyleRule}${letterSpacingRule}${directionRule}  line-height: ${settings.lineHeight};
  font-size: ${readerFontSize};
${color ? `  color: ${color};\n` : ""}${background ? `  background: ${background};\n` : ""}${decorationRules(
    settings,
    "reader",
    scheme,
    explicitScheme,
  )}${extras.join("")}  white-space: pre-wrap;
  overflow-wrap: anywhere;
}`;

  if (settings.sourceDim < 100) {
    const sourceClass = context.sourceClassName || "interlinear-source";
    css += `\n.${sourceClass} {\n  opacity: ${Number((settings.sourceDim / 100).toFixed(2))};\n}`;
  }

  if (followReaderScheme) {
    const darkLines: string[] = [];
    const push = (property: string, role: ColorRole) => {
      const dark = darkColorForRole(settings, role);
      if (dark) darkLines.push(`  ${property}: ${dark};`);
    };
    push("color", "text");
    push("background", "background");
    if (settings.textDecoration.length) push("text-decoration-color", "underline");
    if (settings.ribbon) push(`${ribbonSide}-color`, "ribbon");
    if (settings.divider) push("border-bottom-color", "divider");
    if (darkLines.length) {
      css += `\n:root[data-color-scheme="dark"] .${className} {\n${darkLines.join(
        "\n",
      )}\n}`;
    }
  }

  const stateColors: Array<{ state: string; role: ColorRole }> = [
    { state: "loading", role: "loading" },
    { state: "error", role: "error" },
  ];
  for (const { state, role } of stateColors) {
    const show = settings.colors[role].mode !== "theme" || explicitScheme;
    if (!show) continue;
    const value = cssColorForRole(settings, role, scheme, explicitScheme);
    if (!value) continue;
    css += `\n.${className}[data-state="${state}"] {\n  color: ${value};\n}`;
    if (followReaderScheme) {
      const dark = darkColorForRole(settings, role);
      if (dark) {
        css += `\n:root[data-color-scheme="dark"] .${className}[data-state="${state}"] {\n  color: ${dark};\n}`;
      }
    }
  }
  return css;
}

/* ------------------------------------------------------------------ presets */

export interface AppearancePreset {
  name: string;
  appearance: AppearanceSettings;
}

export const APPEARANCE_EXPORT_FORMAT = "interlinear-appearance";
export const APPEARANCE_EXPORT_VERSION = 2;
export const APPEARANCE_IMPORT_MAX_BYTES = 256 * 1024;
export const APPEARANCE_PRESETS_MAX = 20;
export const APPEARANCE_PRESET_NAME_MAX = 60;

const APPEARANCE_KEYS = new Set(Object.keys(DEFAULT_APPEARANCE));

export function normalizePresetName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const name = raw.replace(/\p{Cc}/gu, "").trim();
  return name.slice(0, APPEARANCE_PRESET_NAME_MAX);
}

export function normalizeAppearancePresets(
  raw: unknown,
  max: number = APPEARANCE_PRESETS_MAX,
): AppearancePreset[] {
  if (!Array.isArray(raw) || max <= 0) return [];
  const presets: AppearancePreset[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const name = normalizePresetName((entry as any).name);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    presets.push({
      name,
      appearance: normalizeAppearance((entry as any).appearance),
    });
    if (presets.length >= max) break;
  }
  return presets;
}

export interface AppearanceImportResult {
  appearance: AppearanceSettings;
  presets: AppearancePreset[];
  ignoredKeys: string[];
  error: string | null;
}

export function parseAppearanceImport(text: string): AppearanceImportResult {
  const empty: AppearanceImportResult = {
    appearance: normalizeAppearance(undefined),
    presets: [],
    ignoredKeys: [],
    error: null,
  };
  if (typeof text !== "string" || text.length > APPEARANCE_IMPORT_MAX_BYTES) {
    return { ...empty, error: "too-large" };
  }
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch (_) {
    return { ...empty, error: "invalid-json" };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ...empty, error: "invalid-format" };
  }
  if (parsed.format !== APPEARANCE_EXPORT_FORMAT) {
    return { ...empty, error: "invalid-format" };
  }
  const version = Number(parsed.version);
  if (!Number.isInteger(version) || version < 1 || version > APPEARANCE_EXPORT_VERSION) {
    return { ...empty, error: "unsupported-version" };
  }
  const sourceAppearance =
    parsed.appearance && typeof parsed.appearance === "object"
      ? parsed.appearance
      : parsed;
  const ignoredKeys = Object.keys(sourceAppearance).filter(
    (key) => !APPEARANCE_KEYS.has(key),
  );
  return {
    appearance: normalizeAppearance(sourceAppearance as Partial<AppearanceSettings>),
    presets: normalizeAppearancePresets(parsed.presets),
    ignoredKeys,
    error: null,
  };
}

export function serializeAppearanceExport(
  appearance: AppearanceSettings,
  presets: AppearancePreset[] = [],
): string {
  return JSON.stringify(
    {
      format: APPEARANCE_EXPORT_FORMAT,
      version: APPEARANCE_EXPORT_VERSION,
      appearance: normalizeAppearance(appearance),
      presets: normalizeAppearancePresets(presets).map((preset) => ({
        name: preset.name,
        appearance: preset.appearance,
      })),
    },
    null,
    2,
  );
}
