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
  buildFontStack,
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
  normalizeAppearancePresets,
  parseAppearanceImport,
  serializeAppearanceExport,
  APPEARANCE_IMPORT_MAX_BYTES,
  normalizeColorToken,
  normalizeHexInput,
  normalizeThemeColor,
  parseColorToRgba,
  parseFontStack,
  pushColorUnique,
  resolveEffectiveColor,
  resolveFontSelection,
  resolveThemeColor,
  resolveUiFontFamily,
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
  assert.equal(isValidFontFamily("Symbol"), false);
  assert.equal(isValidFontFamily("Georgia, Symbol, serif"), true);
});

test("symbol fonts are stripped from parsed, saved and UI font stacks", () => {
  const parsed = parseFontStack("Symbol, Georgia, serif");
  assert.equal(parsed.primary, "Georgia");
  assert.equal(buildFontStack(parsed), "Georgia, serif");

  const mixed = normalizeAppearance({
    fontStack: { primary: "Symbol", fallbacks: ["Georgia"], generic: "serif" },
  });
  assert.equal(mixed.fontStack.primary, "");
  assert.deepEqual(mixed.fontStack.fallbacks, ["Georgia"]);
  assert.equal(mixed.fontFamily, "Georgia, serif");

  const symbolOnly = normalizeAppearance({
    fontFamily: "Webdings",
    fontStack: { primary: "Webdings", fallbacks: [], generic: "" },
  });
  assert.equal(symbolOnly.fontFamily, "");
  assert.deepEqual(symbolOnly.fontStack, { primary: "", fallbacks: [], generic: "" });
  assert.equal(resolveUiFontFamily(symbolOnly), "");

  assert.equal(
    resolveUiFontFamily({
      ...DEFAULT_APPEARANCE,
      fontStack: { primary: "Georgia", fallbacks: [], generic: "" },
    }),
    "Georgia",
  );
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

test("default reader and print CSS are frozen snapshots", () => {
  assert.equal(
    buildTranslationCSS("interlinear-translation", undefined, "reader"),
    `.interlinear-translation {
  box-sizing: border-box;
  border-left: 4px solid #2f6fdf;
  margin: 0.65em 0 1.25em;
  padding: 0.45em 0.95em;
  line-height: 1.75;
  font-size: 16px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}`,
  );
  assert.equal(
    buildTranslationCSS("interlinear-translation", undefined, "print"),
    `.interlinear-translation {
  margin: 0.18em 0 1.25em !important;
  padding: 0.12em 0 0.12em 0.78em !important;
  border-left: 2.2pt solid #2f6fdf !important;
  color: #222 !important;
  background: transparent !important;
  font-size: 12pt !important;
  line-height: 1.75 !important;
  break-inside: avoid-page;
  page-break-inside: avoid;
}`,
  );
});

test("text decoration supports multiple lines, style, thickness, offset and skip-ink", () => {
  const css = buildTranslationCSS(
    "interlinear-translation",
    {
      textDecoration: ["underline", "overline", "line-through"],
      textDecorationStyle: "wavy",
      textDecorationThickness: 2,
      textUnderlineOffset: 4,
      textDecorationSkipInk: "none",
      underlineColor: "#00ff00",
    },
    "reader",
  );
  assert.match(css, /text-decoration: underline overline line-through;/u);
  assert.match(css, /text-decoration-style: wavy;/u);
  assert.match(css, /text-decoration-thickness: 2px;/u);
  assert.match(css, /text-underline-offset: 4px;/u);
  assert.match(css, /text-decoration-skip-ink: none;/u);
  assert.match(css, /text-decoration-color: #00ff00;/u);
});

test("divider, right ribbon and block layout are emitted and clamped", () => {
  const css = buildTranslationCSS(
    "interlinear-translation",
    {
      divider: true,
      dividerStyle: "dashed",
      dividerWidth: 2,
      dividerOffset: 0.5,
      ribbonPosition: "right",
      ribbonWidth: 6,
      ribbonStyle: "dotted",
      ribbonRadius: 4,
      ribbonPadding: 0.5,
      blockPaddingY: 0.6,
      blockPaddingX: 1.2,
      blockRadius: 10,
      blockBorderWidth: 2,
      blockBorderStyle: "double",
      blockIndent: 1,
      firstLineIndent: 0.5,
      textAlign: "justify",
      maxWidthCh: 72,
      opacity: 80,
      sourceGap: 0.3,
      sourceDim: 60,
    },
    "reader",
  );
  assert.match(css, /border-bottom: 2px dashed #d9d9d9;/u);
  assert.match(css, /border-right: 6px dotted #2f6fdf;/u);
  assert.match(css, /border-top-right-radius: 4px;/u);
  assert.match(css, /padding: 0.6em 1.7em 1.1em 1.2em;/u);
  assert.match(css, /border-radius: 10px;/u);
  assert.match(css, /border: 2px double #d9d9d9;/u);
  assert.match(css, /margin-inline-start: 1em;/u);
  assert.match(css, /text-indent: 0.5em;/u);
  assert.match(css, /text-align: justify;/u);
  assert.match(css, /max-width: 72ch;/u);
  assert.match(css, /opacity: 0.8;/u);
  assert.match(css, /margin: 0.3em 0 1.25em;/u);
  assert.match(css, /\.interlinear-source \{\n  opacity: 0.6;\n\}/u);

  const clamped = normalizeAppearance({
    dividerWidth: 99,
    ribbonWidth: -2,
    ribbonRadius: 99,
    blockPaddingY: -1,
    maxWidthCh: 10,
    opacity: 1,
    sourceDim: 999,
    textDecoration: ["underline", "bogus"],
    textDecorationStyle: "bogus",
  });
  assert.equal(clamped.dividerWidth, 6);
  assert.equal(clamped.ribbonWidth, 1);
  assert.equal(clamped.ribbonRadius, 8);
  assert.equal(clamped.blockPaddingY, 0);
  assert.equal(clamped.maxWidthCh, 40);
  assert.equal(clamped.opacity, 40);
  assert.equal(clamped.sourceDim, 100);
  assert.deepEqual(clamped.textDecoration, ["underline"]);
  assert.equal(clamped.textDecorationStyle, "solid");
});

test("appearance presets dedupe, cap and reject invalid entries", () => {
  const presets = normalizeAppearancePresets(
    [
      { name: "Paper", appearance: { fontSize: 20 } },
      { name: "paper", appearance: { fontSize: 18 } },
      { name: "   ", appearance: {} },
      { name: "Academic", appearance: { fontSize: 99, color: "url(x)" } },
      "nope",
    ],
    20,
  );
  assert.equal(presets.length, 2);
  assert.equal(presets[0].name, "Paper");
  assert.equal(presets[0].appearance.fontSize, 20);
  assert.equal(presets[1].appearance.fontSize, 32);
  assert.equal(presets[1].appearance.color, "");
});

test("appearance import rejects oversized, malformed and unsupported files", () => {
  assert.equal(parseAppearanceImport("x".repeat(APPEARANCE_IMPORT_MAX_BYTES + 1)).error, "too-large");
  assert.equal(parseAppearanceImport("{nope").error, "invalid-json");
  assert.equal(parseAppearanceImport("[]").error, "invalid-format");
  assert.equal(
    parseAppearanceImport(JSON.stringify({ format: "other", version: 2 })).error,
    "invalid-format",
  );
  assert.equal(
    parseAppearanceImport(
      JSON.stringify({ format: "interlinear-appearance", version: 99 }),
    ).error,
    "unsupported-version",
  );
});

test("appearance import clamps values, reports unknown keys and never executes content", () => {
  const result = parseAppearanceImport(
    JSON.stringify({
      format: "interlinear-appearance",
      version: 2,
      appearance: {
        fontSize: 999,
        fontFamily: "Arial; } body { display:none",
        color: "red; } body { display:none",
        unknownKey: "value",
        nested: { evil: true },
      },
      presets: [{ name: "Imported", appearance: { fontSize: 12 } }],
    }),
  );
  assert.equal(result.error, null);
  assert.equal(result.appearance.fontSize, 32);
  assert.equal(result.appearance.fontFamily, "");
  assert.equal(result.appearance.color, "");
  assert.deepEqual(result.ignoredKeys.sort(), ["nested", "unknownKey"]);
  assert.equal(result.presets.length, 1);
  assert.equal(result.presets[0].appearance.fontSize, 12);
});

test("appearance export round-trips and contains no provider keys", () => {
  const exported = serializeAppearanceExport(
    normalizeAppearance({ fontSize: 18, color: "#123456", ribbon: false }),
    [{ name: "Mine", appearance: normalizeAppearance({ fontSize: 14 }) }],
  );
  assert.doesNotMatch(exported, /apiKey|endpoint|prompt/iu);
  const parsed = parseAppearanceImport(exported);
  assert.equal(parsed.error, null);
  assert.equal(parsed.appearance.fontSize, 18);
  assert.equal(parsed.appearance.color, "#123456");
  assert.equal(parsed.presets[0].name, "Mine");
  assert.equal(parsed.presets[0].appearance.fontSize, 14);
});
