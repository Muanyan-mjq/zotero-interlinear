import assert from "node:assert/strict";
import test from "node:test";

import { isCaptchaRedirect, isSameHostRedirect } from "../src/utils/redirect.ts";

test("recognises Google's abuse interstitial", () => {
  const location =
    "https://www.google.com/sorry/index?continue=https://translate.googleapis.com/translate_a/single%3Fq%3Dx";
  assert.equal(isCaptchaRedirect(location), true);
  assert.equal(isCaptchaRedirect("https://translate.google.com/sorry/index"), true);
  assert.equal(isCaptchaRedirect("HTTPS://WWW.GOOGLE.COM/SORRY/INDEX"), true);
});

test("recognises consent and captcha redirects", () => {
  assert.equal(isCaptchaRedirect("https://consent.google.com/consent?continue=x"), true);
  assert.equal(isCaptchaRedirect("https://example.com/captcha?token=1"), true);
});

test("ordinary endpoint moves are not captcha", () => {
  for (const url of [
    "https://api.openai.com/v1/chat/completions",
    "https://api.anthropic.com/v1/messages",
    "https://translate.googleapis.com/translate_a/single?client=gtx",
    "",
  ]) {
    assert.equal(isCaptchaRedirect(url), false, url);
  }
  assert.equal(isCaptchaRedirect(undefined), false);
  assert.equal(isCaptchaRedirect(null), false);
});

test("same-host detection compares hosts only", () => {
  assert.equal(
    isSameHostRedirect("https://api.example.com/v2/x", "https://api.example.com/v1/x"),
    true,
  );
  assert.equal(
    isSameHostRedirect("https://other.example.com/v1/x", "https://api.example.com/v1/x"),
    false,
  );
  assert.equal(isSameHostRedirect("not a url", "https://api.example.com"), false);
});
