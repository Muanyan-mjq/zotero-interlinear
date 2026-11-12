import assert from "node:assert/strict";
import test from "node:test";

import {
  assessEndpoint,
  endpointLabel,
  isLoopbackHost,
  isPrivateHost,
} from "../src/utils/endpointSafety.ts";

test("https endpoints never need confirmation", () => {
  for (const url of [
    "https://api.openai.com/v1/chat/completions",
    "https://api.anthropic.com/v1/messages",
    "https://generativelanguage.googleapis.com",
    "HTTPS://API.EXAMPLE.COM/path",
  ]) {
    const result = assessEndpoint(url);
    assert.equal(result.valid, true, url);
    assert.equal(result.scheme, "https", url);
    assert.equal(result.needsConfirmation, false, url);
    assert.equal(result.reason, "ok", url);
  }
});

test("loopback http is fine, including IPv6, ports and userinfo", () => {
  for (const url of [
    "http://localhost:11434/v1/chat/completions",
    "http://127.0.0.1:11434",
    "http://127.1.2.3:8080/v1",
    "http://[::1]:11434/v1",
    "http://[::1]/v1",
    "http://LOCALHOST:11434",
    "http://user:pass@127.0.0.1:11434/v1",
    "http://app.localhost:3000/v1",
    "http://[::ffff:127.0.0.1]:11434",
  ]) {
    const result = assessEndpoint(url);
    assert.equal(result.valid, true, url);
    assert.equal(result.needsConfirmation, false, url);
    assert.equal(result.reason, "ok", url);
  }
});

test("private LAN http is fine", () => {
  for (const url of [
    "http://10.0.0.5:8000/v1",
    "http://172.16.0.9:8000",
    "http://172.31.255.254:8000",
    "http://192.168.1.10:11434",
    "http://169.254.10.20:8000",
    "http://[fd00::1]:8000",
    "http://[fe80::1]:8000",
  ]) {
    const result = assessEndpoint(url);
    assert.equal(result.needsConfirmation, false, url);
    assert.equal(result.reason, "ok", url);
  }
});

test("public plain HTTP needs confirmation", () => {
  for (const url of [
    "http://api.example.com/v1/chat/completions",
    "http://8.8.8.8/v1",
    "http://172.32.0.1/v1",
    "http://192.169.1.1/v1",
    "http://113.1.2.3:9000/v1",
  ]) {
    const result = assessEndpoint(url);
    assert.equal(result.needsConfirmation, true, url);
    assert.equal(result.reason, "public-http", url);
  }
});

test("loopback lookalikes are not treated as loopback", () => {
  for (const url of [
    "http://127.0.0.1.evil.com/v1",
    "http://localhost.evil.com/v1",
    "http://localh0st/v1",
    "http://192.168.1.1.evil.com/v1",
  ]) {
    const result = assessEndpoint(url);
    assert.equal(result.needsConfirmation, true, url);
  }
});

test("invalid and non-http values are reported as invalid without confirmation", () => {
  for (const url of ["", "   ", "not a url", "http://127.0.0.256/v1", "ftp://example.com/x", "file:///tmp/x", "javascript:alert(1)"]) {
    const result = assessEndpoint(url);
    assert.equal(result.valid, false, url);
    assert.equal(result.needsConfirmation, false, url);
  }
});

test("host helpers classify independently", () => {
  assert.equal(isLoopbackHost("127.0.0.1"), true);
  assert.equal(isLoopbackHost("::1"), true);
  assert.equal(isLoopbackHost("127.0.0.1.evil.com"), false);
  assert.equal(isPrivateHost("192.168.0.1"), true);
  assert.equal(isPrivateHost("172.15.0.1"), false);
  assert.equal(isPrivateHost("172.16.0.1"), true);
  assert.equal(isPrivateHost("fd12:3456::1"), true);
  assert.equal(isPrivateHost("fe80::1"), true);
  assert.equal(isPrivateHost("2001:db8::1"), false);
});

test("endpointLabel prefers the parsed host", () => {
  assert.equal(endpointLabel("http://api.example.com:8080/v1"), "api.example.com");
  assert.equal(endpointLabel("http://[::1]:11434"), "::1");
  assert.equal(endpointLabel("nonsense"), "nonsense");
});
