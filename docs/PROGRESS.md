# Interlinear 改造进度记录

每步记录：做了什么、改动文件、测试结果、不确定项、需要手动在 Zotero 里验证的清单。
测试命令约定：`npm run build`、`npm run lint:check`（package.json 里没有 `lint`，只有 `lint:check`/`lint:fix`）、`npm run test:unit`。`npm test` 为 Zotero 内集成测试。

---

## Step 0：参考资料（只读）+ 环境基线

### 做了什么
- 用 gh 读取 isCopyman/zotero-bilingual-reader：1 条 issue（#1）、14 个 release notes、README。整理到 `docs/REFERENCE-isCopyman.md`。其许可证经 GitHub API 确认为 MIT，但按要求未复制任何代码。
- 环境准备：`npm install` 首次失败（npmmirror ECONNRESET + zotero-types 的两个 git+ssh 依赖）。第二次用环境变量 `GIT_CONFIG_COUNT/KEY/VALUE` 把 ssh://git@github.com/ 重写为 https（**未改任何 git 配置文件**），GitHub 走 7897 代理、npmmirror 直连（NO_PROXY），安装成功（200 packages）。未新增任何 npm 依赖。
- 基线验证：build ✔ / lint:check ✔ / test:unit 5 通过 0 失败。

### 改动文件
- 新增 `docs/REFERENCE-isCopyman.md`、`docs/PROGRESS.md`（本文件）。
- 提交纳入上一任务产出的 `docs/ANALYSIS.md`（此前未提交）。

### 测试结果
- `npm run build`：通过（产物 `.scaffold/build/bilingual-reader.xpi`）。
- `npm run lint:check`：通过，无告警输出。
- `npm run test:unit`：5 pass / 0 fail。
- `npm test`（Zotero 集成）：**没跑**（本步未配置 .env；本机 Zotero 在 `C:\Program Files\Zotero\zotero.exe`，后续步骤尝试 `npm run test:review` 的 headless 独立 profile 路线）。

### 不确定项
- isCopyman 的源码实现细节未读（任务要求不复制代码，只读 README/issue/release）。
- `npm run test:review` 在 Windows 本机能否跑通尚未验证。

### 需要手动验证的清单
- 无（本步无功能改动）。