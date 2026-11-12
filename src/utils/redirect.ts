// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — what a 3xx actually means.
//
// No imports: Node's type stripping loads this file directly in unit tests.

/**
 * Google answers automated traffic with a redirect to its "sorry" interstitial
 * (`www.google.com/sorry/index?continue=…`), which is a captcha/abuse block, not
 * an endpoint move. Treating it as "enter the final address" sends the user in
 * circles; it should read as a rate limit instead.
 */
export function isCaptchaRedirect(location: unknown): boolean {
  const value = typeof location === "string" ? location.trim().toLowerCase() : "";
  if (!value) return false;
  return (
    /\/sorry\//u.test(value) ||
    /google\.[a-z.]+\/sorry/u.test(value) ||
    /consent\.google\.com\/consent/u.test(value) ||
    /captcha/u.test(value)
  );
}

/** Redirect that points at the same host and looks like a normal endpoint move. */
export function isSameHostRedirect(location: unknown, endpoint: unknown): boolean {
  const target = typeof location === "string" ? location.trim() : "";
  const base = typeof endpoint === "string" ? endpoint.trim() : "";
  if (!target || !base) return false;
  try {
    return new URL(target).host.toLowerCase() === new URL(base).host.toLowerCase();
  } catch (_) {
    return false;
  }
}
