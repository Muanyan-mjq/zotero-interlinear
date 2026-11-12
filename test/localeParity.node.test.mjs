// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — keeps the two Fluent bundles in step and pins the wording of
// the failure advice, which is the only place users learn what to try next.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const LOCALES = ["en-US", "zh-CN"];

function localePath(locale) {
  return fileURLToPath(new URL(`../addon/locale/${locale}/addon.ftl`, import.meta.url));
}

/**
 * Fluent messages start at column 0 as `key = value`; indented lines are either
 * continuations or attributes (`.attr = …`) and are folded into the value of the
 * message above them so a multi-line message is not mistaken for a new key.
 */
function parseMessages(source) {
  const messages = new Map();
  const duplicates = [];
  let current = null;
  for (const line of source.split(/\r?\n/u)) {
    if (!line.trim() || line.startsWith("#")) continue;
    const match = /^([A-Za-z][A-Za-z0-9-]*)\s*=\s*(.*)$/u.exec(line);
    if (match) {
      const [, key, value] = match;
      if (messages.has(key)) duplicates.push(key);
      current = key;
      messages.set(key, value);
      continue;
    }
    if (current && /^\s+/u.test(line)) {
      messages.set(current, `${messages.get(current)} ${line.trim()}`);
    }
  }
  return { messages, duplicates };
}

function load() {
  return Object.fromEntries(
    LOCALES.map((locale) => [locale, parseMessages(readFileSync(localePath(locale), "utf8"))]),
  );
}

const { "en-US": en, "zh-CN": zh } = load();

test("both bundles define the same message ids", () => {
  assert.deepEqual(en.duplicates, [], "en-US must not define a message twice");
  assert.deepEqual(zh.duplicates, [], "zh-CN must not define a message twice");

  const enKeys = [...en.messages.keys()].sort();
  const zhKeys = [...zh.messages.keys()].sort();
  assert.deepEqual(
    zhKeys.filter((key) => !en.messages.has(key)),
    [],
    "zh-CN has ids that en-US lacks",
  );
  assert.deepEqual(
    enKeys.filter((key) => !zh.messages.has(key)),
    [],
    "en-US has ids that zh-CN lacks",
  );
  assert.equal(enKeys.length, zhKeys.length);
});

test("no message is left empty in either language", () => {
  for (const locale of LOCALES) {
    const bundle = locale === "en-US" ? en : zh;
    const empty = [...bundle.messages.entries()]
      .filter(([, value]) => !value.trim())
      .map(([key]) => key);
    assert.deepEqual(empty, [], `${locale} has empty messages`);
  }
});

// The paused paragraph is the only feedback a user gets when a run gives up on
// its own, so it must carry the same remedies as the transient network hints:
// check the proxy/TUN layer, check the endpoint, or change backend.
const PAUSED_ADVICE = {
  "en-US": [/system proxy|TUN/iu, /endpoint/iu, /another translation backend/iu, /retry/iu],
  "zh-CN": [/系统代理|TUN/u, /端点/u, /其他翻译后端/u, /重试/u],
};

test("the paused paragraph gives the same advice as the network hints", () => {
  for (const locale of LOCALES) {
    const bundle = locale === "en-US" ? en : zh;
    const paused = bundle.messages.get("paragraph-paused");
    assert.ok(paused, `${locale} is missing paragraph-paused`);
    for (const pattern of PAUSED_ADVICE[locale]) {
      assert.match(paused, pattern, `${locale} paragraph-paused should mention ${pattern}`);
    }
  }
});

test("the failure hints are actually translated", () => {
  const hints = [...en.messages.keys()].filter((key) => key.startsWith("network-hint-"));
  assert.ok(hints.length >= 10, "the network hints should still be there");
  for (const key of hints) {
    assert.notEqual(
      zh.messages.get(key),
      en.messages.get(key),
      `${key} is identical in both languages, so it was never translated`,
    );
  }
});
