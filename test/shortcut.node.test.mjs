import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_SHORTCUT,
  formatShortcut,
  isValidShortcut,
  isReservedShortcut,
  matchesShortcut,
  normalizeShortcut,
  parseShortcut,
  shortcutFromEvent,
  shortcutsEqual,
} from "../src/shortcut.ts";

test("parseShortcut accepts modifiers, letters, digits and function keys", () => {
  assert.deepEqual(parseShortcut("Alt+Enter"), {
    ctrl: false,
    alt: true,
    shift: false,
    meta: false,
    key: "Enter",
  });
  assert.deepEqual(parseShortcut("ctrl+shift+t"), {
    ctrl: true,
    alt: false,
    shift: true,
    meta: false,
    key: "T",
  });
  assert.deepEqual(parseShortcut("Meta+1"), {
    ctrl: false,
    alt: false,
    shift: false,
    meta: true,
    key: "1",
  });
  assert.deepEqual(parseShortcut("F2"), {
    ctrl: false,
    alt: false,
    shift: false,
    meta: false,
    key: "F2",
  });
});

test("parseShortcut rejects unsafe or malformed combinations", () => {
  assert.equal(parseShortcut(""), null);
  assert.equal(parseShortcut("T"), null);
  assert.equal(parseShortcut("Shift+T"), null);
  assert.equal(parseShortcut("Alt+Escape"), null);
  assert.equal(parseShortcut("Alt+Alt+T"), null);
  assert.equal(parseShortcut("Alt+Enter+T"), null);
  assert.equal(parseShortcut("Alt+Unknown"), null);
  assert.equal(isValidShortcut("Ctrl+Shift+T"), true);
  assert.equal(isValidShortcut("not a shortcut"), false);
});

test("formatShortcut emits a stable modifier order", () => {
  assert.equal(
    formatShortcut({ ctrl: true, alt: true, shift: true, meta: true, key: "T" }),
    "Ctrl+Alt+Shift+Meta+T",
  );
  assert.equal(normalizeShortcut("shift+ctrl+t"), "Ctrl+Shift+T");
  assert.equal(normalizeShortcut("garbage"), DEFAULT_SHORTCUT);
});

test("matchesShortcut requires the exact key and modifier set", () => {
  const spec = parseShortcut("Ctrl+Shift+T");
  assert.equal(
    matchesShortcut({ key: "T", ctrlKey: true, shiftKey: true }, spec),
    true,
  );
  assert.equal(matchesShortcut({ key: "t", ctrlKey: true, shiftKey: true }, spec), true);
  assert.equal(matchesShortcut({ key: "T", ctrlKey: true }, spec), false);
  assert.equal(matchesShortcut({ key: "T", ctrlKey: true, shiftKey: true, altKey: true }, spec), false);
  assert.equal(matchesShortcut({ key: "Enter", altKey: true }, null), false);

  const altEnter = parseShortcut(DEFAULT_SHORTCUT);
  assert.equal(matchesShortcut({ key: "Enter", altKey: true }, altEnter), true);
  assert.equal(matchesShortcut({ key: "Enter" }, altEnter), false);
});

test("shortcutFromEvent records only safe combinations", () => {
  assert.deepEqual(
    shortcutFromEvent({ key: "t", ctrlKey: true, shiftKey: true }),
    { ctrl: true, alt: false, shift: true, meta: false, key: "T" },
  );
  assert.deepEqual(shortcutFromEvent({ key: "F4" }), {
    ctrl: false,
    alt: false,
    shift: false,
    meta: false,
    key: "F4",
  });
  assert.equal(shortcutFromEvent({ key: "t" }), null);
  assert.equal(shortcutFromEvent({ key: "Escape" }), null);
  assert.equal(shortcutFromEvent({ key: "Control", ctrlKey: true }), null);
});

test("shortcutsEqual compares modifiers exactly", () => {
  assert.equal(shortcutsEqual("Alt+Shift+T", "Alt+Shift+T"), true);
  assert.equal(shortcutsEqual("Alt+Shift+T", "Alt+T"), false);
  assert.equal(shortcutsEqual("Ctrl+Enter", "Ctrl+Shift+Enter"), false);
  assert.equal(shortcutsEqual("nope", "Ctrl+Enter"), false);
});

test("isReservedShortcut only flags common primary-modifier shortcuts", () => {
  for (const value of ["Ctrl+C", "Cmd+V", "Ctrl+Shift+T", "Meta+S"]) {
    assert.equal(isReservedShortcut(value), true, value);
  }
  for (const value of ["Alt+Shift+T", "Ctrl+Alt+Enter", "F8", "Alt+Enter"]) {
    assert.equal(isReservedShortcut(value), false, value);
  }
});
