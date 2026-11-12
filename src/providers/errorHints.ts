// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — one actionable sentence appended to a failed request.

import { getString } from "../utils/locale";
import { classifyNetworkFailure, type NetworkFailureKind } from "../utils/networkError";

const MESSAGE_IDS: Record<NetworkFailureKind, string> = {
  timeout: "network-hint-timeout",
  dns: "network-hint-dns",
  refused: "network-hint-refused",
  reset: "network-hint-reset",
  connection: "network-hint-connection",
  "rate-limit": "network-hint-rate-limit",
  redirect: "network-hint-redirect",
  http: "network-hint-http",
  parse: "network-hint-parse",
  empty: "network-hint-empty",
  unknown: "network-hint-unknown",
};

/**
 * Advice for a failure, already localized. Deliberately mentions only generic
 * remedies: no mirror hostnames, no hints about which service is reliable.
 */
export function networkHint(kind: NetworkFailureKind): string {
  // The message ids live in our FTL bundle; the cast keeps TypeScript honest
  // without listing every id in the generated typings by hand.
  return getString(MESSAGE_IDS[kind] as any);
}

/** Classify and describe in one step. */
export function describeFailure(input: {
  status?: number;
  message?: string;
  parseFailed?: boolean;
  empty?: boolean;
}): { kind: NetworkFailureKind; hint: string } {
  const kind = classifyNetworkFailure(input);
  return { kind, hint: networkHint(kind) };
}
