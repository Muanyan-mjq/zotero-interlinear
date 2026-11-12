import assert from "node:assert/strict";
import test from "node:test";

import { classifyNetworkFailure, isActionableFailure } from "../src/utils/networkError.ts";

test("HTTP status wins over message sniffing", () => {
  assert.equal(classifyNetworkFailure({ status: 404, message: "timeout" }), "http");
  assert.equal(classifyNetworkFailure({ status: 500 }), "http");
  assert.equal(classifyNetworkFailure({ status: 429 }), "rate-limit");
  assert.equal(classifyNetworkFailure({ status: 301 }), "redirect");
  assert.equal(classifyNetworkFailure({ status: 302 }), "redirect");
});

test("transport failures are separated", () => {
  assert.equal(classifyNetworkFailure({ message: "NS_ERROR_NET_TIMEOUT" }), "timeout");
  assert.equal(classifyNetworkFailure({ message: "The operation timed out" }), "timeout");
  assert.equal(classifyNetworkFailure({ message: "NS_ERROR_UNKNOWN_HOST" }), "dns");
  assert.equal(classifyNetworkFailure({ message: "getaddrinfo ENOTFOUND api.example.com" }), "dns");
  assert.equal(classifyNetworkFailure({ message: "NS_ERROR_CONNECTION_REFUSED" }), "refused");
  assert.equal(classifyNetworkFailure({ message: "connect ECONNREFUSED 127.0.0.1:11434" }), "refused");
  assert.equal(classifyNetworkFailure({ message: "NS_ERROR_NET_RESET" }), "reset");
  assert.equal(classifyNetworkFailure({ message: "socket hang up" }), "reset");
  assert.equal(classifyNetworkFailure({ message: "proxy connect failed" }), "connection");
  assert.equal(classifyNetworkFailure({ message: "Network is unreachable" }), "connection");
});

test("parse and empty responses are distinct from transport errors", () => {
  assert.equal(classifyNetworkFailure({ parseFailed: true, status: 200 }), "http");
  assert.equal(classifyNetworkFailure({ parseFailed: true }), "parse");
  assert.equal(classifyNetworkFailure({ empty: true }), "empty");
});

test("unknown fallbacks stay unknown", () => {
  assert.equal(classifyNetworkFailure({}), "unknown");
  assert.equal(classifyNetworkFailure({ message: "" }), "unknown");
  assert.equal(classifyNetworkFailure({ message: "something odd happened" }), "unknown");
  assert.equal(isActionableFailure("unknown"), false);
  assert.equal(isActionableFailure("timeout"), true);
});
