// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — collect reading-mode text for the chat sidebar.

export type ChatScope = "selection" | "page" | "document";

export const CHAT_CONTEXT_LIMIT = 12000;

/**
 * The same paragraph nodes the translation pipeline treats as source text.
 * Keep the list in sync with collectParagraphs() in bilingualReader.ts.
 */
export const CHAT_PARAGRAPH_SELECTOR = [
  "#sdt-content p[data-ref-path]",
  "#sdt-content h1[data-ref-path]",
  "#sdt-content h2[data-ref-path]",
  "#sdt-content h3[data-ref-path]",
  "#sdt-content h4[data-ref-path]",
  "#sdt-content h5[data-ref-path]",
  "#sdt-content h6[data-ref-path]",
  "#sdt-content figcaption[data-ref-path]",
  "#sdt-content aside.sdt-note[data-ref-path]",
  "#sdt-content li[data-ref-path]",
].join(",");

const NESTED_PARAGRAPH_SELECTOR = [
  "p[data-ref-path]",
  "h1[data-ref-path]",
  "h2[data-ref-path]",
  "h3[data-ref-path]",
  "h4[data-ref-path]",
  "h5[data-ref-path]",
  "h6[data-ref-path]",
  "figcaption[data-ref-path]",
  "aside.sdt-note[data-ref-path]",
].join(",");

export interface ChatContextResult {
  text: string;
  truncated: boolean;
  paragraphCount: number;
}

export interface ChatContextOptions {
  /** iframe viewport height; falls back to doc.defaultView. */
  viewportHeight?: number;
  /** Injectable for tests and non-window documents. */
  selection?: any;
  limit?: number;
}

export function truncateChatContext(
  text: string,
  limit: number = CHAT_CONTEXT_LIMIT,
): { text: string; truncated: boolean } {
  if (text.length <= limit) return { text, truncated: false };

  const cut = text.slice(0, limit);
  const boundary = cut.lastIndexOf("\n\n");
  // Only snap to a paragraph boundary when it keeps most of the budget;
  // otherwise a single huge paragraph would produce a nearly empty context.
  const trimmed = boundary > limit * 0.6 ? cut.slice(0, boundary) : cut;
  return { text: trimmed.trimEnd(), truncated: true };
}

function isChatParagraph(element: HTMLElement): boolean {
  try {
    if (element.hidden) return false;
    if (element.closest(".sdt-reference")) return false;
    if (element.closest(".interlinear-translation")) return false;
    return !(
      element.tagName.toLowerCase() === "li" &&
      element.querySelector(NESTED_PARAGRAPH_SELECTOR)
    );
  } catch (_) {
    return false;
  }
}

function paragraphText(element: HTMLElement): string {
  try {
    return (element.textContent || "").replace(/\s+/gu, " ").trim();
  } catch (_) {
    return "";
  }
}

function getParagraphElements(doc: Document): HTMLElement[] {
  let elements: Element[];
  try {
    elements = Array.from(doc.querySelectorAll(CHAT_PARAGRAPH_SELECTOR));
  } catch (_) {
    return [];
  }
  return elements.filter((element) => isChatParagraph(element as HTMLElement)) as HTMLElement[];
}

function selectionParagraph(doc: Document, selection: any): HTMLElement | null {
  // A caret without an actual text selection should not send a whole
  // paragraph; real Selection objects expose isCollapsed.
  if (selection?.isCollapsed === true) return null;
  const anchor = selection?.anchorNode;
  if (!anchor) return null;
  try {
    const element =
      anchor.nodeType === 1 ? (anchor as Element) : (anchor.parentElement as Element | null);
    const paragraph = element?.closest?.(CHAT_PARAGRAPH_SELECTOR) as HTMLElement | null;
    if (!paragraph || paragraph.ownerDocument !== doc) return null;
    return isChatParagraph(paragraph) ? paragraph : null;
  } catch (_) {
    return null;
  }
}

function visibleParagraphs(doc: Document, viewportHeight: number): HTMLElement[] {
  const paragraphs = getParagraphElements(doc);
  if (viewportHeight <= 0) return paragraphs;
  return paragraphs.filter((element) => {
    try {
      const rect = element.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < viewportHeight;
    } catch (_) {
      return false;
    }
  });
}

/**
 * Return null when the chosen scope has no usable text, so the pane can tell
 * the user to select text or open the reader instead of sending an empty
 * prompt.
 */
export function collectChatContext(
  doc: Document,
  scope: ChatScope,
  options: ChatContextOptions = {},
): ChatContextResult | null {
  const limit = options.limit ?? CHAT_CONTEXT_LIMIT;
  let paragraphs: HTMLElement[];

  if (scope === "selection") {
    const selection = options.selection ?? doc.defaultView?.getSelection?.() ?? null;
    const paragraph = selectionParagraph(doc, selection);
    paragraphs = paragraph ? [paragraph] : [];
  } else if (scope === "page") {
    const viewportHeight =
      options.viewportHeight ?? doc.defaultView?.innerHeight ?? 0;
    paragraphs = visibleParagraphs(doc, viewportHeight);
  } else {
    paragraphs = getParagraphElements(doc);
  }

  const texts = paragraphs
    .map(paragraphText)
    .filter((text) => text.length >= 2);
  if (!texts.length) return null;

  const truncated = truncateChatContext(texts.join("\n\n"), limit);
  return {
    text: truncated.text,
    truncated: truncated.truncated,
    paragraphCount: texts.length,
  };
}
