import { assert } from "chai";
import { getTranslationProvider } from "../../src/providers";
import { GoogleThrottleError } from "../../src/providers/google";
import {
  getFreeActiveBackend,
  resetFreeBackends,
  translateFree,
} from "../../src/providers/free";
import type { ProviderContext } from "../../src/providers/types";

const BASE = "extensions.zotero.interlinear";
const MOCK = "http://127.0.0.1:18923";

function context(): ProviderContext {
  return { itemID: 0, sourceLanguage: "en", targetLanguage: "zh-CN", timeoutMs: 30000 };
}

function snapshotPrefs(keys: readonly string[]): Map<string, unknown> {
  const saved = new Map<string, unknown>();
  for (const key of keys) saved.set(key, Zotero.Prefs.get(key, true));
  return saved;
}

function restorePrefs(saved: Map<string, unknown>): void {
  for (const [key, value] of saved) {
    if (value === undefined) Zotero.Prefs.clear(key, true);
    else Zotero.Prefs.set(key, value as any, true);
  }
}

function rethrowDiagnosable(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  const wrapped = new Error(message);
  Object.defineProperty(wrapped, "message", { value: message, enumerable: true });
  throw wrapped;
}

async function controlMock(state: Record<string, unknown>): Promise<void> {
  await Zotero.HTTP.request("POST", `${MOCK}/__control`, {
    body: JSON.stringify(state),
    responseType: "text",
    timeout: 5000,
  });
}

async function readMockStats(): Promise<any> {
  const xhr = await Zotero.HTTP.request("GET", `${MOCK}/__stats`, {
    responseType: "text",
    timeout: 5000,
  });
  return JSON.parse(String(xhr.response));
}

describe("free service router e2e", function () {
  it("should rotate to a healthy Google quota pool within the same batch", async function () {
    this.timeout(120000);
    const keys = [
      `${BASE}.engine`,
      `${BASE}.google.baseUrl`,
      `${BASE}.free.backend`,
      `${BASE}.free.googleClient`,
      `${BASE}.free.autoFallback`,
      `${BASE}.free.libreTranslateUrl`,
      `${BASE}.free.myMemoryUrl`,
      "network.proxy.type",
    ];
    const saved = snapshotPrefs(keys);
    try {
      Zotero.Prefs.set("network.proxy.type", 0, true);
      Zotero.Prefs.set(`${BASE}.engine`, "google", true);
      Zotero.Prefs.set(`${BASE}.google.baseUrl`, MOCK, true);
      Zotero.Prefs.set(`${BASE}.free.backend`, "auto", true);
      Zotero.Prefs.set(`${BASE}.free.googleClient`, "it", true);
      Zotero.Prefs.set(`${BASE}.free.autoFallback`, true, true);
      Zotero.Prefs.set(`${BASE}.free.libreTranslateUrl`, "", true);
      Zotero.Prefs.set(`${BASE}.free.myMemoryUrl`, `${MOCK}/get`, true);
      resetFreeBackends();
      await controlMock({
        googleThrottle: false,
        googleThrottleClients: ["it"],
        googleCaptcha: false,
        myMemoryFail: false,
        libreFail: false,
      });

      const before = await readMockStats();
      const result = await getTranslationProvider("google").translateBatch!(
        ["Hello", "World"],
        context(),
      );
      assert.deepEqual(result, ["ZH:Hello", "ZH:World"], "batch succeeds after switching pools");
      const after = await readMockStats();
      assert.equal(
        (after.googleByClient.it || 0) - (before.googleByClient.it || 0),
        1,
        "throttled pool is tried exactly once",
      );
      assert.isAtLeast(
        (after.googleByClient.at || 0) - (before.googleByClient.at || 0),
        1,
        "rotated to the at pool",
      );
      assert.equal(getFreeActiveBackend(), "google:at", "healthy pool becomes active");

      // The next batch should stay on the healthy pool instead of re-probing
      // the throttled one on every paragraph.
      await getTranslationProvider("google").translateBatch!(["Again"], context());
      assert.equal(getFreeActiveBackend(), "google:at", "active pool is sticky");
    } catch (error) {
      rethrowDiagnosable(error);
    } finally {
      await controlMock({
        googleThrottle: false,
        googleThrottleClients: [],
        googleCaptcha: false,
        myMemoryFail: false,
        libreFail: false,
      });
      resetFreeBackends();
      restorePrefs(saved);
    }
  });

  it("should fall back through MyMemory and LibreTranslate when every Google pool is blocked", async function () {
    this.timeout(120000);
    const keys = [
      `${BASE}.engine`,
      `${BASE}.google.baseUrl`,
      `${BASE}.free.backend`,
      `${BASE}.free.googleClient`,
      `${BASE}.free.autoFallback`,
      `${BASE}.free.libreTranslateUrl`,
      `${BASE}.free.myMemoryUrl`,
      "network.proxy.type",
    ];
    const saved = snapshotPrefs(keys);
    try {
      Zotero.Prefs.set("network.proxy.type", 0, true);
      Zotero.Prefs.set(`${BASE}.engine`, "google", true);
      Zotero.Prefs.set(`${BASE}.google.baseUrl`, MOCK, true);
      Zotero.Prefs.set(`${BASE}.free.backend`, "auto", true);
      Zotero.Prefs.set(`${BASE}.free.googleClient`, "it", true);
      Zotero.Prefs.set(`${BASE}.free.autoFallback`, true, true);
      Zotero.Prefs.set(`${BASE}.free.myMemoryUrl`, `${MOCK}/get`, true);
      Zotero.Prefs.set(`${BASE}.free.libreTranslateUrl`, MOCK, true);
      resetFreeBackends();
      await controlMock({
        googleThrottle: true,
        googleThrottleClients: [],
        googleCaptcha: false,
        myMemoryFail: false,
        libreFail: false,
      });

      const viaMyMemory = await translateFree(["Hello", "World"], context());
      assert.deepEqual(viaMyMemory, ["MM:Hello", "MM:World"], "MyMemory takes over");
      assert.equal(getFreeActiveBackend(), "mymemory");

      // Force MyMemory out of quota too: LibreTranslate must be next.
      resetFreeBackends();
      await controlMock({ myMemoryFail: true });
      const viaLibre = await translateFree(["Hello", "World"], context());
      assert.deepEqual(viaLibre, ["LT:Hello", "LT:World"], "LibreTranslate takes over");
      assert.equal(getFreeActiveBackend(), "libretranslate");
    } catch (error) {
      rethrowDiagnosable(error);
    } finally {
      await controlMock({
        googleThrottle: false,
        googleThrottleClients: [],
        googleCaptcha: false,
        myMemoryFail: false,
        libreFail: false,
      });
      resetFreeBackends();
      restorePrefs(saved);
    }
  });

  it("should pause the run with a cooldown only when every free service is down", async function () {
    this.timeout(120000);
    const keys = [
      `${BASE}.google.baseUrl`,
      `${BASE}.free.backend`,
      `${BASE}.free.libreTranslateUrl`,
      `${BASE}.free.myMemoryUrl`,
      "network.proxy.type",
    ];
    const saved = snapshotPrefs(keys);
    try {
      Zotero.Prefs.set("network.proxy.type", 0, true);
      Zotero.Prefs.set(`${BASE}.google.baseUrl`, MOCK, true);
      Zotero.Prefs.set(`${BASE}.free.backend`, "auto", true);
      Zotero.Prefs.set(`${BASE}.free.myMemoryUrl`, `${MOCK}/get`, true);
      Zotero.Prefs.set(`${BASE}.free.libreTranslateUrl`, MOCK, true);
      resetFreeBackends();
      await controlMock({
        googleThrottle: true,
        googleThrottleClients: [],
        googleCaptcha: false,
        myMemoryFail: true,
        libreFail: true,
      });

      let failure: any = null;
      try {
        await translateFree(["Hello"], context());
      } catch (error: any) {
        failure = error;
      }
      assert.instanceOf(failure, GoogleThrottleError, "all-down must be a run-wide pause");
      assert.isAbove(failure!.cooldownMs, 0, "all-down carries a cooldown for the runner");
    } catch (error) {
      rethrowDiagnosable(error);
    } finally {
      await controlMock({
        googleThrottle: false,
        googleThrottleClients: [],
        googleCaptcha: false,
        myMemoryFail: false,
        libreFail: false,
      });
      resetFreeBackends();
      restorePrefs(saved);
    }
  });

  it("should keep every segment aligned under concurrent high-volume batches", async function () {
    this.timeout(240000);
    const keys = [
      `${BASE}.google.baseUrl`,
      `${BASE}.free.backend`,
      `${BASE}.free.googleClient`,
      `${BASE}.free.myMemoryUrl`,
      "network.proxy.type",
    ];
    const saved = snapshotPrefs(keys);
    try {
      Zotero.Prefs.set("network.proxy.type", 0, true);
      Zotero.Prefs.set(`${BASE}.google.baseUrl`, MOCK, true);
      Zotero.Prefs.set(`${BASE}.free.backend`, "auto", true);
      Zotero.Prefs.set(`${BASE}.free.googleClient`, "it", true);
      Zotero.Prefs.set(`${BASE}.free.myMemoryUrl`, `${MOCK}/get`, true);
      resetFreeBackends();
      await controlMock({
        googleThrottle: false,
        googleThrottleClients: [],
        googleCaptcha: false,
        myMemoryFail: false,
        libreFail: false,
      });

      // 12 concurrent batches x 6 segments = 72 paragraphs, simulating many
      // open readers translating at the same time.
      const batches = Array.from({ length: 12 }, (_, batch) =>
        Array.from({ length: 6 }, (_, i) => `b${batch}-p${i} & more`),
      );
      const before = await readMockStats();
      const results = await Promise.all(
        batches.map((texts) => translateFree(texts, context())),
      );
      for (let b = 0; b < batches.length; b++) {
        assert.deepEqual(
          results[b],
          batches[b].map((text) => `ZH:${text}`),
          `batch ${b} alignment`,
        );
      }
      const after = await readMockStats();
      assert.equal(
        after.googleRequests - before.googleRequests,
        batches.length,
        "one batched request per concurrent job, no per-segment fallback",
      );
      assert.equal(after.googleSegments - before.googleSegments, 72, "all segments sent");
    } catch (error) {
      rethrowDiagnosable(error);
    } finally {
      await controlMock({
        googleThrottle: false,
        googleThrottleClients: [],
        googleCaptcha: false,
        myMemoryFail: false,
        libreFail: false,
      });
      resetFreeBackends();
      restorePrefs(saved);
    }
  });

  it("should use an extra Google gateway as an independent quota pool", async function () {
    this.timeout(120000);
    const keys = [
      `${BASE}.google.baseUrl`,
      `${BASE}.free.backend`,
      `${BASE}.free.autoFallback`,
      `${BASE}.free.googleClient`,
      `${BASE}.free.googleMirrors`,
      `${BASE}.free.customUrl`,
      `${BASE}.free.customResultPath`,
      `${BASE}.free.myMemoryUrl`,
      `${BASE}.free.libreTranslateUrl`,
      "network.proxy.type",
    ];
    const saved = snapshotPrefs(keys);
    try {
      Zotero.Prefs.set("network.proxy.type", 0, true);
      Zotero.Prefs.set(`${BASE}.google.baseUrl`, MOCK, true);
      Zotero.Prefs.set(`${BASE}.free.backend`, "auto", true);
      Zotero.Prefs.set(`${BASE}.free.autoFallback`, true, true);
      Zotero.Prefs.set(`${BASE}.free.googleClient`, "it", true);
      Zotero.Prefs.set(`${BASE}.free.googleMirrors`, `${MOCK}/mirror1`, true);
      Zotero.Prefs.set(`${BASE}.free.customUrl`, "", true);
      Zotero.Prefs.set(`${BASE}.free.customResultPath`, "responseData.translatedText", true);
      Zotero.Prefs.set(`${BASE}.free.myMemoryUrl`, `${MOCK}/get`, true);
      Zotero.Prefs.set(`${BASE}.free.libreTranslateUrl`, "", true);
      resetFreeBackends();
      await controlMock({
        googleThrottle: false,
        googleThrottlePrimary: true,
        googleThrottleClients: [],
        googleCaptcha: false,
        myMemoryFail: false,
        libreFail: false,
        customFail: false,
      });

      const before = await readMockStats();
      const result = await translateFree(["Hello", "World"], context());
      const after = await readMockStats();
      assert.deepEqual(result, ["ZH:Hello", "ZH:World"], "mirror answers the batch");
      assert.equal(getFreeActiveBackend(), "google-m1:it", "mirror becomes the active pool");
      assert.isAtLeast(after.mirrorRequests - before.mirrorRequests, 1);
      assert.equal(
        after.googleThrottled - before.googleThrottled,
        5,
        "all five default pools were tried exactly once before switching",
      );
    } catch (error) {
      rethrowDiagnosable(error);
    } finally {
      await controlMock({
        googleThrottle: false,
        googleThrottlePrimary: false,
        googleThrottleClients: [],
        googleCaptcha: false,
        myMemoryFail: false,
        libreFail: false,
        customFail: false,
      });
      resetFreeBackends();
      restorePrefs(saved);
    }
  });

  it("should keep dozens of articles aligned when only the custom endpoint survives", async function () {
    this.timeout(240000);
    const keys = [
      `${BASE}.google.baseUrl`,
      `${BASE}.free.backend`,
      `${BASE}.free.googleMirrors`,
      `${BASE}.free.customUrl`,
      `${BASE}.free.customResultPath`,
      `${BASE}.free.myMemoryUrl`,
      `${BASE}.free.libreTranslateUrl`,
      "network.proxy.type",
    ];
    const saved = snapshotPrefs(keys);
    try {
      Zotero.Prefs.set("network.proxy.type", 0, true);
      Zotero.Prefs.set(`${BASE}.google.baseUrl`, MOCK, true);
      Zotero.Prefs.set(`${BASE}.free.backend`, "auto", true);
      Zotero.Prefs.set(`${BASE}.free.googleMirrors`, "", true);
      Zotero.Prefs.set(
        `${BASE}.free.customUrl`,
        `${MOCK}/custom?q={text}&langpair={from}|{to}`,
        true,
      );
      Zotero.Prefs.set(`${BASE}.free.customResultPath`, "responseData.translatedText", true);
      Zotero.Prefs.set(`${BASE}.free.myMemoryUrl`, `${MOCK}/get`, true);
      Zotero.Prefs.set(`${BASE}.free.libreTranslateUrl`, MOCK, true);
      resetFreeBackends();
      await controlMock({
        googleThrottle: true,
        googleThrottlePrimary: false,
        googleThrottleClients: [],
        googleCaptcha: false,
        myMemoryFail: true,
        libreFail: true,
        customFail: false,
      });

      // 24 readers open at once, each with 6 paragraphs. Every shared free
      // service is down; the custom endpoint must still serve all of them
      // without a single misaligned or permanently failed paragraph.
      const articles = Array.from({ length: 24 }, (_, article) =>
        Array.from({ length: 6 }, (_, i) => `a${article}-p${i} & more`),
      );
      const results = await Promise.all(
        articles.map((texts) => translateFree(texts, context())),
      );
      for (let a = 0; a < articles.length; a++) {
        assert.deepEqual(
          results[a],
          articles[a].map((text) => `CE:${text}`),
          `article ${a} alignment`,
        );
      }
      assert.equal(getFreeActiveBackend(), "custom", "custom endpoint stays active");
      const stats = await readMockStats();
      assert.isAtLeast(stats.customRequests, 144, "every paragraph reached the custom endpoint");
    } catch (error) {
      rethrowDiagnosable(error);
    } finally {
      await controlMock({
        googleThrottle: false,
        googleThrottlePrimary: false,
        googleThrottleClients: [],
        googleCaptcha: false,
        myMemoryFail: false,
        libreFail: false,
        customFail: false,
      });
      resetFreeBackends();
      restorePrefs(saved);
    }
  });

  it("should keep 36 concurrent articles aligned on the healthy free chain", async function () {
    this.timeout(240000);
    const keys = [
      `${BASE}.google.baseUrl`,
      `${BASE}.free.backend`,
      `${BASE}.free.googleClient`,
      `${BASE}.free.googleMirrors`,
      `${BASE}.free.customUrl`,
      `${BASE}.free.myMemoryUrl`,
      `${BASE}.free.libreTranslateUrl`,
      "network.proxy.type",
    ];
    const saved = snapshotPrefs(keys);
    try {
      Zotero.Prefs.set("network.proxy.type", 0, true);
      Zotero.Prefs.set(`${BASE}.google.baseUrl`, MOCK, true);
      Zotero.Prefs.set(`${BASE}.free.backend`, "auto", true);
      Zotero.Prefs.set(`${BASE}.free.googleClient`, "it", true);
      Zotero.Prefs.set(`${BASE}.free.googleMirrors`, "", true);
      Zotero.Prefs.set(`${BASE}.free.customUrl`, "", true);
      Zotero.Prefs.set(`${BASE}.free.myMemoryUrl`, `${MOCK}/get`, true);
      Zotero.Prefs.set(`${BASE}.free.libreTranslateUrl`, "", true);
      resetFreeBackends();
      await controlMock({
        googleThrottle: false,
        googleThrottlePrimary: false,
        googleThrottleClients: [],
        googleCaptcha: false,
        myMemoryFail: false,
        libreFail: false,
        customFail: false,
      });

      const articles = Array.from({ length: 36 }, (_, article) =>
        Array.from({ length: 10 }, (_, i) => `a${article}-p${i} & more`),
      );
      const before = await readMockStats();
      const results = await Promise.all(
        articles.map((texts) => translateFree(texts, context())),
      );
      for (let a = 0; a < articles.length; a++) {
        assert.deepEqual(
          results[a],
          articles[a].map((text) => `ZH:${text}`),
          `article ${a} alignment`,
        );
      }
      const after = await readMockStats();
      assert.equal(
        after.googleRequests - before.googleRequests,
        36,
        "one batched request per article, no per-paragraph fallback",
      );
      assert.equal(after.googleSegments - before.googleSegments, 360, "all 360 segments sent");
    } catch (error) {
      rethrowDiagnosable(error);
    } finally {
      await controlMock({
        googleThrottle: false,
        googleThrottlePrimary: false,
        googleThrottleClients: [],
        googleCaptcha: false,
        myMemoryFail: false,
        libreFail: false,
        customFail: false,
      });
      resetFreeBackends();
      restorePrefs(saved);
    }
  });
});
