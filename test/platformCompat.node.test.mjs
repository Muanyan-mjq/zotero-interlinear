// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — platform / Zotero 11 compatibility probe.
//
// WHY THIS FILE EXISTS
// --------------------
// The plugin runs inside Zotero's Gecko runtime, which is cross-platform, but
// a few behaviours are platform-dependent: the OS key store (Keychain / DPAPI /
// libsecret), keyboard events on macOS (Option rewrites `event.key`), and the
// native file picker. This probe simulates those environments on any host so
// the assumptions can be checked without a Linux/macOS machine.
//
// IMPORTANT: several tests below are CHARACTERIZATION tests, not acceptance
// tests. They assert the *current* behaviour of a known gap and are named
// "已知缺陷 / 已知风险". When the gap is fixed, those expectations must be
// updated to the correct behaviour. Do not read a green run as "fully adapted".
//
// Run: node --test test/platformCompat.node.test.mjs
// (or npm run test:platform). Deliberately kept out of `test:unit` until the
// characterization cases are replaced by fixed-behaviour assertions.

import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { registerHooks } from "node:module";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (relative) => readFileSync(path.join(root, relative), "utf8");

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

// src/*.ts imports use extensionless relative specifiers (esbuild style).
// Resolve them to .ts so Node 22's type stripping can load the real modules.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !path.extname(specifier)) {
      const base = context.parentURL
        ? path.dirname(fileURLToPath(context.parentURL))
        : process.cwd();
      const candidate = path.resolve(base, `${specifier}.ts`);
      if (existsSync(candidate)) {
        return nextResolve(pathToFileURL(candidate).href, context);
      }
    }
    return nextResolve(specifier, context);
  },
});

const secrets = await import("../src/secrets.ts");
const shortcut = await import("../src/shortcut.ts");
const glossaryFiles = await import("../src/glossaryFiles.ts");
const appearanceFiles = await import("../src/appearanceFiles.ts");

/** Install a fake Zotero/ztoolkit world for one test case. */
function mockZotero({ keystore, isWin = false } = {}) {
  const prefs = new Map();
  const fileCalls = [];
  let pickerArgs = null;
  const selected = "/home/user/My Glossary/术语表.csv";

  globalThis.Zotero = {
    isWin,
    isMac: !isWin,
    logError() {},
    debug() {},
    Prefs: {
      get: (key) => prefs.get(key) ?? "",
      set: (key, value) => prefs.set(key, value),
      clear: (key) => prefs.delete(key),
    },
    OSKeyStore: keystore,
    File: {
      getContentsAsync: async (file) => {
        fileCalls.push(["read", file]);
        return "source,target\n";
      },
      putContentsAsync: async (file, text) => {
        fileCalls.push(["write", file, text]);
      },
    },
  };

  globalThis.ztoolkit = {
    FilePicker: class {
      constructor(title, mode, filters, defaultName) {
        pickerArgs = { title, mode, filters, defaultName };
      }
      async open() {
        return selected;
      }
    },
  };

  return {
    prefs,
    fileCalls,
    selected,
    pickerArgs: () => pickerArgs,
  };
}

// ---------------------------------------------------------------------------
// Zotero 11 regression guards
// ---------------------------------------------------------------------------

test("Zotero 11: manifest allows both Zotero 10 and 11 (max widened to 11.*)", () => {
  const manifest = JSON.parse(read("addon/manifest.json"));
  const range = manifest.applications.zotero;
  assert.equal(range.strict_min_version, "10.0");
  // Widened to 11.* so Zotero 10.x and 11.x (incl. stable) can both install.
  assert.equal(range.strict_max_version, "11.*");

  const built = path.join(root, ".scaffold/build/addon/manifest.json");
  if (existsSync(built)) {
    const builtRange = JSON.parse(readFileSync(built, "utf8")).applications.zotero;
    // The build replaces id/update_url placeholders, so only the version
    // range is comparable.
    assert.equal(builtRange.strict_min_version, range.strict_min_version);
    assert.equal(builtRange.strict_max_version, range.strict_max_version);
  }
});

test("Zotero 11: settings pane has no inline handlers or inline scripts (baseline CSP)", () => {
  const xhtml = read("addon/content/preferences.xhtml");
  const inlineHandlers =
    xhtml.match(
      /\son(?:load|click|command|change|input|submit|focus|blur|keyup|keydown|mousedown|mouseup|select|reset)\s*=/giu,
    ) ?? [];
  assert.deepEqual(inlineHandlers, []);
  assert.deepEqual(xhtml.match(/<script/giu) ?? [], []);
});

test("Zotero 11: preferences bootstrap uses registered scripts and waits for the pane root", () => {
  const hooks = read("src/hooks.ts");
  assert.match(hooks, /Zotero\.PreferencePanes\.register\(/u);
  assert.match(hooks, /scripts:\s*\["content\/preferences-init\.js"\]/u);

  const init = read("addon/content/preferences-init.js");
  assert.match(init, /waitForRoot/u);
  assert.match(init, /onPrefsEvent\("load"/u);
  assert.match(init, /TIMEOUT_MS\s*=/u);
});

test("Zotero 11: secret storage avoids OSKeyStore APIs removed in 11", () => {
  const source = read("src/secrets.ts");
  // The names appear in the header comment explaining the 10/11 difference;
  // only actual member calls matter.
  assert.doesNotMatch(source, /store\.(?:confirmUnencryptedFallback|_usable|_error)\b/u);
  assert.match(source, /store\.encrypt\(/u);
  assert.match(source, /store\.decrypt\(/u);
});

// ---------------------------------------------------------------------------
// Cross-platform baseline
// ---------------------------------------------------------------------------

test("src/ contains no OS branches, Windows absolute paths or .exe references", () => {
  const sources = walk(path.join(root, "src")).filter((file) => file.endsWith(".ts"));
  for (const file of sources) {
    const text = readFileSync(file, "utf8");
    assert.doesNotMatch(text, /\bZotero\.is(?:Win|Mac|Linux)\b/u, file);
    assert.doesNotMatch(text, /\bprocess\.platform\b/u, file);
    assert.doesNotMatch(text, /[A-Za-z]:\\\\/u, file);
    assert.doesNotMatch(text, /\.exe\b/iu, file);
  }
});

test("known gap: only test-review.mjs ships a macOS Zotero binary default", () => {
  const review = read("scripts/test-review.mjs");
  const gui = read("scripts/test-gui.mjs");
  const e2e = read("scripts/test-e2e.mjs");
  for (const [name, source] of [
    ["test-review", review],
    ["test-gui", gui],
    ["test-e2e", e2e],
  ]) {
    assert.match(source, /process\.platform === "win32" \? "exit \/b 0" : "true"/u, name);
  }
  assert.match(review, /process\.platform === "darwin"/u);
  // Both scripts need ZOTERO_PLUGIN_ZOTERO_BIN_PATH set manually on macOS,
  // and all three scripts have no Linux default at all.
  assert.doesNotMatch(gui, /ZOTERO_PLUGIN_ZOTERO_BIN_PATH/u);
  assert.doesNotMatch(e2e, /ZOTERO_PLUGIN_ZOTERO_BIN_PATH/u);
  assert.doesNotMatch(review, /linux/iu);
  assert.doesNotMatch(gui, /linux/iu);
  assert.doesNotMatch(e2e, /linux/iu);
});

test("e2e/gui fixtures keep POSIX paths on Linux and macOS", () => {
  for (const relative of [
    "test-e2e/providers.e2e.test.ts",
    "test-e2e/probe/probe.test.ts",
    "test-gui/capture.test.ts",
  ]) {
    const source = read(relative);
    assert.match(source, /Zotero\.isWin \? path\.replace/u, relative);
    assert.match(source, /: path;/u, relative);
  }
});

// ---------------------------------------------------------------------------
// Linux simulation: OS key store unavailable (no Secret Service)
// ---------------------------------------------------------------------------

test("Linux: missing OSKeyStore degrades to session-only and never writes plaintext", async () => {
  const { prefs } = mockZotero({ keystore: undefined });
  await secrets.initSecrets({ force: true });
  assert.equal(secrets.isKeystoreAvailable(), false);

  const key = secrets.SECRET_PREFS.openai;
  secrets.setSecret(key, "sk-linux-session-only");
  await secrets.whenSecretWritesSettled();

  assert.equal(secrets.getSecret(key), "sk-linux-session-only");
  assert.equal(secrets.getSecretStatus(key), "session");
  assert.equal(
    [...prefs.values()].some((value) => String(value).includes("sk-linux-session-only")),
    false,
  );
});

test("known defect: Linux store with available=false is still treated as usable", async () => {
  // Mozilla's OSKeyStore singleton exists on Linux even when libsecret / a
  // Secret Service is missing; the signal is `available === false`.
  const store = {
    available: false,
    encrypt: async (value) => `oskv1:${value}`,
    decrypt: async () => "",
  };
  mockZotero({ keystore: store });
  await secrets.initSecrets({ force: true });
  // getOsKeyStore() only checks for encrypt/decrypt functions, so the
  // three-way "session / plaintext" confirmation never appears in settings.
  assert.equal(secrets.isKeystoreAvailable(), true);
});

test("known defect: a rejected encrypt leaves no plaintext but is not reported as session", async () => {
  const store = {
    available: true,
    encrypt: async () => {
      throw new Error("Secret Service unavailable / Keychain locked");
    },
    decrypt: async () => "",
  };
  const { prefs } = mockZotero({ keystore: store });
  await secrets.initSecrets({ force: true });

  const key = secrets.SECRET_PREFS.openai;
  secrets.setSecret(key, "sk-encrypt-failed");
  await secrets.whenSecretWritesSettled();

  assert.equal(secrets.getSecret(key), "sk-encrypt-failed", "key stays usable in memory");
  assert.equal(
    [...prefs.values()].some((value) => String(value).includes("sk-encrypt-failed")),
    false,
    "no plaintext reaches prefs.js",
  );
  assert.equal(
    secrets.getSecretStatus(key),
    "missing",
    "current code does not mark a failed encrypted write as session-only",
  );
});

// ---------------------------------------------------------------------------
// macOS simulation: Option rewrites KeyboardEvent.key
// ---------------------------------------------------------------------------

test("macOS: the default Alt+Enter shortcut still works (Enter is not a printable key)", () => {
  const spec = shortcut.parseShortcut(shortcut.DEFAULT_SHORTCUT);
  assert.equal(
    shortcut.matchesShortcut({ key: "Enter", altKey: true }, spec),
    true,
  );
  assert.equal(shortcut.matchesShortcut({ key: "Enter", metaKey: true }, spec), false);
});

test("macOS: Option+letter shortcuts record and match via the physical key code", () => {
  // Option+T yields "†" in event.key; the physical key lives in event.code,
  // so recording and matching must not depend on the dead-key character.
  const spec = shortcut.parseShortcut("Alt+Shift+T");
  assert.equal(
    shortcut.matchesShortcut({ key: "†", altKey: true, shiftKey: true, code: "KeyT" }, spec),
    true,
  );
  assert.deepEqual(
    shortcut.shortcutFromEvent({ key: "†", altKey: true, shiftKey: true, code: "KeyT" }),
    { ctrl: false, alt: true, shift: true, meta: false, key: "T" },
  );
  // These are shipped as (disabled-by-default) extra shortcuts.
  const prefs = read("addon/prefs.js");
  assert.match(prefs, /interaction\.toggleShortcut.*Alt\+Shift\+T/u);
  assert.match(prefs, /interaction\.displayShortcut.*Alt\+Shift\+D/u);
});

test("macOS: shortcut labels use ⌘/⌥ symbols on macOS and stay parseable elsewhere", () => {
  const cmdSpec = shortcut.parseShortcut("Cmd+S");
  assert.equal(shortcut.formatShortcut(cmdSpec, { mac: true }), "⌘+S");
  const altSpec = shortcut.parseShortcut("Alt+Enter");
  assert.equal(shortcut.formatShortcut(altSpec, { mac: true }), "⌥+Enter");
  // Symbols are parseable so a re-normalised shortcut round-trips on macOS.
  assert.deepEqual(shortcut.parseShortcut("⌘+S"), cmdSpec);
  assert.deepEqual(shortcut.parseShortcut("⌥+Enter"), altSpec);
  // Non-macOS keeps textual, parseable labels.
  assert.equal(shortcut.formatShortcut(cmdSpec, { mac: false }), "Meta+S");
  const xhtml = read("addon/content/preferences.xhtml");
  assert.match(xhtml, /Alt\+Enter/u);
});

// ---------------------------------------------------------------------------
// POSIX file paths and native file picker filters
// ---------------------------------------------------------------------------

test("Linux/macOS: POSIX paths with spaces and CJK pass through untouched", async () => {
  const { fileCalls, selected } = mockZotero({ isWin: false });
  const posix = "/home/user/My Glossary/术语表.csv";

  await glossaryFiles.readGlossaryFile(posix);
  await glossaryFiles.writeGlossaryFile(posix, "source,target\n");
  assert.deepEqual(
    fileCalls.map((call) => call[1]),
    [posix, posix],
  );

  assert.equal(await glossaryFiles.pickGlossaryFile("open", "Import"), selected);
});

test("Linux/macOS: file picker filters use the cross-platform glob form", async () => {
  const { pickerArgs } = mockZotero({ isWin: false });

  await glossaryFiles.pickGlossaryFile("open", "Import");
  assert.equal(pickerArgs().filters[1][1], "*", "any file uses '*' not '*.*'");
  assert.equal(
    pickerArgs().filters[0][1],
    "*.csv *.tsv *.txt",
    "space-separated globs, no Windows ';'",
  );

  await appearanceFiles.pickAppearanceFile("save", "Export");
  assert.equal(pickerArgs().filters[1][1], "*");
  assert.equal(pickerArgs().defaultName, "interlinear-appearance.json");
});
