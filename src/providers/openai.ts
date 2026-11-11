// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — OpenAI-compatible provider (Ollama/LM Studio/relays).
//
// Adapted from quillamio/bilingual-reader PR #20 by daxiaxiong88
// (https://github.com/quillamio/bilingual-reader/pull/20, AGPL-3.0-or-later).
// Changes: provider-layer config, optional API key for local servers, and
// localized error messages.

import { getString } from "../utils/locale";
import {
  buildOpenAIRequestBody,
  extractOpenAIContent,
  extractOpenAIErrorDetail,
  getXhrResponseBody,
  normalizeChatCompletionsEndpoint,
} from "./openaiProtocol";
import { redactSecrets } from "../utils/redact";

export interface OpenAIConfig {
  endpoint: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  timeoutMs: number;
}

function httpError(status: number | undefined, detail: string): string {
  detail = redactSecrets(detail);
  if (status) {
    return detail
      ? getString("provider-error-openai-http", {
          args: { status: String(status), detail },
        })
      : getString("provider-error-openai-http-status", { args: { status: String(status) } });
  }
  return getString("provider-error-openai-network", { args: { detail } });
}

export async function requestOpenAITranslation(
  config: OpenAIConfig,
  text: string,
): Promise<string> {
  const endpoint = normalizeChatCompletionsEndpoint(config.endpoint);
  if (!endpoint) throw new Error(getString("provider-error-openai-endpoint"));
  if (!config.model.trim()) throw new Error(getString("provider-error-openai-model"));

  const body = buildOpenAIRequestBody({
    model: config.model.trim(),
    systemPrompt: config.systemPrompt,
    text,
    temperature: config.temperature,
  });
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const apiKey = config.apiKey.trim();
  // Local OpenAI-compatible servers usually ignore auth; only send a header
  // when the user configured a key. The key is never echoed in errors or tags.
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  let xhr: any;
  try {
    xhr = await Zotero.HTTP.request("POST", endpoint, {
      headers,
      body: JSON.stringify(body),
      responseType: "text",
      timeout: config.timeoutMs,
    });
  } catch (error: any) {
    const failed = error?.xmlhttp || error?.xhr;
    const detail =
      extractOpenAIErrorDetail(getXhrResponseBody(failed)) || error?.message || "";
    throw new Error(httpError(failed?.status, String(detail)));
  }

  if (!xhr || xhr.status < 200 || xhr.status >= 300) {
    const detail =
      extractOpenAIErrorDetail(getXhrResponseBody(xhr)) || String(xhr?.statusText || "");
    throw new Error(httpError(xhr?.status, detail));
  }

  let response: any = xhr.response;
  if (typeof response === "string") {
    try {
      response = JSON.parse(response);
    } catch (_) {
      throw new Error(getString("provider-error-openai-parse"));
    }
  }

  const content = extractOpenAIContent(response);
  if (!content) throw new Error(getString("provider-error-openai-empty"));
  return content;
}

export async function testOpenAIConnection(config: {
  endpoint: string;
  apiKey: string;
  model: string;
  temperature: number;
}): Promise<string> {
  return requestOpenAITranslation(
    {
      ...config,
      systemPrompt: "You are a translation engine. Reply with the translation only.",
      timeoutMs: 15000,
    },
    "Hello",
  );
}
