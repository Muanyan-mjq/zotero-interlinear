// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — lightweight context menu for the reader toolbar.

export interface ReaderMenuItem {
  action: string;
  label: string;
  checked?: boolean;
  disabled?: boolean;
}

export type ReaderMenuEntry = ReaderMenuItem | "separator";

export interface ReaderMenuOptions {
  x: number;
  y: number;
  entries: ReaderMenuEntry[];
  onSelect: (action: string) => void;
}

const MENU_CLASS = "interlinear-reader-menu";
const STYLE_ID = "interlinear-reader-menu-style";
const MENUS = new WeakMap<Document, () => void>();

const MENU_CSS = `
.${MENU_CLASS} {
  position: fixed;
  z-index: 2147483000;
  min-width: 196px;
  padding: 4px;
  border: 1px solid rgba(128, 128, 128, 0.45);
  border-radius: 6px;
  background: Canvas;
  color: CanvasText;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28);
  font: menu;
  font-size: 12.5px;
  line-height: 1.35;
  box-sizing: border-box;
}
.${MENU_CLASS}-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  margin: 0;
  padding: 5px 8px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: default;
}
.${MENU_CLASS}-item:hover:not(:disabled):focus-visible,
.${MENU_CLASS}-item:hover:not(:disabled) {
  background: rgba(128, 128, 128, 0.18);
}
.${MENU_CLASS}-item:disabled {
  opacity: 0.45;
}
.${MENU_CLASS}-check {
  width: 1em;
  flex: none;
  text-align: center;
}
.${MENU_CLASS}-label {
  flex: 1 1 auto;
  white-space: nowrap;
}
.${MENU_CLASS}-separator {
  height: 1px;
  margin: 4px 6px;
  background: rgba(128, 128, 128, 0.35);
}
`;

function installMenuStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = MENU_CSS;
  const target = doc.head || doc.documentElement;
  target?.append(style);
}

export function closeReaderMenu(doc?: Document | null): void {
  if (!doc) return;
  const close = MENUS.get(doc);
  if (!close) return;
  MENUS.delete(doc);
  close();
}

export function openReaderMenu(doc: Document, options: ReaderMenuOptions): HTMLElement {
  closeReaderMenu(doc);
  installMenuStyles(doc);

  const menu = doc.createElement("div");
  menu.className = MENU_CLASS;
  menu.setAttribute("role", "menu");

  for (const entry of options.entries) {
    if (entry === "separator") {
      const separator = doc.createElement("div");
      separator.className = `${MENU_CLASS}-separator`;
      separator.setAttribute("role", "separator");
      menu.append(separator);
      continue;
    }

    const button = doc.createElement("button");
    button.type = "button";
    button.className = `${MENU_CLASS}-item`;
    button.dataset.action = entry.action;
    button.setAttribute("role", "menuitem");
    button.disabled = Boolean(entry.disabled);

    const check = doc.createElement("span");
    check.className = `${MENU_CLASS}-check`;
    check.textContent = entry.checked ? "✓" : "";
    button.append(check);

    const label = doc.createElement("span");
    label.className = `${MENU_CLASS}-label`;
    label.textContent = entry.label;
    button.append(label);

    button.addEventListener("click", (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      closeReaderMenu(doc);
      options.onSelect(entry.action);
    });
    menu.append(button);
  }

  menu.style.left = `${Math.max(4, Math.round(options.x))}px`;
  menu.style.top = `${Math.max(4, Math.round(options.y))}px`;
  (doc.body || doc.documentElement)?.append(menu);

  const view = doc.defaultView;
  if (view) {
    const rect = menu.getBoundingClientRect();
    const maxLeft = Math.max(4, view.innerWidth - rect.width - 4);
    const maxTop = Math.max(4, view.innerHeight - rect.height - 4);
    menu.style.left = `${Math.min(Math.max(4, options.x), maxLeft)}px`;
    menu.style.top = `${Math.min(Math.max(4, options.y), maxTop)}px`;
  }

  const onPointerDown = (event: Event) => {
    const target = event.target as Node | null;
    if (target && menu.contains(target)) return;
    closeReaderMenu(doc);
  };
  const onKeyDown = (event: Event) => {
    if ((event as KeyboardEvent).key !== "Escape") return;
    event.preventDefault();
    closeReaderMenu(doc);
  };
  const onDismiss = () => closeReaderMenu(doc);

  doc.addEventListener("pointerdown", onPointerDown, true);
  doc.addEventListener("keydown", onKeyDown, true);
  if (view) {
    view.addEventListener("blur", onDismiss);
    view.addEventListener("resize", onDismiss);
    view.addEventListener("scroll", onDismiss, true);
  }

  MENUS.set(doc, () => {
    doc.removeEventListener("pointerdown", onPointerDown, true);
    doc.removeEventListener("keydown", onKeyDown, true);
    if (view) {
      view.removeEventListener("blur", onDismiss);
      view.removeEventListener("resize", onDismiss);
      view.removeEventListener("scroll", onDismiss, true);
    }
    menu.remove();
  });

  return menu;
}
