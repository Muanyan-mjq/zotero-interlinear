// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — Google Translate free-endpoint protocol helpers.

export const DEFAULT_GOOGLE_BASE_URL = "https://translate.googleapis.com";

/**
 * Google's free endpoint is split into per-`client` quota pools. A pool that
 * has been throttled for an IP does not affect the others, and `translate_a/t`
 * answers one translation per `q` value in a plain string array — which makes
 * it a much cheaper batch path than `translate_a/single`.
 */
export const GOOGLE_CLIENTS = [
  "it",
  "at",
  "gtx",
  "dict-chrome-ex",
  "firefox-a",
] as const;
export type GoogleClient = (typeof GOOGLE_CLIENTS)[number];
export const DEFAULT_GOOGLE_CLIENT: GoogleClient = "it";

export function normalizeGoogleClient(raw: string): GoogleClient {
  const value = String(raw || "").trim() as GoogleClient;
  return GOOGLE_CLIENTS.includes(value) ? value : DEFAULT_GOOGLE_CLIENT;
}

/**
 * Accept a base URL or a full endpoint and return a usable `translate_a/t`
 * URL. Legacy `/translate_a/single` URLs are preserved so that a user-supplied
 * mirror keeps working with the response parser for that shape.
 */
export function normalizeGoogleEndpoint(raw: string): string {
  let url = String(raw || "").trim();
  if (!url) url = DEFAULT_GOOGLE_BASE_URL;
  if (!/^https?:\/\//iu.test(url)) url = `https://${url}`;
  url = url.replace(/\/+$/, "");
  if (/\/translate_a\/(?:single|t)$/iu.test(url)) return url;
  return `${url}/translate_a/t`;
}

export interface GoogleQueryInput {
  source: string;
  target: string;
  text: string;
}

export function buildGoogleQuery(input: GoogleQueryInput): string {
  return buildGoogleQueryMulti(input.source, input.target, [input.text]);
}

/**
 * `translate_a/t` accepts the `q` parameter more than once and answers with
 * one translated string per value, in order. Batching segments into a single
 * request cuts the request count per document by the batch size, which matters
 * because the free endpoint throttles by IP.
 */
export function buildGoogleQueryMulti(
  source: string,
  target: string,
  texts: string[],
  client: string = DEFAULT_GOOGLE_CLIENT,
): string {
  const params = new URLSearchParams();
  params.set("client", normalizeGoogleClient(client));
  params.set("sl", source || "auto");
  params.set("tl", target);
  params.set("dt", "t");
  for (const text of texts) params.append("q", text);
  return params.toString();
}

/** Google returns `[[[translated, original, ...], ...], ...]`. */
export function parseGoogleResponse(payload: any): string | null {
  const single = parseSingleResult(payload);
  return single ? single.trim() || null : null;
}

/**
 * Parse a multi-`q` response. `translate_a/t` returns a plain `string[]` with
 * one entry per segment; the older `translate_a/single` endpoint returns one
 * nested `[[[translated, ...], ...]]` payload per segment. Both shapes are
 * accepted, but a wrong count or a bad shape returns null so callers can fall
 * back instead of guessing at paragraph alignment.
 */
export function parseGoogleMultiResponse(payload: any, expectedCount: number): string[] | null {
  if (!Array.isArray(payload) || payload.length !== expectedCount) return null;

  const results: string[] = [];
  for (const entry of payload) {
    const text = typeof entry === "string" ? entry : parseSingleResult(entry);
    if (!text || !text.trim()) return null;
    results.push(text.trim());
  }
  return results;
}

/** Concatenate the `dt=t` sentence segments of one `q` result. */
function parseSingleResult(payload: any): string | null {
  // `translate_a/t` with a single `q` returns a bare string array.
  if (Array.isArray(payload) && payload.length && typeof payload[0] === "string") {
    return payload.join("");
  }
  const segments = payload?.[0];
  if (!Array.isArray(segments)) return null;

  const parts: string[] = [];
  for (const segment of segments) {
    if (!Array.isArray(segment) || segment.length < 2) return null;
    if (typeof segment[0] !== "string") return null;
    parts.push(segment[0]);
  }

  return parts.join("");
}
