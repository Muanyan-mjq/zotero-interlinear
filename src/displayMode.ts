// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — display mode model and CSS for reader layouts.

export type DisplayMode = "top-bottom" | "side-by-side" | "target-only" | "source-only";

export const DISPLAY_MODES: readonly DisplayMode[] = [
  "top-bottom",
  "side-by-side",
  "target-only",
  "source-only",
];

export const DEFAULT_DISPLAY_MODE: DisplayMode = "top-bottom";

export function normalizeDisplayMode(value: unknown): DisplayMode {
  return DISPLAY_MODES.includes(value as DisplayMode)
    ? (value as DisplayMode)
    : DEFAULT_DISPLAY_MODE;
}

/**
 * Reader-only layout rules. Every mode is scoped by the data attribute on
 * `#sdt-content`, so switching modes never moves Zotero's source nodes; native
 * annotation ranges keep pointing at the same text nodes.
 */
export function buildDisplayModeCSS(
  translationClass: string,
  sourceClass: string,
  paragraphSpacing: number,
): string {
  const root = "#sdt-content";
  return `    ${root}[data-interlinear-display="target-only"] .${sourceClass} {
      display: none;
    }
    ${root}[data-interlinear-display="source-only"] .${translationClass} {
      display: none;
    }
    ${root}[data-interlinear-display="side-by-side"] .${sourceClass} {
      display: inline-block;
      width: 49%;
      vertical-align: top;
      box-sizing: border-box;
      margin-top: 0;
      margin-block-start: 0;
    }
    ${root}[data-interlinear-display="side-by-side"] .${translationClass} {
      display: inline-block;
      width: 49%;
      vertical-align: top;
      box-sizing: border-box;
      margin: 0 0 ${paragraphSpacing}em 1%;
      padding-top: 0;
    }
`;
}
