// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_AZURE_ENDPOINT,
  azureLanguage,
  buildAzureBody,
  buildAzureEndpoint,
  extractAzureError,
  normalizeAzureEndpoint,
  parseAzureTranslations,
} from "../src/providers/azureProtocol.ts";

test("azureLanguage maps Chinese to script subtags and omits auto", () => {
  assert.equal(azureLanguage("auto"), "");
  assert.equal(azureLanguage(""), "");
  assert.equal(azureLanguage("zh"), "zh-Hans");
  assert.equal(azureLanguage("zh-CN"), "zh-Hans");
  assert.equal(azureLanguage("zh-Hans"), "zh-Hans");
  assert.equal(azureLanguage("zh-TW"), "zh-Hant");
  assert.equal(azureLanguage("zh-HK"), "zh-Hant");
  assert.equal(azureLanguage("ja"), "ja");
});

test("normalizeAzureEndpoint accepts bare hosts, bases and full URLs", () => {
  assert.equal(normalizeAzureEndpoint(""), DEFAULT_AZURE_ENDPOINT);
  assert.equal(normalizeAzureEndpoint("api.cognitive.microsofttranslator.com"), DEFAULT_AZURE_ENDPOINT);
  assert.equal(
    normalizeAzureEndpoint("https://api.translator.azure.cn/"),
    "https://api.translator.azure.cn",
  );
  assert.equal(
    normalizeAzureEndpoint("https://api.translator.azure.cn/translate"),
    "https://api.translator.azure.cn",
  );
});

test("buildAzureEndpoint sets api-version, optional from, and required to", () => {
  const auto = new URL(buildAzureEndpoint("", "auto", "zh-CN"));
  assert.equal(auto.pathname, "/translate");
  assert.equal(auto.searchParams.get("api-version"), "3.0");
  assert.equal(auto.searchParams.get("from"), null);
  assert.equal(auto.searchParams.get("to"), "zh-Hans");

  const explicit = new URL(
    buildAzureEndpoint("https://api.translator.azure.cn", "en", "zh-TW"),
  );
  assert.equal(explicit.origin, "https://api.translator.azure.cn");
  assert.equal(explicit.searchParams.get("from"), "en");
  assert.equal(explicit.searchParams.get("to"), "zh-Hant");
});

test("buildAzureBody keeps one Text object per segment", () => {
  const texts = ["Hello\nworld", "你好，世界"];
  assert.deepEqual(JSON.parse(buildAzureBody(texts)), [
    { Text: "Hello\nworld" },
    { Text: "你好，世界" },
  ]);
});

test("parseAzureTranslations validates shape, order and count", () => {
  const payload = [
    { detectedLanguage: { language: "en" }, translations: [{ text: "你好，世界", to: "zh-Hans" }] },
    { translations: [{ text: "第二段", to: "zh-Hans" }] },
  ];
  assert.deepEqual(parseAzureTranslations(payload, 2), ["你好，世界", "第二段"]);
  assert.equal(parseAzureTranslations(payload, 1), null);
  assert.equal(parseAzureTranslations(payload, 3), null);
  assert.equal(parseAzureTranslations("not json", 1), null);
  assert.equal(parseAzureTranslations([{ translations: [{ text: "   " }] }], 1), null);
  assert.equal(parseAzureTranslations([{}], 1), null);
});

test("extractAzureError keeps code and message for the settings pane", () => {
  assert.equal(
    extractAzureError({ error: { code: 401, message: "Access denied due to invalid subscription key." } }),
    "401: Access denied due to invalid subscription key.",
  );
  assert.equal(extractAzureError({ error: { code: "400036" } }), "400036");
  assert.equal(extractAzureError({ error: { message: "Bad request" } }), "Bad request");
  assert.equal(extractAzureError({}), "");
  assert.equal(extractAzureError("plain"), "");
});
