// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — chat request/response shapes for every LLM backend.
//
// Kept free of Zotero APIs so Node tests can verify multi-turn mapping without
// launching the application.

export type ChatRole = "user" | "assistant";

export interface ChatTurn {
  role: ChatRole;
  content: string;
}

export interface OpenAIChatRequestBodyInput {
  model: string;
  systemPrompt: string;
  turns: readonly ChatTurn[];
  temperature: number;
}

export interface ClaudeChatRequestBodyInput extends OpenAIChatRequestBodyInput {
  maxTokens: number;
}

export interface GeminiChatRequestBodyInput {
  systemPrompt: string;
  turns: readonly ChatTurn[];
  temperature: number;
}

export type OllamaChatRequestBodyInput = OpenAIChatRequestBodyInput;

export function buildOpenAIChatRequestBody(
  input: OpenAIChatRequestBodyInput,
): Record<string, unknown> {
  return {
    model: input.model,
    messages: [
      { role: "system", content: input.systemPrompt },
      ...input.turns.map((turn) => ({ role: turn.role, content: turn.content })),
    ],
    temperature: input.temperature,
    stream: false,
  };
}

export function buildClaudeChatRequestBody(
  input: ClaudeChatRequestBodyInput,
): Record<string, unknown> {
  return {
    model: input.model,
    max_tokens: input.maxTokens,
    temperature: input.temperature,
    system: input.systemPrompt,
    messages: input.turns.map((turn) => ({
      role: turn.role,
      content: [{ type: "text", text: turn.content }],
    })),
  };
}

export function buildGeminiChatRequestBody(
  input: GeminiChatRequestBodyInput,
): Record<string, unknown> {
  return {
    systemInstruction: { parts: [{ text: input.systemPrompt }] },
    contents: input.turns.map((turn) => ({
      role: turn.role === "assistant" ? "model" : "user",
      parts: [{ text: turn.content }],
    })),
    generationConfig: { temperature: input.temperature },
  };
}

export function buildOllamaChatRequestBody(
  input: OllamaChatRequestBodyInput,
): Record<string, unknown> {
  return {
    model: input.model,
    stream: false,
    keep_alive: "30m",
    messages: [
      { role: "system", content: input.systemPrompt },
      ...input.turns.map((turn) => ({ role: turn.role, content: turn.content })),
    ],
    options: { temperature: input.temperature },
  };
}

export function extractOllamaChatContent(response: any): string | null {
  const content = response?.message?.content;
  if (typeof content !== "string") return null;
  const text = content.trim();
  return text || null;
}
