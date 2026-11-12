import { assert } from "chai";
import { requestGoogleTranslations } from "../../src/providers/google";

const BASE = "extensions.zotero.interlinear";
const MOCK = "http://127.0.0.1:18923";

function resolveRepoRoot(): string {
  const configured = Zotero.Prefs.get(`${BASE}.test.repoRoot`, true);
  return String(configured || "").replace(/\\/g, "/").replace(/\/+$/, "");
}

function nativePath(path: string): string {
  return Zotero.isWin ? path.replace(/\//g, "\\") : path;
}

async function controlMock(state: Record<string, unknown>): Promise<void> {
  await Zotero.HTTP.request("POST", `${MOCK}/__control`, {
    body: JSON.stringify(state),
    responseType: "text",
    timeout: 5000,
  });
}

const diagPath = `${resolveRepoRoot()}/.scaffold/e2e-probe-diag.txt`;
const diag: string[] = [`start=${new Date().toISOString()}`];
async function trace(line: string): Promise<void> {
  diag.push(`${Date.now()} ${line}`);
  try {
    await Zotero.File.putContentsAsync(Zotero.File.pathToFile(nativePath(diagPath)), diag.join("\n"));
  } catch (_) {
    // Best effort only.
  }
}

describe("http probe", function () {
  it("probes raw Zotero.HTTP behavior on mock 429 and 302", async function () {
    this.timeout(90000);
    await controlMock({ googleThrottle: false, googleCaptcha: false });
    const body = "client=gtx&sl=en&tl=zh-CN&dt=t&q=Hello&q=world";

    await trace("delay probe");
    await Zotero.Promise.delay(10);
    await trace("delay ok");

    await trace("raw 200");
    try {
      const ok = await Zotero.HTTP.request("POST", `${MOCK}/translate_a/single`, {
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body,
        responseType: "text",
        timeout: 5000,
      });
      await trace(`raw 200 resolved status=${ok.status}`);
    } catch (error: any) {
      await trace(`raw 200 threw name=${error?.name} msg=${String(error?.message)}`);
    }

    await controlMock({ googleThrottle: false, googleCaptcha: true });
    await trace("raw 302 (followRedirects false)");
    try {
      const xhr = await Zotero.HTTP.request("POST", `${MOCK}/translate_a/single`, {
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body,
        responseType: "text",
        followRedirects: false,
        timeout: 5000,
      });
      await trace(
        `raw 302 resolved status=${xhr.status} location=${xhr.getResponseHeader?.("Location")}`,
      );
    } catch (error: any) {
      await trace(
        `raw 302 threw name=${error?.name} msg=${String(error?.message)} ` +
          `xmlhttp.status=${error?.xmlhttp?.status}`,
      );
    }

    await controlMock({ googleThrottle: false, googleCaptcha: false });
    await trace("google provider throttled call");
    try {
      const result = await requestGoogleTranslations(
        { baseURL: MOCK, sourceLanguage: "en", targetLanguage: "zh-CN", timeoutMs: 10000 },
        ["Hello", "world"],
      );
      await trace(`provider resolved ${JSON.stringify(result)}`);
    } catch (error: any) {
      await trace(
        `provider threw name=${error?.name} ctor=${error?.constructor?.name} ` +
          `msg=${String(error?.message)} cooldown=${String(error?.cooldownMs)}`,
      );
    }

    assert.isTrue(true, "probe completed; see .scaffold/e2e-probe-diag.txt");
  });
});
