import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGoogleQuery,
  normalizeGoogleEndpoint,
  parseGoogleResponse,
} from "../src/providers/googleProtocol.ts";

test("normalizeGoogleEndpoint fills the default and the translate_a/single path", () => {
  assert.equal(
    normalizeGoogleEndpoint(""),
    "https://translate.googleapis.com/translate_a/single",
  );
  assert.equal(
    normalizeGoogleEndpoint("translate.googleapis.com"),
    "https://translate.googleapis.com/translate_a/single",
  );
  assert.equal(
    normalizeGoogleEndpoint("https://mirror.example.com/"),
    "https://mirror.example.com/translate_a/single",
  );
  assert.equal(
    normalizeGoogleEndpoint("http://127.0.0.1:8080"),
    "http://127.0.0.1:8080/translate_a/single",
  );
  assert.equal(
    normalizeGoogleEndpoint("https://mirror.example.com/translate_a/single"),
    "https://mirror.example.com/translate_a/single",
  );
});

test("buildGoogleQuery encodes source, target and text", () => {
  const query = buildGoogleQuery({
    source: "auto",
    target: "zh-CN",
    text: "Hello world & 你好",
  });
  const params = new URLSearchParams(query);
  assert.equal(params.get("client"), "gtx");
  assert.equal(params.get("sl"), "auto");
  assert.equal(params.get("tl"), "zh-CN");
  assert.equal(params.get("dt"), "t");
  assert.equal(params.get("q"), "Hello world & 你好");
});

test("buildGoogleQuery keeps batch markers intact", () => {
  const text = "[[BRSEG_0000]]\nFirst paragraph.\n\n[[BRSEG_0001]]\nSecond.";
  const params = new URLSearchParams(
    buildGoogleQuery({ source: "auto", target: "zh-CN", text }),
  );
  assert.equal(params.get("q"), text);
});

test("parseGoogleResponse joins every translated segment", () => {
  const payload = [
    [
      ["你好", "Hello", null, null, 10],
      ["世界", " world", null, null, 10],
    ],
    null,
    "en",
  ];
  assert.equal(parseGoogleResponse(payload), "你好世界");
});

test("parseGoogleResponse rejects malformed payloads and empty text", () => {
  assert.equal(parseGoogleResponse(undefined), null);
  assert.equal(parseGoogleResponse(null), null);
  assert.equal(parseGoogleResponse({}), null);
  assert.equal(parseGoogleResponse([[]]), null);
  assert.equal(parseGoogleResponse([[["", "Hello"]]]), null);
  assert.equal(parseGoogleResponse([["not-a-segment"]]), null);
});

import {
  buildOpenAIRequestBody,
  extractOpenAIContent,
  extractOpenAIErrorDetail,
  getXhrResponseBody,
  normalizeChatCompletionsEndpoint,
} from "../src/providers/openaiProtocol.ts";

test("normalizeChatCompletionsEndpoint accepts base URLs and full URLs", () => {
  assert.equal(normalizeChatCompletionsEndpoint(""), "");
  assert.equal(
    normalizeChatCompletionsEndpoint("api.example.com"),
    "https://api.example.com/v1/chat/completions",
  );
  assert.equal(
    normalizeChatCompletionsEndpoint("http://127.0.0.1:11434"),
    "http://127.0.0.1:11434/v1/chat/completions",
  );
  assert.equal(
    normalizeChatCompletionsEndpoint("https://api.example.com/v1"),
    "https://api.example.com/v1/chat/completions",
  );
  assert.equal(
    normalizeChatCompletionsEndpoint("https://generativelanguage.googleapis.com/v1beta/openai"),
    "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  );
  assert.equal(
    normalizeChatCompletionsEndpoint("https://api.example.com/v1/chat/completions"),
    "https://api.example.com/v1/chat/completions",
  );
});

test("buildOpenAIRequestBody emits a non-streaming chat request", () => {
  const body = buildOpenAIRequestBody({
    model: "gpt-oss:20b",
    systemPrompt: "Translate carefully.",
    text: "[[BRSEG_0000]]\nHello.",
    temperature: 0.2,
  });
  assert.equal(body.model, "gpt-oss:20b");
  assert.equal(body.temperature, 0.2);
  assert.equal(body.stream, false);
  assert.deepEqual(body.messages, [
    { role: "system", content: "Translate carefully." },
    { role: "user", content: "[[BRSEG_0000]]\nHello." },
  ]);
});

test("extractOpenAIContent reads string and array content and drops think blocks", () => {
  assert.equal(
    extractOpenAIContent({ choices: [{ message: { content: "你好" } }] }),
    "你好",
  );
  assert.equal(
    extractOpenAIContent({
      choices: [{ message: { content: [{ text: "你" }, { text: "好" }] } }],
    }),
    "你好",
  );
  assert.equal(
    extractOpenAIContent({ choices: [{ message: { content: "<think>hmm</think>答" } }] }),
    "答",
  );
  assert.equal(extractOpenAIContent({ choices: [] }), null);
  assert.equal(extractOpenAIContent({ choices: [{ message: { content: "   " } }] }), null);
});

test("extractOpenAIErrorDetail extracts API error messages and truncates them", () => {
  assert.equal(
    extractOpenAIErrorDetail(JSON.stringify({ error: { message: "invalid key" } })),
    "invalid key",
  );
  assert.equal(extractOpenAIErrorDetail({ error: { message: "offline" } }), "offline");
  const truncated = extractOpenAIErrorDetail("x".repeat(400));
  assert.equal(truncated.length, 300);
});

test("getXhrResponseBody respects the responseType before touching responseText", () => {
  assert.equal(
    getXhrResponseBody({ responseType: "text", responseText: "body", response: null }),
    "body",
  );
  assert.deepEqual(
    getXhrResponseBody({ responseType: "json", response: { ok: true } }),
    { ok: true },
  );
  assert.equal(getXhrResponseBody(null), undefined);
  const throwing = {
    responseType: "json",
    get response() {
      throw new Error("dead");
    },
  };
  assert.equal(getXhrResponseBody(throwing), undefined);
});
