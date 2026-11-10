import assert from "node:assert/strict";
import test from "node:test";

import {
  FONT_CANDIDATES,
  FONT_DETECTION_CACHE_MAX_FONTS,
  FONT_DETECTION_CACHE_TTL_MS,
  FONT_DETECTION_CACHE_VERSION,
  FONT_FAVORITES_MAX,
  FONT_GROUP_ORDER,
  FONT_SAMPLE_TEXT,
  FONT_SCRIPTS,
  GENERIC_BASELINES,
  buildFontSections,
  detectAvailableFonts,
  filterFontCandidates,
  isFontDetected,
  normalizeFontFavorites,
  parseFontDetectionCache,
  quoteFontName,
} from "../src/fontCatalog.ts";
import { isValidFontName } from "../src/appearance.ts";

function fakeMeasure(widths) {
  return (stack, _text) => {
    const tokens = stack.split(",").map((token) => token.trim());
    const first = tokens[0].replace(/^"|"$/gu, "");
    const last = tokens[tokens.length - 1];
    const key = Object.keys(widths).find((name) => name === first);
    return key !== undefined ? widths[key] : (widths[last] ?? 10);
  };
}

test("font catalog has at least 150 unique, safe, grouped family names", () => {
  assert.ok(FONT_CANDIDATES.length >= 150, `only ${FONT_CANDIDATES.length} candidates`);
  const seen = new Set();
  const groups = new Set();
  for (const candidate of FONT_CANDIDATES) {
    const key = candidate.family.toLowerCase();
    assert.equal(seen.has(key), false, `duplicate candidate ${candidate.family}`);
    seen.add(key);
    groups.add(candidate.group);
    assert.equal(isValidFontName(candidate.family), true, candidate.family);
    assert.ok(FONT_SAMPLE_TEXT[candidate.script], `missing sample for ${candidate.script}`);
  }
  for (const group of FONT_GROUP_ORDER) {
    assert.equal(groups.has(group), true, `group ${group} has no candidates`);
  }
  assert.deepEqual(GENERIC_BASELINES, ["monospace", "serif", "sans-serif"]);
});

test("every script has a non-empty sample and all scripts are declared", () => {
  assert.deepEqual(
    Object.keys(FONT_SAMPLE_TEXT).sort(),
    [...FONT_SCRIPTS].sort(),
  );
  for (const script of FONT_SCRIPTS) {
    assert.ok(FONT_SAMPLE_TEXT[script].trim().length > 0, script);
  }
});

test("quoteFontName preserves spaces and escapes embedded quotes", () => {
  assert.equal(quoteFontName("Times New Roman"), '"Times New Roman"');
  assert.equal(quoteFontName('A"b'), '"A\\"b"');
});

test("isFontDetected compares against every generic baseline", () => {
  const measure = fakeMeasure({ "sans-serif": 10, serif: 11, monospace: 12, Arial: 8 });
  assert.equal(isFontDetected({ family: "Arial", script: "latin" }, measure), true);
  assert.equal(
    isFontDetected({ family: "Definitely Missing Font", script: "latin" }, measure),
    false,
  );
});

test("isFontDetected treats generic-equal metrics as not installed", () => {
  const measure = () => 10;
  assert.equal(isFontDetected({ family: "Arial", script: "latin" }, measure), false);
});

test("detectAvailableFonts keeps candidate order and skips missing fonts", () => {
  const measure = fakeMeasure({ "sans-serif": 10, serif: 11, monospace: 12, Arial: 8, Georgia: 9 });
  const detected = detectAvailableFonts(
    [
      { family: "Georgia", script: "latin" },
      { family: "Missing One", script: "latin" },
      { family: "Arial", script: "latin" },
    ],
    measure,
  );
  assert.deepEqual(detected, ["Georgia", "Arial"]);
});

test("filterFontCandidates searches names case-insensitively and safely", () => {
  const arial = filterFontCandidates({ query: "arial" }).map((font) => font.family);
  assert.ok(arial.includes("Arial"));
  assert.ok(arial.includes("Arial Black"));
  const yahei = filterFontCandidates({ query: "  YAHEI " }).map((font) => font.family);
  assert.ok(yahei.includes("Microsoft YaHei"));
  assert.deepEqual(filterFontCandidates({ query: "}; body {" }), []);
});

test("filterFontCandidates shows only detected fonts unless showAll or no scan", () => {
  const detected = new Set(["Arial"]);
  const filtered = filterFontCandidates({ detected }).map((font) => font.family);
  assert.deepEqual(filtered, ["Arial"]);
  const all = filterFontCandidates({ detected, showAll: true }).map((font) => font.family);
  assert.equal(all.length, FONT_CANDIDATES.length);
  const unscanned = filterFontCandidates({ detected: null }).map((font) => font.family);
  assert.equal(unscanned.length, FONT_CANDIDATES.length);
});

test("filterFontCandidates keeps favorites visible even when undetected", () => {
  const filtered = filterFontCandidates({
    detected: new Set(["Arial"]),
    favorites: ["Georgia"],
  }).map((font) => font.family);
  assert.deepEqual(filtered.sort(), ["Arial", "Georgia"]);
});

test("buildFontSections puts favorites first and removes them from normal groups", () => {
  const sections = buildFontSections(FONT_CANDIDATES, ["Georgia", "Microsoft YaHei"]);
  assert.equal(sections[0].group, "favorites");
  assert.deepEqual(
    sections[0].fonts.map((font) => font.family),
    ["Georgia", "Microsoft YaHei"],
  );
  for (const section of sections.slice(1)) {
    const names = section.fonts.map((font) => font.family);
    assert.equal(names.includes("Georgia"), false);
    assert.equal(names.includes("Microsoft YaHei"), false);
  }
  assert.deepEqual(
    sections.slice(1).map((section) => section.group),
    [...FONT_GROUP_ORDER],
  );
});

test("normalizeFontFavorites dedupes, validates and caps the list", () => {
  assert.deepEqual(normalizeFontFavorites(null), []);
  assert.deepEqual(normalizeFontFavorites("Arial"), []);
  const mixed = normalizeFontFavorites([
    "Georgia",
    "georgia",
    "  Arial  ",
    "url(https://example.com/x)",
    "Bad;Name",
    "Bad\nName",
    42,
    null,
    "x".repeat(81),
  ]);
  assert.deepEqual(mixed, ["Georgia", "Arial"]);
  const many = Array.from({ length: FONT_FAVORITES_MAX + 10 }, (_, index) => `Font ${index}`);
  assert.equal(normalizeFontFavorites(many).length, FONT_FAVORITES_MAX);
});

test("parseFontDetectionCache accepts fresh valid caches only", () => {
  const now = 1_700_000_000_000;
  const cache = {
    version: FONT_DETECTION_CACHE_VERSION,
    at: now - 1000,
    fonts: ["Arial", "Missing Syntax;", "Georgia", "Georgia"],
  };
  assert.deepEqual(parseFontDetectionCache(cache, now), ["Arial", "Georgia"]);
  assert.equal(parseFontDetectionCache(cache, now + FONT_DETECTION_CACHE_TTL_MS + 1), null);
  assert.equal(parseFontDetectionCache({ ...cache, version: 99 }, now), null);
  assert.equal(parseFontDetectionCache({ ...cache, at: "yesterday" }, now), null);
  assert.equal(parseFontDetectionCache({ ...cache, at: now + 60_000 }, now), null);
  assert.equal(parseFontDetectionCache({ ...cache, fonts: "Arial" }, now), null);
  assert.equal(parseFontDetectionCache("{not json", now), null);
  assert.equal(parseFontDetectionCache(null, now), null);
});

test("parseFontDetectionCache refuses oversized caches", () => {
  const now = 1_700_000_000_000;
  const fonts = Array.from({ length: FONT_DETECTION_CACHE_MAX_FONTS + 1 }, (_, i) => `Font ${i}`);
  assert.equal(
    parseFontDetectionCache({ version: FONT_DETECTION_CACHE_VERSION, at: now, fonts }, now),
    null,
  );
});
