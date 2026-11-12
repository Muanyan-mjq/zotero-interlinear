import test from "node:test";
import assert from "node:assert/strict";

import {
  transition,
  isTranslationVisible,
  isTranslationHidden,
  isRunActive,
} from "../src/readerToggle.ts";

// Each row is a literal contract: a wrong branch, missing effect, or wrong
// ordering in transition() must fail the matching row.
const rows = [
  // First click on an untranslated reader starts a run.
  ["empty", "toggle", "running", ["start-run"]],
  // An on-demand translation (shortcut/Alt-click) marks the reader as shown.
  ["empty", "paragraph-translated", "shown", []],
  ["empty", "shortcut", "shown", []],
  // Clicking mid-run pauses the run and hides; completed blocks survive.
  ["running", "toggle", "hidden-paused", ["pause-run", "hide"]],
  ["running", "run-finished", "shown", []],
  // Failure streak pauses the run; blocks were already marked by the runner.
  ["running", "run-paused", "shown-paused", []],
  // Explicit cancel keeps finished blocks and marks the rest paused.
  ["running", "run-cancelled", "shown-paused", ["mark-paused"]],
  ["running", "shortcut", "running", []],
  ["running", "paragraph-translated", "running", []],
  // Clicking a finished reader hides without clearing anything.
  ["shown", "toggle", "hidden", ["hide"]],
  ["shown", "shortcut", "shown", []],
  ["shown", "paragraph-translated", "shown", []],
  ["shown-paused", "toggle", "hidden-paused", ["hide"]],
  ["shown-paused", "shortcut", "shown-paused", []],
  ["shown-paused", "paragraph-translated", "shown-paused", []],
  // Re-showing a fully translated reader never re-requests.
  ["hidden", "toggle", "shown", ["show"]],
  // Shortcut/Alt-click while hidden reveals, then translates that paragraph.
  ["hidden", "shortcut", "shown", ["show"]],
  // A late completion must not un-hide a reader the user hid.
  ["hidden", "paragraph-translated", "hidden", []],
  // Resuming a paused run shows first, then restarts from cache.
  ["hidden-paused", "toggle", "running", ["show", "resume-run"]],
  ["hidden-paused", "shortcut", "shown-paused", ["show"]],
  ["hidden-paused", "paragraph-translated", "hidden-paused", []],
  // Stale run notifications after pause/cancel must not change visibility.
  ["hidden-paused", "run-finished", "hidden-paused", []],
  ["hidden-paused", "run-cancelled", "hidden-paused", []],
  ["shown", "run-finished", "shown", []],
  ["empty", "run-finished", "empty", []],
];

for (const [state, event, next, effects] of rows) {
  test(`transition: ${state} + ${event} -> ${next} [${effects.join(", ")}]`, () => {
    assert.deepEqual(transition(state, event), { state: next, effects });
  });
}

const allStates = [
  "empty",
  "running",
  "shown",
  "shown-paused",
  "hidden",
  "hidden-paused",
];

for (const state of allStates) {
  test(`refresh from ${state} clears, shows, and restarts the run`, () => {
    assert.deepEqual(transition(state, "refresh"), {
      state: "running",
      effects: ["clear-translations", "show", "start-run"],
    });
  });

  test(`reset from ${state} returns to empty with no effects`, () => {
    assert.deepEqual(transition(state, "reset"), { state: "empty", effects: [] });
  });
}

test("full lifecycle: translate, finish, hide, re-show", () => {
  let state = "empty";
  const step = (event) => {
    state = transition(state, event).state;
    return state;
  };
  assert.equal(step("toggle"), "running");
  assert.equal(step("run-finished"), "shown");
  assert.equal(step("toggle"), "hidden");
  assert.equal(step("toggle"), "shown");
});

test("pause/resume lifecycle keeps the run resumable after hiding", () => {
  let state = "empty";
  const step = (event) => {
    state = transition(state, event).state;
    return state;
  };
  assert.equal(step("toggle"), "running");
  assert.equal(step("toggle"), "hidden-paused");
  assert.equal(step("toggle"), "running");
  assert.equal(step("run-finished"), "shown");
});

test("isTranslationVisible is true only while translations are on screen", () => {
  assert.deepEqual(
    allStates.map(isTranslationVisible),
    [false, true, true, true, false, false],
  );
});

test("isTranslationHidden reports hidden toggle states only", () => {
  assert.deepEqual(
    allStates.map(isTranslationHidden),
    [false, false, false, false, true, true],
  );
});

test("isRunActive is true only while the run is translating", () => {
  assert.deepEqual(
    allStates.map(isRunActive),
    [false, true, false, false, false, false],
  );
});