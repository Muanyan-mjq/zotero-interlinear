import assert from "node:assert/strict";
import test from "node:test";

import {
  CONTRAST_AA_MIN,
  DEFAULT_APPEARANCE,
  FONT_CUSTOM_VALUE,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  FONT_STACK_PRESETS,
  buildColorPalette,
  buildTranslationCSS,
  contrastRatio,
  contrastRatioOver,
  hexToRgb,
  hslToRgba,
  isValidColor,
  isValidFontFamily,
  meetsContrastAA,
  normalizeAppearance,
  normalizeColorList,
  normalizeColorToken,
  normalizeHexInput,
  normalizeThemeColor,
  parseColorToRgba,
  pushColorUnique,
  resolveEffectiveColor,
  resolveFontSelection,
  resolveThemeColor,
  rgbaToHex,
  rgbaToHsl,
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
  assert.equal(settings.ribbonColor, "#2f6fdf");
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
  assert.equal(normalizeAppearance({ ribbonColor: "x;}" }).ribbonColor, "#2f6fdf");
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

test("normalizeHexInput expands short hex and uppercases six-digit hex", () => {
  assert.equal(normalizeHexInput("#abc"), "#AABBCC");
  assert.equal(normalizeHexInput("abc"), "#AABBCC");
  assert.equal(normalizeHexInput("#AABBCC"), "#AABBCC");
  assert.equal(normalizeHexInput("#aabbcc"), "#AABBCC");
  assert.equal(normalizeHexInput("  #fff  "), "#FFFFFF");
  assert.equal(normalizeHexInput("123"), "#112233");
});

test("normalizeHexInput rejects anything that is not #RGB or #RRGGBB", () => {
  for (const value of ["", "#12345", "#aabbccdd", "red", "rgb(1,2,3)", "#gggggg", "12345", "#12"]) {
    assert.equal(normalizeHexInput(value), null, value);
  }
});

test("hexToRgb parses normalized hex into channels and rejects non-hex", () => {
  assert.deepEqual(hexToRgb("#ff0000"), { r: 255, g: 0, b: 0 });
  assert.deepEqual(hexToRgb("#00ff00"), { r: 0, g: 255, b: 0 });
  assert.deepEqual(hexToRgb("abc"), { r: 170, g: 187, b: 204 });
  assert.equal(hexToRgb("red"), null);
  assert.equal(hexToRgb(""), null);
});

test("contrastRatio computes WCAG ratios and returns null for non-hex input", () => {
  assert.equal(contrastRatio("#000000", "#ffffff"), 21);
  assert.equal(contrastRatio("#ffffff", "#ffffff"), 1);
  assert.equal(contrastRatio("#777777", "#777777"), 1);
  assert.equal(contrastRatio("#000000", "#ffffff"), contrastRatio("#ffffff", "#000000"));
  assert.equal(contrastRatio("red", "#ffffff"), null);
  assert.equal(contrastRatio("", ""), null);
});

test("meetsContrastAA uses the 4.5:1 normal-text threshold", () => {
  assert.equal(CONTRAST_AA_MIN, 4.5);
  assert.equal(meetsContrastAA(21), true);
  assert.equal(meetsContrastAA(4.5), true);
  assert.equal(meetsContrastAA(4.49), false);
  assert.equal(meetsContrastAA(1), false);
  // #767676 on white clears AA (~4.54); #777777 on white just misses it (~4.48).
  assert.equal(meetsContrastAA(contrastRatio("#767676", "#ffffff")), true);
  assert.equal(meetsContrastAA(contrastRatio("#777777", "#ffffff")), false);
});

test("resolveEffectiveColor prefers an explicit value over the theme palette", () => {
  assert.equal(resolveEffectiveColor("#ff0000", "dark", "color"), "#ff0000");
  assert.equal(resolveEffectiveColor("#123456", "light", "background"), "#123456");
});

test("resolveEffectiveColor resolves inherit to the light/dark palette", () => {
  assert.equal(resolveEffectiveColor("", "dark", "color"), "#e8e8e8");
  assert.equal(resolveEffectiveColor("", "dark", "background"), "#2b2b2b");
  assert.equal(resolveEffectiveColor("", "light", "color"), "#222");
  assert.equal(resolveEffectiveColor("", "light", "background"), "#f6f6f6");
  assert.equal(resolveEffectiveColor("   ", "light", "color"), "#222");
});

test("resolveEffectiveColor leaves auto-inherit empty so the preview shows a checkerboard", () => {
  assert.equal(resolveEffectiveColor("", "auto", "color"), "");
  assert.equal(resolveEffectiveColor("", "auto", "background"), "");
});
test("FONT_STACK_PRESETS covers inherit plus cross-platform sans/serif/mono stacks", () => {
  assert.ok(FONT_STACK_PRESETS.includes(""));
  assert.ok(FONT_STACK_PRESETS.includes("Georgia, serif"));
  assert.ok(FONT_STACK_PRESETS.some((v) => /sans-serif$/u.test(v)));
  assert.ok(FONT_STACK_PRESETS.some((v) => /monospace$/u.test(v)));
  for (const value of FONT_STACK_PRESETS) {
    assert.equal(normalizeAppearance({ fontFamily: value }).fontFamily, value);
  }
});

test("resolveFontSelection maps empty input to inherit", () => {
  assert.equal(resolveFontSelection(""), "");
  assert.equal(resolveFontSelection("   "), "");
});

test("resolveFontSelection matches a preset ignoring case and whitespace", () => {
  assert.equal(resolveFontSelection("Georgia, serif"), "Georgia, serif");
  assert.equal(resolveFontSelection("georgia,serif"), "Georgia, serif");
  assert.equal(
    resolveFontSelection("Arial, Helvetica, PingFang SC, Microsoft YaHei, sans-serif"),
    "Arial, Helvetica, PingFang SC, Microsoft YaHei, sans-serif",
  );
});

test("resolveFontSelection flags an unmatched non-empty stack as custom", () => {
  assert.equal(resolveFontSelection("Comic Sans MS, cursive"), FONT_CUSTOM_VALUE);
});

test("isValidFontFamily accepts empty and safe stacks but rejects CSS-breaking tokens", () => {
  assert.equal(isValidFontFamily(""), true);
  assert.equal(isValidFontFamily("   "), true);
  assert.equal(isValidFontFamily("Georgia, serif"), true);
  assert.equal(isValidFontFamily("Comic Sans MS, cursive"), true);
  assert.equal(isValidFontFamily("Arial; color: red"), false);
  assert.equal(isValidFontFamily('Font "Name"'), false);
  assert.equal(isValidFontFamily("Arial}"), false);
});

test("normalizeThemeColor converts legacy strings and keeps safe split colors", () => {
  assert.deepEqual(normalizeThemeColor("#ff0000"), {
    mode: "single",
    light: "#ff0000",
    dark: "#ff0000",
  });
  assert.deepEqual(normalizeThemeColor(""), { mode: "theme", light: "", dark: "" });
  assert.deepEqual(
    normalizeThemeColor({ mode: "split", light: "#111", dark: "#222" }),
    { mode: "split", light: "#111", dark: "#222" },
  );
  const fallback = { mode: "split", light: "#333333", dark: "#444444" };
  assert.deepEqual(
    normalizeThemeColor({ mode: "split", light: "red;}", dark: "#eeeeee" }, fallback),
    { mode: "split", light: "#333333", dark: "#eeeeee" },
  );
  assert.deepEqual(normalizeThemeColor("url(x)", fallback), fallback);
  assert.deepEqual(normalizeThemeColor({ mode: "split" }, fallback), fallback);
});

test("normalizeAppearance derives colors from legacy fields and lets colors win", () => {
  const legacy = normalizeAppearance({
    color: "#ff0000",
    background: "",
    underlineColor: "red",
    ribbonColor: "#123456",
  });
  assert.deepEqual(legacy.colors.text, {
    mode: "single",
    light: "#ff0000",
    dark: "#ff0000",
  });
  assert.deepEqual(legacy.colors.background, { mode: "theme", light: "", dark: "" });
  assert.deepEqual(legacy.colors.underline, {
    mode: "single",
    light: "red",
    dark: "red",
  });
  assert.deepEqual(legacy.colors.ribbon, {
    mode: "single",
    light: "#123456",
    dark: "#123456",
  });
  assert.equal(legacy.color, "#ff0000");

  const split = normalizeAppearance({
    color: "#999999",
    colors: { text: { mode: "split", light: "#111111", dark: "#eeeeee" } },
  });
  assert.equal(split.color, "#111111");
  assert.deepEqual(split.colors.text, {
    mode: "split",
    light: "#111111",
    dark: "#eeeeee",
  });
  assert.deepEqual(
    normalizeAppearance(undefined).colors,
    DEFAULT_APPEARANCE.colors,
  );
});

test("theme colors resolve to palette defaults or stored values per role and scheme", () => {
  const theme = { mode: "theme", light: "", dark: "" };
  assert.equal(resolveThemeColor(theme, "light", "text"), "");
  assert.equal(resolveThemeColor(theme, "dark", "text"), "");
  assert.equal(resolveThemeColor(theme, "light", "ribbon"), "#2f6fdf");
  assert.equal(resolveThemeColor(theme, "dark", "ribbon"), "#4f8ff0");
  assert.equal(resolveThemeColor(theme, "light", "error"), "#c7354a");
  assert.equal(resolveThemeColor(theme, "dark", "error"), "#ff8a9a");
  assert.equal(
    resolveThemeColor({ mode: "single", light: "#123456", dark: "#654321" }, "dark", "text"),
    "#123456",
  );
  assert.equal(
    resolveThemeColor({ mode: "split", light: "#111111", dark: "#eeeeee" }, "dark", "text"),
    "#eeeeee",
  );
  assert.equal(
    resolveThemeColor({ mode: "split", light: "#111111", dark: "" }, "dark", "text"),
    "",
  );
});

test("color tokens and HSL/RGB conversion round-trip with alpha", () => {
  assert.equal(normalizeColorToken("#abc"), "#AABBCC");
  assert.equal(normalizeColorToken("#aabbccdd"), "#AABBCCDD");
  assert.equal(normalizeColorToken("#12345"), null);
  assert.equal(normalizeColorToken("red"), null);
  assert.equal(normalizeColorToken("url(x)"), null);

  assert.equal(rgbaToHex({ r: 255, g: 0, b: 0, a: 1 }), "#FF0000");
  assert.equal(rgbaToHex({ r: 255, g: 0, b: 0, a: 128 / 255 }), "#FF000080");

  const rgba = parseColorToRgba("rgba(255, 0, 0, 0.5)");
  assert.equal(rgba.r, 255);
  assert.equal(rgba.g, 0);
  assert.equal(rgba.b, 0);
  assert.ok(Math.abs(rgba.a - 0.5) < 0.01);
  assert.deepEqual(parseColorToRgba("hsl(120, 100%, 50%)"), {
    r: 0,
    g: 255,
    b: 0,
    a: 1,
  });
  assert.equal(parseColorToRgba("url(x)"), null);
  assert.equal(parseColorToRgba("#12345"), null);

  assert.deepEqual(hslToRgba({ h: 240, s: 100, l: 50, a: 1 }), {
    r: 0,
    g: 0,
    b: 255,
    a: 1,
  });
  const hsl = rgbaToHsl({ r: 0, g: 0, b: 255, a: 1 });
  assert.equal(Math.round(hsl.h), 240);
  assert.equal(Math.round(hsl.s), 100);
  assert.equal(Math.round(hsl.l), 50);
});

test("contrast checks composite translucent colors over the theme base", () => {
  assert.equal(contrastRatio("#000000", "#ffffff"), 21);
  const opaque = contrastRatio("#808080", "#ffffff");
  const translucent = contrastRatioOver("#80808080", "#ffffff00", "#ffffff");
  assert.ok(translucent !== null && translucent < opaque);
  const gray = contrastRatioOver("#777777", "#ffffff00", "#ffffff");
  assert.ok(gray !== null && Math.abs(gray - 4.48) < 0.02);
  assert.equal(contrastRatioOver("nope", "#ffffff", "#ffffff"), null);
});

test("color lists normalize, deduplicate and cap entries", () => {
  assert.deepEqual(
    normalizeColorList(["#abc", "#AABBCC", "#12345678", "nope", "#ff000080", 42], 12),
    ["#AABBCC", "#12345678", "#FF000080"],
  );
  const many = Array.from(
    { length: 20 },
    (_, index) => `#${(index * 1000).toString(16).padStart(6, "0")}`,
  );
  assert.equal(normalizeColorList(many, 12).length, 12);
  assert.deepEqual(normalizeColorList("nope", 12), []);
});

test("color palette is five lightness rows by eight hue columns", () => {
  const rows = buildColorPalette();
  assert.equal(rows.length, 5);
  for (const row of rows) {
    assert.equal(row.length, 8);
    for (const color of row) assert.equal(normalizeColorToken(color), color);
  }
  const unique = new Set(rows.flat());
  assert.equal(unique.size, 40);
  // Every row must be a lightness step of the same eight hues.
  assert.match(rows[0][0], /^#[0-9A-F]{6}$/u);
  assert.notEqual(rows[0][3], rows[4][3]);
});

test("pushColorUnique moves a color to the front and caps the list", () => {
  assert.deepEqual(pushColorUnique(["#AABBCC", "#112233"], "#aabbcc", 12), [
    "#AABBCC",
    "#112233",
  ]);
  assert.deepEqual(pushColorUnique(["#112233"], "#AABBCC", 12), [
    "#AABBCC",
    "#112233",
  ]);
  assert.deepEqual(pushColorUnique(["#112233"], "nope", 12), ["#112233"]);
  assert.deepEqual(pushColorUnique(["#112233", "#445566"], "#778899", 2), [
    "#778899",
    "#112233",
  ]);
});

test("reader CSS emits light colors and a data-color-scheme dark override", () => {
  const css = buildTranslationCSS(
    "interlinear-translation",
    {
      colors: {
        text: { mode: "split", light: "#111111", dark: "#eeeeee" },
        background: { mode: "split", light: "#ffffff", dark: "#000000" },
      },
    },
    "reader",
  );
  assert.match(css, /color: #111111;/u);
  assert.match(css, /background: #ffffff;/u);
  assert.match(css, /:root\[data-color-scheme="dark"\] \.interlinear-translation \{/u);
  assert.match(css, /color: #eeeeee;/u);
  assert.match(css, /background: #000000;/u);
});

test("reader CSS can be forced to one scheme for the preview", () => {
  const css = buildTranslationCSS(
    "interlinear-translation",
    {
      colors: {
        text: { mode: "split", light: "#111111", dark: "#eeeeee" },
      },
    },
    "reader",
    { colorScheme: "dark" },
  );
  assert.match(css, /color: #eeeeee;/u);
  assert.doesNotMatch(css, /data-color-scheme/u);
});

test("print CSS always uses the light color of a split setting", () => {
  const css = buildTranslationCSS(
    "interlinear-translation",
    {
      colors: {
        text: { mode: "split", light: "#111111", dark: "#eeeeee" },
      },
    },
    "print",
  );
  assert.match(css, /color: #111111 !important;/u);
  assert.doesNotMatch(css, /#eeeeee/u);
});

test("reader CSS skips a dark override when the dark side inherits", () => {
  const css = buildTranslationCSS(
    "interlinear-translation",
    {
      colors: {
        text: { mode: "split", light: "#111111", dark: "" },
      },
    },
    "reader",
  );
  assert.match(css, /color: #111111;/u);
  assert.doesNotMatch(css, /data-color-scheme/u);
});

test("reader CSS rejects malicious split colors and keeps state colors explicit", () => {
  const malicious = buildTranslationCSS(
    "interlinear-translation",
    {
      colors: {
        text: {
          mode: "single",
          light: "red; } body { display: none",
          dark: "#ffffff",
        },
      },
    },
    "reader",
  );
  assert.doesNotMatch(malicious, /body/u);
  assert.doesNotMatch(malicious, /color:/u);

  const defaultCss = buildTranslationCSS("interlinear-translation", undefined, "reader");
  assert.doesNotMatch(defaultCss, /data-state=/u);

  const states = buildTranslationCSS(
    "interlinear-translation",
    {
      colors: {
        loading: { mode: "single", light: "#666666", dark: "#666666" },
        error: { mode: "split", light: "#cc0000", dark: "#ff8888" },
      },
    },
    "reader",
  );
  assert.match(states, /\.interlinear-translation\[data-state="loading"\] \{/u);
  assert.match(states, /color: #666666;/u);
  assert.match(states, /\.interlinear-translation\[data-state="error"\] \{/u);
  assert.match(states, /color: #cc0000;/u);
  assert.match(
    states,
    /:root\[data-color-scheme="dark"\] \.interlinear-translation\[data-state="error"\]/u,
  );
  assert.match(states, /color: #ff8888;/u);
});
