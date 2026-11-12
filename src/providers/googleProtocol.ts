// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — Google Translate free-endpoint protocol helpers.

export const DEFAULT_GOOGLE_BASE_URL = "https://translate.googleapis.com";

/**
 * Accept a base URL (with or without scheme/path) and return the endpoint that
 * accepts `client=gtx` queries. A full endpoint is kept verbatim so users can
 * point the provider at a mirror with a non-standard path.
 */
export function normalizeGoogleEndpoint(raw: string): string {
  let url = String(raw || "").trim();
  if (!url) url = DEFAULT_GOOGLE_BASE_URL;
  if (!/^https?:\/\//iu.test(url)) url = `https://${url}`;
  url = url.replace(/\/+$/, "");
  if (/\/translate_a\/single$/iu.test(url)) return url;
  return `${url}/translate_a/single`;
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
 * The `client=gtx` endpoint accepts the `q` parameter more than once and
 * answers with one result per value, in order. Batching segments into a
 * single request cuts the request count per document by the batch size,
 * which matters because the endpoint throttles by IP.
 */
export function buildGoogleQueryMulti(
  source: string,
  target: string,
  texts: string[],
): string {
  const params = new URLSearchParams();
  params.set("client", "gtx");
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
 * Parse a multi-`q` response: an array with one `[[[translated, ...], ...]]`
 * payload per requested segment, in order. Returns null when the shape or the
 * count does not match so callers can treat it as a hard failure instead of
 * guessing at the alignment.
 */
export function parseGoogleMultiResponse(payload: any, expectedCount: number): string[] | null {
  if (!Array.isArray(payload) || payload.length !== expectedCount) return null;
  const results: string[] = [];
  for (const entry of payload) {
    const text = parseSingleResult(entry);
    if (!text || !text.trim()) return null;
    results.push(text.trim());
  }
  return results;
}

/** Concatenate the `dt=t` sentence segments of one `q` result. */
function parseSingleResult(payload: any): string | null {
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
