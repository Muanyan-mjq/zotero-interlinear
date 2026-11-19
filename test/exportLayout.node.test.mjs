import test from "node:test";
import assert from "node:assert/strict";

import {
  PAIR_CLASS,
  buildExportLayoutCSS,
} from "../src/exportLayout.ts";

test("top-bottom keeps a pair together across page breaks", () => {
  const css = buildExportLayoutCSS("top-bottom", "tr", "src");
  assert.match(css, new RegExp(`\\.${PAIR_CLASS}`));
  assert.match(css, /break-inside:\s*avoid/);
  assert.match(css, /page-break-inside:\s*avoid/);
  assert.doesNotMatch(css, /display:\s*flex/);
});

test("side-by-side uses two flex halves", () => {
  const css = buildExportLayoutCSS("side-by-side", "tr", "src");
  assert.match(css, /display:\s*flex/);
  assert.match(css, /width:\s*50%/);
  assert.match(css, /break-inside:\s*avoid/);
});

test("one-sided layouts hide the other half", () => {
  assert.match(
    buildExportLayoutCSS("source-only", "tr", "src"),
    /#sdt-content \.tr \{\s*display: none !important;/,
  );
  assert.match(
    buildExportLayoutCSS("target-only", "tr", "src"),
    /#sdt-content \.src \{\s*display: none !important;/,
  );
});

test("each layout names its scoped root attribute", () => {
  for (const mode of ["top-bottom", "side-by-side"]) {
    const css = buildExportLayoutCSS(mode, "tr", "src");
    assert.match(css, new RegExp(`data-export-layout="${mode}"`));
  }
});