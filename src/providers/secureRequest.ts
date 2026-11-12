// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — HTTP requests that carry a credential must never follow a
// redirect, because the request headers (and therefore the key) would be sent
// to whatever host the redirect points at.
//
// `Zotero.HTTP.request` accepts `followRedirects: false`; in that mode it
// cancels the channel during `asyncOnChannelRedirect` and resolves with a small
// stand-in object whose `status` is the 3xx code and whose `getResponseHeader`
// only answers for `Location` (see chrome/content/zotero/xpcom/http.js).

import { getString } from "../utils/locale";
import { isCaptchaRedirect } from "../utils/redirect";

export function isRedirectStatus(status: unknown): boolean {
  return typeof status === "number" && status >= 300 && status < 400;
}

export function getRedirectLocation(xhr: any): string {
  try {
    const location = xhr?.getResponseHeader?.("Location");
    return typeof location === "string" ? location : "";
  } catch (_) {
    return "";
  }
}

export function redirectErrorMessage(xhr: any): string {
  const location = getRedirectLocation(xhr);
  if (isCaptchaRedirect(location)) return getString("provider-error-captcha");
  return location
    ? getString("provider-error-redirect", { args: { location } })
    : getString("provider-error-redirect-unknown");
}

/**
 * Request options for anything that sends an API key. Spread into the options
 * object passed to `Zotero.HTTP.request`.
 */
export const NO_REDIRECT_OPTIONS = { followRedirects: false } as const;
