// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — OpenAI-compatible chat protocol helpers.
//
// Adapted from quillamio/bilingual-reader PR #20 by daxiaxiong88
// (https://github.com/quillamio/bilingual-reader/pull/20, AGPL-3.0-or-later).
// Changes: extracted into the provider layer, kept the endpoint normalization,
// request body, content extraction and HTTP error formatting behaviour.

/**
 * Accept a full chat-completions URL or a common base URL and return the
 * endpoint that should be called. Providers differ on whether they publish
 * ".../v1", ".../v1beta/openai", or the full ".../chat/completions" path.
 */
export function normalizeChatCompletionsEndpoint(raw: string): string {
  let url = String(raw || "").trim();
  if (!url) return "";
  if (!/^https?:\/\//iu.test(url)) url = `https://${url}`;
  url = url.replace(/\/+$/, "");

  if (/\/chat\/completions$/iu.test(url)) return url;

  try {
    const parsed = new URL(url);
    if (!parsed.pathname || parsed.pathname === "/") {
      return `${url}/v1/chat/completions`;
    }
  } catch (_) {
    return url;
  }

  if (/\/(?:v\d+[a-z0-9]*|openai)$/iu.test(url)) {
    return `${url}/chat/completions`;
  }
  return url;
}

export interface OpenAIRequestBodyInput {
  model: string;
  systemPrompt: string;
  text: string;
  temperature: number;
}

export function buildOpenAIRequestBody(input: OpenAIRequestBodyInput): Record<string, unknown> {
  return {
    model: input.model,
    messages: [
      { role: "system", content: input.systemPrompt },
      { role: "user", content: input.text },
    ],
    temperature: input.temperature,
    stream: false,
  };
}

export function extractOpenAIContent(response: any): string | null {
  const content = response?.choices?.[0]?.message?.content;
  let text = "";
  if (typeof content === "string") {
    text = content;
  } else if (Array.isArray(content)) {
    text = content
      .map((part: any) => (typeof part === "string" ? part : String(part?.text || "")))
      .join("");
  }
  text = text.replace(/<think>[\s\S]*?(?:<\/think>|$)/giu, "").trim();
  return text || null;
}

/**
 * Gecko throws when responseText is read on an XHR whose responseType is not
 * "" or "text". Error paths must therefore go through this helper instead of
 * touching responseText directly.
 */
export function getXhrResponseBody(xhr: any): unknown {
  if (!xhr) return undefined;
  const responseType = typeof xhr.responseType === "string" ? xhr.responseType : "";
  try {
    if (responseType === "" || responseType === "text") return xhr.responseText;
    return xhr.response;
  } catch (_) {
    try {
      return xhr.response;
    } catch (_) {
      return undefined;
    }
  }
}

export function extractOpenAIErrorDetail(body: unknown): string {
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
