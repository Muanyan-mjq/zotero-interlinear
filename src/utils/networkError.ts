// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — turns a failed request into a cause we can give advice about.
//
// No imports: Node's type stripping loads this file directly in unit tests.

export type NetworkFailureKind =
  | "timeout"
  | "dns"
  | "refused"
  | "reset"
  | "connection"
  | "rate-limit"
  | "redirect"
  | "http"
  | "parse"
  | "empty"
  | "unknown";

export interface NetworkFailureInput {
  /** HTTP status when the request actually got a response. */
  status?: number;
  /** Error message / detail text (Gecko `NS_ERROR_*`, Node codes, provider text). */
  message?: string;
  /** The response body could not be parsed as the expected shape. */
  parseFailed?: boolean;
  /** The provider answered but produced no usable text. */
  empty?: boolean;
}

/**
 * Order matters: an HTTP status wins over message sniffing, parsing wins over
 * an empty body, and the specific transport errors (timeout/DNS/refused/reset)
 * must be tested before the generic "network" bucket.
 */
export function classifyNetworkFailure(input: NetworkFailureInput): NetworkFailureKind {
  const { status } = input;
  if (status) {
    if (status >= 300 && status < 400) return "redirect";
    if (status === 429) return "rate-limit";
    return "http";
  }
  if (input.parseFailed) return "parse";
  if (input.empty) return "empty";

  const text = String(input.message ?? "").toLowerCase();
  if (!text) return "unknown";

  if (/ns_error_net_timeout|timed?\s*out|timeout|etimedout/.test(text)) return "timeout";
  if (/ns_error_unknown_host|ns_error_dns|unknown host|dns|name or service not known|eai_again|enotfound/.test(text)) {
    return "dns";
  }
  if (/ns_error_connection_refused|connection refused|econnrefused/.test(text)) return "refused";
  if (/ns_error_net_reset|ns_error_net_interrupt|connection reset|econnreset|broken pipe|socket hang up/.test(text)) {
    return "reset";
  }
  if (/proxy|ns_error_net_|ns_error_offline|unreachable|network is down|enetunreach|connect/.test(text)) {
    return "connection";
  }
  return "unknown";
}

/** Whether the user can plausibly do something about this failure. */
export function isActionableFailure(kind: NetworkFailureKind): boolean {
  return kind !== "unknown";
}
