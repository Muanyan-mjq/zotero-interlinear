// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — Anthropic Claude provider (Messages API).

import { getString } from "../utils/locale";
import {
  buildClaudeRequestBody,
  CLAUDE_API_VERSION,
  extractClaudeContent,
  extractClaudeErrorDetail,
  normalizeClaudeEndpoint,
} from "./claudeProtocol";
import { getXhrResponseBody } from "./openaiProtocol";
import { redactSecrets } from "../utils/redact";
import { NO_REDIRECT_OPTIONS, isRedirectStatus, redirectErrorMessage } from "./secureRequest";
import { describeFailure } from "./errorHints";

export interface ClaudeConfig {
  endpoint: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
}

function httpError(status: number | undefined, detail: string): string {
  detail = redactSecrets(detail);
  if (status) {
    if (status === 429) {
      return `${detail ? getString("provider-error-claude-http", { args: { status: String(status), detail } }) : getString("provider-error-claude-http-status", { args: { status: String(status) } })} ${describeFailure({ status }).hint}`;
    }
    return detail
      ? getString("provider-error-claude-http", {
          args: { status: String(status), detail },
        })
      : getString("provider-error-claude-http-status", { args: { status: String(status) } });
  }
  return `${getString("provider-error-claude-network", { args: { detail } })} ${describeFailure({ message: detail }).hint}`;
}

export async function requestClaudeTranslation(
  config: ClaudeConfig,
  text: string,
): Promise<string> {
  const endpoint = normalizeClaudeEndpoint(config.endpoint);
  if (!endpoint) throw new Error(getString("provider-error-claude-endpoint"));
  if (!config.model.trim()) throw new Error(getString("provider-error-claude-model"));
  const apiKey = config.apiKey.trim();
  if (!apiKey) throw new Error(getString("provider-error-claude-key"));

  const body = buildClaudeRequestBody({
    model: config.model.trim(),
    systemPrompt: config.systemPrompt,
    text,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
  });
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": CLAUDE_API_VERSION,
    // Anthropic rejects browser-origin requests without this header. Zotero's
    // privileged XHR usually has no Origin, but the header is harmless there
    // and keeps direct requests working. The key never appears in errors.
    "anthropic-dangerous-direct-browser-access": "true",
  };

  let xhr: any;
  try {
    xhr = await Zotero.HTTP.request("POST", endpoint, {
      headers,
      body: JSON.stringify(body),
      responseType: "text",
      ...NO_REDIRECT_OPTIONS,
      timeout: config.timeoutMs,
    });
  } catch (error: any) {
    const failed = error?.xmlhttp || error?.xhr;
    const detail =
      extractClaudeErrorDetail(getXhrResponseBody(failed)) || error?.message || "";
    throw new Error(httpError(failed?.status, String(detail)));
  }

  if (!xhr || xhr.status < 200 || xhr.status >= 300) {
    if (isRedirectStatus(xhr?.status)) throw new Error(redirectErrorMessage(xhr));
    const detail =
      extractClaudeErrorDetail(getXhrResponseBody(xhr)) || String(xhr?.statusText || "");
    throw new Error(httpError(xhr?.status, detail));
  }

  let response: any = xhr.response;
  if (typeof response === "string") {
    try {
      response = JSON.parse(response);
    } catch (_) {
      throw new Error(getString("provider-error-claude-parse"));
    }
  }

  const content = extractClaudeContent(response);
  if (!content) throw new Error(getString("provider-error-claude-empty"));
  return content;
}

export async function testClaudeConnection(config: {
  endpoint: string;
  apiKey: string;
  model: string;
  temperature: number;
}): Promise<string> {
  return requestClaudeTranslation(
    {
      ...config,
      systemPrompt: "You are a translation engine. Reply with the translation only.",
      maxTokens: 64,
      timeoutMs: 15000,
    },
    "Hello",
  );
}
