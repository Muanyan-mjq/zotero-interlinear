// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — Google Translate provider (free `client=gtx` endpoint).

import { getString } from "../utils/locale";
import {
  buildGoogleQueryMulti,
  normalizeGoogleEndpoint,
  parseGoogleMultiResponse,
  parseGoogleResponse,
} from "./googleProtocol";
import { getXhrResponseBody } from "./openaiProtocol";
import { redactSecrets } from "../utils/redact";
import { isCaptchaRedirect } from "../utils/redirect";
import {
  NO_REDIRECT_OPTIONS,
  getRedirectLocation,
  isRedirectStatus,
  redirectErrorMessage,
} from "./secureRequest";

export interface GoogleConfig {
  baseURL: string;
  sourceLanguage: string;
  targetLanguage: string;
  timeoutMs: number;
}

/**
 * Thrown when the free endpoint signals IP-level throttling (429 after
 * retries, or the "sorry" captcha redirect). Carries the cooldown that the
 * caller should wait before trying again so a whole-document run can pause
 * once instead of failing paragraph by paragraph.
 */
export class GoogleThrottleError extends Error {
  readonly cooldownMs: number;

  constructor(message: string, cooldownMs: number) {
    super(message);
    this.name = "GoogleThrottleError";
    this.cooldownMs = cooldownMs;
  }
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
const CAPTCHA_COOLDOWN_MS = 60_000;
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

async function performGoogleRequest(
  config: GoogleConfig,
  body: string,
  expectedCount: number,
): Promise<any> {
  const endpoint = normalizeGoogleEndpoint(config.baseURL);

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
      // `Zotero.HTTP.request` rejects non-2xx statuses, so a 429 or a
      // blocked redirect can arrive either as a thrown error or as a
      // resolved response; classify both the same way.
      const failed = error?.xmlhttp || error?.xhr;
      if (isRedirectStatus(failed?.status)) {
        consecutiveThrottles = Math.max(consecutiveThrottles + 1, 3);
        if (isCaptchaRedirect(getRedirectLocation(failed))) {
          throw new GoogleThrottleError(redirectErrorMessage(failed), CAPTCHA_COOLDOWN_MS);
        }
        throw new Error(redirectErrorMessage(failed));
      }
      if (failed?.status === 429) {
        consecutiveThrottles++;
        if (attempt < 2) continue;
        throw new GoogleThrottleError(getString("network-hint-rate-limit"), googleBackoffMs(2));
      }

      lastError = error;
      // A timeout or a dropped connection is usually the rate limiter; retry
      // after a growing pause instead of surfacing it on the first try.
      consecutiveThrottles++;
      if (attempt < 2) continue;
      const detail = responseDetail(getXhrResponseBody(failed)) || error?.message || "";
      throw new Error(
        getString("provider-error-google-network", { args: { detail: redactSecrets(detail) } }),
      );
    }

    if (isRedirectStatus(xhr?.status)) {
      consecutiveThrottles = Math.max(consecutiveThrottles + 1, 3);
      if (isCaptchaRedirect(getRedirectLocation(xhr))) {
        throw new GoogleThrottleError(redirectErrorMessage(xhr), CAPTCHA_COOLDOWN_MS);
      }
      throw new Error(redirectErrorMessage(xhr));
    }
    if (xhr && xhr.status === 429) {
      consecutiveThrottles++;
      if (attempt < 2) continue;
      throw new GoogleThrottleError(getString("network-hint-rate-limit"), googleBackoffMs(2));
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
  return payload;
}

/**
 * Translate one or more segments in a single request. The endpoint answers a
 * multi-`q` body with one result per segment, in order; a batch of N
 * paragraphs therefore costs one request instead of N.
 */
export async function requestGoogleTranslations(
  config: GoogleConfig,
  texts: string[],
): Promise<string[]> {
  if (!texts.length) return [];
  const payload = await performGoogleRequest(
    config,
    buildGoogleQueryMulti(config.sourceLanguage, config.targetLanguage, texts),
    texts.length,
  );

  if (texts.length === 1) {
    const translated = parseGoogleResponse(payload);
    if (!translated) throw new Error(getString("provider-error-google-empty"));
    return [translated];
  }

  const translated = parseGoogleMultiResponse(payload, texts.length);
  if (!translated) throw new Error(getString("provider-error-google-empty"));
  return translated;
}

export async function requestGoogleTranslation(
  config: GoogleConfig,
  text: string,
): Promise<string> {
  return (await requestGoogleTranslations(config, [text]))[0];
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
