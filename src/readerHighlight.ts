// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — source/translation hover and selection highlight sync.

import { mapSelectionToTranslation } from "./highlightText";

const HIGHLIGHT_NAME = "interlinear-sync";
const TRANSLATION_CLASS = "interlinear-translation";
const FALLBACK_ATTR = "data-interlinear-sync";

interface DocState {
  doc: Document;
  win: any;
}

export interface ReaderHighlighter {
  register(doc: Document): void;
  unregister(doc: Document): void;
  showFromSource(
    source: HTMLElement,
    selection?: { start: number; end: number },
  ): void;
  /** Paint the source paragraph(s) that belong to a hovered translation. */
  showSource(source: HTMLElement): void;
  /** Selecting inside a translation paints the matching part of its source. */
  showFromTranslation(
    block: HTMLElement,
    selection?: { start: number; end: number },
  ): void;
  clear(): void;
  clearFor(doc: Document): void;
  dispose(): void;
}

function translationBlocksOf(source: HTMLElement, docs: DocState[]): HTMLElement[] {
  const refPath = source.dataset.refPath || "";
  const blocks: HTMLElement[] = [];
  const push = (element: Element | null) => {
    if (element && !blocks.includes(element as HTMLElement)) {
      blocks.push(element as HTMLElement);
    }
  };

  const sibling = source.nextElementSibling;
  if (
    sibling?.classList.contains(TRANSLATION_CLASS) &&
    (sibling as HTMLElement).dataset.sourceRefPath === refPath
  ) {
    push(sibling);
  }
  if (!refPath) return blocks;

  for (const state of docs) {
    try {
      for (const block of Array.from(
        state.doc.querySelectorAll(`.${TRANSLATION_CLASS}[data-source-ref-path]`),
      ) as HTMLElement[]) {
        if (block.dataset.sourceRefPath === refPath) push(block);
      }
    } catch (_) {
      // A split-view document can be torn down between calls.
    }
  }
  return blocks;
}

function textNodesOf(root: HTMLElement): Text[] {
  const doc = root.ownerDocument;
  if (!doc) return [];
  const nodes: Text[] = [];
  try {
    const walker = doc.createTreeWalker(
      root,
      doc.defaultView?.NodeFilter?.SHOW_TEXT ?? 4,
    );
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      nodes.push(node as Text);
    }
  } catch (_) {
    // Detached documents simply produce no ranges.
  }
  return nodes;
}

function rangeAt(block: HTMLElement, start: number, end: number): Range | null {
  const doc = block.ownerDocument;
  if (!doc) return null;
  const nodes = textNodesOf(block);
  let offset = 0;
  let startNode: Text | null = null;
  let startOffset = 0;
  let endNode: Text | null = null;
  let endOffset = 0;

  for (const node of nodes) {
    const length = node.data.length;
    if (!startNode && start < offset + length) {
      startNode = node;
      startOffset = start - offset;
    }
    if (end <= offset + length) {
      endNode = node;
      endOffset = end - offset;
      break;
    }
    offset += length;
  }

  if (!startNode || !endNode) return null;
  try {
    const range = doc.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
    return range;
  } catch (_) {
    return null;
  }
}

export function createReaderHighlighter(): ReaderHighlighter {
  const states = new Map<Document, DocState>();
  let lastSignature = "";

  const clearState = (state: DocState) => {
    try {
      state.win?.CSS?.highlights?.delete(HIGHLIGHT_NAME);
    } catch (_) {
      // A torn-down iframe has no highlight registry left.
    }
    try {
      for (const block of Array.from(
        state.doc.querySelectorAll(`[${FALLBACK_ATTR}]`),
      ) as HTMLElement[]) {
        delete block.dataset.interlinearSync;
      }
    } catch (_) {
      // Same teardown case.
    }
  };

  const clear = () => {
    lastSignature = "";
    for (const state of states.values()) clearState(state);
  };

  const highlightBlock = (block: HTMLElement, start: number, end: number): void => {
    const text = block.textContent || "";
    if (!text.trim()) return;
    const from = Math.max(0, Math.min(text.length, start));
    const to = Math.max(from, Math.min(text.length, end));
    if (to <= from) return;

    const doc = block.ownerDocument;
    const win: any = doc?.defaultView;
    const range = rangeAt(block, from, to);
    if (win?.Highlight && win?.CSS?.highlights && range) {
      try {
        win.CSS.highlights.set(HIGHLIGHT_NAME, new win.Highlight(range));
        return;
      } catch (_) {
        // Fall back to the block-level tint below.
      }
    }
    block.dataset.interlinearSync = "true";
  };

  /**
   * Paint the source paragraph of `refPath` in every registered document.
   * A split view keeps the source and the translation in different panes, so
   * the hovered/targeted element alone is not enough.
   */
  const paintSource = (
    refPath: string,
    selection: { start: number; end: number } | null,
    origin: HTMLElement,
    fallback: HTMLElement | null,
  ): void => {
    const originText = origin?.textContent || "";
    if (!refPath) {
      if (fallback) {
        highlightBlock(
          fallback,
          selection?.start ?? 0,
          selection?.end ?? (fallback.textContent || "").length,
        );
      }
      return;
    }
    for (const state of states.values()) {
      let target: HTMLElement | null = null;
      try {
        for (const candidate of Array.from(
          state.doc.querySelectorAll(`[data-ref-path="${refPath.replace(/"/gu, "")}"]`),
        ) as HTMLElement[]) {
          if (candidate.closest(`.${TRANSLATION_CLASS}`)) continue;
          target = candidate;
          break;
        }
      } catch (_) {
        // A torn-down split pane produces no targets.
        continue;
      }
      if (!target) continue;
      if (!selection) {
        highlightBlock(target, 0, (target.textContent || "").length);
        continue;
      }
      const span = mapSelectionToTranslation(
        selection.start,
        selection.end,
        originText,
        target.textContent || "",
      );
      if (span) highlightBlock(target, span.start, span.end);
    }
  };

  return {
    register(doc) {
      if (!doc || states.has(doc)) return;
      states.set(doc, { doc, win: doc.defaultView });
    },
    unregister(doc) {
      const state = states.get(doc);
      if (!state) return;
      clearState(state);
      states.delete(doc);
      lastSignature = "";
    },
    showFromSource(source, selection) {
      const refPath = source?.dataset?.refPath || "";
      const signature = `${refPath}|${selection?.start ?? -1}|${selection?.end ?? -1}`;
      if (signature === lastSignature) return;
      lastSignature = signature;

      for (const state of states.values()) clearState(state);

      const blocks = translationBlocksOf(source, Array.from(states.values()));
      if (!blocks.length) return;
      const sourceText = source.textContent || "";

      for (const block of blocks) {
        if (!selection) {
          highlightBlock(block, 0, (block.textContent || "").length);
          continue;
        }
        const span = mapSelectionToTranslation(
          selection.start,
          selection.end,
          sourceText,
          block.textContent || "",
        );
        if (span) highlightBlock(block, span.start, span.end);
      }
    },
    showSource(source) {
      const refPath = source?.dataset?.refPath || "";
      const signature = `source:${refPath}`;
      if (signature === lastSignature) return;
      lastSignature = signature;

      for (const state of states.values()) clearState(state);
      paintSource(refPath, null, source, source);
    },
    showFromTranslation(block, selection) {
      const refPath = block?.dataset?.sourceRefPath || "";
      const signature = `block:${refPath}|${selection?.start ?? -1}|${selection?.end ?? -1}`;
      if (signature === lastSignature) return;
      lastSignature = signature;

      for (const state of states.values()) clearState(state);
      paintSource(refPath, selection ?? null, block, null);
    },
    clear,
    clearFor(doc) {
      const state = states.get(doc);
      if (state) clearState(state);
      lastSignature = "";
    },
    dispose() {
      clear();
      states.clear();
    },
  };
}