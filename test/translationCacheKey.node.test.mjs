import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildLegacyTranslationCacheKey,
  buildTranslationCacheKey,
} from "../src/translationCacheKey.ts";

const input = {
  itemKey: "ABCD1234",
  sourceText: "Interlinear keeps translations per paragraph.",
  engineTag: "google|zh-CN|g0",
  targetLanguage: "zh-CN",
};

test("translation cache key is stable for identical translation inputs", () => {
  assert.equal(buildTranslationCacheKey({ ...input }), buildTranslationCacheKey({ ...input }));
});

test("translation cache key depends on item, text, engine and language", () => {
  const base = buildTranslationCacheKey(input);
  assert.notEqual(
    buildTranslationCacheKey({ ...input, itemKey: "OTHERKEY" }),
    base,
  );
  assert.notEqual(
    buildTranslationCacheKey({ ...input, sourceText: `${input.sourceText} ` }),
    base,
  );
  assert.notEqual(
    buildTranslationCacheKey({ ...input, engineTag: "google|zh-CN|g1" }),
    base,
  );
  assert.notEqual(
    buildTranslationCacheKey({ ...input, targetLanguage: "ja-JP" }),
    base,
  );
});

test("translation cache key has the v4 prefix and sanitized parts", () => {
  const key = buildTranslationCacheKey({
    ...input,
    itemKey: "bad key/with spaces",
    targetLanguage: "zh-CN<script>",
  });
  assert.match(key, /^extensions\.zotero\.interlinear\.cache\.v4\./);
  assert.match(key, /\.bad_key_with_spaces\./);
  assert.match(key, /\.zh-CN_script_$/);
});

test("legacy cache key keeps the v3 layout", () => {
  const key = buildLegacyTranslationCacheKey(input);
  assert.match(key, /^extensions\.zotero\.interlinear\.cache\.v3\./);
  assert.ok(key.endsWith(".zh-CN"));
});

test("cache module never reads appearance settings", () => {
  // Font, color, spacing and direction are presentation-only. If any of them
  // ever enters the key, every style tweak would retranslate the whole document.
  for (const file of ["../src/translationCache.ts", "../src/translationCacheKey.ts"]) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(source, /appearance/i, `${file} must not reference appearance`);
  }
});
