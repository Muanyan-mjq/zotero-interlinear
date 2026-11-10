// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — Anthropic Messages API protocol helpers.
//
// API reference: https://docs.anthropic.com/en/api/messages
// Only the request/response shapes are implemented here so settings and tests
// can use them without touching Zotero's HTTP stack.

export const DEFAULT_CLAUDE_ENDPOINT = "https://api.anthropic.com/v1/messages";
export const CLAUDE_API_VERSION = "2023-06-01";

/**
 * Accept the official base URL, a proxy base, or a full Messages URL. Unknown
 * paths are treated as proxy prefixes and get `/v1/messages` appended.
 */
export function normalizeClaudeEndpoint(raw: string): string {
  let url = String(raw || "").trim();
  if (!url) return DEFAULT_CLAUDE_ENDPOINT;
  if (!/^https?:\/\//iu.test(url)) url = `https://${url}`;
  url = url.replace(/\/+$/, "");

  if (/\/messages$/iu.test(url)) return url;

  try {
    const parsed = new URL(url);
    if (!parsed.pathname || parsed.pathname === "/") {
      return `${url}/v1/messages`;
    }
  } catch (_) {
    return url;
  }

  if (/\/v\d+[a-z0-9]*$/iu.test(url)) {
    return `${url}/messages`;
  }
  return `${url}/v1/messages`;
}

export interface ClaudeRequestBodyInput {
  model: string;
  systemPrompt: string;
  text: string;
  temperature: number;
  maxTokens: number;
}

export function buildClaudeRequestBody(
  input: ClaudeRequestBodyInput,
): Record<string, unknown> {
  return {
    model: input.model,
    max_tokens: input.maxTokens,
    temperature: input.temperature,
    system: input.systemPrompt,
    messages: [
      { role: "user", content: [{ type: "text", text: input.text }] },
    ],
  };
}

export function extractClaudeContent(response: any): string | null {
  const blocks = response?.content;
  if (!Array.isArray(blocks)) return null;
  const text = blocks
    .filter(
      (block: any) =>
        block && block.type === "text" && typeof block.text === "string",
    )
    .map((block: any) => block.text)
    .join("")
    .trim();
  return text || null;
}

export function extractClaudeErrorDetail(body: unknown): string {
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
