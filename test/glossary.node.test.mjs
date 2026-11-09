import assert from "node:assert/strict";
import test from "node:test";

import {
  applyGlossaryToTranslation,
  buildGlossaryDirective,
  glossaryHash,
  normalizeGlossary,
  parseGlossary,
  serializeGlossary,
} from "../src/glossary.ts";

test("parseGlossary reads CSV with a header, quoted commas and escaped quotes", () => {
  const entries = parseGlossary(
    [
      "source,target",
      "neural network,神经网络",
      '"attention, self","自注意力"',
      '"say ""hi""",说“嗨”',
      "",
      "# comment line",
    ].join("\n"),
  );

  assert.deepEqual(entries, [
    { source: "neural network", target: "神经网络" },
    { source: "attention, self", target: "自注意力" },
    { source: 'say "hi"', target: "说“嗨”" },
  ]);
});

test("parseGlossary reads TSV, skips comments and keeps the last duplicate", () => {
  const entries = parseGlossary(
    ["# comment", "gene\t基因", "protein\t蛋白质", "gene\t基因（更新）"].join("\n"),
  );

  assert.deepEqual(entries, [
    { source: "protein", target: "蛋白质" },
    { source: "gene", target: "基因（更新）" },
  ]);
});

test("parseGlossary drops malformed and empty rows", () => {
  assert.deepEqual(parseGlossary(""), []);
  assert.deepEqual(parseGlossary("only-source"), []);
  assert.deepEqual(parseGlossary("source,target\n,空原文"), []);
  assert.deepEqual(parseGlossary("source,target\n空译文,"), []);
});

test("normalizeGlossary trims fields, ignores empties and caps entry length", () => {
  const entries = normalizeGlossary([
    { source: "  gene  ", target: "  基因  " },
    { source: "", target: "空" },
    { source: "x".repeat(300), target: "长" },
  ]);

  assert.deepEqual(entries, [{ source: "gene", target: "基因" }]);
});

test("serializeGlossary round-trips CSV quoting", () => {
  const entries = [
    { source: 'attention, self', target: "自注意力" },
    { source: 'say "hi"', target: "说“嗨”" },
    { source: "line\nbreak", target: "换行" },
  ];
  const csv = serializeGlossary(entries);
  assert.match(csv, /^source,target\n/u);

  assert.deepEqual(parseGlossary(csv), entries);
});

test("glossaryHash is empty for an empty glossary and changes with content", () => {
  assert.equal(glossaryHash([]), "");
  const first = glossaryHash([{ source: "gene", target: "基因" }]);
  const second = glossaryHash([{ source: "gene", target: "基因" }]);
  const changed = glossaryHash([{ source: "gene", target: "遗传因子" }]);

  assert.match(first, /^[0-9a-f]{8}$/u);
  assert.equal(first, second);
  assert.notEqual(first, changed);
});

test("buildGlossaryDirective lists terms and reports truncation", () => {
  const entries = [
    { source: "gene", target: "基因" },
    { source: "protein", target: "蛋白质" },
  ];
  const directive = buildGlossaryDirective(entries);
  assert.ok(directive.includes("gene => 基因"));
  assert.ok(directive.includes("protein => 蛋白质"));
  assert.ok(!directive.includes("未列入"));

  const truncated = buildGlossaryDirective(entries, 90);
  assert.ok(truncated.includes("未列入"));
  assert.ok(truncated.length <= 140);
});

test("applyGlossaryToTranslation enforces terms case-insensitively with boundaries", () => {
  const entries = [
    { source: "Gene", target: "基因" },
    { source: "neural network", target: "神经网络" },
    { source: "network", target: "网络" },
  ];
  assert.equal(
    applyGlossaryToTranslation("A GENE drives the neural Network, not a generic network.", entries),
    "A 基因 drives the 神经网络, not a generic 网络.",
  );
  assert.equal(applyGlossaryToTranslation("genes and networks", entries), "genes and networks");
});

test("applyGlossaryToTranslation handles regex metacharacters and literal dollar targets", () => {
  assert.equal(
    applyGlossaryToTranslation("Use C++ (not C#).", [
      { source: "C++", target: "$& 语言" },
      { source: "C#", target: "C Sharp" },
    ]),
    "Use $& 语言 (not C Sharp).",
  );
});

test("applyGlossaryToTranslation skips identity entries and empty input", () => {
  assert.equal(applyGlossaryToTranslation("", [{ source: "gene", target: "基因" }]), "");
  assert.equal(
    applyGlossaryToTranslation("gene model", [{ source: "gene", target: "gene" }]),
    "gene model",
  );
  assert.equal(applyGlossaryToTranslation("gene model", []), "gene model");
});
