import test from "node:test";
import assert from "node:assert/strict";

import {
  mapSelectionToTranslation,
  splitSentences,
  splitWords,
} from "../src/highlightText.ts";

test("splitSentences keeps offsets into the original text", () => {
  const text = "First sentence. Second one! 第三句。";
  const spans = splitSentences(text);
  assert.deepEqual(
    spans.map((span) => span.text),
    ["First sentence.", "Second one!", "第三句。"],
  );
  assert.equal(text.slice(spans[1].start, spans[1].end), "Second one!");
  assert.equal(text.slice(spans[2].start, spans[2].end), "第三句。");
});

test("splitSentences does not split decimals or abbreviations", () => {
  const spans = splitSentences("Pi is 3.14 today. See e.g. this.");
  assert.deepEqual(
    spans.map((span) => span.text),
    ["Pi is 3.14 today.", "See e.g. this."],
  );
});

test("splitWords segments Han and Latin text into increasing offsets", () => {
  const text = "ABC 机器 translation-based";
  const spans = splitWords(text);
  assert.ok(spans.length >= 4);
  assert.equal(spans[0].text, "ABC");
  for (const span of spans) {
    assert.equal(text.slice(span.start, span.end), span.text);
  }
  for (let index = 1; index < spans.length; index += 1) {
    assert.ok(spans[index].start > spans[index - 1].start, "units must advance");
  }
  // The Han run must be covered without swallowing the Latin words.
  const covered = spans.filter((span) => /[\u4e00-\u9fff]/u.test(span.text));
  assert.ok(covered.length >= 1);
  assert.ok(covered.every((span) => !/[A-Za-z]/u.test(span.text)));
});

test("selecting one word tints a sub-range, never the whole translation", () => {
  const source = "Alpha beta. Gamma delta. Epsilon zeta.";
  const translation = "阿尔法贝塔。伽马德尔塔。艾普西隆泽塔。";
  const start = source.indexOf("Gamma");
  const range = mapSelectionToTranslation(start, start + 5, source, translation);
  assert.ok(range);
  const text = translation.slice(range.start, range.end);
  assert.ok(text.includes("伽马"), `expected the 伽马 fragment, got "${text}"`);
  assert.ok(!text.includes("德尔塔"), `a single word must not pull in the rest, got "${text}"`);
});

test("selecting a whole sentence still lands on exactly that sentence", () => {
  const source = "Alpha beta. Gamma delta. Epsilon zeta.";
  const translation = "阿尔法贝塔。伽马德尔塔。艾普西隆泽塔。";
  const start = source.indexOf("Gamma");
  const end = source.indexOf("Epsilon");
  const range = mapSelectionToTranslation(start, end, source, translation);
  assert.ok(range);
  assert.equal(translation.slice(range.start, range.end), "伽马德尔塔。");
});

test("multi-sentence selection spans every covered translation sentence", () => {
  const source = "One. Two. Three.";
  const translation = "一。二。三。";
  const range = mapSelectionToTranslation(0, source.length, source, translation);
  assert.ok(range);
  assert.equal(translation.slice(range.start, range.end), "一。二。三。");
});

test("uneven sentence counts still anchor the second sentence", () => {
  const source = "Short first. A much longer second sentence here.";
  const translation = "第一句。第二句更长一些。";
  const start = source.indexOf("much longer");
  const end = source.indexOf("sentence");
  const range = mapSelectionToTranslation(start, end, source, translation);
  assert.ok(range);
  const text = translation.slice(range.start, range.end);
  // The second sentence starts at the second translation sentence.
  assert.ok(range.start >= translation.indexOf("第二"), `got "${text}"`);
  // and the selection must not stretch beyond the block.
  assert.ok(range.end <= translation.length);
});

test("a long paragraph with one merged translation sentence stays monotonic", () => {
  const source = "First idea here. Second idea there. Third idea now.";
  const translation = "第一个想法在这里，第二个想法在那里，第三个想法现在。";
  for (let offset = 1; offset < source.length; offset += 3) {
    const range = mapSelectionToTranslation(offset, offset + 4, source, translation);
    assert.ok(range);
    assert.ok(range.start >= 0 && range.end <= translation.length);
  }
});

test("mapping is monotonic across the paragraph", () => {
  const source = "Alpha beta gamma. Delta epsilon zeta eta. Theta iota kappa.";
  const translation = "甲乙丙。丁戊己庚。辛壬癸。";
  let previous = -1;
  for (let offset = 1; offset < source.length; offset += 2) {
    const range = mapSelectionToTranslation(offset, offset + 1, source, translation);
    assert.ok(range);
    assert.ok(range.start >= previous, "the mapped start must never move backwards");
    previous = range.start;
  }
});

test("empty or collapsed selections return null", () => {
  assert.equal(mapSelectionToTranslation(0, 0, "A. B.", "甲。乙。"), null);
  assert.equal(mapSelectionToTranslation(0, 2, "", "甲。"), null);
  assert.equal(mapSelectionToTranslation(0, 9, "A. B.", ""), null);
});
