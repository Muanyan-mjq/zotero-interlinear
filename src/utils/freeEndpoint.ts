// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — helpers for user-supplied free translation endpoints.
//
// No imports: Node's type stripping loads this file directly in unit tests.
// Keeping these pure makes it possible to test the template and result-path
// behaviour without booting Zotero.

/**
 * Cap the number of extra Google gateways. Google requests are globally paced
 * at one per second, so a long chain would turn an all-throttled run into a
 * minute-long wait before the cooldown is surfaced.
 */
export const MAX_GOOGLE_MIRRORS = 4;

/**
 * Extra Google gateway hosts, one per line (commas/semicolons also accepted).
 * A bare host is upgraded to https; an existing path is preserved so a
 * Cloudflare Worker mirror can expose a custom route.
 */
export function parseMirrorList(raw: string): string[] {
  const parts = String(raw || "")
    .split(/[\n\r,;]+/u)
    .map((entry) => entry.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of parts) {
    let url = part;
    if (!/^https?:\/\//iu.test(url)) url = `https://${url}`;
    url = url.replace(/\/+$/u, "");
    if (seen.has(url)) continue;
    seen.add(url);
    result.push(url);
    if (result.length >= MAX_GOOGLE_MIRRORS) break;
  }
  return result;
}

/** Placeholders accepted by a custom free endpoint URL template. */
export interface CustomURLValues {
  text: string;
  from: string;
  to: string;
}

/**
 * Substitute `{text}`, `{from}`, `{to}` with URL-encoded values. The template
 * must contain `{text}`, otherwise we would silently send the same request for
 * every paragraph and produce misaligned translations.
 */
export function buildCustomURL(template: string, values: CustomURLValues): string | null {
  const raw = String(template || "").trim();
  if (!raw || !raw.includes("{text}")) return null;
  let url = raw;
  if (!/^https?:\/\//iu.test(url)) url = `https://${url}`;
  url = url.replace(/\{text\}/gu, encodeURIComponent(values.text));
  url = url.replace(/\{from\}/gu, encodeURIComponent(values.from));
  url = url.replace(/\{to\}/gu, encodeURIComponent(values.to));
  // Catch a malformed template rather than issuing a request with braces in it.
  if (/\{(?:text|from|to)\}/u.test(url)) return null;
  return url;
}

/**
 * Read a translated string out of a JSON response using a dotted path, e.g.
 * `responseData.translatedText` (MyMemory) or `translateResult.0.0.tgt`
 * (Youdao). An empty path means the endpoint answers with plain text.
 */
export function readResultPath(payload: unknown, path: string): string | null {
  const trimmed = String(path || "").trim();
  if (!trimmed) {
    return typeof payload === "string" && payload.trim() ? payload.trim() : null;
  }
  let current: any = payload;
  if (typeof current === "string") {
    try {
      current = JSON.parse(current);
    } catch (_) {
      return null;
    }
  }
  for (const key of trimmed.split(".")) {
    if (!key) continue;
    if (current === null || current === undefined) return null;
    current = Array.isArray(current) && /^\d+$/u.test(key) ? current[Number(key)] : current[key];
  }
  if (typeof current === "string") return current.trim() || null;
  if (Array.isArray(current) && current.every((entry) => typeof entry === "string")) {
    return current.join("").trim() || null;
  }
  return null;
}
