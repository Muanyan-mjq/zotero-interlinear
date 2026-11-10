// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — Google Gemini generateContent protocol helpers.
//
// API reference:
// https://ai.google.dev/api/generate-content
// The API key is sent as an x-goog-api-key header, never as a query string,
// so it cannot leak into logs or cache keys.

export const DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com";
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export function normalizeGeminiModel(raw: string): string {
  return String(raw || "")
    .trim()
    .replace(/^models\//iu, "");
}

/**
 * Accept the official base URL, a proxy base, or a full :generateContent URL.
 */
export function buildGeminiEndpoint(rawBase: string, rawModel: string): string {
  let base = String(rawBase || "").trim() || DEFAULT_GEMINI_BASE_URL;
  if (!/^https?:\/\//iu.test(base)) base = `https://${base}`;
  base = base.replace(/\/+$/, "");

  if (/:generateContent$/iu.test(base)) return base;

  const model = normalizeGeminiModel(rawModel);
  if (!model) return base;

  const path = `/models/${encodeURIComponent(model)}:generateContent`;
  if (/\/v\d+[a-z0-9]*$/iu.test(base)) return `${base}${path}`;
  return `${base}/v1beta${path}`;
}

export interface GeminiRequestBodyInput {
  systemPrompt: string;
  text: string;
  temperature: number;
}

export function buildGeminiRequestBody(
  input: GeminiRequestBodyInput,
): Record<string, unknown> {
  return {
    systemInstruction: { parts: [{ text: input.systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: input.text }] }],
    generationConfig: { temperature: input.temperature },
  };
}

export function extractGeminiContent(response: any): string | null {
  const parts = response?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return null;
  const text = parts
    .filter((part: any) => part && part.thought !== true && typeof part.text === "string")
    .map((part: any) => part.text)
    .join("")
    .trim();
  return text || null;
}

export function extractGeminiErrorDetail(body: unknown): string {
  let detail = "";
  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body);
      detail = parsed?.error?.message || parsed?.message || body;
    } catch (_) {
      detail = body;
    }
  } else if (body && typeof body === "object") {
    const parsed = body as any;
    detail = parsed?.error?.message || parsed?.message || "";
  }
  return String(detail || "").trim().slice(0, 300);
}
