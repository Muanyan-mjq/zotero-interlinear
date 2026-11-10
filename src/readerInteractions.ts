// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — reader selection popup and per-paragraph triggers.

import { getString } from "./utils/locale";
import { DEFAULT_SHORTCUT, matchesShortcut, parseShortcut, type ShortcutSpec } from "./shortcut";

const SOURCE_SELECTOR = "[data-ref-path]";
const TRANSLATION_CLASS = "interlinear-translation";
const RETRY_SELECTOR = `.${TRANSLATION_CLASS}[data-state="error"], .${TRANSLATION_CLASS}[data-state="paused"]`;
const POPUP_CLASS = "interlinear-selection-popup";
const HOVER_CLASS = "interlinear-source-hover";
const AUTO_HOVER_CLASS = "interlinear-source-hover-auto";

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
  /** Read at gesture time so settings changes apply without re-attaching. */
  getHoverSettings?: () => { enabled: boolean; delayMs: number };
  getShortcutSettings?: () => { enabled: boolean; spec: ShortcutSpec | null };
  /** Tests can replace the dwell timer with a manual handle. */
  setHoverTimer?: (callback: () => void, delay: number) => any;
  clearHoverTimer?: (handle: any) => void;
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
  let hoverMode: "alt" | "auto" | null = null;
  let hoverTimer: any = null;
  let hoverPoint: { x: number; y: number } | null = null;
  let hoverAnchor: { x: number; y: number } | null = null;
  let popup: ReturnType<typeof createPopup> | null = null;

  const getHoverSettings =
    options.getHoverSettings ||
    (() => ({ enabled: false, delayMs: 800 }));
  const getShortcutSettings =
    options.getShortcutSettings ||
    (() => ({ enabled: true, spec: parseShortcut(DEFAULT_SHORTCUT) }));
  const setHoverTimeout =
    options.setHoverTimer ||
    ((callback: () => void, delay: number) => {
      const target = win || Zotero.getMainWindow();
      return target.setTimeout(callback, delay);
    });
  const clearHoverTimeout =
    options.clearHoverTimer ||
    ((handle: any) => {
      const target = win || Zotero.getMainWindow();
      target.clearTimeout(handle);
    });

  const getSelection = (): SelectionLike | null => {
    if (options.getSelection) return options.getSelection();
    try {
      return (win?.getSelection?.() as SelectionLike) || null;
    } catch (_) {
      return null;
    }
  };

  const shouldSkipAutoTranslate = (source: HTMLElement): boolean => {
    const next = source.nextElementSibling as HTMLElement | null;
    if (next?.classList?.contains(TRANSLATION_CLASS)) return true;
    const text = (source.textContent || "").replace(/\s+/gu, " ").trim();
    return text.length < 2;
  };

  const clearHoverTimer = () => {
    if (hoverTimer === null) return;
    try {
      clearHoverTimeout(hoverTimer);
    } catch (_) {
      // The reader can replace its content document.
    }
    hoverTimer = null;
  };

  const clearHover = () => {
    clearHoverTimer();
    if (hovered) {
      try {
        hovered.classList.remove(HOVER_CLASS);
        hovered.classList.remove(AUTO_HOVER_CLASS);
      } catch (_) {
        // The reader can replace its content document.
      }
      hovered = null;
    }
    hoverMode = null;
    hoverPoint = null;
    hoverAnchor = null;
  };

  const hidePopup = () => {
    popup?.hide();
  };

  const armAutoHover = (source: HTMLElement, event: MouseEvent) => {
    const settings = getHoverSettings();
    if (!settings.enabled || shouldSkipAutoTranslate(source)) return;

    clearHoverTimer();
    hovered = source;
    hoverMode = "auto";
    hoverPoint = { x: Number(event.clientX) || 0, y: Number(event.clientY) || 0 };
    hoverAnchor = hoverPoint;
    source.classList.add(AUTO_HOVER_CLASS);

    let fired = false;
    const handle = setHoverTimeout(() => {
      fired = true;
      hoverTimer = null;
      if (disposed || hovered !== source || hoverMode !== "auto") return;
      if (!getHoverSettings().enabled) return;
      if (!source.isConnected) {
        clearHover();
        return;
      }
      if (hoverPoint && (hoverPoint.x || hoverPoint.y)) {
        try {
          const at = (doc as any).elementFromPoint?.(hoverPoint.x, hoverPoint.y);
          // Only a different paragraph proves the pointer left. A null hit
          // (annotation overlay, page gap, transparent layer) is not proof.
          const current = at ? findSource(at) : null;
          if (current && current !== source) {
            clearHover();
            return;
          }
        } catch (_) {
          // elementFromPoint is best-effort geometry validation.
        }
      }
      const selection = getSelection();
      if (selection?.rangeCount && !selection.isCollapsed) return;
      if (popup && !popup.root.hidden) return;
      if (shouldSkipAutoTranslate(source)) return;
      invokeParagraph(host, source);
    }, Math.max(0, Number(settings.delayMs) || 0));
    if (!fired) hoverTimer = handle;
  };

  const movedEnoughToRearm = (event: MouseEvent): boolean => {
    if (!hoverAnchor) return true;
    const dx = (Number(event.clientX) || 0) - hoverAnchor.x;
    const dy = (Number(event.clientY) || 0) - hoverAnchor.y;
    return Math.abs(dx) + Math.abs(dy) > 6;
  };

  const onMouseMove = (event: MouseEvent) => {
    const source = findSource(event.target);
    if (event.altKey) {
      if (hoverMode === "alt" && source === hovered) return;
      clearHover();
      if (source) {
        hovered = source;
        hoverMode = "alt";
        source.classList.add(HOVER_CLASS);
      }
      return;
    }

    if (!getHoverSettings().enabled) {
      clearHover();
      return;
    }
    if (hoverMode === "auto" && source === hovered) {
      // Keep the newest pointer position for the geometry check, but restart
      // the dwell timer only after meaningful movement. Hovering must mean
      // resting on a paragraph, not merely entering it.
      hoverPoint = { x: Number(event.clientX) || 0, y: Number(event.clientY) || 0 };
      if (!movedEnoughToRearm(event)) return;
    }
    clearHover();
    if (source) armAutoHover(source, event);
  };

  const onMouseLeave = () => clearHover();

  const onScroll = () => clearHover();

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

  const retryBlockOf = (target: EventTarget | null): { block: HTMLElement; source: HTMLElement } | null => {
    const block = elementOf(target as Node | null)?.closest?.(RETRY_SELECTOR) as HTMLElement | null;
    if (!block) return null;
    const source = block.previousElementSibling as HTMLElement | null;
    if (!source?.matches?.(SOURCE_SELECTOR)) return null;
    return { block, source };
  };

  const retryIfRequested = (event: Event): boolean => {
    const retry = retryBlockOf(event.target);
    if (!retry) return false;
    // Let the reader select and copy error text without retrying.
    const selection = getSelection();
    if (selection?.rangeCount && !selection.isCollapsed) return false;
    event.preventDefault();
    event.stopPropagation();
    clearHover();
    hidePopup();
    invokeParagraph(host, retry.source);
    return true;
  };

  const onClick = (event: MouseEvent) => {
    if (retryIfRequested(event)) return;
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

    if ((event.key === "Enter" || event.key === " ") && retryIfRequested(event)) {
      return;
    }

    const shortcut = getShortcutSettings();
    if (!shortcut.enabled || !shortcut.spec || event.repeat) return;
    if (!matchesShortcut(event, shortcut.spec)) return;
    const target = elementOf(event.target as Node);
    if (target?.closest(`.${POPUP_CLASS}`)) return;

    let source = hovered && hovered.isConnected ? hovered : null;
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
    if (hoverMode === "auto") clearHover();
  };

  const onWindowBlur = () => clearHover();

  doc.addEventListener("mousemove", onMouseMove, true);
  doc.addEventListener("mouseleave", onMouseLeave, true);
  doc.addEventListener("mouseup", onMouseUp, true);
  doc.addEventListener("click", onClick, true);
  doc.addEventListener("keydown", onKeyDown, true);
  doc.addEventListener("mousedown", onMouseDown, true);
  doc.addEventListener("scroll", onScroll, true);
  try {
    win?.addEventListener?.("blur", onWindowBlur);
  } catch (_) {
    // Detached test documents have no window.
  }

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
      doc.removeEventListener("scroll", onScroll, true);
      try {
        win?.removeEventListener?.("blur", onWindowBlur);
      } catch (_) {
        // The iframe may already be gone.
      }
    },
  };
}
