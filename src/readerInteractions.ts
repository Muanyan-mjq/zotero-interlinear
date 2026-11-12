// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — reader selection popup and per-paragraph triggers.

import { getString } from "./utils/locale";
import { openReaderMenu } from "./readerMenu";
import { DEFAULT_SHORTCUT, matchesShortcut, parseShortcut, type ShortcutSpec } from "./shortcut";
import { logError } from "./utils/log";

const SOURCE_SELECTOR = "[data-ref-path]";
const TRANSLATION_CLASS = "interlinear-translation";
const RETRY_SELECTOR = `.${TRANSLATION_CLASS}[data-state="error"], .${TRANSLATION_CLASS}[data-state="paused"]`;
const POPUP_CLASS = "interlinear-selection-popup";
/** Alt-hover outline marking the paragraph that Alt+click will translate. */
const HOVER_CLASS = "interlinear-source-hover";

interface SelectionLike {
  toString(): string;
  isCollapsed: boolean;
  rangeCount: number;
  getRangeAt(index: number): Range;
}

export interface InteractionHost {
  translateSelection(text: string): Promise<string>;
  translateParagraph(source: HTMLElement, options?: { force?: boolean }): Promise<void>;
}

export interface InteractionOptions {
  /** Tests inject a selection because createHTMLDocument has no defaultView. */
  getSelection?: () => SelectionLike | null;
  setTimer?: (callback: () => void, delay: number) => void;
  /** Read at gesture time so settings changes apply without re-attaching. */
  getShortcutSettings?: () => { enabled: boolean; spec: ShortcutSpec | null };
  /** Width of the selection popup, read when it opens. */
  getPopupWidth?: () => number;
  getToggleShortcutSettings?: () => { enabled: boolean; spec: ShortcutSpec | null };
  getDisplayShortcutSettings?: () => { enabled: boolean; spec: ShortcutSpec | null };
  onToggleShortcut?: () => void;
  onCycleDisplayShortcut?: () => void;
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

function invokeParagraph(
  host: InteractionHost,
  source: HTMLElement,
  options?: { force?: boolean },
): void {
  const report = (error: unknown) => {
    try {
      logError(error as Error);
    } catch (_) {
      // Outside Zotero (unit harness) there is nowhere to report.
    }
  };
  try {
    void Promise.resolve(host.translateParagraph(source, options)).catch(report);
  } catch (error) {
    report(error);
  }
}

function createPopup(
  doc: Document,
  win: any,
  host: InteractionHost,
  getWidth: () => number,
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
    const width = Math.min(
      Math.max(280, Number(getWidth()) || 380),
      Math.max(280, viewportWidth - 16),
    );
    const left = Math.max(8, Math.min(rect.left || 0, viewportWidth - width - 8));
    const top = Math.max(8, Math.min((rect.bottom || 0) + 8, viewportHeight - 140));
    root.style.width = `${width}px`;
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

async function copyText(doc: Document, text: string): Promise<boolean> {
  const win: any = doc.defaultView;
  try {
    const clipboard = win?.navigator?.clipboard;
    if (clipboard) {
      await clipboard.writeText(text);
      return true;
    }
  } catch (_) {
    // Fall back to a hidden textarea + execCommand below.
  }
  try {
    const textarea = doc.createElement("textarea");
    textarea.value = text;
    textarea.style.cssText = "position:fixed;left:0;top:0;opacity:0;pointer-events:none;";
    (doc.body || doc.documentElement)?.append(textarea);
    textarea.select();
    const ok = Boolean((doc as any).execCommand?.("copy"));
    textarea.remove();
    return ok;
  } catch (_) {
    return false;
  }
}

function showCopyNotice(doc: Document, message: string): void {
  const host = doc.body || doc.documentElement;
  if (!host) return;
  const notice = doc.createElement("div");
  notice.className = "interlinear-copy-notice";
  notice.textContent = message;
  notice.style.cssText =
    "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483002;" +
    "padding:6px 12px;border-radius:6px;background:Canvas;color:CanvasText;" +
    "border:1px solid rgba(127,127,127,0.45);box-shadow:0 4px 14px rgba(0,0,0,0.25);" +
    "font-size:12px;pointer-events:none;";
  host.append(notice);
  const win: any = doc.defaultView;
  win?.setTimeout?.(() => notice.remove(), 1600);
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

  const getPopupWidth = options.getPopupWidth || (() => 380);
  const getShortcutSettings =
    options.getShortcutSettings ||
    (() => ({ enabled: true, spec: parseShortcut(DEFAULT_SHORTCUT) }));

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

  /**
   * Alt-hover only marks the paragraph; translation happens on Alt+click.
   * Hover-to-translate and the Ctrl modifier were removed at the user's
   * request, so there is no dwell timer here.
   */
  const onMouseMove = (event: MouseEvent) => {
    const source = findSource(event.target);
    if (!event.altKey) {
      clearHover();
      return;
    }
    if (hovered === source) return;
    clearHover();
    if (source) {
      hovered = source;
      source.classList.add(HOVER_CLASS);
    }
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
      popup ||= createPopup(doc, win, host, getPopupWidth);
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

  const blockContext = (
    target: EventTarget | null,
  ): { block: HTMLElement; source: HTMLElement } | null => {
    const block = elementOf(target as Node | null)?.closest?.(
      `.${TRANSLATION_CLASS}`,
    ) as HTMLElement | null;
    if (!block) return null;
    const source = block.previousElementSibling as HTMLElement | null;
    if (!source?.matches?.(SOURCE_SELECTOR)) return null;
    return { block, source };
  };

  const showBlockMenu = (event: MouseEvent) => {
    const target = blockContext(event.target);
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    clearHover();
    hidePopup();
    const { block, source } = target;
    openReaderMenu(doc, {
      x: event.clientX,
      y: event.clientY,
      entries: [
        { action: "retranslate", label: getString("block-menu-retranslate") },
        {
          action: "copy-translation",
          label: getString("block-menu-copy-translation"),
          disabled: !(block.textContent || "").trim(),
        },
        {
          action: "copy-source",
          label: getString("block-menu-copy-source"),
          disabled: !(source.textContent || "").trim(),
        },
      ],
      onSelect: (action) => {
        if (action === "retranslate") {
          invokeParagraph(host, source, { force: true });
          return;
        }
        const text =
          action === "copy-source" ? source.textContent || "" : block.textContent || "";
        void copyText(doc, text).then((ok) =>
          showCopyNotice(
            doc,
            getString(ok ? "block-menu-copied" : "block-menu-copy-failed"),
          ),
        );
      },
    });
  };

  const onContextMenu = (event: MouseEvent) => showBlockMenu(event);
  const onDoubleClick = (event: MouseEvent) => showBlockMenu(event);

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

    const toggleShortcut = options.getToggleShortcutSettings?.();
    if (
      toggleShortcut?.enabled &&
      toggleShortcut.spec &&
      matchesShortcut(event, toggleShortcut.spec)
    ) {
      event.preventDefault();
      event.stopPropagation();
      options.onToggleShortcut?.();
      return;
    }
    const displayShortcut = options.getDisplayShortcutSettings?.();
    if (
      displayShortcut?.enabled &&
      displayShortcut.spec &&
      matchesShortcut(event, displayShortcut.spec)
    ) {
      event.preventDefault();
      event.stopPropagation();
      options.onCycleDisplayShortcut?.();
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
  };

  const onWindowBlur = () => clearHover();

  doc.addEventListener("mousemove", onMouseMove, true);
  doc.addEventListener("mouseleave", onMouseLeave, true);
  doc.addEventListener("mouseup", onMouseUp, true);
  doc.addEventListener("click", onClick, true);
  doc.addEventListener("keydown", onKeyDown, true);
  doc.addEventListener("mousedown", onMouseDown, true);
  doc.addEventListener("scroll", onScroll, true);
  doc.addEventListener("contextmenu", onContextMenu, true);
  doc.addEventListener("dblclick", onDoubleClick, true);
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
      doc.removeEventListener("contextmenu", onContextMenu, true);
      doc.removeEventListener("dblclick", onDoubleClick, true);
      try {
        win?.removeEventListener?.("blur", onWindowBlur);
      } catch (_) {
        // The iframe may already be gone.
      }
    },
  };
}
