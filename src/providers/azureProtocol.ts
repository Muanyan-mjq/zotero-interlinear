// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — Azure AI Translator REST protocol helpers.
//
// No imports: Node's type stripping loads this file directly in unit tests.
// Endpoint shape: POST {base}/translate?api-version=3.0&from=..&to=..
// Body: [{ "Text": "..." }, ...] — the response preserves input order.

export const DEFAULT_AZURE_ENDPOINT = "https://api.cognitive.microsofttranslator.com";
export const AZURE_API_VERSION = "3.0";

/**
 * Azure uses script subtags: zh-Hans / zh-Hant. An empty string means "let the
 * service detect it" and is only valid for `from`.
 */
export function azureLanguage(code: string): string {
  const value = String(code || "").trim();
  if (!value || /^auto$/iu.test(value)) return "";
  if (/^zh$/iu.test(value) || /^zh-(?:cn|sg|hans|my)$/iu.test(value)) {
    return "zh-Hans";
  }
  if (/^zh-(?:tw|hk|mo|hant)$/iu.test(value)) return "zh-Hant";
  return value;
}

/** Accepts a bare host, a base URL, or a full `.../translate` URL. */
export function normalizeAzureEndpoint(raw: string): string {
  let value = String(raw || "").trim();
  if (!value) return DEFAULT_AZURE_ENDPOINT;
  if (!/^https?:\/\//iu.test(value)) value = `https://${value}`;
  value = value.replace(/\/+$/u, "");
  return value.replace(/\/translate$/iu, "");
}

export function buildAzureEndpoint(
  baseURL: string,
  sourceLanguage: string,
  targetLanguage: string,
): string {
  const params = new URLSearchParams();
  params.set("api-version", AZURE_API_VERSION);
  const from = azureLanguage(sourceLanguage);
  if (from) params.set("from", from);
  params.set("to", azureLanguage(targetLanguage) || "en");
  return `${normalizeAzureEndpoint(baseURL)}/translate?${params.toString()}`;
}

export function buildAzureBody(texts: string[]): string {
  return JSON.stringify(texts.map((text) => ({ Text: text })));
}

/** Requires one non-empty translation per input, in order. */
export function parseAzureTranslations(
  payload: unknown,
  expectedCount: number,
): string[] | null {
  if (!Array.isArray(payload) || payload.length !== expectedCount) return null;
  const results: string[] = [];
  for (const entry of payload) {
    const text = (entry as any)?.translations?.[0]?.text;
    if (typeof text !== "string" || !text.trim()) return null;
    results.push(text.trim());
  }
  return results;
}

/** Azure errors look like `{ error: { code, message } }`. */
export function extractAzureError(payload: unknown): string {
  const error = (payload as any)?.error;
  if (!error) return "";
  const code =
    typeof error.code === "string" || typeof error.code === "number"
      ? String(error.code)
      : "";
  const message = typeof error.message === "string" ? error.message : "";
  return [code, message].filter(Boolean).join(": ");
}
