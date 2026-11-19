import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_DISPLAY_MODE,
  DISPLAY_MODES,
  buildDisplayModeCSS,
  normalizeDisplayMode,
} from "../src/displayMode.ts";

test("display modes expose the four reader layouts and a side-by-side default", () => {
  assert.deepEqual(DISPLAY_MODES, [
    "top-bottom",
    "side-by-side",
    "target-only",
    "source-only",
  ]);
  assert.equal(DEFAULT_DISPLAY_MODE, "side-by-side");
});

test("normalizeDisplayMode keeps valid modes and falls back to side-by-side", () => {
  for (const mode of DISPLAY_MODES) {
    assert.equal(normalizeDisplayMode(mode), mode);
  }
  assert.equal(normalizeDisplayMode("columns"), "side-by-side");
  assert.equal(normalizeDisplayMode(undefined), "side-by-side");
  assert.equal(normalizeDisplayMode(null), "side-by-side");
});

test("target-only hides only the source cells", () => {
  const css = buildDisplayModeCSS("tr", "src", 1.25);
  assert.match(
    css,
    /#sdt-content\[data-interlinear-display="target-only"\] \.src:not\(:has\(figure/u,
  );
  assert.doesNotMatch(
    css,
    /#sdt-content\[data-interlinear-display="target-only"\] \.tr/u,
  );
});

test("target-only keeps figures, tables and formula images visible", () => {
  const css = buildDisplayModeCSS("tr", "src", 1.25);
  assert.match(
    css,
    /#sdt-content\[data-interlinear-display="target-only"\] \.src:has\(figure, table, img, svg, canvas, video\) \{\s*display: block;/u,
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
    /#sdt-content\[data-interlinear-display="side-by-side"\] \.src \{\s*vertical-align: top;\s*box-sizing: border-box;\s*margin-top: 0;\s*margin-block-start: 0;/u,
  );
  assert.match(
    css,
    /#sdt-content\[data-interlinear-display="side-by-side"\] p\.src,[\s\S]*h1\.src,[\s\S]*h6\.src,[\s\S]*aside\.sdt-note\.src \{\s*display: inline-block;\s*width: 49%;/u,
  );
  assert.doesNotMatch(
    css,
    /#sdt-content\[data-interlinear-display="side-by-side"\] li\.src[\s\S]{0,80}display: inline-block/u,
  );
  assert.doesNotMatch(
    css,
    /#sdt-content\[data-interlinear-display="side-by-side"\] figcaption\.src[\s\S]{0,80}display: inline-block/u,
  );
  assert.match(
    css,
    /#sdt-content\[data-interlinear-display="side-by-side"\] \.tr \{[\s\S]*margin: 0 0 2em 1%;[\s\S]*padding-top: 0;/u,
  );
  assert.match(
    css,
    /#sdt-content\[data-interlinear-display="side-by-side"\] li\.src \+ \.tr,\s*#sdt-content\[data-interlinear-display="side-by-side"\] figcaption\.src \+ \.tr \{\s*display: block;\s*width: auto;\s*margin-left: 0;/u,
  );
  assert.doesNotMatch(css, /position: absolute/u);
  assert.doesNotMatch(css, /transform/u);
});

test("top-bottom emits no hiding or column rules", () => {
  const css = buildDisplayModeCSS("tr", "src", 1.25);
  assert.doesNotMatch(css, /data-interlinear-display="top-bottom"/u);
});
