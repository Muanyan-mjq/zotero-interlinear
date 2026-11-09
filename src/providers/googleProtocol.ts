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
  const params = new URLSearchParams();
  params.set("client", "gtx");
  params.set("sl", input.source || "auto");
  params.set("tl", input.target);
  params.set("dt", "t");
  params.set("q", input.text);
  return params.toString();
}

/** Google returns `[[[translated, original, ...], ...], ...]`. */
export function parseGoogleResponse(payload: any): string | null {
  const segments = payload?.[0];
  if (!Array.isArray(segments)) return null;

  const parts: string[] = [];
  for (const segment of segments) {
    if (!Array.isArray(segment) || segment.length < 2) return null;
    if (typeof segment[0] !== "string") return null;
    parts.push(segment[0]);
  }

  const text = parts.join("").trim();
  return text || null;
}
