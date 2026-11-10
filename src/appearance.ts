// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — appearance settings and translation-block stylesheet builder.

export type AppearanceTheme = "auto" | "light" | "dark";

export interface AppearanceSettings {
  fontSize: number;
  color: string;
  fontFamily: string;
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

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  fontSize: 16,
  // Empty means "inherit", so the reader follows Zotero's light/dark theme.
  color: "",
  fontFamily: "",
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
// Family names may contain spaces and generic keywords such as `serif`, so the
// list is emitted unquoted; reject every character that could end a
// declaration or open a new rule.
const FONT_FAMILY = /^[a-z0-9 ,._-]+$/iu;

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

function normalizeFontFamily(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (!trimmed || !FONT_FAMILY.test(trimmed)) return "";
  return trimmed
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}

/** Empty (inherit) or a stack of tokens that cannot break out of a CSS declaration. */
export function isValidFontFamily(value: string): boolean {
  const trimmed = value.trim();
  return !trimmed || FONT_FAMILY.test(trimmed);
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
  return {
    fontSize,
    color: isValidColor(rawColor) ? rawColor : DEFAULT_APPEARANCE.color,
    fontFamily: normalizeFontFamily(input?.fontFamily),
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
  const fontFamily = settings.fontFamily ? `  font-family: ${settings.fontFamily};\n` : "";

  if (mode === "print") {
    // The export is meant for paper: a dark reader theme must not bleed into it.
    return `.${className} {
  margin: 0.18em 0 ${settings.paragraphSpacing}em !important;
  padding: 0.12em 0 0.12em 0.78em !important;
  border-left: ${settings.ribbon ? `2.2pt solid ${settings.ribbonColor}` : "none"} !important;
  color: ${settings.color || "#222"} !important;
  background: transparent !important;
${fontFamily}  font-size: ${points(settings.fontSize)}pt !important;
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
${fontFamily}  line-height: ${settings.lineHeight};
  font-size: ${settings.fontSize}px;
${color ? `  color: ${color};\n` : ""}${background ? `  background: ${background};\n` : ""}${underline}  white-space: pre-wrap;
  overflow-wrap: anywhere;
}`;
}
