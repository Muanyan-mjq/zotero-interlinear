// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — print/PDF layout for exported bilingual documents.

import type { DisplayMode } from "./displayMode";

export const PAIR_CLASS = "interlinear-pair";

/**
 * Wrap each source paragraph and its translation into one printable unit.
 * List items are skipped: a wrapper div inside ol/ul would break numbering,
 * so their source and translation simply stay stacked.
 */
export function wrapExportPairs(
  root: HTMLElement,
  translationClass: string,
  sourceClass: string,
): number {
  const doc = root.ownerDocument;
  if (!doc) return 0;
  let count = 0;
  for (const block of Array.from(
    root.querySelectorAll(`.${translationClass}`),
  ) as HTMLElement[]) {
    const source = block.previousElementSibling as HTMLElement | null;
    if (!source?.classList.contains(sourceClass)) continue;
    if (source.parentElement?.classList.contains(PAIR_CLASS)) continue;
    if (source.tagName.toLowerCase() === "li") continue;

    const pair = doc.createElement("div");
    pair.className = PAIR_CLASS;
    source.before(pair);
    pair.append(source, block);
    count += 1;
  }
  return count;
}

export function buildExportLayoutCSS(
  mode: DisplayMode,
  translationClass: string,
  sourceClass: string,
): string {
  if (mode === "source-only") {
    return `#sdt-content .${translationClass} { display: none !important; }`;
  }
  if (mode === "target-only") {
    return `#sdt-content .${sourceClass} { display: none !important; }`;
  }

  const root = `#sdt-content[data-export-layout="${mode}"]`;
  if (mode === "side-by-side") {
    return `
  ${root} .${PAIR_CLASS} {
    display: flex;
    align-items: flex-start;
    gap: 2%;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  ${root} .${PAIR_CLASS} > .${sourceClass} {
    width: 50%;
    margin: 0;
    box-sizing: border-box;
  }
  ${root} .${PAIR_CLASS} > .${translationClass} {
    width: 50%;
    margin: 0;
    box-sizing: border-box;
  }`;
  }

  return `
  ${root} .${PAIR_CLASS} {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  ${root} .${PAIR_CLASS} > .${translationClass} {
    margin-top: 0.35em;
  }`;
}