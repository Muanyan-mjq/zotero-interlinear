// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — Ollama chat provider.

import { getString } from "../utils/locale";
import {
  NO_REDIRECT_OPTIONS,
  isRedirectStatus,
  redirectErrorMessage,
  requestWithRetry,
} from "./secureRequest";

export interface OllamaConfig {
  baseURL: string;
  model: string;
  systemPrompt: string;
  timeoutMs: number;
}

export async function requestOllamaTranslation(
  config: OllamaConfig,
  text: string,
): Promise<string> {
  const url = `${config.baseURL.replace(/\/+$/u, "")}/api/chat`;
  const body = {
    model: config.model,
    stream: false,
    keep_alive: "30m",
    messages: [
      { role: "system", content: config.systemPrompt },
      { role: "user", content: text },
    ],
    options: { temperature: 0.1 },
  };

  const xhr = await requestWithRetry("POST", url, {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    responseType: "json",
    ...NO_REDIRECT_OPTIONS,
    timeout: config.timeoutMs,
  });

  if (!xhr || xhr.status < 200 || xhr.status >= 300) {
    if (isRedirectStatus(xhr?.status)) throw new Error(redirectErrorMessage(xhr));
    throw new Error(
      getString("provider-error-ollama-http", {
        args: { status: String(xhr?.status || "unknown") },
      }),
    );
  }

  let response: any = xhr.response;
  if (typeof response === "string") {
    try {
      response = JSON.parse(response);
    } catch (_) {
      // The validation below reports the malformed response.
    }
  }

  const result = response?.message?.content;
  if (!result || typeof result !== "string") {
    throw new Error(getString("provider-error-ollama-empty"));
  }
  return result.trim();
}
