// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — reader selection popup and per-paragraph triggers.

import { getString } from "./utils/locale";

const SOURCE_SELECTOR = "[data-ref-path]";
const TRANSLATION_CLASS = "interlinear-translation";
const POPUP_CLASS = "interlinear-selection-popup";
const HOVER_CLASS = "interlinear-source-hover";

interface SelectionLike {
  toString(): string;
  isCollapsed: boolean;
  rangeCount: number;
  getRangeAt(index: number): Range;
}

export interface InteractionHost {
  translateSelection(text: string): Promise<string>;
  translateParagraph(source: HTMLElement): Promise<void>;
}

export interface InteractionOptions {
  /** Tests inject a selection because createHTMLDocument has no defaultView. */
  getSelection?: () => SelectionLike | null;
  setTimer?: (callback: () => void, delay: number) => void;
}

export interface InteractionController {
  dispose(): void;
}

function elementOf(node: Node | null): Element | null {
  if (!node) return null;
  return node.nodeType === 1 ? (node as Element) : node.parentElement;
}

function findSource(target: EventTarget | null): HTMLElement | null {
  const element = elementOf(target as Node | null);
  const source = element?.closest?.(SOURCE_SELECTOR) as HTMLElement | null;
  if (!source) return null;
  if (!source.closest("#sdt-content")) return null;
  if (source.closest(`.${TRANSLATION_CLASS}, .${POPUP_CLASS}`)) return null;
  return source;
}

function invokeParagraph(host: InteractionHost, source: HTMLElement): void {
  const report = (error: unknown) => {
    try {
      Zotero.logError(error as Error);
    } catch (_) {
      // Outside Zotero (unit harness) there is nowhere to report.
    }
  };
  try {
    void Promise.resolve(host.translateParagraph(source)).catch(report);
  } catch (error) {
    report(error);
  }
}

function createPopup(
  doc: Document,
  win: any,
  host: InteractionHost,
): {
  root: HTMLDivElement;
  show: (rect: DOMRect, text: string) => void;
  hide: () => void;
  contains: (target: EventTarget | null) => boolean;
} {
  const root = doc.createElement("div") as HTMLDivElement;
  root.className = POPUP_CLASS;
  root.hidden = true;

  const actions = doc.createElement("div");
  actions.className = "interlinear-selection-actions";

  const translateButton = doc.createElement("button") as HTMLButtonElement;
  translateButton.type = "button";
  translateButton.className = "interlinear-selection-translate";
  translateButton.textContent = getString("selection-translate-button");

  const closeButton = doc.createElement("button") as HTMLButtonElement;
  closeButton.type = "button";
  closeButton.className = "interlinear-selection-close";
  closeButton.textContent = "×";
  closeButton.title = getString("selection-close-title");
  closeButton.setAttribute("aria-label", getString("selection-close-title"));

  const result = doc.createElement("div") as HTMLDivElement;
  result.className = "interlinear-selection-result";
  result.hidden = true;

  actions.append(translateButton, closeButton);
  root.append(actions, result);
  root.addEventListener("mousedown", (event: Event) => event.stopPropagation());
  root.addEventListener("click", (event: Event) => event.stopPropagation());

  let pendingText = "";
  let busy = false;

  const hide = () => {
    root.hidden = true;
    result.hidden = true;
    result.textContent = "";
    result.removeAttribute("data-state");
  };

  closeButton.addEventListener("click", (event: Event) => {
    event.preventDefault();
    hide();
  });

  translateButton.addEventListener("click", async (event: Event) => {
    event.preventDefault();
    if (busy || !pendingText) return;
    busy = true;
    translateButton.disabled = true;
    translateButton.textContent = getString("selection-translating");
    result.hidden = false;
    result.dataset.state = "loading";
    result.textContent = getString("selection-translating");
    try {
      const translated = await host.translateSelection(pendingText);
      result.dataset.state = "done";
      result.textContent = translated;
    } catch (error: any) {
      result.dataset.state = "error";
      result.textContent = getString("selection-error", {
        args: { detail: String(error?.message || error) },
      });
    } finally {
      busy = false;
      translateButton.disabled = false;
      translateButton.textContent = getString("selection-translate-button");
    }
  });

  const show = (rect: DOMRect, text: string) => {
    pendingText = text;
    result.hidden = true;
    result.textContent = "";
    result.removeAttribute("data-state");
    root.hidden = false;

    const viewportWidth = Number(win?.innerWidth) || 800;
    const viewportHeight = Number(win?.innerHeight) || 600;
    const width = 380;
    const left = Math.max(8, Math.min(rect.left || 0, viewportWidth - width - 8));
    const top = Math.max(8, Math.min((rect.bottom || 0) + 8, viewportHeight - 140));
    root.style.left = `${left}px`;
    root.style.top = `${top}px`;
  };

  const container = doc.body || doc.documentElement;
  container?.append(root);

  return {
    root,
    show,
    hide,
    contains: (target) => root.contains(target as Node | null),
  };
}

export function attachReaderInteractions(
  doc: Document,
  host: InteractionHost,
  options: InteractionOptions = {},
): InteractionController {
  const win: any = doc.defaultView;
  const schedule =
    options.setTimer ||
    ((callback: () => void, delay: number) => {
      const target = win || Zotero.getMainWindow();
      target.setTimeout(callback, delay);
    });
  let disposed = false;
  let hovered: HTMLElement | null = null;
  let popup: ReturnType<typeof createPopup> | null = null;

  const getSelection = (): SelectionLike | null => {
    if (options.getSelection) return options.getSelection();
    try {
      return (win?.getSelection?.() as SelectionLike) || null;
    } catch (_) {
      return null;
    }
  };

  const clearHover = () => {
    if (hovered) {
      try {
        hovered.classList.remove(HOVER_CLASS);
      } catch (_) {
        // The reader can replace its content document.
      }
      hovered = null;
    }
  };

  const hidePopup = () => {
    popup?.hide();
  };

  const onMouseMove = (event: MouseEvent) => {
    if (!event.altKey) {
      clearHover();
      return;
    }
    const source = findSource(event.target);
    if (source === hovered) return;
    clearHover();
    if (source) {
      hovered = source;
      source.classList.add(HOVER_CLASS);
    }
  };

  const onMouseLeave = () => clearHover();

  const onMouseUp = () => {
    schedule(() => {
      if (disposed) return;
      const selection = getSelection();
      if (!selection || selection.isCollapsed || !selection.rangeCount) {
        hidePopup();
        return;
      }
      const text = selection.toString().replace(/\s+/gu, " ").trim();
      if (text.length < 2) {
        hidePopup();
        return;
      }
      const range = selection.getRangeAt(0);
      const inside = elementOf(range.commonAncestorContainer)?.closest(
        `.${TRANSLATION_CLASS}, .${POPUP_CLASS}`,
      );
      if (inside) {
        hidePopup();
        return;
      }
      popup ||= createPopup(doc, win, host);
      popup.show(range.getBoundingClientRect(), text.slice(0, 8000));
    }, 0);
  };

  const onClick = (event: MouseEvent) => {
    if (!event.altKey) return;
    const source = findSource(event.target);
    if (!source) return;
    event.preventDefault();
    event.stopPropagation();
    clearHover();
    invokeParagraph(host, source);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      hidePopup();
      clearHover();
      return;
    }
    if (!event.altKey || event.key !== "Enter") return;

    let source = hovered;
    if (!source) {
      const selection = getSelection();
      if (selection?.rangeCount) {
        source = findSource(selection.getRangeAt(0).startContainer);
      }
    }
    if (!source) return;
    event.preventDefault();
    event.stopPropagation();
    clearHover();
    invokeParagraph(host, source);
  };

  const onMouseDown = (event: MouseEvent) => {
    if (popup && !popup.contains(event.target)) hidePopup();
  };

  doc.addEventListener("mousemove", onMouseMove, true);
  doc.addEventListener("mouseleave", onMouseLeave, true);
  doc.addEventListener("mouseup", onMouseUp, true);
  doc.addEventListener("click", onClick, true);
  doc.addEventListener("keydown", onKeyDown, true);
  doc.addEventListener("mousedown", onMouseDown, true);

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      clearHover();
      try {
        popup?.root.remove();
      } catch (_) {
        // The iframe may already be gone.
      }
      doc.removeEventListener("mousemove", onMouseMove, true);
      doc.removeEventListener("mouseleave", onMouseLeave, true);
      doc.removeEventListener("mouseup", onMouseUp, true);
      doc.removeEventListener("click", onClick, true);
      doc.removeEventListener("keydown", onKeyDown, true);
      doc.removeEventListener("mousedown", onMouseDown, true);
    },
  };
}
