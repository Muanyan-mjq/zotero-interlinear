// SPDX-License-Identifier: AGPL-3.0-or-later

export interface ToolbarButtonHandlers {
  onClick?: (event: Event, button: HTMLButtonElement) => void;
  onContextMenu?: (event: MouseEvent, button: HTMLButtonElement) => void;
}

const handlersByDocument = new WeakMap<Document, Map<string, ToolbarButtonHandlers>>();
const delegatedDocuments = new WeakSet<Document>();

function findHandlers(
  doc: Document,
  button: HTMLButtonElement,
): ToolbarButtonHandlers | null {
  const handlers = handlersByDocument.get(doc);
  if (!handlers) return null;
  for (const [className, entry] of handlers) {
    if (button.classList.contains(className)) return entry;
  }
  return null;
}

function closestButton(target: EventTarget | null): HTMLButtonElement | null {
  const element = target as Element | null;
  if (!element || typeof (element as any).closest !== "function") return null;
  return element.closest("button") as HTMLButtonElement | null;
}

function installDelegation(doc: Document): void {
  if (delegatedDocuments.has(doc)) return;
  delegatedDocuments.add(doc);

  const dispatch = (event: Event, kind: "click" | "contextmenu") => {
    const button = closestButton(event.target);
    if (!button || button.disabled) return;
    const handlers = findHandlers(doc, button);
    if (!handlers) return;

    if (kind === "click") {
      if (!handlers.onClick) return;
      event.preventDefault();
      event.stopPropagation();
      handlers.onClick(event, button);
      return;
    }

    if (!handlers.onContextMenu) return;
    event.preventDefault();
    event.stopPropagation();
    handlers.onContextMenu(event as MouseEvent, button);
  };

  doc.addEventListener("click", (event) => dispatch(event, "click"), true);
  doc.addEventListener(
    "contextmenu",
    (event) => dispatch(event, "contextmenu"),
    true,
  );
}

/**
 * Listeners attached to reader-iframe nodes from the plugin compartment are
 * unreliable in real Zotero. Register handlers once per document and dispatch
 * from document-level capture listeners instead.
 */
export function registerToolbarHandlers(
  doc: Document,
  className: string,
  handlers: ToolbarButtonHandlers,
): void {
  let registry = handlersByDocument.get(doc);
  if (!registry) {
    registry = new Map();
    handlersByDocument.set(doc, registry);
  }
  registry.set(className, handlers);
  installDelegation(doc);
}
