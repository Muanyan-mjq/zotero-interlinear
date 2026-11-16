// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — Alibaba Cloud Machine Translation RPC protocol helpers.
//
// No imports: Node's type stripping loads this file directly in unit tests.
// The signature follows the RPC style used by the `alimt` product:
// canonicalized, sorted, RFC 3986 encoded parameters, then HMAC-SHA1 over
// `POST&%2F&<canonical query>` with the AccessKey secret as the key.

export const ALIBABA_ENDPOINT = "https://mt.cn-hangzhou.aliyuncs.com/";
export const ALIBABA_API_VERSION = "2018-10-12";
/** TranslateGeneral rejects a single SourceText above this length. */
export const ALIBABA_MAX_CHARS = 5000;

const ALIBABA_LANGUAGES: Record<string, string> = {
  "zh-CN": "zh",
  "zh-TW": "zh-tw",
};

/** Map the plugin's language codes onto Alibaba's `zh` / `zh-tw`. */
export function alibabaLanguage(code: string): string {
  const value = String(code || "").trim();
  if (!value) return "";
  return ALIBABA_LANGUAGES[value] || value;
}

/**
 * RFC 3986 encoding as required by Alibaba RPC: keep `A-Z a-z 0-9 - _ . ~`,
 * encode everything else (including `*`, `!`, `'`, `(`, `)`).
 */
export function alibabaPercentEncode(value: string): string {
  return encodeURIComponent(String(value))
    .replace(/[!'()*]/gu, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%7E/giu, "~");
}

/** Parameters sorted by name and joined with `&`, both sides encoded. */
export function buildAlibabaCanonicalQuery(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map((key) => `${alibabaPercentEncode(key)}=${alibabaPercentEncode(params[key] ?? "")}`)
    .join("&");
}

export function buildAlibabaStringToSign(
  params: Record<string, string>,
  method = "POST",
): string {
  return `${method.toUpperCase()}&${alibabaPercentEncode("/")}&${alibabaPercentEncode(
    buildAlibabaCanonicalQuery(params),
  )}`;
}

/** Form-urlencoded body; the signature itself is appended last. */
export function buildAlibabaBody(
  params: Record<string, string>,
  signature: string,
): string {
  return `${buildAlibabaCanonicalQuery(params)}&Signature=${alibabaPercentEncode(signature)}`;
}

export interface AlibabaParamsInput {
  accessKeyId: string;
  action?: string;
  sourceLanguage: string;
  targetLanguage: string;
  text: string;
  nonce: string;
  timestamp: string;
}

export function buildAlibabaParams(input: AlibabaParamsInput): Record<string, string> {
  return {
    AccessKeyId: input.accessKeyId,
    Action: input.action || "TranslateGeneral",
    Format: "JSON",
    FormatType: "text",
    RegionId: "cn-hangzhou",
    Scene: "general",
    SignatureMethod: "HMAC-SHA1",
    SignatureNonce: input.nonce,
    SignatureVersion: "1.0",
    SourceLanguage: alibabaLanguage(input.sourceLanguage) || "auto",
    SourceText: input.text,
    TargetLanguage: alibabaLanguage(input.targetLanguage) || "en",
    Timestamp: input.timestamp,
    Version: ALIBABA_API_VERSION,
  };
}

/** `2026-11-16T08:00:00Z` — Alibaba rejects fractional seconds. */
export function alibabaTimestamp(date = new Date()): string {
  return date.toISOString().replace(/\.\d{3}Z$/u, "Z");
}

export async function signAlibabaStringToSign(
  accessKeySecret: string,
  stringToSign: string,
): Promise<string> {
  const subtle = (globalThis as any).crypto?.subtle;
  if (!subtle) throw new Error("WebCrypto HMAC-SHA1 is unavailable");
  const encoder = new TextEncoder();
  const key = await subtle.importKey(
    "raw",
    encoder.encode(`${accessKeySecret}&`),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const signature = await subtle.sign("HMAC", key, encoder.encode(stringToSign));
  const bytes = new Uint8Array(signature);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export interface AlibabaResult {
  ok: boolean;
  text?: string;
  code?: string;
  message?: string;
  requestId?: string;
  detectedLanguage?: string;
}

/** Accepts only `Code: 200` with a non-empty `Data.Translated`. */
export function parseAlibabaTranslation(payload: unknown): AlibabaResult {
  const root = payload as any;
  if (!root || typeof root !== "object") {
    return { ok: false, code: "", message: "" };
  }
  const code = root.Code ?? root.code;
  const message = root.Message ?? root.message ?? "";
  const requestId = root.RequestId ?? root.requestId ?? "";
  const data = root.Data ?? root.data;
  const translated = data?.Translated ?? data?.translated;
  const detected = data?.DetectedLanguage ?? data?.detectedLanguage;
  if (String(code) === "200" && typeof translated === "string" && translated.trim()) {
    return {
      ok: true,
      text: translated.trim(),
      code: "200",
      requestId: String(requestId || ""),
      detectedLanguage: typeof detected === "string" ? detected : undefined,
    };
  }
  return {
    ok: false,
    code: code === undefined || code === null ? "" : String(code),
    message: String(message || ""),
    requestId: String(requestId || ""),
  };
}

/** QPS / throttling answers must pause the run instead of failing fast. */
export function isAlibabaThrottle(code: string, message = ""): boolean {
  return (
    String(code) === "429" ||
    /qps|throttl|too many requests|rate.?limit|频繁|限流/iu.test(String(message || ""))
  );
}
