// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — scrubs credentials out of user-visible and logged text.
//
// This module deliberately has no imports so Node's type stripping can load it
// directly in unit tests (same convention as translationCacheKey.ts).
//
// Two layers:
// 1. `knownSecrets` — the exact key values this run holds in memory. Replacing
//    them is the only reliable way to catch providers whose key format we do
//    not know (custom relays, self-hosted gateways).
// 2. Shape patterns — catch keys echoed by a service in an error body
//    (`Incorrect API key provided: sk-…`, `API key not valid: AIza…`) and
//    header echoes (`Authorization: Bearer …`).

export const REDACTED = "***";

/** Minimum length before a known value is treated as a secret to replace. */
const MIN_KNOWN_SECRET_LENGTH = 4;

const PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // OpenAI and most OpenAI-compatible providers / relays.
  { pattern: /\bsk-[A-Za-z0-9_-]{8,}/gu, replacement: `sk-${REDACTED}` },
  // Google API keys (Gemini, Google Cloud).
  { pattern: /\bAIza[0-9A-Za-z_-]{10,}/gu, replacement: `AIza${REDACTED}` },
  // Anthropic keys.
  { pattern: /\bsk-ant-[A-Za-z0-9_-]{8,}/gu, replacement: `sk-ant-${REDACTED}` },
  // Header echoes, in either "Name: value" or JSON form.
  { pattern: /(Bearer\s+)[^\s"',;]+/giu, replacement: `$1${REDACTED}` },
  { pattern: /(x-api-key["']?\s*[:=]\s*["']?)[^\s"',;]+/giu, replacement: `$1${REDACTED}` },
  { pattern: /(x-goog-api-key["']?\s*[:=]\s*["']?)[^\s"',;]+/giu, replacement: `$1${REDACTED}` },
  {
    pattern: /(Authorization["']?\s*[:=]\s*["']?)(?!Bearer\b)[^\s"',;]+/giu,
    replacement: `$1${REDACTED}`,
  },
];

/**
 * Replace every occurrence of the given values and every string that looks like
 * a credential. Safe to call with `undefined`, non-strings, and empty text.
 */
export function redactSecrets(text: unknown, knownSecrets: Array<string | undefined> = []): string {
  if (text === undefined || text === null) return "";
  let output = typeof text === "string" ? text : String(text);
  if (!output) return output;

  for (const secret of knownSecrets) {
    if (typeof secret !== "string") continue;
    const value = secret.trim();
    if (value.length < MIN_KNOWN_SECRET_LENGTH) continue;
    if (!output.includes(value)) continue;
    output = output.split(value).join(REDACTED);
  }

  for (const { pattern, replacement } of PATTERNS) {
    output = output.replace(pattern, replacement);
  }

  return output;
}

/**
 * Redact an error for logging without losing the stack or the error name.
 * Returns the original object when it is not an Error, redacted and stringified.
 */
export function redactError(error: unknown, knownSecrets: Array<string | undefined> = []): Error {
  if (error instanceof Error) {
    const redacted = new Error(redactSecrets(error.message, knownSecrets));
    redacted.name = error.name;
    if (error.stack) redacted.stack = redactSecrets(error.stack, knownSecrets);
    const cause = (error as { cause?: unknown }).cause;
    if (cause !== undefined) (redacted as { cause?: unknown }).cause = cause;
    return redacted;
  }
  return new Error(redactSecrets(error, knownSecrets));
}
