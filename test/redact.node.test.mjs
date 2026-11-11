import assert from "node:assert/strict";
import test from "node:test";

import { REDACTED, redactError, redactSecrets } from "../src/utils/redact.ts";

/** Fake credentials only — never real values. */
const FAKE_OPENAI = "sk-test-000111222333444555666777888999";
const FAKE_ANTHROPIC = "sk-ant-test-000111222333444555";
const FAKE_GOOGLE = "AIzaTEST000111222333444555666777888";
const FAKE_CUSTOM = "relay_9f8e7d6c5b4a3210";

/** Any 8-character window of the secret must be gone from the output. */
function assertNoSecretFragments(output, secret) {
  assert.ok(!output.includes(secret), `output still contains the full secret: ${output}`);
  for (let i = 0; i + 8 <= secret.length; i++) {
    const window = secret.slice(i, i + 8);
    assert.ok(!output.includes(window), `output still contains "${window}": ${output}`);
  }
}

test("replaces a known secret wherever it appears", () => {
  const text = `HTTP 401: Incorrect API key provided: ${FAKE_CUSTOM}. Retry with ${FAKE_CUSTOM}?`;
  const output = redactSecrets(text, [FAKE_CUSTOM]);
  assert.ok(!output.includes(FAKE_CUSTOM));
  assert.equal(output.split(REDACTED).length - 1, 2);
});

test("ignores empty, short and non-string known secrets", () => {
  const text = "plain text about abc and 1234";
  assert.equal(redactSecrets(text, [undefined, "", "abc"]), text);
  assert.equal(redactSecrets(text, []), text);
});

test("masks OpenAI, Anthropic and Google key shapes echoed by a service", () => {
  const text = [
    `Incorrect API key provided: ${FAKE_OPENAI}.`,
    `invalid x-api-key ${FAKE_ANTHROPIC}`,
    `API key not valid. Please pass a valid API key. key=${FAKE_GOOGLE}`,
  ].join(" | ");

  const output = redactSecrets(text);
  assertNoSecretFragments(output, FAKE_OPENAI);
  assertNoSecretFragments(output, FAKE_ANTHROPIC);
  assertNoSecretFragments(output, FAKE_GOOGLE);
  assert.match(output, /sk-\*\*\*/);
  assert.match(output, /AIza\*\*\*/);
});

test("masks header echoes in text and JSON form", () => {
  const output = redactSecrets(
    [
      "Authorization: Bearer sk-test-000111222333444555",
      '"x-api-key": "sk-ant-test-000111222333444555"',
      "x-goog-api-key=AIzaTEST000111222333444555666777888",
    ].join("\n"),
  );

  assert.ok(!output.includes("sk-test-000111222333444555"));
  assert.ok(!output.includes("sk-ant-test-000111222333444555"));
  assert.ok(!output.includes("AIzaTEST000111222333444555666777888"));
  assert.match(output, /Bearer \*\*\*/);
});

test("leaves credential-free text untouched", () => {
  const samples = [
    "OpenAI-compatible service request failed (HTTP 429): Rate limit reached for gpt-oss:20b.",
    "Anthropic Claude returned 529 overloaded_error.",
    "task-management risk-taking disk-usage desk-lamp",
    "段落翻译失败：网络超时，请稍后重试。",
    "GET https://api.example.com/v1/chat/completions?stream=false",
    "模型名 gpt-oss:20b、claude-sonnet-4-5、gemini-2.5-flash 都不含密钥。",
    "sha512:0df65587080c4b0fffdf3a0a36e84b877ee6fa98a96975f4ad95559f09b1cf10",
  ];
  for (const sample of samples) {
    assert.equal(redactSecrets(sample, [FAKE_CUSTOM]), sample);
  }
});

test("keeps a provider error readable after redaction", () => {
  const message = `OpenAI-compatible service request failed (HTTP 401): Incorrect API key provided: ${FAKE_OPENAI}.`;
  const output = redactSecrets(message, [FAKE_OPENAI]);
  assert.match(output, /HTTP 401/);
  assert.match(output, /Incorrect API key provided/);
  assertNoSecretFragments(output, FAKE_OPENAI);
});

test("redacts an Error without losing name, message shape or stack", () => {
  const error = new TypeError(`request failed for ${FAKE_OPENAI}`);
  const redacted = redactError(error, [FAKE_OPENAI]);
  assert.equal(redacted.name, "TypeError");
  assert.ok(!redacted.message.includes(FAKE_OPENAI));
  assert.match(redacted.message, /request failed for/);
  assert.ok(redacted.stack);
  assert.ok(!redacted.stack.includes(FAKE_OPENAI));
});

test("redacts non-Error values and tolerates nullish input", () => {
  assert.equal(redactSecrets(undefined, [FAKE_CUSTOM]), "");
  assert.equal(redactSecrets(null, [FAKE_CUSTOM]), "");
  assert.equal(redactSecrets(42, []), "42");
  assert.equal(redactError({ message: FAKE_CUSTOM }, [FAKE_CUSTOM]).message.includes(FAKE_CUSTOM), false);
});

test("does not redact a short user-visible token that merely looks prefixed", () => {
  // A key shorter than the pattern minimum (sk- plus 8 chars) is not a key.
  assert.equal(redactSecrets("sk-abc"), "sk-abc");
  assert.equal(redactSecrets("AIza1"), "AIza1");
});
