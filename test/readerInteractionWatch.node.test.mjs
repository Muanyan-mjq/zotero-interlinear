/**
 * Regression guards for the per-paragraph trigger lifecycle.
 *
 * Zotero opens PDFs in the plain PDF view and only creates `#sdt-content`
 * once reading mode is enabled. Historically the watcher was created before
 * that happened, short-circuited forever after one failed 3-second window,
 * and the only way to enable reading mode was the full-document toolbar run.
 * The result: hover/shortcut/Alt-click never worked and every translation
 * turned into a full-document one. These assertions pin the wiring that
 * prevents that regression; they are intentionally source-level because
 * bilingualReader.ts imports the whole Zotero runtime.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (url) => readFileSync(new URL(url, import.meta.url), "utf8");
const source = read("../src/bilingualReader.ts");
const en = read("../addon/locale/en-US/addon.ftl");
const zh = read("../addon/locale/zh-CN/addon.ftl");

function body(start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + 1);
  assert.ok(from >= 0, `missing ${start}`);
  assert.ok(to > from, `missing ${end}`);
  return source.slice(from, to);
}

const watcher = () =>
  body("export function watchReaderInteractions", "function stopWatchingReaderInteractions");
const cleanup = () =>
  body("function stopWatchingReaderInteractions", "function getNoticeDocument");
const ensureReadingMode = () =>
  body("async function ensureReadingMode", "function installStyles");
const paragraphMode = () =>
  body(
    "export async function enterParagraphTranslationMode",
    "export async function toggleBilingualReading",
  );
const menu = () =>
  body("function openBilingualToolbarMenu", "const autoTranslateAttempted");

test("an already-created watcher retries instead of short-circuiting", () => {
  const fn = watcher();
  assert.doesNotMatch(fn, /interactionWatchers\.has\(reader\)\)\s*return/);
  assert.match(fn, /const existing = interactionWatchers\.get\(reader\)/);
  assert.match(fn, /tryAttachInteractions\(reader, existing\)/);
  assert.match(fn, /scheduleInteractionRetries\(reader, existing/);
});

test("late reading mode is caught by a MutationObserver, not only a 3s window", () => {
  assert.match(source, /function observeForContent\(/);
  assert.match(source, /new Observer\(/);
  assert.match(source, /childList: true, subtree: true/);
  assert.match(source, /if \(doc\.querySelector\("#sdt-content"\)\) tryAttachInteractions/);
  assert.match(source, /if \(hasReaderInteractions\(reader, doc\)\) return;/);
  assert.match(watcher(), /observeForContent\(reader, state, outerDoc\)/);
  assert.match(source, /INTERACTION_ATTACH_DELAYS_MS = \[[^\]]*10000\]/);
  // No permanent polling loop: the tail must stay bounded.
  assert.doesNotMatch(source, /INTERACTION_ATTACH_DELAYS_MS = \[[^\]]*60000/);
  assert.match(watcher(), /tryAttachInteractions\(reader, state\);/);
  assert.match(watcher(), /scheduleInteractionRetries\(reader, state, IFRAME_LOAD_RETRY_DELAYS_MS\)/);
});

test("every branch that turns reading mode on attaches the paragraph controller", () => {
  const fn = ensureReadingMode();
  const attaches = fn.match(/ensureReaderInteractions\(reader, doc\)/g) || [];
  assert.equal(attaches.length, 2, "both the ready and the newly-enabled branch must attach");
});

test("the paragraph-only entry never starts a full-document run", () => {
  const fn = paragraphMode();
  assert.match(fn, /await ensureReadingMode\(reader\)/);
  assert.match(fn, /ensureReaderInteractions\(reader, doc\)/);
  assert.doesNotMatch(fn, /prepareAndRun|start-run|dispatchToggle/);
  // Installing the alignment observer early previously broke native highlights.
  assert.doesNotMatch(fn, /observeReadingLayout/);
});

test("the shortcut bootstraps paragraph mode while still in the PDF view", () => {
  const fn = watcher();
  assert.match(fn, /onBootstrapKeyDown/);
  assert.match(fn, /isReadingModeReady\(reader\)/);
  assert.match(fn, /const spec = getShortcutSpec\(\)/);
  assert.match(fn, /matchesShortcut\(event, spec\)/);
  assert.match(fn, /void enterParagraphTranslationMode\(reader\)/);
});

test("the toolbar menu exposes the paragraph-only entry in both locales", () => {
  assert.match(menu(), /action: "paragraph-mode"/);
  assert.match(menu(), /enterParagraphTranslationMode\(reader\)/);
  assert.match(menu(), /getString\("toolbar-menu-paragraph-mode"\)/);
  assert.match(en, /^toolbar-menu-paragraph-mode = \S/m);
  assert.match(zh, /^toolbar-menu-paragraph-mode = \S/m);
});

test("cleanup disconnects observers and removes the bootstrap listener", () => {
  const fn = cleanup();
  assert.match(fn, /observer\.disconnect\(\)/);
  assert.match(fn, /removeEventListener\("load", state\.onLoad, true\)/);
  assert.match(fn, /removeEventListener\("keydown", state\.onBootstrapKeyDown, true\)/);
});

test("reader private document access is centralised in zoteroCompat", () => {
  const compat = read("../src/zoteroCompat.ts");
  assert.match(compat, /export function getSDTViewDocument/);
  assert.doesNotMatch(source, /view\?\._iframeDocument/);
  assert.match(source, /getSDTViewDocument\(view\)/);
});
