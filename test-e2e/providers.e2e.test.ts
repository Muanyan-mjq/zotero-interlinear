import { assert } from "chai";
import { getChatProvider, getTranslationProvider } from "../src/providers";
import { GoogleThrottleError, requestGoogleTranslations } from "../src/providers/google";
import type { ChatTurn } from "../src/providers/chatProtocol";
import type { ProviderContext } from "../src/providers/types";

const BASE = "extensions.zotero.interlinear";
const MOCK = "http://127.0.0.1:18923";
const MARKER = "MOCK-LLM-OK";
const TURNS: readonly ChatTurn[] = [{ role: "user", content: "Hello from the e2e run" }];

function resolveRepoRoot(): string {
  const configured = Zotero.Prefs.get(`${BASE}.test.repoRoot`, true);
  const fallback = (() => {
    try {
      return Services.dirsvc.get("CurWorkD", Components.interfaces.nsIFile).path;
    }
    catch (_) {
      return "";
    }
  })();
  return String(configured || fallback).replace(/\\/g, "/").replace(/\/+$/, "");
}

const DIAG_PATH = `${resolveRepoRoot()}/.scaffold/e2e-diag.txt`;

function nativePath(path: string): string {
  return Zotero.isWin ? path.replace(/\//g, "\\") : path;
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

function context(): ProviderContext {
  return { itemID: 0, sourceLanguage: "en", targetLanguage: "zh-CN", timeoutMs: 30000 };
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

describe("provider e2e", function () {
  it("should translate and chat through every third-party protocol over real HTTP", async function () {
    this.timeout(60000);
    const keys = [
      `${BASE}.engine`,
      `${BASE}.language.source`,
      `${BASE}.language.target`,
      `${BASE}.openai.endpoint`,
      `${BASE}.openai.model`,
      `${BASE}.openai.apiKey`,
      `${BASE}.claude.endpoint`,
      `${BASE}.claude.model`,
      `${BASE}.claude.apiKey`,
      `${BASE}.gemini.baseUrl`,
      `${BASE}.gemini.model`,
      `${BASE}.gemini.apiKey`,
      `${BASE}.ollama.url`,
      `${BASE}.ollama.model`,
      "network.proxy.type",
    ];
    const saved = snapshotPrefs(keys);

    try {
      Zotero.Prefs.set("network.proxy.type", 0, true);
      Zotero.Prefs.set(`${BASE}.language.source`, "en", true);
      Zotero.Prefs.set(`${BASE}.language.target`, "zh-CN", true);

      const diag: string[] = [
        `proxy.type=${Zotero.Prefs.get("network.proxy.type", true)}`,
      ];
      let probeOk = false;
      for (const url of [`http://127.0.0.1:18923/api/chat`]) {
        try {
          const probe = await Zotero.HTTP.request("GET", url, {
            responseType: "text",
            timeout: 5000,
          });
          diag.push(`probe ${url} -> ${probe.status}`);
          if (probe.status > 0) probeOk = true;
        } catch (error: any) {
          diag.push(
            `probe ${url} failed status=${error?.xmlhttp?.status} ${error?.message}`,
          );
        }
      }
      await Zotero.File.putContentsAsync(
        Zotero.File.pathToFile(nativePath(DIAG_PATH)),
        diag.join("\n"),
      );
      assert.isTrue(probeOk, diag.join(" | "));

      const engines: Array<{
        id: "openai" | "claude" | "gemini" | "ollama";
        settings: Array<[string, string]>;
      }> = [
        {
          id: "openai",
          settings: [
            [`${BASE}.openai.endpoint`, `${MOCK}/v1`],
            [`${BASE}.openai.model`, "mock-model"],
            [`${BASE}.openai.apiKey`, "test-key"],
          ],
        },
        {
          id: "claude",
          settings: [
            [`${BASE}.claude.endpoint`, `${MOCK}/v1/messages`],
            [`${BASE}.claude.model`, "mock-model"],
            [`${BASE}.claude.apiKey`, "test-key"],
          ],
        },
        {
          id: "gemini",
          settings: [
            [`${BASE}.gemini.baseUrl`, MOCK],
            [`${BASE}.gemini.model`, "mock-model"],
            [`${BASE}.gemini.apiKey`, "test-key"],
          ],
        },
        {
          id: "ollama",
          settings: [
            [`${BASE}.ollama.url`, MOCK],
            [`${BASE}.ollama.model`, "mock-model"],
          ],
        },
      ];

      for (const engine of engines) {
        for (const [key, value] of engine.settings) Zotero.Prefs.set(key, value, true);
        Zotero.Prefs.set(`${BASE}.engine`, engine.id, true);

        const translation = await getTranslationProvider(engine.id).translate(
          "The quick brown fox.",
          context(),
        );
        assert.equal(translation.text, MARKER, `${engine.id} translation`);

        const chat = getChatProvider(engine.id);
        assert.exists(chat, `${engine.id} chat provider`);
        const reply = await chat!.chat(TURNS);
        assert.equal(reply, MARKER, `${engine.id} chat`);
      }

      // The mock answers the first request on every path with 429; reaching
      // this point at all means the retry layer recovered on every backend.
      const stats = await readMockStats();
      assert.isAtLeast(stats.llmRetried, 4, "expected a simulated 429 on every LLM path");
    } catch (error) {
      rethrowDiagnosable(error);
    } finally {
      restorePrefs(saved);
    }
  });

  it("should translate and chat through a real local Ollama model", async function () {
    this.timeout(300000);
    const model = String(
      Zotero.Prefs.get(`${BASE}.test.ollamaModel`, true) || "",
    );
    if (!model) {
      this.skip();
      return;
    }
    const keys = [
      `${BASE}.engine`,
      `${BASE}.ollama.url`,
      `${BASE}.ollama.model`,
      `${BASE}.language.source`,
      `${BASE}.language.target`,
      `${BASE}.requestTimeoutMs`,
      "network.proxy.type",
    ];
    const saved = snapshotPrefs(keys);

    try {
      Zotero.Prefs.set("network.proxy.type", 0, true);
      Zotero.Prefs.set(`${BASE}.engine`, "ollama", true);
      Zotero.Prefs.set(`${BASE}.ollama.url`, "http://127.0.0.1:11434", true);
      Zotero.Prefs.set(`${BASE}.ollama.model`, model, true);
      Zotero.Prefs.set(`${BASE}.language.source`, "en", true);
      Zotero.Prefs.set(`${BASE}.language.target`, "zh-CN", true);
      Zotero.Prefs.set(`${BASE}.requestTimeoutMs`, 240000, true);

      const translated = await getTranslationProvider("ollama").translate(
        "The quick brown fox jumps over the lazy dog.",
        { itemID: 0, sourceLanguage: "en", targetLanguage: "zh-CN", timeoutMs: 240000 },
      );
      assert.isNotEmpty(translated.text.trim());
      assert.notEqual(
        translated.text.trim(),
        "The quick brown fox jumps over the lazy dog.",
      );
      assert.match(
        translated.text,
        /[\u4e00-\u9fff]/u,
        `expected Chinese output, got: ${translated.text}`,
      );

      const chat = getChatProvider("ollama");
      assert.exists(chat, "ollama chat provider");
      const reply = await chat!.chat([
        { role: "user", content: "用一句话解释什么是机器翻译。" },
      ]);
      assert.isNotEmpty(reply.trim());
      assert.match(reply, /[\u4e00-\u9fff]/u, `expected Chinese reply, got: ${reply}`);
    } catch (error) {
      rethrowDiagnosable(error);
    } finally {
      restorePrefs(saved);
    }
  });

  it("should reach the real Google endpoint through the local proxy", async function () {
    this.timeout(90000);
    const proxyPort = Number(
      Zotero.Prefs.get(`${BASE}.test.googleProxyPort`, true),
    );
    if (!proxyPort) {
      this.skip();
      return;
    }
    const keys = [
      `${BASE}.engine`,
      `${BASE}.google.baseUrl`,
      `${BASE}.language.source`,
      `${BASE}.language.target`,
      "network.proxy.type",
      "network.proxy.http",
      "network.proxy.http_port",
      "network.proxy.ssl",
      "network.proxy.ssl_port",
      "network.proxy.no_proxies_on",
    ];
    const saved = snapshotPrefs(keys);

    try {
      Zotero.Prefs.set(`${BASE}.engine`, "google", true);
      Zotero.Prefs.set(`${BASE}.google.baseUrl`, "https://translate.googleapis.com", true);
      Zotero.Prefs.set(`${BASE}.language.source`, "en", true);
      Zotero.Prefs.set(`${BASE}.language.target`, "zh-CN", true);
      Zotero.Prefs.set("network.proxy.type", 1, true);
      Zotero.Prefs.set("network.proxy.http", "127.0.0.1", true);
      Zotero.Prefs.set("network.proxy.http_port", proxyPort, true);
      Zotero.Prefs.set("network.proxy.ssl", "127.0.0.1", true);
      Zotero.Prefs.set("network.proxy.ssl_port", proxyPort, true);
      Zotero.Prefs.set("network.proxy.no_proxies_on", "localhost, 127.0.0.1", true);

      const translated = await getTranslationProvider("google").translate(
        "The quick brown fox jumps over the lazy dog.",
        context(),
      );
      assert.isNotEmpty(translated.text.trim());
      assert.notEqual(translated.text.trim(), "The quick brown fox jumps over the lazy dog.");
      assert.match(translated.text, /[\u4e00-\u9fff]/u, "expected Chinese output");
    } catch (error: any) {
      try {
        const detail = [
          `elapsedCatch=${Date.now()}`,
          `type=${typeof error}`,
          `name=${String(error?.name)}`,
          `message=${String(error?.message)}`,
          `string=${String(error)}`,
          `stack=${String(error?.stack)}`,
          `json=${JSON.stringify(error)}`,
          `proxy.type=${Zotero.Prefs.get("network.proxy.type", true)}`,
          `proxy.http=${Zotero.Prefs.get("network.proxy.http", true)}:${Zotero.Prefs.get("network.proxy.http_port", true)}`,
          `proxy.ssl=${Zotero.Prefs.get("network.proxy.ssl", true)}:${Zotero.Prefs.get("network.proxy.ssl_port", true)}`,
        ].join("\n");
        await Zotero.File.putContentsAsync(
          Zotero.File.pathToFile(
            nativePath(`${resolveRepoRoot()}/.scaffold/e2e-google-diag.txt`),
          ),
          detail,
        );
      }
      catch (_) {
        // Diagnostics must never mask the original error.
      }
      rethrowDiagnosable(error);
    } finally {
      restorePrefs(saved);
    }
  });

  it("should batch Google segments into aligned multi-q requests at volume", async function () {
    this.timeout(240000);
    const keys = [
      `${BASE}.engine`,
      `${BASE}.google.baseUrl`,
      `${BASE}.language.source`,
      `${BASE}.language.target`,
      "network.proxy.type",
    ];
    const saved = snapshotPrefs(keys);

    try {
      Zotero.Prefs.set("network.proxy.type", 0, true);
      Zotero.Prefs.set(`${BASE}.engine`, "google", true);
      Zotero.Prefs.set(`${BASE}.google.baseUrl`, MOCK, true);
      Zotero.Prefs.set(`${BASE}.language.source`, "en", true);
      Zotero.Prefs.set(`${BASE}.language.target`, "zh-CN", true);
      await controlMock({ googleThrottle: false, googleCaptcha: false });

      // Alignment first: one multi-q call must return one translation per
      // segment, in order.
      const aligned = await getTranslationProvider("google").translateBatch!(
        ["First paragraph.", "Second paragraph.", "Third & final paragraph."],
        context(),
      );
      assert.deepEqual(
        aligned,
        ["ZH:First paragraph.", "ZH:Second paragraph.", "ZH:Third & final paragraph."],
        "multi-q alignment",
      );

      // Volume: 30 articles-worth of paragraphs (6 per request) must all come
      // back correctly paired while the shared pacer serializes the calls.
      const before = await readMockStats();
      const BATCH = 6;
      const ARTICLES = 30;
      const PER_ARTICLE = 12;
      const total = ARTICLES * PER_ARTICLE;
      for (let start = 0; start < total; start += BATCH) {
        const texts = Array.from(
          { length: Math.min(BATCH, total - start) },
          (_, i) => `paragraph ${start + i} of ${total}`,
        );
        const results = await requestGoogleTranslations(
          {
            baseURL: String(Zotero.Prefs.get(`${BASE}.google.baseUrl`, true)),
            sourceLanguage: "en",
            targetLanguage: "zh-CN",
            timeoutMs: 30000,
          },
          texts,
        );
        assert.equal(results.length, texts.length, `batch at ${start} length`);
        for (let i = 0; i < texts.length; i++) {
          assert.equal(results[i], `ZH:${texts[i]}`, `batch at ${start} segment ${i}`);
        }
      }
      const after = await readMockStats();
      const requests = after.googleRequests - before.googleRequests;
      assert.equal(
        after.googleSegments - before.googleSegments,
        total,
        "every segment was sent",
      );
      // 360 segments must fit into 60 requests (6 each) plus the alignment
      // call; any per-segment fallback would break this bound.
      assert.isAtMost(requests, 61, `expected batched requests, got ${requests}`);
      assert.isAtLeast(requests, 60, `expected one request per batch, got ${requests}`);
    } catch (error) {
      rethrowDiagnosable(error);
    } finally {
      await controlMock({ googleThrottle: false, googleCaptcha: false, googleThrottleClients: [] });
      restorePrefs(saved);
    }
  });

  it("should surface throttling as a cooldown error instead of failing every segment", async function () {
    this.timeout(120000);
    const keys = [`${BASE}.google.baseUrl`, "network.proxy.type"];
    const saved = snapshotPrefs(keys);
    const diagPath = nativePath(`${resolveRepoRoot()}/.scaffold/e2e-throttle-diag.txt`);
    const diag: string[] = [`start=${new Date().toISOString()}`];
    const trace = async (line: string) => {
      diag.push(`${Date.now()} ${line}`);
      try {
        await Zotero.File.putContentsAsync(Zotero.File.pathToFile(diagPath), diag.join("\n"));
      } catch (_) {
        // Best effort only; never mask the flow under test.
      }
    };

    const describeError = (error: any): string =>
      [
        `name=${String(error?.name)}`,
        `ctor=${error?.constructor?.name}`,
        `message=${String(error?.message)}`,
        `cooldown=${String(error?.cooldownMs)}`,
        `stack=${String(error?.stack).split("\n").slice(0, 4).join(" | ")}`,
      ].join(" ");

    try {
      Zotero.Prefs.set("network.proxy.type", 0, true);
      Zotero.Prefs.set(`${BASE}.google.baseUrl`, MOCK, true);
      await controlMock({ googleThrottle: true, googleCaptcha: false });
      await trace("flags set: throttle on");

      let throttle: any = null;
      try {
        await requestGoogleTranslations(
          {
            baseURL: String(Zotero.Prefs.get(`${BASE}.google.baseUrl`, true)),
            sourceLanguage: "en",
            targetLanguage: "zh-CN",
            timeoutMs: 30000,
          },
          ["Hello", "world"],
        );
        await trace("throttle call resolved without error");
      } catch (error: any) {
        throttle = error;
        await trace(`throttle call threw: ${describeError(error)}`);
      }
      await trace(`throttle instanceof GoogleThrottleError = ${throttle instanceof GoogleThrottleError}`);
      assert.instanceOf(throttle, GoogleThrottleError, "429 must map to a throttle error");
      assert.equal(throttle!.cooldownMs, 0, "pool failure is handed to the router, not the runner");

      // The captcha redirect must fail fast — one request, no retry hammering.
      await controlMock({ googleThrottle: false, googleCaptcha: true });
      await trace("flags set: captcha on");
      const captchaBefore = await readMockStats();
      let captcha: any = null;
      try {
        await requestGoogleTranslations(
          {
            baseURL: String(Zotero.Prefs.get(`${BASE}.google.baseUrl`, true)),
            sourceLanguage: "en",
            targetLanguage: "zh-CN",
            timeoutMs: 30000,
          },
          ["Hello", "world"],
        );
        await trace("captcha call resolved without error");
      } catch (error: any) {
        captcha = error;
        await trace(`captcha call threw: ${describeError(error)}`);
      }
      const captchaAfter = await readMockStats();
      trace(
        `captcha instanceof = ${captcha instanceof GoogleThrottleError}, ` +
          `captchas=${captchaAfter.googleCaptchas - captchaBefore.googleCaptchas}`,
      );
      assert.instanceOf(captcha, GoogleThrottleError, "captcha must map to a throttle error");
      assert.equal(captcha!.cooldownMs, 0, "captcha is a pool failure, not a run-wide pause");
      assert.equal(
        captchaAfter.googleCaptchas - captchaBefore.googleCaptchas,
        1,
        "captcha must not be retried in-process",
      );

      // After the block clears, the same call succeeds again.
      await controlMock({ googleThrottle: false, googleCaptcha: false });
      await trace("flags cleared");
      const recovered = await requestGoogleTranslations(
        {
          baseURL: String(Zotero.Prefs.get(`${BASE}.google.baseUrl`, true)),
          sourceLanguage: "en",
          targetLanguage: "zh-CN",
          timeoutMs: 30000,
        },
        ["Hello", "world"],
      );
      await trace(`recovered = ${JSON.stringify(recovered)}`);
      assert.deepEqual(recovered, ["ZH:Hello", "ZH:world"], "recovery after throttle");
    } catch (error: any) {
      diag.push(`FAILED: ${describeError(error)}`);
      try {
        await Zotero.File.putContentsAsync(
          Zotero.File.pathToFile(nativePath(`${resolveRepoRoot()}/.scaffold/e2e-throttle-diag.txt`)),
          diag.join("\n"),
        );
      } catch (_) {
        // Diagnostics must never mask the original error.
      }
      rethrowDiagnosable(error);
    } finally {
      await controlMock({ googleThrottle: false, googleCaptcha: false });
      restorePrefs(saved);
    }
  });

});
