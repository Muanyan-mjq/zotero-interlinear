import assert from "node:assert/strict";
import test from "node:test";

import {
  buildClaudeChatRequestBody,
  buildGeminiChatRequestBody,
  buildOllamaChatRequestBody,
  buildOpenAIChatRequestBody,
  extractOllamaChatContent,
} from "../src/providers/chatProtocol.ts";
import {
  buildChatContextBlock,
  buildChatSystemPrompt,
} from "../src/providers/chatPrompts.ts";
import {
  CHAT_CONTEXT_LIMIT,
  truncateChatContext,
} from "../src/chatContext.ts";
import {
  appendChatTurn,
  clearChatSession,
  getChatSession,
  resetChatSessions,
} from "../src/chatSession.ts";

const TURNS = [
  { role: "user", content: "Q1" },
  { role: "assistant", content: "A1" },
  { role: "user", content: "Q2" },
];

test("buildOpenAIChatRequestBody keeps the system prompt and turn order", () => {
  const body = buildOpenAIChatRequestBody({
    model: "gpt-4o-mini",
    systemPrompt: "SYS",
    turns: TURNS,
    temperature: 0.3,
  });

  assert.equal(body.model, "gpt-4o-mini");
  assert.equal(body.stream, false);
  assert.equal(body.temperature, 0.3);
  assert.deepEqual(body.messages, [
    { role: "system", content: "SYS" },
    { role: "user", content: "Q1" },
    { role: "assistant", content: "A1" },
    { role: "user", content: "Q2" },
  ]);
});

test("buildClaudeChatRequestBody uses system plus text blocks", () => {
  const body = buildClaudeChatRequestBody({
    model: "claude-sonnet-4-5",
    systemPrompt: "SYS",
    turns: TURNS,
    temperature: 0.4,
    maxTokens: 1024,
  });

  assert.equal(body.model, "claude-sonnet-4-5");
  assert.equal(body.system, "SYS");
  assert.equal(body.max_tokens, 1024);
  assert.equal(body.temperature, 0.4);
  assert.deepEqual(body.messages, [
    { role: "user", content: [{ type: "text", text: "Q1" }] },
    { role: "assistant", content: [{ type: "text", text: "A1" }] },
    { role: "user", content: [{ type: "text", text: "Q2" }] },
  ]);
});

test("buildGeminiChatRequestBody maps assistant turns to the model role", () => {
  const body = buildGeminiChatRequestBody({
    systemPrompt: "SYS",
    turns: TURNS,
    temperature: 0.5,
  });

  assert.deepEqual(body.systemInstruction, { parts: [{ text: "SYS" }] });
  assert.deepEqual(body.generationConfig, { temperature: 0.5 });
  assert.deepEqual(body.contents, [
    { role: "user", parts: [{ text: "Q1" }] },
    { role: "model", parts: [{ text: "A1" }] },
    { role: "user", parts: [{ text: "Q2" }] },
  ]);
  assert.equal("model" in body, false);
});

test("buildOllamaChatRequestBody keeps chat options and the system turn", () => {
  const body = buildOllamaChatRequestBody({
    model: "gpt-oss:20b",
    systemPrompt: "SYS",
    turns: TURNS,
    temperature: 0.1,
  });

  assert.equal(body.model, "gpt-oss:20b");
  assert.equal(body.stream, false);
  assert.equal(body.keep_alive, "30m");
  assert.deepEqual(body.options, { temperature: 0.1 });
  assert.deepEqual(body.messages, [
    { role: "system", content: "SYS" },
    { role: "user", content: "Q1" },
    { role: "assistant", content: "A1" },
    { role: "user", content: "Q2" },
  ]);
});

test("extractOllamaChatContent trims the reply and rejects empty payloads", () => {
  assert.equal(extractOllamaChatContent({ message: { content: "  hi  " } }), "hi");
  assert.equal(extractOllamaChatContent({ message: {} }), null);
  assert.equal(extractOllamaChatContent({}), null);
});

test("buildChatSystemPrompt names the answer language and appends the glossary", () => {
  const prompt = buildChatSystemPrompt("简体中文", "gene => 基因");
  assert.ok(prompt.includes("学术"));
  assert.ok(prompt.includes("简体中文"));
  assert.ok(prompt.includes("gene => 基因"));

  const plain = buildChatSystemPrompt("英文", "");
  assert.ok(plain.includes("英文"));
  assert.ok(!plain.includes("术语表"));
});

test("buildChatContextBlock labels the scope and flags truncation", () => {
  const block = buildChatContextBlock("selection", "文本A\n\n文本B", false);
  assert.ok(block.includes("选中段落"));
  assert.ok(block.includes("文本A"));
  assert.ok(!block.includes("截断"));

  const truncated = buildChatContextBlock("document", "X".repeat(20), true);
  assert.ok(truncated.includes("全文"));
  assert.ok(truncated.includes("截断"));
});

test("truncateChatContext returns short text unchanged", () => {
  assert.deepEqual(truncateChatContext("abc", 10), { text: "abc", truncated: false });
  assert.equal(CHAT_CONTEXT_LIMIT, 12000);
});

test("truncateChatContext cuts at a paragraph boundary when one is near the limit", () => {
  const first = "a".repeat(10);
  const second = "b".repeat(10);
  const text = `${first}\n\n${second}\n\n${"c".repeat(10)}`;
  const result = truncateChatContext(text, 30);

  assert.equal(result.truncated, true);
  assert.equal(result.text, `${first}\n\n${second}`);
});

test("truncateChatContext hard-cuts text without paragraph breaks", () => {
  const result = truncateChatContext("x".repeat(100), 20);
  assert.deepEqual(result, { text: "x".repeat(20), truncated: true });
});

test("chat sessions are stored per item and capped by max turns", () => {
  resetChatSessions();
  appendChatTurn("ITEM-A", { role: "user", content: "Q1" });
  appendChatTurn("ITEM-B", { role: "user", content: "B1" });

  assert.deepEqual(getChatSession("ITEM-A"), [{ role: "user", content: "Q1" }]);
  assert.deepEqual(getChatSession("ITEM-B"), [{ role: "user", content: "B1" }]);

  appendChatTurn("ITEM-A", { role: "assistant", content: "A1" }, 2);
  appendChatTurn("ITEM-A", { role: "user", content: "Q2" }, 2);
  assert.deepEqual(getChatSession("ITEM-A"), [
    { role: "assistant", content: "A1" },
    { role: "user", content: "Q2" },
  ]);

  clearChatSession("ITEM-A");
  assert.deepEqual(getChatSession("ITEM-A"), []);
  assert.deepEqual(getChatSession("ITEM-B"), [{ role: "user", content: "B1" }]);
});

test("getChatSession returns a copy that callers cannot mutate", () => {
  resetChatSessions();
  appendChatTurn("ITEM-C", { role: "user", content: "Q" });
  const session = getChatSession("ITEM-C");
  session.push({ role: "assistant", content: "injected" });

  assert.equal(getChatSession("ITEM-C").length, 1);
});

