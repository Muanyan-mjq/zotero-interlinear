import { Config, Test } from "zotero-plugin-scaffold";
import { createWriteStream } from "node:fs";

process.env.ZOTERO_PLUGIN_KILL_COMMAND = process.platform === "win32" ? "exit /b 0" : "true";

const context = await Config.loadConfig({
  test: {
    watch: false,
    entries: "test-gui",
    prefs: {
      "extensions.zotero.interlinear.test.repoRoot": process.cwd().replace(/\\/g, "/"),
    },
  },
  server: { devtools: false, startArgs: ["-no-remote"] },
});
const runner = new Test(context);
await runner.run();
const nativeLog = createWriteStream(".scaffold/gui-zotero.log");
runner.zotero.zotero.stdout.pipe(nativeLog);
runner.zotero.zotero.stderr.pipe(nativeLog);