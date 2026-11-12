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

/**
 * The free `client=gtx` endpoint has no API key and throttles by IP instead:
 * a burst of parallel requests is answered with 429s, dropped connections or a
 * redirect to the "sorry" captcha. Keep at least one second between requests
 * from this client and back off after a failure.
 */
const MIN_INTERVAL_MS = 1000;
let nextSlotAt = 0;
let consecutiveThrottles = 0;

/** Delay that must be applied before the next request, without sleeping. */
export function googleBackoffMs(attempt: number, throttles = consecutiveThrottles): number {
  const base = Math.min(30000, MIN_INTERVAL_MS * 2 ** Math.max(0, attempt));
  const penalty = throttles >= 3 ? 30000 : 0;
  return base + penalty;
}

async function paceGoogleRequest(attempt = 0): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, nextSlotAt - now) + (attempt > 0 ? googleBackoffMs(attempt) : 0);
  nextSlotAt = now + wait + MIN_INTERVAL_MS;
  if (wait > 0) await Zotero.Promise.delay(wait);
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
  let lastError: any = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    await paceGoogleRequest(attempt);
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
      lastError = error;
      // A timeout or a dropped connection is usually the rate limiter; retry
      // after a growing pause instead of surfacing it on the first try.
      consecutiveThrottles++;
      if (attempt < 2) continue;
      const failed = error?.xmlhttp || error?.xhr;
      const detail = responseDetail(getXhrResponseBody(failed)) || error?.message || "";
      throw new Error(
        getString("provider-error-google-network", { args: { detail: redactSecrets(detail) } }),
      );
    }

    if (isRedirectStatus(xhr?.status)) {
      consecutiveThrottles++;
      throw new Error(redirectErrorMessage(xhr));
    }
    if (xhr && xhr.status === 429) {
      consecutiveThrottles++;
      if (attempt < 2) continue;
      throw new Error(getString("network-hint-rate-limit"));
    }
    break;
  }
  if (lastError && !xhr) {
    const detail = lastError?.message || "";
    throw new Error(
      getString("provider-error-google-network", { args: { detail: redactSecrets(detail) } }),
    );
  }
  if (xhr && xhr.status >= 200 && xhr.status < 300) consecutiveThrottles = 0;

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
