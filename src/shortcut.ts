// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — keyboard shortcut parsing and matching.

export interface ShortcutSpec {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  key: string;
}

export interface ShortcutEventLike {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
}

export const DEFAULT_SHORTCUT = "Alt+Enter";

const MODIFIER_ALIASES: Record<string, "ctrl" | "alt" | "shift" | "meta"> = {
  ctrl: "ctrl",
  control: "ctrl",
  alt: "alt",
  option: "alt",
  opt: "alt",
  shift: "shift",
  meta: "meta",
  cmd: "meta",
  command: "meta",
  win: "meta",
  super: "meta",
};

const NAMED_KEYS: Record<string, string> = {
  enter: "Enter",
  return: "Enter",
  space: "Space",
  spacebar: "Space",
  arrowup: "ArrowUp",
  arrowdown: "ArrowDown",
  arrowleft: "ArrowLeft",
  arrowright: "ArrowRight",
  home: "Home",
  end: "End",
  pageup: "PageUp",
  pagedown: "PageDown",
};

function normalizeKey(token: string): string | null {
  const trimmed = token.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  // Escape stays reserved for closing the selection popup.
  if (lower === "esc" || lower === "escape") return null;
  if (NAMED_KEYS[lower]) return NAMED_KEYS[lower];
  if (/^f([1-9]|1[0-2])$/u.test(lower)) return lower.toUpperCase();
  if (/^[a-z]$/u.test(lower)) return lower.toUpperCase();
  if (/^[0-9]$/u.test(lower)) return lower;
  return null;
}

function withModifiers(spec: Pick<ShortcutSpec, "ctrl" | "alt" | "meta" | "key">): boolean {
  // A plain letter/number would hijack ordinary typing inside the reader.
  return spec.ctrl || spec.alt || spec.meta || /^F([1-9]|1[0-2])$/u.test(spec.key);
}

export function parseShortcut(value: string): ShortcutSpec | null {
  const parts = String(value || "")
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) return null;

  const spec: ShortcutSpec = {
    ctrl: false,
    alt: false,
    shift: false,
    meta: false,
    key: "",
  };

  for (let index = 0; index < parts.length; index++) {
    const token = parts[index];
    const modifier = MODIFIER_ALIASES[token.toLowerCase()];
    if (modifier) {
      if (spec[modifier]) return null;
      spec[modifier] = true;
      continue;
    }
    // The key must be the final token.
    if (index !== parts.length - 1) return null;
    const key = normalizeKey(token);
    if (!key) return null;
    spec.key = key;
  }

  if (!spec.key) return null;
  if (!withModifiers(spec)) return null;
  return spec;
}

export function formatShortcut(spec: ShortcutSpec): string {
  const parts: string[] = [];
  if (spec.ctrl) parts.push("Ctrl");
  if (spec.alt) parts.push("Alt");
  if (spec.shift) parts.push("Shift");
  if (spec.meta) parts.push("Meta");
  parts.push(spec.key);
  return parts.join("+");
}

export function normalizeShortcut(value: string, fallback = DEFAULT_SHORTCUT): string {
  const spec = parseShortcut(value);
  return spec ? formatShortcut(spec) : fallback;
}

export function isValidShortcut(value: string): boolean {
  return parseShortcut(value) !== null;
}

function normalizeEventKey(key: string): string {
  if (key === " " || key === "Spacebar") return "Space";
  const lower = key.toLowerCase();
  if (NAMED_KEYS[lower]) return NAMED_KEYS[lower];
  if (/^f([1-9]|1[0-2])$/u.test(lower)) return lower.toUpperCase();
  if (/^[a-z]$/u.test(lower)) return lower.toUpperCase();
  return key;
}

export function shortcutFromEvent(event: ShortcutEventLike): ShortcutSpec | null {
  const key = normalizeEventKey(event.key);
  if (!normalizeKey(key)) return null;
  const spec: ShortcutSpec = {
    ctrl: !!event.ctrlKey,
    alt: !!event.altKey,
    shift: !!event.shiftKey,
    meta: !!event.metaKey,
    key,
  };
  return withModifiers(spec) ? spec : null;
}

export function matchesShortcut(
  event: ShortcutEventLike,
  spec: ShortcutSpec | null | undefined,
): boolean {
  if (!spec) return false;
  if (!!event.ctrlKey !== spec.ctrl) return false;
  if (!!event.altKey !== spec.alt) return false;
  if (!!event.shiftKey !== spec.shift) return false;
  if (!!event.metaKey !== spec.meta) return false;
  return normalizeEventKey(event.key) === spec.key;
}
