import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_APPEARANCE,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  buildTranslationCSS,
  isValidColor,
  normalizeAppearance,
} from "../src/appearance.ts";

test("normalizeAppearance falls back to defaults for missing input", () => {
  assert.deepEqual(normalizeAppearance(undefined), DEFAULT_APPEARANCE);
  assert.deepEqual(normalizeAppearance(null), DEFAULT_APPEARANCE);
  assert.deepEqual(normalizeAppearance({}), DEFAULT_APPEARANCE);
});

test("normalizeAppearance clamps font size into the supported range", () => {
  assert.equal(normalizeAppearance({ fontSize: FONT_SIZE_MIN - 5 }).fontSize, FONT_SIZE_MIN);
  assert.equal(normalizeAppearance({ fontSize: FONT_SIZE_MAX + 50 }).fontSize, FONT_SIZE_MAX);
  assert.equal(normalizeAppearance({ fontSize: Number.NaN }).fontSize, DEFAULT_APPEARANCE.fontSize);
  assert.equal(normalizeAppearance({ fontSize: 18 }).fontSize, 18);
});

test("isValidColor accepts inherit, hex, rgb/rgba and plain named colors", () => {
  for (const value of ["", "#abc", "#AABBCC", "#aabbccdd", "rgb(1, 2, 3)", "rgba(1,2,3,0.5)", "red", "rebeccapurple"]) {
    assert.equal(isValidColor(value), true, value);
  }
});

test("isValidColor rejects anything that could escape a CSS declaration", () => {
  for (const value of [
    "red; } body { display: none",
    "#12345",
    "url(https://example.com/x.png)",
    "expression(alert(1))",
    "var(--color)",
    "rgb(1,2,3); background:url(x)",
    "red\n}",
  ]) {
    assert.equal(isValidColor(value), false, value);
  }
});

test("normalizeAppearance drops an invalid color back to inherit", () => {
  assert.equal(normalizeAppearance({ color: "red; } body { display:none" }).color, "");
  assert.equal(normalizeAppearance({ color: "#ff0000" }).color, "#ff0000");
});

test("reader CSS uses the configured pixel font size and inherits color by default", () => {
  const css = buildTranslationCSS("interlinear-translation", undefined, "reader");
  assert.match(css, /^\.interlinear-translation \{/u);
  assert.match(css, /font-size: 16px;/u);
  assert.doesNotMatch(css, /color:/u);
});

test("reader CSS emits a validated color and a configured font size", () => {
  const css = buildTranslationCSS(
    "interlinear-translation",
    { fontSize: 20, color: "#ff0000" },
    "reader",
  );
  assert.match(css, /font-size: 20px;/u);
  assert.match(css, /color: #ff0000;/u);
});

test("reader CSS never leaks an injected color into the stylesheet", () => {
  const css = buildTranslationCSS(
    "interlinear-translation",
    { color: "red; } body { display: none" },
    "reader",
  );
  assert.doesNotMatch(css, /body/u);
  assert.doesNotMatch(css, /color:/u);
});

test("print CSS converts pixels to points and keeps print overrides", () => {
  const css = buildTranslationCSS("interlinear-translation", undefined, "print");
  assert.match(css, /font-size: 12pt !important;/u);
  assert.match(css, /color: #222 !important;/u);
  assert.match(css, /break-inside: avoid-page;/u);
});

test("print CSS honors a configured font size and color", () => {
  const css = buildTranslationCSS(
    "interlinear-translation",
    { fontSize: 20, color: "#00ff00" },
    "print",
  );
  assert.match(css, /font-size: 15pt !important;/u);
  assert.match(css, /color: #00ff00 !important;/u);
});

test("normalizeAppearance exposes the full appearance defaults", () => {
  const settings = normalizeAppearance(undefined);
  assert.equal(settings.fontFamily, "");
  assert.equal(settings.lineHeight, 1.75);
  assert.equal(settings.paragraphSpacing, 1.25);
  assert.equal(settings.background, "");
  assert.equal(settings.theme, "auto");
  assert.equal(settings.underline, false);
  assert.equal(settings.underlineColor, "");
  assert.equal(settings.ribbon, true);
  assert.equal(settings.ribbonColor, "#c7354a");
});

test("normalizeAppearance keeps safe font families and rejects rule-breaking input", () => {
  assert.equal(normalizeAppearance({ fontFamily: "Georgia, serif" }).fontFamily, "Georgia, serif");
  assert.equal(
    normalizeAppearance({ fontFamily: " Noto Serif SC , serif " }).fontFamily,
    "Noto Serif SC, serif",
  );
  for (const value of [
    "serif; } body { display:none",
    "serif{color:red}",
    'serif" onload="x',
    "url(https://example.com/x.woff)",
    "serif\n}",
  ]) {
    assert.equal(normalizeAppearance({ fontFamily: value }).fontFamily, "", value);
  }
});

test("normalizeAppearance clamps line height and paragraph spacing", () => {
  assert.equal(normalizeAppearance({ lineHeight: 0.2 }).lineHeight, 1);
  assert.equal(normalizeAppearance({ lineHeight: 9 }).lineHeight, 2.5);
  assert.equal(normalizeAppearance({ lineHeight: 1.756 }).lineHeight, 1.76);
  assert.equal(normalizeAppearance({ lineHeight: "nope" }).lineHeight, 1.75);
  assert.equal(normalizeAppearance({ paragraphSpacing: -1 }).paragraphSpacing, 0);
  assert.equal(normalizeAppearance({ paragraphSpacing: 99 }).paragraphSpacing, 3);
  assert.equal(normalizeAppearance({ paragraphSpacing: 0.333 }).paragraphSpacing, 0.33);
  assert.equal(normalizeAppearance({ paragraphSpacing: "nope" }).paragraphSpacing, 1.25);
});

test("normalizeAppearance validates theme, background and accent colors", () => {
  assert.equal(normalizeAppearance({ theme: "dark" }).theme, "dark");
  assert.equal(normalizeAppearance({ theme: "sepia" }).theme, "auto");
  assert.equal(normalizeAppearance({ background: "#101010" }).background, "#101010");
  assert.equal(normalizeAppearance({ background: "url(x)" }).background, "");
  assert.equal(normalizeAppearance({ underlineColor: "red" }).underlineColor, "red");
  assert.equal(normalizeAppearance({ underlineColor: "red;}" }).underlineColor, "");
  assert.equal(normalizeAppearance({ ribbonColor: "#123456" }).ribbonColor, "#123456");
  assert.equal(normalizeAppearance({ ribbonColor: "x;}" }).ribbonColor, "#c7354a");
});

test("reader CSS applies the configured font family, line height and spacing", () => {
  const css = buildTranslationCSS(
    "interlinear-translation",
    { fontFamily: "Georgia, serif", lineHeight: 2, paragraphSpacing: 2 },
    "reader",
  );
  assert.match(css, /font-family: Georgia, serif;/u);
  assert.match(css, /line-height: 2;/u);
  assert.match(css, /margin: 0\.65em 0 2em;/u);
  assert.doesNotMatch(css, /color:/u);
  assert.doesNotMatch(css, /background:/u);
});

test("reader CSS applies light and dark theme colors unless overridden", () => {
  const light = buildTranslationCSS("interlinear-translation", { theme: "light" }, "reader");
  assert.match(light, /color: #222;/u);
  assert.match(light, /background: #f6f6f6;/u);

  const dark = buildTranslationCSS("interlinear-translation", { theme: "dark" }, "reader");
  assert.match(dark, /color: #e8e8e8;/u);
  assert.match(dark, /background: #2b2b2b;/u);

  const overridden = buildTranslationCSS(
    "interlinear-translation",
    { theme: "dark", color: "#ff0000", background: "#000000" },
    "reader",
  );
  assert.match(overridden, /color: #ff0000;/u);
  assert.match(overridden, /background: #000000;/u);
  assert.doesNotMatch(overridden, /#e8e8e8/u);
});

test("reader CSS toggles the underline and the left ribbon", () => {
  const underlined = buildTranslationCSS(
    "interlinear-translation",
    { underline: true, underlineColor: "#00ff00" },
    "reader",
  );
  assert.match(underlined, /text-decoration: underline;/u);
  assert.match(underlined, /text-decoration-color: #00ff00;/u);

  const plain = buildTranslationCSS("interlinear-translation", { underline: true }, "reader");
  assert.match(plain, /text-decoration: underline;/u);
  assert.doesNotMatch(plain, /text-decoration-color:/u);

  const noRibbon = buildTranslationCSS("interlinear-translation", { ribbon: false }, "reader");
  assert.match(noRibbon, /border-left: none;/u);

  const customRibbon = buildTranslationCSS(
    "interlinear-translation",
    { ribbon: true, ribbonColor: "#123456" },
    "reader",
  );
  assert.match(customRibbon, /border-left: 4px solid #123456;/u);
});

test("print CSS ignores the dark reader theme but keeps typography and accents", () => {
  const css = buildTranslationCSS(
    "interlinear-translation",
    {
      theme: "dark",
      fontFamily: "Georgia, serif",
      lineHeight: 2,
      underline: true,
      ribbon: false,
    },
    "print",
  );
  assert.match(css, /color: #222 !important;/u);
  assert.match(css, /background: transparent !important;/u);
  assert.match(css, /font-family: Georgia, serif;/u);
  assert.match(css, /line-height: 2 !important;/u);
  assert.match(css, /text-decoration: underline !important;/u);
  assert.match(css, /border-left: none !important;/u);
  assert.doesNotMatch(css, /#2b2b2b/u);
});

test("print CSS keeps an explicitly configured ribbon color", () => {
  const css = buildTranslationCSS(
    "interlinear-translation",
    { ribbon: true, ribbonColor: "#123456" },
    "print",
  );
  assert.match(css, /border-left: 2\.2pt solid #123456 !important;/u);
});