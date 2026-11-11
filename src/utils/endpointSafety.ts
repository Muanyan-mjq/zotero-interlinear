// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — decides whether an endpoint would send a credential over plain
// HTTP to somewhere it could be observed.
//
// No imports: Node's type stripping loads this file directly in unit tests.
//
// Policy (from docs/dev/RESEARCH-key-security.md §5.7):
//   https://                                  → fine
//   http:// localhost / 127.0.0.0/8 / ::1      → fine (loopback never leaves the machine)
//   http:// 10/8, 172.16/12, 192.168/16, 169.254/16, fc00::/7, fe80::/10 → fine (LAN)
//   http:// anything else                     → warn and require a second confirmation

export type EndpointReason = "ok" | "invalid" | "public-http";

export interface EndpointAssessment {
  /** Trimmed input, for messages. */
  input: string;
  /** False when the value is not an absolute http(s) URL. */
  valid: boolean;
  /** Lowercased, without brackets for IPv6. Empty when invalid. */
  host: string;
  scheme: string;
  /** True when saving should show a warning and ask for confirmation. */
  needsConfirmation: boolean;
  reason: EndpointReason;
}

const LOOPBACK_NAMES = new Set(["localhost", "localhost.", "::1", "0:0:0:0:0:0:0:1"]);

function stripBrackets(host: string): string {
  return host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
}

function unmapIpv4(host: string): string {
  const lower = host.toLowerCase();
  const prefix = "::ffff:";
  if (!lower.startsWith(prefix)) return lower;
  const rest = lower.slice(prefix.length);
  const parsed = parseIpv4(rest);
  if (parsed) return rest;
  // `new URL()` normalises `::ffff:127.0.0.1` to the hex form `::ffff:7f00:1`.
  const hex = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/u.exec(rest);
  if (!hex) return lower;
  const high = Number.parseInt(hex[1], 16);
  const low = Number.parseInt(hex[2], 16);
  return [high >> 8, high & 0xff, low >> 8, low & 0xff].join(".");
}

function parseIpv4(host: string): number[] | null {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return null;
  const parts = match.slice(1).map((part) => Number(part));
  if (parts.some((part) => part > 255)) return null;
  return parts;
}

export function isLoopbackHost(rawHost: string): boolean {
  const host = unmapIpv4(stripBrackets(rawHost.trim().toLowerCase()));
  if (LOOPBACK_NAMES.has(host)) return true;
  if (host.endsWith(".localhost")) return true;
  const ipv4 = parseIpv4(host);
  if (ipv4) return ipv4[0] === 127;
  return false;
}

export function isPrivateHost(rawHost: string): boolean {
  const host = unmapIpv4(stripBrackets(rawHost.trim().toLowerCase()));

  const ipv4 = parseIpv4(host);
  if (ipv4) {
    const [a, b] = ipv4;
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    return false;
  }

  // IPv6 unique-local (fc00::/7) and link-local (fe80::/10).
  if (/^f[cd][0-9a-f]{0,2}:/u.test(host)) return true;
  if (/^fe[89ab][0-9a-f]?:/u.test(host)) return true;

  return false;
}

export function assessEndpoint(raw: string): EndpointAssessment {
  const input = (raw || "").trim();
  if (!input) {
    return { input, valid: false, host: "", scheme: "", needsConfirmation: false, reason: "invalid" };
  }

  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch (_) {
    return { input, valid: false, host: "", scheme: "", needsConfirmation: false, reason: "invalid" };
  }

  const scheme = parsed.protocol.replace(/:$/u, "").toLowerCase();
  const host = stripBrackets(parsed.hostname.toLowerCase());

  if (scheme !== "http" && scheme !== "https") {
    // Anything that is not plain HTTP is not downgraded by us; whether the
    // provider accepts it is a separate concern.
    return { input, valid: false, host, scheme, needsConfirmation: false, reason: "invalid" };
  }

  if (scheme === "https") {
    return { input, valid: true, host, scheme, needsConfirmation: false, reason: "ok" };
  }

  const trusted = isLoopbackHost(host) || isPrivateHost(host);
  return {
    input,
    valid: true,
    host,
    scheme,
    needsConfirmation: !trusted,
    reason: trusted ? "ok" : "public-http",
  };
}

/** Human-readable host for warnings, falling back to the raw input. */
export function endpointLabel(raw: string): string {
  const assessment = assessEndpoint(raw);
  return assessment.host || assessment.input;
}
