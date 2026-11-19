// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — display mode model and CSS for reader layouts.

export type DisplayMode = "top-bottom" | "side-by-side" | "target-only" | "source-only";

export const DISPLAY_MODES: readonly DisplayMode[] = [
  "top-bottom",
  "side-by-side",
  "target-only",
  "source-only",
];

export const DEFAULT_DISPLAY_MODE: DisplayMode = "side-by-side";

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
  const sideBySide = `${root}[data-interlinear-display="side-by-side"]`;
  const columnSources = [
    `${sideBySide} p.${sourceClass}`,
    ...["h1", "h2", "h3", "h4", "h5", "h6"].map(
      (tag) => `${sideBySide} ${tag}.${sourceClass}`,
    ),
    `${sideBySide} aside.sdt-note.${sourceClass}`,
  ].join(",\n    ");
  return `    /* A translation-only pane keeps the visual blocks: figures, tables and
       formula images have no text to translate, so hiding them loses content. */
    ${root}[data-interlinear-display="target-only"] .${sourceClass}:not(:has(figure, table, img, svg, canvas, video)) {
      display: none;
    }
    ${root}[data-interlinear-display="target-only"] .${sourceClass}:has(figure, table, img, svg, canvas, video) {
      display: block;
      margin: 0 0 ${paragraphSpacing}em;
    }
    ${root}[data-interlinear-display="source-only"] .${translationClass} {
      display: none;
    }
    ${sideBySide} .${sourceClass} {
      vertical-align: top;
      box-sizing: border-box;
      margin-top: 0;
      margin-block-start: 0;
    }
    /* Only paragraph-like sources become columns. Turning list items or
       captions into inline blocks loses their markers and figure nesting. */
    ${columnSources} {
      display: inline-block;
      width: 49%;
    }
    ${sideBySide} .${translationClass} {
      display: inline-block;
      width: 49%;
      vertical-align: top;
      box-sizing: border-box;
      margin: 0 0 ${paragraphSpacing}em 1%;
      padding-top: 0;
    }
    ${sideBySide} li.${sourceClass} + .${translationClass},
    ${sideBySide} figcaption.${sourceClass} + .${translationClass} {
      display: block;
      width: auto;
      margin-left: 0;
    }
`;
}
