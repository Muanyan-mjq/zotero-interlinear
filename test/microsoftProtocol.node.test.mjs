// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildMicrosoftBody,
  buildMicrosoftEndpoint,
  microsoftLanguage,
  parseMicrosoftTranslations,
} from "../src/providers/microsoftProtocol.ts";

test("microsoftLanguage maps the plugin's codes to Edge's script subtags", () => {
  assert.equal(microsoftLanguage("auto"), "");
  assert.equal(microsoftLanguage(""), "");
  assert.equal(microsoftLanguage("zh"), "zh-Hans");
  assert.equal(microsoftLanguage("zh-CN"), "zh-Hans");
  assert.equal(microsoftLanguage("zh-Hans"), "zh-Hans");
  assert.equal(microsoftLanguage("zh-TW"), "zh-Hant");
  assert.equal(microsoftLanguage("zh-HK"), "zh-Hant");
  assert.equal(microsoftLanguage("en"), "en");
  assert.equal(microsoftLanguage("ja"), "ja");
});

test("buildMicrosoftEndpoint omits from for auto detection and always sets to", () => {
  const auto = new URL(buildMicrosoftEndpoint("auto", "zh-CN"));
  assert.equal(auto.origin + auto.pathname, "https://edge.microsoft.com/translate/translatetext");
  assert.equal(auto.searchParams.get("from"), null);
  assert.equal(auto.searchParams.get("to"), "zh-Hans");
  assert.equal(auto.searchParams.get("isEnterpriseClient"), "false");

  const explicit = new URL(buildMicrosoftEndpoint("ja", "zh-TW"));
  assert.equal(explicit.searchParams.get("from"), "ja");
  assert.equal(explicit.searchParams.get("to"), "zh-Hant");

  const custom = buildMicrosoftEndpoint("en", "de", "https://mirror.example.com/translate?x=1");
  assert.match(custom, /^https:\/\/mirror\.example\.com\/translate\?x=1&from=en&to=de/u);
});

test("buildMicrosoftBody keeps one JSON string per segment", () => {
  const texts = ["Hello\nworld", "你好，世界"];
  assert.deepEqual(JSON.parse(buildMicrosoftBody(texts)), texts);
});

test("parseMicrosoftTranslations validates shape, order and count", () => {
  const payload = [
    { detectedLanguage: { language: "en" }, translations: [{ text: "你好，世界" }] },
    { translations: [{ text: "第二段" }] },
  ];
  assert.deepEqual(parseMicrosoftTranslations(payload, 2), ["你好，世界", "第二段"]);
  assert.equal(parseMicrosoftTranslations(payload, 1), null, "a short answer would misalign paragraphs");
  assert.equal(parseMicrosoftTranslations(payload, 3), null);
  assert.equal(parseMicrosoftTranslations("not json", 1), null);
  assert.equal(parseMicrosoftTranslations([{ translations: [{ text: "   " }] }], 1), null);
  assert.equal(parseMicrosoftTranslations([{}], 1), null);
});
