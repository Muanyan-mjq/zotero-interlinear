// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — Google Translate provider (free endpoint, per-client pools).

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
  /** One of the free `client` quota pools, e.g. `it`, `at`, `gtx`. */
  client?: string;
  sourceLanguage: string;
  targetLanguage: string;
  timeoutMs: number;
}

/**
 * Thrown when a free endpoint signals IP-level throttling (429 or the
 * "sorry" captcha redirect). `cooldownMs` is the wait the *runner* should
 * apply; individual backends use 0 so the free-service router can switch to
 * another pool immediately instead of parking the whole run.
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
 * Keep at least one second between requests from this client. The free pools
 * throttle by IP, so even with automatic pool rotation a burst would burn
 * every pool in seconds.
 */
const MIN_INTERVAL_MS = 1000;
let nextSlotAt = 0;

async function paceGoogleRequest(): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, nextSlotAt - now);
  nextSlotAt = now + wait + MIN_INTERVAL_MS;
  if (wait > 0) await Zotero.Promise.delay(wait);
}

function throttleError(xhr: any): GoogleThrottleError {
  if (isCaptchaRedirect(getRedirectLocation(xhr))) {
    return new GoogleThrottleError(redirectErrorMessage(xhr), 0);
  }
  return new GoogleThrottleError(getString("network-hint-rate-limit"), 0);
}

/**
 * Translate one or more segments in a single request. `translate_a/t` answers
 * a multi-`q` body with one result per segment, in order; a batch of N
 * paragraphs therefore costs one request instead of N.
 */
export async function requestGoogleTranslations(
  config: GoogleConfig,
  texts: string[],
): Promise<string[]> {
  if (!texts.length) return [];
  const endpoint = normalizeGoogleEndpoint(config.baseURL);
  const body = buildGoogleQueryMulti(
    config.sourceLanguage,
    config.targetLanguage,
    texts,
    config.client,
  );

  await paceGoogleRequest();
  let xhr: any;
  try {
    // POST keeps long paragraphs out of the URL; the endpoint accepts a
    // form-encoded body on the same path.
    xhr = await Zotero.HTTP.request("POST", endpoint, {
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body,
      responseType: "text",
      ...NO_REDIRECT_OPTIONS,
      timeout: config.timeoutMs,
    });
  } catch (error: any) {
    // `Zotero.HTTP.request` rejects non-2xx statuses, so a 429 or a blocked
    // redirect can arrive either as a thrown error or as a resolved response.
    // `noRetryOnThrottle` in NO_REDIRECT_OPTIONS keeps Zotero from parking the
    // request in its own (up to one hour long) 429 retry loop.
    const failed = error?.xmlhttp || error?.xhr;
    if (isRedirectStatus(failed?.status)) {
      if (isCaptchaRedirect(getRedirectLocation(failed))) throw throttleError(failed);
      throw new Error(redirectErrorMessage(failed));
    }
    if (failed?.status === 429) throw throttleError(failed);
    const detail = responseDetail(getXhrResponseBody(failed)) || error?.message || "";
    throw new Error(
      getString("provider-error-google-network", { args: { detail: redactSecrets(detail) } }),
    );
  }

  if (isRedirectStatus(xhr?.status)) {
    if (isCaptchaRedirect(getRedirectLocation(xhr))) throw throttleError(xhr);
    throw new Error(redirectErrorMessage(xhr));
  }
  if (xhr?.status === 429) throw throttleError(xhr);
  if (!xhr || xhr.status < 200 || xhr.status >= 300) {
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
  client?: string,
): Promise<string> {
  return requestGoogleTranslation(
    { baseURL, client, sourceLanguage: "auto", targetLanguage, timeoutMs: 15000 },
    "Hello",
  );
}
