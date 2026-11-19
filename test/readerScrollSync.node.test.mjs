import { test } from "node:test";
import assert from "node:assert/strict";

import {
  pickScrollAnchor,
  targetScrollTop,
} from "../src/readerScrollSync.ts";

test("pickScrollAnchor skips blocks that are fully above the viewport", () => {
  const pick = pickScrollAnchor([
    { refPath: "1", top: -120, height: 100 },
    { refPath: "2", top: -20, height: 100 },
    { refPath: "3", top: 80, height: 100 },
  ]);
  assert.deepEqual(pick, { refPath: "2", progress: 0.2 });
});

test("pickScrollAnchor starts at the first block below the top", () => {
  const pick = pickScrollAnchor([
    { refPath: "1", top: 40, height: 200 },
    { refPath: "2", top: 260, height: 200 },
  ]);
  assert.deepEqual(pick, { refPath: "1", progress: 0 });
});

test("pickScrollAnchor ignores a tall block that is entirely above the viewport", () => {
  assert.equal(
    pickScrollAnchor([{ refPath: "1", top: -300, height: 200 }]),
    null,
  );
});

test("pickScrollAnchor ignores zero-height and empty lists", () => {
  assert.equal(pickScrollAnchor([]), null);
  assert.equal(
    pickScrollAnchor([{ refPath: "1", top: -10, height: 0 }]),
    null,
  );
});

test("targetScrollTop places the same progress inside the peer block", () => {
  assert.equal(targetScrollTop(0, { top: 120, height: 200 }, 0.5), 220);
  assert.equal(targetScrollTop(400, { top: -120, height: 200 }, 0.25), 330);
});

test("targetScrollTop never returns a negative offset", () => {
  assert.equal(targetScrollTop(0, { top: 10, height: 100 }, 0), 10);
  assert.equal(targetScrollTop(0, { top: 10, height: 0 }, 0.5), 0);
});