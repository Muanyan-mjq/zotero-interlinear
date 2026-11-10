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

import {
  buildClaudeRequestBody,
  extractClaudeContent,
  extractClaudeErrorDetail,
  normalizeClaudeEndpoint,
} from "../src/providers/claudeProtocol.ts";

test("normalizeClaudeEndpoint accepts base URLs and full messages URLs", () => {
  assert.equal(normalizeClaudeEndpoint(""), "https://api.anthropic.com/v1/messages");
  assert.equal(
    normalizeClaudeEndpoint("api.anthropic.com"),
    "https://api.anthropic.com/v1/messages",
  );
  assert.equal(
    normalizeClaudeEndpoint("https://api.anthropic.com/"),
    "https://api.anthropic.com/v1/messages",
  );
  assert.equal(
    normalizeClaudeEndpoint("https://api.anthropic.com/v1"),
    "https://api.anthropic.com/v1/messages",
  );
  assert.equal(
    normalizeClaudeEndpoint("http://127.0.0.1:8080/proxy"),
    "http://127.0.0.1:8080/proxy/v1/messages",
  );
  assert.equal(
    normalizeClaudeEndpoint("https://relay.example.com/v1/messages"),
    "https://relay.example.com/v1/messages",
  );
});

test("buildClaudeRequestBody emits a Messages API request with the system prompt", () => {
  const body = buildClaudeRequestBody({
    model: "claude-sonnet-4-5",
    systemPrompt: "Translate carefully.",
    text: "[[BRSEG_0000]]\nHello.",
    temperature: 0.2,
    maxTokens: 4096,
  });
  assert.equal(body.model, "claude-sonnet-4-5");
  assert.equal(body.max_tokens, 4096);
  assert.equal(body.temperature, 0.2);
  assert.equal(body.system, "Translate carefully.");
  assert.equal(body.stream, undefined);
  assert.deepEqual(body.messages, [
    { role: "user", content: [{ type: "text", text: "[[BRSEG_0000]]\nHello." }] },
  ]);
});

test("extractClaudeContent joins text blocks and ignores non-text blocks", () => {
  assert.equal(
    extractClaudeContent({
      content: [
        { type: "text", text: "你" },
        { type: "thinking", thinking: "hmm" },
        { type: "text", text: "好" },
      ],
    }),
    "你好",
  );
  assert.equal(extractClaudeContent({ content: [] }), null);
  assert.equal(extractClaudeContent({ content: [{ type: "tool_use" }] }), null);
  assert.equal(extractClaudeContent({ content: [{ type: "text", text: "   " }] }), null);
  assert.equal(extractClaudeContent(undefined), null);
});

test("extractClaudeErrorDetail reads Anthropic error messages and truncates them", () => {
  assert.equal(
    extractClaudeErrorDetail(
      JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "bad key" } }),
    ),
    "bad key",
  );
  assert.equal(extractClaudeErrorDetail({ error: { message: "overloaded" } }), "overloaded");
  assert.equal(extractClaudeErrorDetail("plain failure"), "plain failure");
  assert.equal(extractClaudeErrorDetail(null), "");
  assert.equal(extractClaudeErrorDetail("x".repeat(400)).length, 300);
});

import {
  buildGeminiEndpoint,
  buildGeminiRequestBody,
  extractGeminiContent,
  extractGeminiErrorDetail,
  normalizeGeminiModel,
} from "../src/providers/geminiProtocol.ts";

test("buildGeminiEndpoint composes the generateContent URL", () => {
  assert.equal(
    buildGeminiEndpoint("", "gemini-2.5-flash"),
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
  );
  assert.equal(
    buildGeminiEndpoint("https://generativelanguage.googleapis.com/", "gemini-2.5-flash"),
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
  );
  assert.equal(
    buildGeminiEndpoint("https://mirror.example.com/v1beta", "gemini-2.5-pro"),
    "https://mirror.example.com/v1beta/models/gemini-2.5-pro:generateContent",
  );
  assert.equal(
    buildGeminiEndpoint("http://127.0.0.1:8080", "models/gemini-2.5-flash"),
    "http://127.0.0.1:8080/v1beta/models/gemini-2.5-flash:generateContent",
  );
  assert.equal(
    buildGeminiEndpoint(
      "https://proxy.example.com/v1beta/models/gemini-2.5-flash:generateContent",
      "ignored",
    ),
    "https://proxy.example.com/v1beta/models/gemini-2.5-flash:generateContent",
  );
});

test("normalizeGeminiModel strips the models prefix", () => {
  assert.equal(normalizeGeminiModel("models/gemini-2.5-flash"), "gemini-2.5-flash");
  assert.equal(normalizeGeminiModel(" gemini-2.5-pro "), "gemini-2.5-pro");
  assert.equal(normalizeGeminiModel(""), "");
});

test("buildGeminiRequestBody emits systemInstruction and user contents", () => {
  const body = buildGeminiRequestBody({
    systemPrompt: "Translate carefully.",
    text: "Hello.",
    temperature: 0.2,
  });
  assert.deepEqual(body.systemInstruction, { parts: [{ text: "Translate carefully." }] });
  assert.deepEqual(body.contents, [{ role: "user", parts: [{ text: "Hello." }] }]);
  assert.deepEqual(body.generationConfig, { temperature: 0.2 });
});

test("extractGeminiContent joins text parts and skips thought parts", () => {
  assert.equal(
    extractGeminiContent({
      candidates: [
        {
          content: {
            parts: [{ text: "你" }, { thought: true, text: "内部推理" }, { text: "好" }],
          },
        },
      ],
    }),
    "你好",
  );
  assert.equal(extractGeminiContent({ candidates: [] }), null);
  assert.equal(
    extractGeminiContent({ candidates: [{ content: { parts: [{ thought: true, text: "x" }] } }] }),
    null,
  );
  assert.equal(
    extractGeminiContent({ candidates: [{ content: { parts: [{ text: "  " }] } }] }),
    null,
  );
  assert.equal(extractGeminiContent(undefined), null);
});

test("extractGeminiErrorDetail reads Google API error messages and truncates them", () => {
  assert.equal(
    extractGeminiErrorDetail(
      JSON.stringify({ error: { code: 400, message: "API key not valid", status: "INVALID_ARGUMENT" } }),
    ),
    "API key not valid",
  );
  assert.equal(extractGeminiErrorDetail({ error: { message: "quota exceeded" } }), "quota exceeded");
  assert.equal(extractGeminiErrorDetail("plain failure"), "plain failure");
  assert.equal(extractGeminiErrorDetail(null), "");
  assert.equal(extractGeminiErrorDetail("x".repeat(400)).length, 300);
});
