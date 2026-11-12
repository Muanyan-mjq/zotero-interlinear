import assert from "node:assert/strict";
import test from "node:test";

import { isAllowed, scanText } from "../scripts/check-secrets.mjs";

/** Fake but realistically shaped credentials — never real values. */
const LIVE_SHAPED_OPENAI = `sk-proj-${"a1B2c3D4e5F6g7H8i9J0".repeat(2)}`;
const LIVE_SHAPED_GOOGLE = `AIza${"SyA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6".slice(0, 35)}`;
const LIVE_SHAPED_GITHUB = `ghp_${"a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8".slice(0, 36)}`;

test("detects provider-shaped credentials", () => {
  const findings = scanText(
    [
      `OPENAI_API_KEY=${LIVE_SHAPED_OPENAI}`,
      `google: "${LIVE_SHAPED_GOOGLE}"`,
      `token: ${LIVE_SHAPED_GITHUB}`,
      "Authorization: Bearer abcdefghijklmnopqrstuvwxyz012345", // allow-secret-scan
    ].join("\n"),
  );

  assert.equal(findings.length, 4);
  assert.deepEqual(
    findings.map((finding) => finding.line),
    [1, 2, 3, 4],
  );
  assert.ok(findings.every((finding) => typeof finding.name === "string"));
});

test("detects an embedded private key block", () => {
  // allow-secret-scan: the pattern under test, not a key
  const findings = scanText("const key = `-----BEGIN RSA PRIVATE KEY-----`;");
  assert.equal(findings.length, 1);
  assert.match(findings[0].name, /private key/u);
});

test("does not report placeholders used by tests and docs", () => {
  const text = [
    'const fake = "sk-test-000111222333444555";',
    'const fake2 = "sk-ant-test-000111222333444555";',
    'const fake3 = "AIzaTEST000111222333444555666777888";',
    "文档里的示例：`sk-test-000…`",
    "The key is stored as `oskv1:` ciphertext.",
  ].join("\n");
  assert.deepEqual(scanText(text), []);
});

test("does not report short or ordinary tokens", () => {
  const text = [
    "sk-abc",
    "AIza1",
    "Bearer short",
    "sha512:0df65587080c4b0fffdf3a0a36e84b877ee6fa98a96975f4ad95559f09b1cf10",
    "任务：修复 sk- 前缀的判断",
  ].join("\n");
  assert.deepEqual(scanText(text), []);
});

test("an explicit allow-secret-scan comment suppresses the finding", () => {
  const line = `const sample = "${LIVE_SHAPED_OPENAI}"; // allow-secret-scan`;
  assert.deepEqual(scanText(line), []);
  assert.equal(isAllowed(line, LIVE_SHAPED_OPENAI), true);
});

test("reports the line number, not the file offset", () => {
  const findings = scanText(`line one\nline two\n${LIVE_SHAPED_OPENAI}\n`);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].line, 3);
});
