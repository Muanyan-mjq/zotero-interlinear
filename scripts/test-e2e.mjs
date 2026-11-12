import { spawn } from "node:child_process";
import { Config, Test } from "zotero-plugin-scaffold";

process.env.ZOTERO_PLUGIN_KILL_COMMAND = process.platform === "win32" ? "exit /b 0" : "true";

const mock = spawn(process.execPath, ["test-e2e/mock-llm-server.mjs"], {
  stdio: ["ignore", "pipe", "inherit"],
});
process.on("exit", () => mock.kill());
mock.stdout.on("data", (chunk) => process.stdout.write(chunk));

await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("mock LLM server did not start")), 10000);
  mock.stdout.on("data", (chunk) => {
    if (String(chunk).includes("listening")) {
      clearTimeout(timer);
      resolve();
    }
  });
  mock.on("exit", (code) => {
    clearTimeout(timer);
    reject(new Error(`mock LLM server exited with code ${code}`));
  });
});

const prefs = {
  "extensions.zotero.interlinear.test.repoRoot": process.cwd().replace(/\\/g, "/"),
  "extensions.zotero.interlinear.test.ollamaModel":
    process.env.INTERLINEAR_TEST_OLLAMA_MODEL || "",
  "extensions.zotero.interlinear.test.googleProxyPort": Number(
    process.env.INTERLINEAR_TEST_GOOGLE_PROXY_PORT || 0,
  ),
};

const context = await Config.loadConfig({
  test: { watch: false, entries: process.env.INTERLINEAR_E2E_ENTRIES || "test-e2e", prefs },
  server: { devtools: false, startArgs: ["-no-remote"] },
});
const runner = new Test(context);
await runner.run();
