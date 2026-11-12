import assert from "node:assert/strict";
import test from "node:test";

import { isRetryableStatus, retryDelayMs } from "../src/utils/retry.ts";

test("retryDelayMs grows exponentially and is capped", () => {
  assert.equal(retryDelayMs(0), 1000);
  assert.equal(retryDelayMs(1), 2000);
  assert.equal(retryDelayMs(2), 4000);
  assert.equal(retryDelayMs(3), 8000);
  assert.equal(retryDelayMs(10), 8000);
  assert.equal(retryDelayMs(-1), 1000);
});

test("isRetryableStatus accepts 429 and 5xx only", () => {
  assert.equal(isRetryableStatus(429), true);
  assert.equal(isRetryableStatus(500), true);
  assert.equal(isRetryableStatus(503), true);
  assert.equal(isRetryableStatus(400), false);
  assert.equal(isRetryableStatus(401), false);
  assert.equal(isRetryableStatus(404), false);
  assert.equal(isRetryableStatus("429"), false);
  assert.equal(isRetryableStatus(null), false);
  assert.equal(isRetryableStatus(undefined), false);
});
