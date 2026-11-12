// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_GOOGLE_MIRRORS,
  buildCustomURL,
  parseMirrorList,
  readResultPath,
} from "../src/utils/freeEndpoint.ts";

test("parseMirrorList normalises, deduplicates and caps hosts", () => {
  assert.deepEqual(
    parseMirrorList("translate.google.com\nhttps://worker.example.com/, translate.google.com;;"),
    ["https://translate.google.com", "https://worker.example.com"],
  );
  assert.deepEqual(parseMirrorList(""), []);
  assert.equal(parseMirrorList(`https://worker.example.com/translate_a/t/`)[0],
    "https://worker.example.com/translate_a/t");
  const many = Array.from({ length: 12 }, (_, i) => `https://host${i}.example.com`).join("\n");
  assert.equal(parseMirrorList(many).length, MAX_GOOGLE_MIRRORS);
});

test("buildCustomURL requires the text placeholder and URL-encodes every value", () => {
  const template =
    "https://api.example.com/get?q={text}&langpair={from}|{to}&x=1";
  const url = buildCustomURL(template, { text: "hello world & more", from: "en", to: "zh-CN" });
  assert.equal(
    url,
    "https://api.example.com/get?q=hello%20world%20%26%20more&langpair=en|zh-CN&x=1",
  );
  assert.equal(buildCustomURL("https://api.example.com/get?q=fixed", {
    text: "a", from: "en", to: "zh",
  }), null, "a template without the text placeholder would misalign paragraphs");
  assert.equal(buildCustomURL("", { text: "a", from: "en", to: "zh" }), null);
  // A bare host is upgraded to https so it can be checked by the endpoint policy.
  assert.match(
    buildCustomURL("api.example.com/get?q={text}", { text: "a", from: "en", to: "zh" }),
    /^https:\/\//u,
  );
});

test("readResultPath handles nested objects, arrays, plain text and missing data", () => {
  const myMemory = { responseData: { translatedText: "你好" } };
  assert.equal(readResultPath(myMemory, "responseData.translatedText"), "你好");
  const youdao = { translateResult: [[{ src: "hello", tgt: "你好" }]] };
  assert.equal(readResultPath(youdao, "translateResult.0.0.tgt"), "你好");
  assert.equal(readResultPath(JSON.stringify(myMemory), "responseData.translatedText"), "你好");
  assert.equal(readResultPath("plain translation", ""), "plain translation");
  assert.equal(readResultPath({ data: ["a", "b"] }, "data"), "ab");
  assert.equal(readResultPath(myMemory, "missing.path"), null);
  assert.equal(readResultPath({ responseData: { translatedText: "   " } }, "responseData.translatedText"), null);
  assert.equal(readResultPath("<html>blocked</html>", "responseData.translatedText"), null);
});
