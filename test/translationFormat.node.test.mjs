import test from "node:test";
import assert from "node:assert/strict";

import {
  maskProtectedSpans,
  restoreProtectedSpans,
  sanitizeModelOutput,
  tokenizeTranslation,
} from "../src/translationFormat.ts";

test("masks and restores math, code and URLs exactly", () => {
  const source =
    "Use $x^2$ and `npm test` at https://example.com/a?b=1 with \\(y\\) and \\[z\\].";
  const { text, tokens } = maskProtectedSpans(source);
  assert.doesNotMatch(text, /\$x\^2\$/);
  assert.doesNotMatch(text, /`npm test`/);
  assert.doesNotMatch(text, /https:\/\/example\.com/);
  assert.equal(tokens.length, 5);
  assert.equal(restoreProtectedSpans(text, tokens), source);
});

test("display math is masked before inline math", () => {
  const { text, tokens } = maskProtectedSpans("$$a+b$$ then $c$");
  assert.equal(tokens.length, 2);
  assert.equal(tokens[0], "$$a+b$$");
  assert.equal(restoreProtectedSpans(text, tokens), "$$a+b$$ then $c$");
});

test("restores tokens the model re-spaced or bracketed differently", () => {
  const { tokens } = maskProtectedSpans("See $E=mc^2$.");
  assert.equal(restoreProtectedSpans("看 ⟦ IL 0 ⟧。", tokens), "看 $E=mc^2$。");
  assert.equal(restoreProtectedSpans("看 [[IL0]]。", tokens), "看 $E=mc^2$。");
  assert.equal(restoreProtectedSpans("看 【IL0】。", tokens), "看 $E=mc^2$。");
});

test("drops tokens that cannot be restored", () => {
  const { tokens } = maskProtectedSpans("A $x$ B");
  assert.equal(restoreProtectedSpans("甲乙 ⟦IL9⟧ 丙", tokens), "甲乙  丙");
});

test("leaves ordinary text and literal HTML untouched", () => {
  const { text, tokens } = maskProtectedSpans("Use <answer> & keep 5 < 6.");
  assert.equal(tokens.length, 0);
  assert.equal(text, "Use <answer> & keep 5 < 6.");
});

test("tokenizes markdown, inline code, math and plain text", () => {
  const tokens = tokenizeTranslation("**Bold** and *soft* with `code` and $x$.");
  assert.deepEqual(
    tokens.map((token) => token.type),
    ["strong", "text", "em", "text", "code", "text", "math", "text"],
  );
  assert.equal(tokens[0].value, "Bold");
  assert.equal(tokens[4].value, "code");
  assert.equal(tokens[6].value, "x");
});

test("unmatched markers stay literal text", () => {
  const tokens = tokenizeTranslation("2 * 3 = 6, an unclosed $ sign");
  assert.equal(tokens.length, 1);
  assert.equal(tokens[0].type, "text");
  assert.equal(tokens[0].value, "2 * 3 = 6, an unclosed $ sign");
});
test("strips answer tags, fences and translation labels", () => {
  assert.equal(sanitizeModelOutput("<answer>译文内容</answer>"), "译文内容");
  assert.equal(sanitizeModelOutput("```markdown\n译文内容\n```"), "译文内容");
  assert.equal(sanitizeModelOutput("译文：这是译文。"), "这是译文。");
  assert.equal(sanitizeModelOutput("Translation: This is it."), "This is it.");
  assert.equal(sanitizeModelOutput("  <translation>中文</translation>  "), "中文");
});

test("removes a wrapping quote pair but keeps inner and curly quotes", () => {
  assert.equal(sanitizeModelOutput('"这是译文。"'), "这是译文。");
  assert.equal(sanitizeModelOutput('"He said "ok", then left."'), '"He said "ok", then left."');
  // A fully quoted Chinese sentence is content, not a wrapper.
  assert.equal(sanitizeModelOutput("“这是引用的原文。”"), "“这是引用的原文。”");
});

test("leaves real prose untouched", () => {
  const prose = "图 3 显示：准确率提升了 2.5%，见 Smith (2020)。";
  assert.equal(sanitizeModelOutput(prose), prose);
  assert.equal(sanitizeModelOutput("  多行\n\n\n文本  "), "多行\n\n文本");
});
