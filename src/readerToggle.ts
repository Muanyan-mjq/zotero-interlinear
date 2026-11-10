// SPDX-License-Identifier: AGPL-3.0-or-later
// Pure toggle state machine for the reader toolbar button. No DOM, no Zotero.

export type ToggleState =
  | "empty"
  | "running"
  | "shown"
  | "shown-paused"
  | "hidden"
  | "hidden-paused";

export type ToggleEvent =
  | "toggle"
  | "shortcut"
  | "refresh"
  | "run-finished"
  | "run-paused"
  | "run-cancelled"
  | "paragraph-translated"
  | "reset";

export type ToggleEffect =
  | "start-run"
  | "resume-run"
  | "pause-run"
  | "hide"
  | "show"
  | "mark-paused"
  | "clear-translations";

export interface ToggleTransition {
  state: ToggleState;
  effects: ToggleEffect[];
}

type TransitionTable = Partial<
  Record<ToggleState, Partial<Record<ToggleEvent, ToggleTransition>>>
>;

const table: TransitionTable = {
  empty: {
    toggle: { state: "running", effects: ["start-run"] },
    shortcut: { state: "shown", effects: [] },
    "paragraph-translated": { state: "shown", effects: [] },
  },
  running: {
    toggle: { state: "hidden-paused", effects: ["pause-run", "hide"] },
    "run-finished": { state: "shown", effects: [] },
    "run-paused": { state: "shown-paused", effects: [] },
    "run-cancelled": { state: "shown-paused", effects: ["mark-paused"] },
  },
  shown: {
    toggle: { state: "hidden", effects: ["hide"] },
  },
  "shown-paused": {
    toggle: { state: "hidden-paused", effects: ["hide"] },
  },
  hidden: {
    toggle: { state: "shown", effects: ["show"] },
    shortcut: { state: "shown", effects: ["show"] },
  },
  "hidden-paused": {
    toggle: { state: "running", effects: ["show", "resume-run"] },
    shortcut: { state: "shown-paused", effects: ["show"] },
  },
};

export function transition(
  state: ToggleState,
  event: ToggleEvent,
): ToggleTransition {
  if (event === "reset") return { state: "empty", effects: [] };
  if (event === "refresh") {
    return {
      state: "running",
      effects: ["clear-translations", "show", "start-run"],
    };
  }
  return table[state]?.[event] || { state, effects: [] };
}

export function isTranslationVisible(state: ToggleState): boolean {
  return state === "running" || state === "shown" || state === "shown-paused";
}

export function isTranslationHidden(state: ToggleState): boolean {
  return state === "hidden" || state === "hidden-paused";
}

export function isRunActive(state: ToggleState): boolean {
  return state === "running";
}