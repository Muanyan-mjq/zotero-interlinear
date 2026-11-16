// SPDX-License-Identifier: AGPL-3.0-or-later
// Bounded stress test for the free translation backends.
//
// This is deliberately *not* a load generator aimed at somebody else's
// servers: every scenario stays at or below the concurrency the plugin itself
// allows, and the totals are small enough to be a realistic "long document"
// run. It measures what the plugin cares about — success rate, latency, 429
// behaviour and batch alignment — rather than peak throughput.
//
// Usage:
//   NODE_USE_ENV_PROXY=1 HTTPS_PROXY=http://127.0.0.1:7897 node scripts/stress-free.mjs
//
// Alibaba and Azure need credentials and are skipped without them:
//   ALIBABA_ACCESS_KEY_ID=... ALIBABA_ACCESS_KEY_SECRET=... \
//   AZURE_TRANSLATOR_KEY=... AZURE_TRANSLATOR_REGION=eastasia \
//   node scripts/stress-free.mjs

import {
  buildMicrosoftBody,
  buildMicrosoftEndpoint,
  parseMicrosoftTranslations,
} from "../src/providers/microsoftProtocol.ts";
import {
  buildGoogleQueryMulti,
  normalizeGoogleEndpoint,
  parseGoogleMultiResponse,
} from "../src/providers/googleProtocol.ts";
import {
  ALIBABA_ENDPOINT,
  ALIBABA_MAX_CHARS,
  alibabaTimestamp,
  buildAlibabaBody,
  buildAlibabaParams,
  buildAlibabaStringToSign,
  parseAlibabaTranslation,
  signAlibabaStringToSign,
} from "../src/providers/alibabaProtocol.ts";
import {
  DEFAULT_AZURE_ENDPOINT,
  buildAzureBody,
  buildAzureEndpoint,
  parseAzureTranslations,
} from "../src/providers/azureProtocol.ts";

const SOURCE = "en";
const TARGET = "zh-CN";
const TIMEOUT_MS = 20000;

const TEXTS = [
  "Hello world",
  "Interlinear keeps the source and the translation on the same page.",
  "Line one.\nLine two.\nLine three.",
  "Punctuation: commas, semicolons; dashes — and “quotes” (nested).",
  "你好，世界。这是第二段中文。",
  "A number like 3.14159 and a citation (Smith et al., 2024) must survive.",
  "This sentence is deliberately a little longer than the others so that the batch path is exercised with a realistic paragraph length.",
  "Short.",
];

function longSegment(length = 1800) {
  const sentence =
    "Retrieval-augmented generation combines a retriever with a generator. ";
  return sentence.repeat(Math.ceil(length / sentence.length)).slice(0, length);
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return Math.round(sorted[index]);
}

function summarize(name, results) {
  const ok = results.filter((r) => r.kind === "ok");
  const throttled = results.filter((r) => r.kind === "throttle");
  const failed = results.filter((r) => r.kind === "error");
  const latencies = results.map((r) => r.ms);
  return {
    name,
    requests: results.length,
    ok: ok.length,
    throttled: throttled.length,
    failed: failed.length,
    successRate: results.length ? Number((ok.length / results.length).toFixed(3)) : 0,
    p50ms: percentile(latencies, 50),
    p95ms: percentile(latencies, 95),
    maxMs: latencies.length ? Math.max(...latencies) : 0,
    alignmentFailures: results.filter((r) => r.alignment === false).length,
    sampleErrors: [...new Set(failed.map((r) => r.detail).filter(Boolean))].slice(0, 4),
    sampleThrottles: throttled.length,
  };
}

async function fetchWithTimeout(url, init) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function runOne(fn) {
  const started = Date.now();
  try {
    const value = await fn();
    return { kind: "ok", ms: Date.now() - started, value };
  } catch (error) {
    const ms = Date.now() - started;
    const status = error?.status;
    const cause = error?.name === "AbortError" ? "timeout" : error?.cause?.code || "";
    const detail = [String(error?.message || error), cause].filter(Boolean).join(" / ").slice(0, 160);
    if (status === 429) return { kind: "throttle", ms, status, detail };
    return { kind: "error", ms, status, detail };
  }
}

async function pool(tasks, concurrency) {
  const results = new Array(tasks.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
    while (true) {
      const index = next++;
      if (index >= tasks.length) return;
      results[index] = await tasks[index]();
    }
  });
  await Promise.all(workers);
  return results;
}

async function stressEdge() {
  const endpoint = buildMicrosoftEndpoint(SOURCE, TARGET);
  const mixed = [
    [TEXTS[0], TEXTS[2], TEXTS[4]],
    [TEXTS[1]],
    [TEXTS[3], TEXTS[5], TEXTS[6], TEXTS[7]],
    [longSegment(1800)],
  ];
  const request = async (texts) => {
    const result = await runOne(async () => {
      const response = await fetchWithTimeout(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: buildMicrosoftBody(texts),
      });
      const body = await response.text();
      if (response.status === 429) {
        const error = new Error(body.slice(0, 160));
        error.status = 429;
        throw error;
      }
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${body.slice(0, 160)}`);
        error.status = response.status;
        throw error;
      }
      const parsed = parseMicrosoftTranslations(JSON.parse(body), texts.length);
      if (!parsed) throw new Error("batch alignment/shape failure");
      return parsed;
    });
    if (result.kind === "ok" && !Array.isArray(result.value)) result.alignment = false;
    return result;
  };

  const functional = await pool(
    Array.from({ length: 16 }, () => () => request(mixed[Math.floor(Math.random() * 3)])),
    4,
  );
  const burst = await pool(
    Array.from({ length: 16 }, (_, i) => () => request([TEXTS[i % TEXTS.length]])),
    8,
  );
  const long = await request([longSegment(1800), TEXTS[0]]);
  return [
    summarize("Microsoft Edge (concurrency 4, batches)", [...functional, long]),
    summarize("Microsoft Edge (burst concurrency 8)", burst),
  ];
}

async function stressGoogle() {
  const endpoint = normalizeGoogleEndpoint("https://translate.googleapis.com");
  const request = (texts, client) =>
    runOne(async () => {
      const response = await fetchWithTimeout(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: buildGoogleQueryMulti(SOURCE, TARGET, texts, client),
      });
      const body = await response.text();
      if (response.status === 429) {
        const error = new Error(body.replace(/\s+/gu, " ").slice(0, 160));
        error.status = 429;
        throw error;
      }
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${body.slice(0, 160)}`);
        error.status = response.status;
        throw error;
      }
      const parsed = parseGoogleMultiResponse(JSON.parse(body), texts.length);
      if (!parsed) throw new Error("batch alignment/shape failure");
      return parsed;
    });

  const paced = [];
  for (let i = 0; i < 6; i += 1) {
    paced.push(await request([TEXTS[i % TEXTS.length], TEXTS[(i + 1) % TEXTS.length]], "it"));
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  const burst = await pool(
    Array.from({ length: 4 }, (_, i) => () => request([TEXTS[i % TEXTS.length]], "gtx")),
    4,
  );
  return summarize("Google translate_a/t", [...paced, ...burst]);
}

async function stressMyMemory() {
  const request = (text) =>
    runOne(async () => {
      const params = new URLSearchParams();
      params.set("q", text);
      params.set("langpair", `${SOURCE}|${TARGET}`);
      const response = await fetchWithTimeout(
        `https://api.mymemory.translated.net/get?${params.toString()}`,
      );
      const body = await response.text();
      if (response.status === 429) {
        const error = new Error(body.slice(0, 160));
        error.status = 429;
        throw error;
      }
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${body.slice(0, 160)}`);
        error.status = response.status;
        throw error;
      }
      const payload = JSON.parse(body);
      if (payload.quotaFinished) {
        const error = new Error("quotaFinished");
        error.status = 429;
        throw error;
      }
      const translated = payload?.responseData?.translatedText;
      if (typeof translated !== "string" || !translated.trim()) {
        throw new Error(`empty translation (${payload?.responseStatus})`);
      }
      return translated;
    });

  const results = [];
  for (let i = 0; i < 6; i += 1) {
    results.push(await request(TEXTS[i % TEXTS.length].slice(0, 200)));
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  return summarize("MyMemory (anonymous quota)", results);
}

function alibabaConfigured() {
  return !!(process.env.ALIBABA_ACCESS_KEY_ID && process.env.ALIBABA_ACCESS_KEY_SECRET);
}

function newNonce() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

async function stressAlibaba() {
  if (!alibabaConfigured()) {
    return { name: "Alibaba Cloud", skipped: "set ALIBABA_ACCESS_KEY_ID and ALIBABA_ACCESS_KEY_SECRET" };
  }
  const accessKeyId = process.env.ALIBABA_ACCESS_KEY_ID.trim();
  const accessKeySecret = process.env.ALIBABA_ACCESS_KEY_SECRET.trim();

  const request = (text) =>
    runOne(async () => {
      if (text.length > ALIBABA_MAX_CHARS) throw new Error("segment too long");
      const params = buildAlibabaParams({
        accessKeyId,
        sourceLanguage: SOURCE,
        targetLanguage: TARGET,
        text,
        nonce: newNonce(),
        timestamp: alibabaTimestamp(),
      });
      const signature = await signAlibabaStringToSign(
        accessKeySecret,
        buildAlibabaStringToSign(params),
      );
      const response = await fetchWithTimeout(ALIBABA_ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          accept: "application/json",
        },
        body: buildAlibabaBody(params, signature),
      });
      const body = await response.text();
      let payload = body;
      try {
        payload = JSON.parse(body);
      } catch {}
      if (response.status === 429) {
        const error = new Error(body.slice(0, 160));
        error.status = 429;
        throw error;
      }
      const parsed = parseAlibabaTranslation(payload);
      if (!parsed.ok) {
        const error = new Error(`code ${parsed.code}: ${parsed.message}`);
        if (/qps|throttl|too many|rate limit|频繁|限流/iu.test(`${parsed.code} ${parsed.message}`)) {
          error.status = 429;
        }
        throw error;
      }
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }
      return parsed.text;
    });

  const results = await pool(
    Array.from({ length: 8 }, (_, i) => () => request(TEXTS[i % 6])),
    3,
  );
  results.push(await request(longSegment(Math.min(3000, ALIBABA_MAX_CHARS - 200))));
  return summarize("Alibaba Cloud TranslateGeneral", results);
}

async function stressAzure() {
  const key = process.env.AZURE_TRANSLATOR_KEY;
  if (!key) {
    return { name: "Azure Translator", skipped: "set AZURE_TRANSLATOR_KEY (and AZURE_TRANSLATOR_REGION if regional)" };
  }
  const region = process.env.AZURE_TRANSLATOR_REGION || "";
  const endpoint = buildAzureEndpoint(DEFAULT_AZURE_ENDPOINT, SOURCE, TARGET);
  const headers = {
    "content-type": "application/json",
    accept: "application/json",
    "Ocp-Apim-Subscription-Key": key,
  };
  if (region) headers["Ocp-Apim-Subscription-Region"] = region;

  const request = (texts) =>
    runOne(async () => {
      const response = await fetchWithTimeout(endpoint, {
        method: "POST",
        headers,
        body: buildAzureBody(texts),
      });
      const body = await response.text();
      if (response.status === 429) {
        const error = new Error(body.slice(0, 160));
        error.status = 429;
        throw error;
      }
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${body.slice(0, 160)}`);
        error.status = response.status;
        throw error;
      }
      const parsed = parseAzureTranslations(JSON.parse(body), texts.length);
      if (!parsed) throw new Error("batch alignment/shape failure");
      return parsed;
    });

  const results = await pool(
    [
      () => request([TEXTS[0], TEXTS[1], TEXTS[2], TEXTS[3]]),
      () => request([TEXTS[4], TEXTS[5], TEXTS[6], TEXTS[7]]),
      () => request([longSegment(1800)]),
    ],
    2,
  );
  return summarize("Azure Translator", results);
}

async function stressAlibabaSigning() {
  const secret = "stress-test-secret";
  const tasks = Array.from({ length: 400 }, (_, i) => () =>
    runOne(async () => {
      const params = buildAlibabaParams({
        accessKeyId: "LTAI_STRESS_TEST",
        sourceLanguage: SOURCE,
        targetLanguage: TARGET,
        text: `segment ${i} — ${TEXTS[i % TEXTS.length]}`,
        nonce: `nonce-${i}-${Date.now()}`,
        timestamp: alibabaTimestamp(),
      });
      return signAlibabaStringToSign(secret, buildAlibabaStringToSign(params));
    }),
  );
  const results = await pool(tasks, 20);
  const summary = summarize("Alibaba signing (local, 400 ops @ 20 concurrent)", results);
  summary.uniqueSignatures = new Set(
    results.filter((r) => r.kind === "ok").map((r) => r.value),
  ).size;
  return summary;
}

function print(summary) {
  if (summary.skipped) {
    console.log(`- ${summary.name}: SKIPPED (${summary.skipped})`);
    return;
  }
  console.log(
    `- ${summary.name}: ${summary.ok}/${summary.requests} ok ` +
      `(${Math.round(summary.successRate * 100)}%), ` +
      `429/限流 ${summary.throttled}, errors ${summary.failed}, ` +
      `p50 ${summary.p50ms}ms, p95 ${summary.p95ms}ms, max ${summary.maxMs}ms, ` +
      `alignment failures ${summary.alignmentFailures}` +
      (summary.uniqueSignatures === undefined
        ? ""
        : `, unique signatures ${summary.uniqueSignatures}`),
  );
  if (summary.sampleErrors.length) {
    console.log(`  errors: ${summary.sampleErrors.join(" | ")}`);
  }
}

async function main() {
  if (!process.env.HTTPS_PROXY && !process.env.https_proxy) {
    console.warn(
      "warning: no HTTPS_PROXY set; Node's fetch ignores system proxies unless " +
        "NODE_USE_ENV_PROXY=1 and HTTPS_PROXY are set.",
    );
  }
  console.log("Bounded free-backend stress test (plugin-realistic load)\n");
  const summaries = [];
  summaries.push(...(await stressEdge()));
  summaries.push(await stressGoogle());
  summaries.push(await stressMyMemory());
  summaries.push(await stressAlibaba());
  summaries.push(await stressAzure());
  summaries.push(await stressAlibabaSigning());
  console.log("");
  for (const summary of summaries) print(summary);
  console.log("\nNote: Google throttles by egress IP; a throttled proxy exit is a valid result,");
  console.log("not a plugin failure. Alibaba/Azure need credentials and are skipped otherwise.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
