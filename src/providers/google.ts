// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — Google Translate provider (free `client=gtx` endpoint).

import { getString } from "../utils/locale";
import {
  buildGoogleQuery,
  normalizeGoogleEndpoint,
  parseGoogleResponse,
} from "./googleProtocol";
import { getXhrResponseBody } from "./openaiProtocol";
import { redactSecrets } from "../utils/redact";
import { NO_REDIRECT_OPTIONS, isRedirectStatus, redirectErrorMessage } from "./secureRequest";

export interface GoogleConfig {
  baseURL: string;
  sourceLanguage: string;
  targetLanguage: string;
  timeoutMs: number;
}

function responseDetail(body: unknown): string {
  const text = typeof body === "string" ? body : "";
  return text.trim().replace(/\s+/gu, " ").slice(0, 200);
}

export async function requestGoogleTranslation(
  config: GoogleConfig,
  text: string,
): Promise<string> {
  const endpoint = normalizeGoogleEndpoint(config.baseURL);
  const body = buildGoogleQuery({
    source: config.sourceLanguage,
    target: config.targetLanguage,
    text,
  });

  let xhr: any;
  try {
    // POST keeps long paragraphs out of the URL; the gtx endpoint accepts a
    // form-encoded body on the same path.
    xhr = await Zotero.HTTP.request("POST", endpoint, {
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body,
      responseType: "text",
      ...NO_REDIRECT_OPTIONS,
      timeout: config.timeoutMs,
    });
  } catch (error: any) {
    const failed = error?.xmlhttp || error?.xhr;
    const detail = responseDetail(getXhrResponseBody(failed)) || error?.message || "";
    throw new Error(
      getString("provider-error-google-network", { args: { detail: redactSecrets(detail) } }),
    );
  }

  if (!xhr || xhr.status < 200 || xhr.status >= 300) {
    if (isRedirectStatus(xhr?.status)) throw new Error(redirectErrorMessage(xhr));
    const detail = responseDetail(getXhrResponseBody(xhr)) || String(xhr?.statusText || "");
    throw new Error(
      getString("provider-error-google-http", {
        args: { status: String(xhr?.status || "unknown"), detail: redactSecrets(detail) },
      }),
    );
  }

  let payload: any = xhr.response;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch (_) {
      throw new Error(getString("provider-error-google-parse"));
    }
  }

  const translated = parseGoogleResponse(payload);
  if (!translated) throw new Error(getString("provider-error-google-empty"));
  return translated;
}

export async function testGoogleConnection(
  baseURL: string,
  targetLanguage: string,
): Promise<string> {
  return requestGoogleTranslation(
    { baseURL, sourceLanguage: "auto", targetLanguage, timeoutMs: 15000 },
    "Hello",
  );
}
