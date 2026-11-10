// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — multi-turn chat requests for every LLM backend.

import { getString } from "../utils/locale";
import {
  buildClaudeChatRequestBody,
  buildGeminiChatRequestBody,
  buildOllamaChatRequestBody,
  buildOpenAIChatRequestBody,
  extractOllamaChatContent,
  type ChatTurn,
} from "./chatProtocol";
import {
  CLAUDE_API_VERSION,
  extractClaudeContent,
  normalizeClaudeEndpoint,
} from "./claudeProtocol";
import {
  buildGeminiEndpoint,
  extractGeminiContent,
  normalizeGeminiModel,
} from "./geminiProtocol";
import {
  extractOpenAIContent,
  getXhrResponseBody,
  normalizeChatCompletionsEndpoint,
} from "./openaiProtocol";

export interface OpenAIChatConfig {
  endpoint: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  timeoutMs: number;
}

export interface ClaudeChatConfig extends OpenAIChatConfig {
  maxTokens: number;
}

export interface GeminiChatConfig {
  baseURL: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  timeoutMs: number;
}

export interface OllamaChatConfig {
  baseURL: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  timeoutMs: number;
}

function chatHttpError(status: number | undefined, detail: string): string {
  if (status) {
    return detail
      ? getString("chat-error-http", {
          args: { status: String(status), detail },
        })
      : getString("chat-error-http-status", { args: { status: String(status) } });
  }
  return getString("chat-error-network", { args: { detail } });
}

function extractChatErrorDetail(body: unknown): string {
  let detail = "";
  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body);
      detail = parsed?.error?.message || parsed?.message || body;
    } catch (_) {
      detail = body;
    }
  } else if (body && typeof body === "object") {
    const parsed = body as any;
    detail = parsed?.error?.message || parsed?.message || "";
  }
  return String(detail || "").trim().slice(0, 300);
}

async function postChatJSON(
  endpoint: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number,
): Promise<any> {
  let xhr: any;
  try {
    xhr = await Zotero.HTTP.request("POST", endpoint, {
      headers,
      body: JSON.stringify(body),
      responseType: "text",
      timeout: timeoutMs,
    });
  } catch (error: any) {
    const failed = error?.xmlhttp || error?.xhr;
    const detail =
      extractChatErrorDetail(getXhrResponseBody(failed)) || error?.message || "";
    throw new Error(chatHttpError(failed?.status, String(detail)));
  }

  if (!xhr || xhr.status < 200 || xhr.status >= 300) {
    const detail =
      extractChatErrorDetail(getXhrResponseBody(xhr)) || String(xhr?.statusText || "");
    throw new Error(chatHttpError(xhr?.status, detail));
  }

  let response: any = xhr.response;
  if (typeof response === "string") {
    try {
      response = JSON.parse(response);
    } catch (_) {
      throw new Error(getString("chat-error-parse"));
    }
  }
  return response;
}

export async function requestOpenAIChat(
  config: OpenAIChatConfig,
  turns: readonly ChatTurn[],
): Promise<string> {
  const endpoint = normalizeChatCompletionsEndpoint(config.endpoint);
  if (!endpoint) throw new Error(getString("provider-error-openai-endpoint"));
  if (!config.model.trim()) throw new Error(getString("provider-error-openai-model"));

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const apiKey = config.apiKey.trim();
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const response = await postChatJSON(
    endpoint,
    headers,
    buildOpenAIChatRequestBody({
      model: config.model.trim(),
      systemPrompt: config.systemPrompt,
      turns,
      temperature: config.temperature,
    }),
    config.timeoutMs,
  );

  const content = extractOpenAIContent(response);
  if (!content) throw new Error(getString("chat-error-empty"));
  return content;
}

export async function requestClaudeChat(
  config: ClaudeChatConfig,
  turns: readonly ChatTurn[],
): Promise<string> {
  const endpoint = normalizeClaudeEndpoint(config.endpoint);
  if (!config.model.trim()) throw new Error(getString("provider-error-claude-model"));
  const apiKey = config.apiKey.trim();
  if (!apiKey) throw new Error(getString("provider-error-claude-key"));

  const response = await postChatJSON(
    endpoint,
    {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": CLAUDE_API_VERSION,
      "anthropic-dangerous-direct-browser-access": "true",
    },
    buildClaudeChatRequestBody({
      model: config.model.trim(),
      systemPrompt: config.systemPrompt,
      turns,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    }),
    config.timeoutMs,
  );

  const content = extractClaudeContent(response);
  if (!content) throw new Error(getString("chat-error-empty"));
  return content;
}

export async function requestGeminiChat(
  config: GeminiChatConfig,
  turns: readonly ChatTurn[],
): Promise<string> {
  const model = normalizeGeminiModel(config.model);
  if (!model) throw new Error(getString("provider-error-gemini-model"));
  const apiKey = config.apiKey.trim();
  if (!apiKey) throw new Error(getString("provider-error-gemini-key"));

  const response = await postChatJSON(
    buildGeminiEndpoint(config.baseURL, model),
    {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    buildGeminiChatRequestBody({
      systemPrompt: config.systemPrompt,
      turns,
      temperature: config.temperature,
    }),
    config.timeoutMs,
  );

  const content = extractGeminiContent(response);
  if (!content) throw new Error(getString("chat-error-empty"));
  return content;
}

export async function requestOllamaChat(
  config: OllamaChatConfig,
  turns: readonly ChatTurn[],
): Promise<string> {
  const response = await postChatJSON(
    `${config.baseURL.replace(/\/+$/u, "")}/api/chat`,
    { "Content-Type": "application/json" },
    buildOllamaChatRequestBody({
      model: config.model,
      systemPrompt: config.systemPrompt,
      turns,
      temperature: config.temperature,
    }),
    config.timeoutMs,
  );

  const content = extractOllamaChatContent(response);
  if (!content) throw new Error(getString("chat-error-empty"));
  return content;
}
