// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — keep two split Reading Mode panes on the same paragraph.

const TRANSLATION_CLASS = "interlinear-translation";

const SOURCE_SELECTOR = [
  "p[data-ref-path]",
  "h1[data-ref-path]",
  "h2[data-ref-path]",
  "h3[data-ref-path]",
  "h4[data-ref-path]",
  "h5[data-ref-path]",
  "h6[data-ref-path]",
  "li[data-ref-path]",
  "figcaption[data-ref-path]",
  "aside.sdt-note[data-ref-path]",
].join(",");

export interface ScrollSyncAnchor {
  refPath: string;
  top: number;
  height: number;
}

export interface ScrollAnchorPick {
  refPath: string;
  progress: number;
}

export interface ScrollSyncHandle {
  start(): void;
  stop(): void;
  dispose(): void;
  resync(from?: Document): void;
}

export interface ScrollSyncOptions {
  suppressionMs?: number;
}

/**
 * Pick the anchor that crosses the viewport top: the first block still
 * visible. `progress` is how far the viewport top sits inside that block.
 */
export function pickScrollAnchor(
  anchors: readonly ScrollSyncAnchor[],
): ScrollAnchorPick | null {
  for (const anchor of anchors) {
    if (anchor.height <= 0) continue;
    if (anchor.top + anchor.height <= 0) continue;
    const progress = Math.min(1, Math.max(0, -anchor.top / anchor.height));
    return { refPath: anchor.refPath, progress };
  }
  return null;
}

/** Scroll position in the peer that reproduces `progress` inside `target`. */
export function targetScrollTop(
  scrollTop: number,
  target: { top: number; height: number },
  progress: number,
): number {
  if (target.height <= 0) return Math.max(0, scrollTop);
  return Math.max(0, scrollTop + target.top + progress * target.height);
}

interface AnchorEntry {
  source?: HTMLElement;
  block?: HTMLElement;
}

interface DocState {
  doc: Document;
  entries: Map<string, AnchorEntry>;
  order: string[];
  onScroll: (() => void) | null;
  frame: number;
}

function getWindow(doc: Document): any {
  try {
    return doc.defaultView;
  } catch (_) {
    return null;
  }
}

function getScrollTop(doc: Document): number {
  const win = getWindow(doc);
  const host = doc.scrollingElement as HTMLElement | null;
  const value = Number(win?.scrollY ?? host?.scrollTop ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function setScrollTop(doc: Document, value: number): void {
  const win = getWindow(doc);
  try {
    win?.scrollTo?.(0, value);
  } catch (_) {
    // Some Gecko documents expose scrollTop only.
  }
  const host = doc.scrollingElement as HTMLElement | null;
  if (host && Math.abs((host.scrollTop || 0) - value) > 1) {
    try {
      host.scrollTop = value;
    } catch (_) {
      // The pane may be tearing down.
    }
  }
}

function collectAnchors(doc: Document): {
  entries: Map<string, AnchorEntry>;
  order: string[];
} {
  const entries = new Map<string, AnchorEntry>();
  const order: string[] = [];
  const content = doc.querySelector("#sdt-content");
  if (!content) return { entries, order };

  const entryFor = (refPath: string): AnchorEntry => {
    let entry = entries.get(refPath);
    if (!entry) {
      entry = {};
      entries.set(refPath, entry);
      order.push(refPath);
    }
    return entry;
  };

  for (const node of Array.from(content.querySelectorAll(SOURCE_SELECTOR))) {
    const element = node as HTMLElement;
    const refPath = element.dataset.refPath;
    if (!refPath) continue;
    entryFor(refPath).source = element;
  }
  for (const node of Array.from(content.querySelectorAll("[data-source-ref-path]"))) {
    const element = node as HTMLElement;
    const refPath = element.dataset.sourceRefPath;
    if (!refPath) continue;
    if (!element.classList.contains(TRANSLATION_CLASS)) continue;
    entryFor(refPath).block = element;
  }

  return { entries, order };
}

function visibleElement(entry: AnchorEntry | undefined): HTMLElement | null {
  if (!entry) return null;
  for (const element of [entry.source, entry.block]) {
    if (!element?.isConnected) continue;
    const rect = element.getBoundingClientRect();
    if (rect.height > 0 && rect.width > 0) return element;
  }
  return null;
}

function measure(doc: Document): ScrollSyncAnchor[] {
  const { entries, order } = collectAnchors(doc);
  const anchors: ScrollSyncAnchor[] = [];
  for (const refPath of order) {
    const element = visibleElement(entries.get(refPath));
    if (!element) continue;
    const rect = element.getBoundingClientRect();
    anchors.push({ refPath, top: rect.top, height: rect.height });
  }
  return anchors;
}

function findPeerElement(state: DocState, refPath: string): HTMLElement | null {
  let index = state.order.indexOf(refPath);
  if (index === -1 || !state.order.length) {
    // Mirrored blocks arrive over time; rebuild before giving up.
    const { entries, order } = collectAnchors(state.doc);
    state.entries = entries;
    state.order = order;
    index = order.indexOf(refPath);
  }
  if (index === -1) {
    // The peer may lack this exact paragraph (untranslated or filtered out);
    // anchor on the nearest preceding block instead of jumping to the top.
    for (let i = state.order.length - 1; i >= 0; i -= 1) {
      const element = visibleElement(state.entries.get(state.order[i]));
      if (!element) continue;
      const targetRect = element.getBoundingClientRect();
      if (targetRect.bottom <= 0) continue;
      return element;
    }
    return null;
  }
  for (let i = index; i >= 0; i -= 1) {
    const element = visibleElement(state.entries.get(state.order[i]));
    if (element) return element;
  }
  for (let i = index + 1; i < state.order.length; i += 1) {
    const element = visibleElement(state.entries.get(state.order[i]));
    if (element) return element;
  }
  return null;
}

export function createScrollSync(
  docs: Document[],
  options: ScrollSyncOptions = {},
): ScrollSyncHandle {
  const suppressionMs = options.suppressionMs ?? 80;
  const lastWrite = new WeakMap<Document, number>();
  const states: DocState[] = docs.map((doc) => ({
    doc,
    entries: new Map(),
    order: [],
    onScroll: null,
    frame: 0,
  }));
  let started = false;

  const syncTo = (peer: DocState, pick: ScrollAnchorPick): void => {
    // Rebuild when the ref is unknown: mirrored blocks arrive over time.
    if (!peer.order.length || !peer.entries.has(pick.refPath)) {
      const { entries, order } = collectAnchors(peer.doc);
      peer.entries = entries;
      peer.order = order;
    }
    const element = findPeerElement(peer, pick.refPath);
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const target = targetScrollTop(getScrollTop(peer.doc), rect, pick.progress);
    if (Math.abs(target - getScrollTop(peer.doc)) <= 1) return;
    lastWrite.set(peer.doc, Date.now());
    setScrollTop(peer.doc, target);
  };

  const syncFrom = (source: DocState): void => {
    const pick = pickScrollAnchor(measure(source.doc));
    if (!pick) return;
    for (const peer of states) {
      if (peer === source) continue;
      syncTo(peer, pick);
    }
  };

  const schedule = (state: DocState): void => {
    const win = getWindow(state.doc);
    if (typeof win?.requestAnimationFrame !== "function") {
      syncFrom(state);
      return;
    }
    if (state.frame) return;
    state.frame = win.requestAnimationFrame(() => {
      state.frame = 0;
      syncFrom(state);
    });
  };

  const attach = (state: DocState): void => {
    if (state.onScroll) return;
    const handler = () => {
      const written = lastWrite.get(state.doc);
      if (written && Date.now() - written < suppressionMs) return;
      schedule(state);
    };
    state.onScroll = handler;
    try {
      state.doc.addEventListener("scroll", handler, true);
    } catch (_) {
      // A destroyed iframe cannot listen.
    }
  };

  const detach = (state: DocState): void => {
    if (!state.onScroll) return;
    try {
      state.doc.removeEventListener("scroll", state.onScroll, true);
    } catch (_) {
      // Already gone.
    }
    state.onScroll = null;
  };

  return {
    start() {
      if (started) return;
      started = true;
      for (const state of states) attach(state);
      if (states.length) syncFrom(states[0]);
    },
    stop() {
      started = false;
      for (const state of states) {
        detach(state);
        const win = getWindow(state.doc);
        if (state.frame) {
          try {
            win?.cancelAnimationFrame?.(state.frame);
          } catch (_) {
            // Ignore a torn-down window.
          }
          state.frame = 0;
        }
      }
    },
    dispose() {
      this.stop();
      states.length = 0;
    },
    resync(from?: Document) {
      const source = states.find((state) => state.doc === from) || states[0];
      if (source) syncFrom(source);
    },
  };
}