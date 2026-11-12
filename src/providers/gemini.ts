// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — Google Gemini provider (generateContent API).

import { getString } from "../utils/locale";
import {
  buildGeminiEndpoint,
  buildGeminiRequestBody,
  extractGeminiContent,
  extractGeminiErrorDetail,
  normalizeGeminiModel,
} from "./geminiProtocol";
import { getXhrResponseBody } from "./openaiProtocol";
import { redactSecrets } from "../utils/redact";
import {
  NO_REDIRECT_OPTIONS,
  isRedirectStatus,
  redirectErrorMessage,
  requestWithRetry,
} from "./secureRequest";
import { describeFailure } from "./errorHints";

export interface GeminiConfig {
  baseURL: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  timeoutMs: number;
}

function httpError(status: number | undefined, detail: string): string {
  detail = redactSecrets(detail);
  if (status) {
    if (status === 429) {
      return `${detail ? getString("provider-error-gemini-http", { args: { status: String(status), detail } }) : getString("provider-error-gemini-http-status", { args: { status: String(status) } })} ${describeFailure({ status }).hint}`;
    }
    return detail
      ? getString("provider-error-gemini-http", {
          args: { status: String(status), detail },
        })
      : getString("provider-error-gemini-http-status", { args: { status: String(status) } });
  }
  return `${getString("provider-error-gemini-network", { args: { detail } })} ${describeFailure({ message: detail }).hint}`;
}

export async function requestGeminiTranslation(
  config: GeminiConfig,
  text: string,
): Promise<string> {
  if (!normalizeGeminiModel(config.model)) {
    throw new Error(getString("provider-error-gemini-model"));
  }
  const apiKey = config.apiKey.trim();
  if (!apiKey) throw new Error(getString("provider-error-gemini-key"));

  const endpoint = buildGeminiEndpoint(config.baseURL, config.model);
  const body = buildGeminiRequestBody({
    systemPrompt: config.systemPrompt,
    text,
    temperature: config.temperature,
  });
  // The official API accepts x-goog-api-key; a header keeps the key out of
  // URLs, logs and cache tags.
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-goog-api-key": apiKey,
  };

  let xhr: any;
  try {
    xhr = await requestWithRetry("POST", endpoint, {
      headers,
      body: JSON.stringify(body),
      responseType: "text",
      ...NO_REDIRECT_OPTIONS,
      timeout: config.timeoutMs,
    });
  } catch (error: any) {
    const failed = error?.xmlhttp || error?.xhr;
    const detail =
      extractGeminiErrorDetail(getXhrResponseBody(failed)) || error?.message || "";
    throw new Error(httpError(failed?.status, String(detail)));
  }

  if (!xhr || xhr.status < 200 || xhr.status >= 300) {
    if (isRedirectStatus(xhr?.status)) throw new Error(redirectErrorMessage(xhr));
    const detail =
      extractGeminiErrorDetail(getXhrResponseBody(xhr)) || String(xhr?.statusText || "");
    throw new Error(httpError(xhr?.status, detail));
  }

  let response: any = xhr.response;
  if (typeof response === "string") {
    try {
      response = JSON.parse(response);
    } catch (_) {
      throw new Error(getString("provider-error-gemini-parse"));
    }
  }

  const content = extractGeminiContent(response);
  if (!content) throw new Error(getString("provider-error-gemini-empty"));
  return content;
}

export async function testGeminiConnection(config: {
  baseURL: string;
  apiKey: string;
  model: string;
  temperature: number;
}): Promise<string> {
  return requestGeminiTranslation(
    {
      ...config,
      systemPrompt: "You are a translation engine. Reply with the translation only.",
      timeoutMs: 15000,
    },
    "Hello",
  );
}
