import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_DISPLAY_MODE,
  DISPLAY_MODES,
  buildDisplayModeCSS,
  normalizeDisplayMode,
} from "../src/displayMode.ts";

test("display modes expose the four reader layouts and a top-bottom default", () => {
  assert.deepEqual(DISPLAY_MODES, [
    "top-bottom",
    "side-by-side",
    "target-only",
    "source-only",
  ]);
  assert.equal(DEFAULT_DISPLAY_MODE, "top-bottom");
});

test("normalizeDisplayMode keeps valid modes and falls back to top-bottom", () => {
  for (const mode of DISPLAY_MODES) {
    assert.equal(normalizeDisplayMode(mode), mode);
  }
  assert.equal(normalizeDisplayMode("columns"), "top-bottom");
  assert.equal(normalizeDisplayMode(undefined), "top-bottom");
  assert.equal(normalizeDisplayMode(null), "top-bottom");
});

test("target-only hides only the source cells", () => {
  const css = buildDisplayModeCSS("tr", "src", 1.25);
  assert.match(
    css,
    /#sdt-content\[data-interlinear-display="target-only"\] \.src \{\s*display: none;/u,
  );
  assert.doesNotMatch(
    css,
    /#sdt-content\[data-interlinear-display="target-only"\] \.tr/u,
  );
});

test("source-only hides only the translation blocks", () => {
  const css = buildDisplayModeCSS("tr", "src", 1.25);
  assert.match(
    css,
    /#sdt-content\[data-interlinear-display="source-only"\] \.tr \{\s*display: none;/u,
  );
});

test("side-by-side uses two top-aligned columns without moving source nodes", () => {
  const css = buildDisplayModeCSS("tr", "src", 2);
  assert.match(
    css,
    /#sdt-content\[data-interlinear-display="side-by-side"\] \.src \{\s*display: inline-block;\s*width: 49%;\s*vertical-align: top;/u,
  );
  assert.match(
    css,
    /#sdt-content\[data-interlinear-display="side-by-side"\] \.tr \{[\s\S]*width: 49%;[\s\S]*margin: 0 0 2em 1%;/u,
  );
  assert.doesNotMatch(css, /position: absolute/u);
  assert.doesNotMatch(css, /transform/u);
});

test("top-bottom emits no hiding or column rules", () => {
  const css = buildDisplayModeCSS("tr", "src", 1.25);
  assert.doesNotMatch(css, /data-interlinear-display="top-bottom"/u);
});
