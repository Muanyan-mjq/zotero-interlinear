// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — Microsoft Edge translation provider (free, no key).

import { getString } from "../utils/locale";
import { redactSecrets } from "../utils/redact";
import { GoogleThrottleError } from "./google";
import { getXhrResponseBody } from "./openaiProtocol";
import {
  buildMicrosoftBody,
  buildMicrosoftEndpoint,
  parseMicrosoftTranslations,
} from "./microsoftProtocol";
import { NO_REDIRECT_OPTIONS } from "./secureRequest";

export interface MicrosoftConfig {
  sourceLanguage: string;
  targetLanguage: string;
  timeoutMs: number;
  /** Kept overridable so a future mirror or a test double can stand in. */
  endpoint?: string;
}

function responseDetail(body: unknown): string {
  const text = typeof body === "string" ? body : "";
  return text.trim().replace(/\s+/gu, " ").slice(0, 200);
}

export async function requestMicrosoftTranslations(
  config: MicrosoftConfig,
  texts: string[],
): Promise<string[]> {
  if (!texts.length) return [];
  const endpoint = buildMicrosoftEndpoint(
    config.sourceLanguage,
    config.targetLanguage,
    config.endpoint,
  );

  let xhr: any;
  try {
    xhr = await Zotero.HTTP.request("POST", endpoint, {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: buildMicrosoftBody(texts),
      responseType: "text",
      ...NO_REDIRECT_OPTIONS,
      timeout: config.timeoutMs,
    });
  } catch (error: any) {
    const failed = error?.xmlhttp || error?.xhr;
    if (failed?.status === 429) throw new GoogleThrottleError("", 0);
    const detail = responseDetail(getXhrResponseBody(failed)) || error?.message || "";
    throw new Error(
      getString("provider-error-microsoft-network", {
        args: { detail: redactSecrets(detail) },
      }),
    );
  }

  if (xhr?.status === 429) throw new GoogleThrottleError("", 0);
  if (!xhr || xhr.status < 200 || xhr.status >= 300) {
    const detail = responseDetail(getXhrResponseBody(xhr)) || String(xhr?.statusText || "");
    throw new Error(
      getString("provider-error-microsoft-http", {
        args: { status: String(xhr?.status || "unknown"), detail: redactSecrets(detail) },
      }),
    );
  }

  let payload: any = xhr.response;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch (_) {
      throw new Error(getString("provider-error-microsoft-parse"));
    }
  }

  const translated = parseMicrosoftTranslations(payload, texts.length);
  if (!translated) throw new Error(getString("provider-error-microsoft-empty"));
  return translated;
}
