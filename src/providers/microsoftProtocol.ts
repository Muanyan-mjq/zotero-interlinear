// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — Microsoft Edge translation endpoint protocol helpers.

/**
 * The endpoint Edge itself uses for its built-in translator. It is
 * undocumented, needs no key, accepts a JSON array of segments and answers in
 * order — which makes it a useful last-resort pool when every Google quota is
 * blocked.
 */
export const MICROSOFT_EDGE_ENDPOINT =
  "https://edge.microsoft.com/translate/translatetext";

/**
 * Edge uses BCP-47 script subtags for Chinese (`zh-Hans` / `zh-Hant`), while
 * the plugin stores the regional forms. An empty string means "detect".
 */
export function microsoftLanguage(code: string): string {
  const value = String(code || "").trim();
  if (!value || value === "auto") return "";
  if (/^zh$/iu.test(value)) return "zh-Hans";
  if (/^zh-(?:cn|sg|hans|my)$/iu.test(value)) return "zh-Hans";
  if (/^zh-(?:tw|hk|mo|hant)$/iu.test(value)) return "zh-Hant";
  return value;
}

export function buildMicrosoftEndpoint(
  source: string,
  target: string,
  baseURL: string = MICROSOFT_EDGE_ENDPOINT,
): string {
  const params = new URLSearchParams();
  const from = microsoftLanguage(source);
  // Omitting `from` lets the service detect the language.
  if (from) params.set("from", from);
  params.set("to", microsoftLanguage(target) || "en");
  params.set("isEnterpriseClient", "false");
  const base = String(baseURL || MICROSOFT_EDGE_ENDPOINT).trim();
  return `${base}${base.includes("?") ? "&" : "?"}${params.toString()}`;
}

export function buildMicrosoftBody(texts: string[]): string {
  return JSON.stringify(texts);
}

/** `[{detectedLanguage?, translations: [{text, to, ...}]}]` in request order. */
export function parseMicrosoftTranslations(
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
