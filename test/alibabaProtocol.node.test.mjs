// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  ALIBABA_API_VERSION,
  alibabaLanguage,
  alibabaPercentEncode,
  alibabaTimestamp,
  buildAlibabaBody,
  buildAlibabaCanonicalQuery,
  buildAlibabaParams,
  buildAlibabaStringToSign,
  isAlibabaThrottle,
  parseAlibabaTranslation,
  signAlibabaStringToSign,
} from "../src/providers/alibabaProtocol.ts";

const PARAMS = buildAlibabaParams({
  accessKeyId: "testid",
  sourceLanguage: "auto",
  targetLanguage: "zh-TW",
  text: "Hello world & 你好 / 100%",
  nonce: "fixed-nonce",
  timestamp: "2026-11-16T08:00:00Z",
});

test("alibabaLanguage maps Chinese variants and keeps auto", () => {
  assert.equal(alibabaLanguage("zh-CN"), "zh");
  assert.equal(alibabaLanguage("zh-TW"), "zh-tw");
  assert.equal(alibabaLanguage("auto"), "auto");
  assert.equal(alibabaLanguage("en"), "en");
  assert.equal(alibabaLanguage(""), "");
});

test("alibabaPercentEncode follows RFC 3986, not encodeURIComponent's extras", () => {
  assert.equal(alibabaPercentEncode("a b*c~d/e+"), "a%20b%2Ac~d%2Fe%2B");
  assert.equal(alibabaPercentEncode("!'()"), "%21%27%28%29");
  assert.equal(alibabaPercentEncode("你好"), "%E4%BD%A0%E5%A5%BD");
});

test("buildAlibabaParams carries the RPC contract and language mapping", () => {
  assert.equal(PARAMS.Action, "TranslateGeneral");
  assert.equal(PARAMS.Version, ALIBABA_API_VERSION);
  assert.equal(PARAMS.Format, "JSON");
  assert.equal(PARAMS.FormatType, "text");
  assert.equal(PARAMS.Scene, "general");
  assert.equal(PARAMS.SignatureMethod, "HMAC-SHA1");
  assert.equal(PARAMS.SignatureNonce, "fixed-nonce");
  assert.equal(PARAMS.SignatureVersion, "1.0");
  assert.equal(PARAMS.SourceLanguage, "auto");
  assert.equal(PARAMS.TargetLanguage, "zh-tw");
  assert.equal(PARAMS.SourceText, "Hello world & 你好 / 100%");
  assert.equal(PARAMS.Timestamp, "2026-11-16T08:00:00Z");
});

test("canonical query is sorted, encoded and lossless", () => {
  const query = buildAlibabaCanonicalQuery(PARAMS);
  const keys = [...query.matchAll(/(?:^|&)([^=]+)=/gu)].map((match) =>
    decodeURIComponent(match[1]),
  );
  assert.deepEqual(keys, [...keys].sort());
  const parsed = new URLSearchParams(query);
  assert.equal(parsed.get("SourceText"), "Hello world & 你好 / 100%");
  assert.equal(parsed.get("TargetLanguage"), "zh-tw");
  assert.equal(parsed.get("AccessKeyId"), "testid");
});

test("string to sign uses POST&%2F& and the encoded canonical query", () => {
  const canonical = buildAlibabaCanonicalQuery(PARAMS);
  const stringToSign = buildAlibabaStringToSign(PARAMS);
  assert.ok(stringToSign.startsWith("POST&%2F&"));
  assert.equal(
    stringToSign,
    `POST&%2F&${alibabaPercentEncode(canonical)}`,
  );
  assert.ok(!stringToSign.includes("&SourceText="), "raw & would break the signature");
});

test("WebCrypto signature matches an independent Node HMAC-SHA1", async () => {
  const stringToSign = buildAlibabaStringToSign(PARAMS);
  const expected = createHmac("sha1", "testsecret&")
    .update(stringToSign)
    .digest("base64");
  assert.equal(await signAlibabaStringToSign("testsecret", stringToSign), expected);
});

test("body appends an encoded signature after the canonical parameters", () => {
  const body = buildAlibabaBody(PARAMS, "a+b/c=");
  assert.ok(body.startsWith(buildAlibabaCanonicalQuery(PARAMS)));
  assert.ok(body.endsWith("&Signature=a%2Bb%2Fc%3D"));
});

test("alibabaTimestamp drops fractional seconds", () => {
  assert.equal(
    alibabaTimestamp(new Date("2026-11-16T08:09:10.123Z")),
    "2026-11-16T08:09:10Z",
  );
});

test("parseAlibabaTranslation accepts only a real 200 with text", () => {
  assert.deepEqual(
    parseAlibabaTranslation({
      Code: 200,
      Message: "success",
      RequestId: "req-1",
      Data: { Translated: " 你好 ", DetectedLanguage: "en" },
    }),
    {
      ok: true,
      text: "你好",
      code: "200",
      requestId: "req-1",
      detectedLanguage: "en",
    },
  );
  assert.equal(
    parseAlibabaTranslation({ Code: "200", Data: { Translated: "ok" } }).ok,
    true,
  );
  const error = parseAlibabaTranslation({
    Code: 10010,
    Message: "账号没有开通服务",
    RequestId: "req-2",
  });
  assert.equal(error.ok, false);
  assert.equal(error.code, "10010");
  assert.equal(error.message, "账号没有开通服务");
  assert.equal(parseAlibabaTranslation({ Code: 200, Data: { Translated: "   " } }).ok, false);
  assert.equal(parseAlibabaTranslation({ Code: 200 }).ok, false);
  assert.equal(parseAlibabaTranslation("not json").ok, false);
});

test("isAlibabaThrottle only parks real rate limiting", () => {
  assert.equal(isAlibabaThrottle("429", ""), true);
  assert.equal(isAlibabaThrottle("10002", "QPS limit exceeded"), true);
  assert.equal(isAlibabaThrottle("10002", "The request has timed out."), false);
  assert.equal(isAlibabaThrottle("10010", "账号没有开通服务"), false);
});
