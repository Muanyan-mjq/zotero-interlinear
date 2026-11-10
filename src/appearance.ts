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
  const palette =
    settings.theme === "dark"
      ? { color: "#e8e8e8", background: "#2b2b2b" }
      : settings.theme === "light"
        ? { color: "#222", background: "#f6f6f6" }
        : { color: "", background: "" };
  return {
    color: settings.color || palette.color,
    background: settings.background || palette.background,
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
