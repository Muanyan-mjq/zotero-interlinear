import { cleanupBilingualReader, renderBilingualToolbarButtons } from "./bilingualReader";
import { cleanupReaderUI, renderReaderExportButton } from "./readerUI";
import { config } from "../package.json";
import { logError } from "./utils/log";
import { getReaderFrameDocument, getReaders } from "./zoteroCompat";

const PLUGIN_ID = config.addonID;
const STARTUP_RECONCILE_DELAYS_MS = [250, 1000, 3000];

type ToolbarRenderer = (event: any) => void;

const toolbarRenderers: ToolbarRenderer[] = [
  renderBilingualToolbarButtons,
  renderReaderExportButton,
];

let registered = false;
let reconcileTimeouts: ReturnType<typeof setTimeout>[] = [];

function applyToolbarSectionLayout(section: HTMLElement): void {
  // Never inherit Zotero's generic ".section" layout rules here. Some Zotero
  // 10 builds/themes apply a vertical layout to that class, which can stack our
  // toolbar buttons. Keep our container fully namespaced and explicit.
  section.classList.remove("section");
  section.classList.add("interlinear-toolbar-section");
  section.style.display = "inline-flex";
  section.style.flexDirection = "row";
  section.style.alignItems = "center";
  section.style.flexWrap = "nowrap";
  section.style.flexShrink = "0";
  section.style.whiteSpace = "nowrap";
  section.style.gap = "0";
  section.style.overflow = "visible";
}

function getOrCreateToolbarSection(doc: Document, container: Element): HTMLElement {
  let section = container.querySelector(
    ".interlinear-toolbar-section",
  ) as HTMLElement | null;

  if (!section) {
    section = doc.createElement("div");
    container.append(section);
  }

  applyToolbarSectionLayout(section);
  return section;
}

/**
 * Zotero's renderToolbar append clones nodes into the reader iframe with
 * Components.utils.cloneInto(). Clones lose event listeners and can lose child
 * nodes, which made the toolbar buttons inert and icon-less in real Zotero.
 * Append our controls directly to the toolbar container instead.
 */
export function resolveToolbarAppend(
  event: any,
): ((...elements: HTMLElement[]) => void) | null {
  const doc = event?.doc as Document | undefined;
  const container = doc?.querySelector?.(".toolbar .custom-sections") || null;
  if (doc && container) {
    return (...elements: HTMLElement[]) => {
      if (!elements.length) return;
      getOrCreateToolbarSection(doc, container).append(...elements);
    };
  }
  return typeof event?.append === "function" ? event.append : null;
}

/** Catch readers whose toolbar mounted before plugin installation/startup. */
export function reconcileReaderToolbars(): void {
  const readers = getReaders();
  for (const reader of readers) {
    try {
      if (reader.type !== "pdf" || reader._isUninitialized) continue;
      const doc = getReaderFrameDocument(reader) as Document | undefined;
      if (!doc?.querySelector(".toolbar .custom-sections")) continue;

      renderReaderToolbar({ reader, doc });
    } catch (error) {
      // A reader can close or replace its iframe while being inspected.
      logError(error as Error);
    }
  }
}

function clearStartupReconcileTimeouts(): void {
  for (const timeout of reconcileTimeouts) clearTimeout(timeout);
  reconcileTimeouts = [];
}

function scheduleStartupReconcile(): void {
  clearStartupReconcileTimeouts();

  // One immediate pass handles already-open readers. A few bounded retries
  // cover restored/slow readers without keeping a permanent polling loop alive.
  reconcileReaderToolbars();
  reconcileTimeouts = STARTUP_RECONCILE_DELAYS_MS.map((delay) =>
    setTimeout(() => {
      if (registered) reconcileReaderToolbars();
    }, delay),
  );
}

/**
 * Render every Interlinear control from one Zotero Reader listener.
 *
 * Zotero dispatches Reader listeners synchronously without isolating exceptions.
 * Keeping our controls in one listener removes ordering dependencies, while the
 * per-control guard prevents one optional control from hiding the other icons.
 */
function resolveReaderDocument(event: any): Document | null {
  try {
    const doc = getReaderFrameDocument(event?.reader) as Document | undefined;
    if (doc) return doc;
  } catch (_) {
    // The reader window can disappear while its event is still being handled.
  }
  return (event?.doc as Document | undefined) || null;
}

export function renderReaderToolbar(event: any): void {
  const doc = resolveReaderDocument(event);
  const withDoc = doc && doc !== event?.doc ? { ...event, doc } : event;
  const append = resolveToolbarAppend(withDoc);
  const target = append ? { ...withDoc, append } : withDoc;
  for (const render of toolbarRenderers) {
    try {
      render(target);
    } catch (error) {
      logError(error as Error);
    }
  }
}

function cleanupReader(reader: any): void {
  for (const cleanup of [cleanupReaderUI, cleanupBilingualReader]) {
    try {
      cleanup(reader);
    } catch (error) {
      logError(error as Error);
    }
  }
}

export function registerReaderToolbar(): void {
  if (registered) return;
  Zotero.Reader.registerEventListener("renderToolbar", renderReaderToolbar, PLUGIN_ID);
  registered = true;
  scheduleStartupReconcile();
}

export function unregisterReaderToolbar(): void {
  clearStartupReconcileTimeouts();

  if (registered) {
    Zotero.Reader.unregisterEventListener("renderToolbar", renderReaderToolbar);
    registered = false;
  }

  const readers = getReaders();
  for (const reader of readers) {
    cleanupReader(reader);
    try {
      getReaderFrameDocument(reader)?.querySelector(".interlinear-toolbar-section")?.remove();
    } catch (_) {
      // The reader may already have closed.
    }
  }
}
