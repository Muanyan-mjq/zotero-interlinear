// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — the single place that touches Zotero's reader internals.
//
// Everything here reads private, undocumented properties of Zotero's reader
// (`_internalReader`, `_primarySDTView`, `_secondarySDTView`, `_readers`,
// `_iframeWindow`, `_setReadingMode`, `_handleViewUpdate`). They exist in
// Zotero 10.0.8 and in the Zotero 11 dev build (see
// docs/dev/RESEARCH-zotero11.md), but they can be renamed without notice, so:
//
// - every access is defensive (optional chaining + try/catch where a window may
//   already be gone),
// - callers must not read these fields directly,
// - when a symbol moves, this file is the only place to change.
//
// Version-sensitive notes are kept next to each accessor.

/** `reader._internalReader` is the reader view object; older builds return it directly. */
export function getInternalReader(reader: any): any {
  return reader?._internalReader || reader;
}

/** Zotero tracks which of the two SDT views is active in `_lastViewPrimary`. */
export function isPrimaryView(internal: any): boolean {
  if (!internal) return true;
  return internal._lastViewPrimary !== false || !internal._secondaryView;
}

/** The SDT (reading mode) view that currently has focus. */
export function getActiveSDTView(reader: any): any {
  const internal = getInternalReader(reader);
  if (!internal) return null;
  return isPrimaryView(internal) ? internal._primarySDTView : internal._secondarySDTView;
}

/** Both SDT views, primary first; `null` entries are dropped. */
export function getSDTViews(reader: any): any[] {
  const internal = getInternalReader(reader);
  if (!internal) return [];
  return [internal._primarySDTView, internal._secondarySDTView].filter(Boolean);
}

/**
 * Turn reading mode on/off. Returns false when the build does not expose
 * `_setReadingMode` (the caller reports "reading mode unsupported").
 */
export async function setReadingMode(reader: any, enabled: boolean): Promise<boolean> {
  const internal = getInternalReader(reader);
  if (!internal || typeof internal._setReadingMode !== "function") return false;
  const primary = isPrimaryView(internal);
  await internal._setReadingMode(primary, enabled);
  return true;
}

/**
 * Re-run the reader's own layout pass after we insert or remove blocks.
 * Returns false when the build has no `_handleViewUpdate`, so callers can fall
 * back to a synthetic resize.
 */
export function refreshSDTView(view: any): boolean {
  if (typeof view?._handleViewUpdate !== "function") return false;
  view._handleViewUpdate(true);
  return true;
}

/** `Zotero.Reader._readers` is the live reader registry used for reconciliation. */
export function getReaders(): any[] {
  try {
    return (((Zotero.Reader as any)?._readers || []) as any[]).slice();
  } catch (_) {
    return [];
  }
}

/** The reader's outer (toolbar) window, if it is still alive. */
export function getReaderFrameWindow(reader: any): any | null {
  try {
    return reader?._iframeWindow || null;
  } catch (_) {
    return null;
  }
}

/** The reader's outer document (toolbar, popups), if it is still alive. */
export function getReaderFrameDocument(reader: any): Document | null {
  try {
    return (reader?._iframeWindow?.document as Document) || null;
  } catch (_) {
    return null;
  }
}

/** The document hosted by an SDT view. */
export function getSDTViewDocument(view: any): Document | null {
  try {
    return view?._iframeDocument || view?._iframe?.contentDocument || null;
  } catch (_) {
    return null;
  }
}
