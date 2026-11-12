// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — retry pacing for provider HTTP calls.
//
// No imports: Node's type stripping loads this file directly in unit tests.

/** Exponential backoff between retries: 1s, 2s, 4s… capped at 8s. */
export function retryDelayMs(attempt: number, baseMs = 1000, capMs = 8000): number {
  const delay = baseMs * 2 ** Math.max(0, attempt);
  return Math.min(capMs, delay);
}

/** Statuses that a retry can plausibly help with: throttling and 5xx. */
export function isRetryableStatus(status: unknown): boolean {
  if (status === 429) return true;
  return typeof status === "number" && status >= 500 && status < 600;
}
