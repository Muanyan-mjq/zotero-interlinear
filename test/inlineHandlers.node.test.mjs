/**
 * Guards the settings pane and every HTML string we inject against the baseline
 * chrome CSP that Zotero plans to enable (`script-src chrome: resource:
 * moz-src:`). Inline <script> and inline event handler attributes are blocked
 * by that CSP, and the failure mode is a silently dead handler.
 *
 * See docs/dev/RESEARCH-zotero11.md.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

const ADDON_DIR = join(ROOT, "addon");
const SRC_DIR = join(ROOT, "src");

/** `onclick`, `onLoad`, `oncommand`… but not `aria-*`, `content`, `version`. */
const EVENT_ATTR = /<[a-zA-Z][^<>]*?\s(on[a-z]{3,})\s*=/g;
const INLINE_SCRIPT_TAG = /<script(?![^>]*\bsrc\s*=)[^>]*>/gi;
const JAVASCRIPT_URL = /(?:href|src|action)\s*=\s*["']?\s*javascript:/gi;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function read(file) {
  return readFileSync(file, "utf8");
}

test("addon markup has no inline event handlers, inline scripts or javascript: URLs", () => {
  const files = walk(ADDON_DIR).filter((file) => /\.(xhtml|html)$/i.test(file));
  assert.ok(files.length > 0, "expected at least one markup file under addon/");

  const offences = [];
  for (const file of files) {
    const text = read(file);
    for (const match of text.matchAll(EVENT_ATTR)) {
      offences.push(`${relative(ROOT, file)}: inline handler ${match[1]}`);
    }
    for (const match of text.matchAll(INLINE_SCRIPT_TAG)) {
      offences.push(`${relative(ROOT, file)}: inline <script> ${match[0].slice(0, 40)}`);
    }
    for (const match of text.matchAll(JAVASCRIPT_URL)) {
      offences.push(`${relative(ROOT, file)}: javascript: URL`);
    }
  }
  assert.deepEqual(offences, []);
});

test("injected HTML built in src/ has no inline handlers, inline scripts or javascript: URLs", () => {
  const files = walk(SRC_DIR).filter((file) => file.endsWith(".ts"));
  assert.ok(files.length > 0, "expected source files");

  const offences = [];
  for (const file of files) {
    const text = read(file);
    const where = relative(ROOT, file).replace(/\\/g, "/");

    for (const match of text.matchAll(EVENT_ATTR)) {
      offences.push(`${where}: inline handler ${match[1]}`);
    }
    for (const match of text.matchAll(INLINE_SCRIPT_TAG)) {
      offences.push(`${where}: inline <script> ${match[0].slice(0, 40)}`);
    }
    for (const match of text.matchAll(JAVASCRIPT_URL)) {
      offences.push(`${where}: javascript: URL`);
    }
    for (const match of text.matchAll(/setAttribute\s*\(\s*["'](on[a-z]{3,})["']/gi)) {
      offences.push(`${where}: setAttribute("${match[1]}")`);
    }
  }
  assert.deepEqual(offences, []);
});

test("the settings pane registers a bootstrap script instead of an onload attribute", () => {
  const xhtml = read(join(ADDON_DIR, "content", "preferences.xhtml"));
  assert.ok(!/\sonload\s*=/.test(xhtml), "preferences.xhtml must not carry an onload attribute");

  const hooks = read(join(SRC_DIR, "hooks.ts"));
  assert.match(hooks, /scripts:\s*\[/);
  assert.match(hooks, /content\/preferences-init\.js/);
});

test("the bootstrap script waits for the pane root before initialising", () => {
  const script = read(join(ADDON_DIR, "content", "preferences-init.js"));
  // The script runs before the markup is inserted, so a naive init would no-op.
  assert.match(script, /interlinear-settings-root/);
  assert.match(script, /onPrefsEvent/);
  assert.match(script, /setTimeout/);
});
