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

---

## Step 1：改名 Interlinear + 换图标

### 做了什么
- **显示名 / ID / 前缀**：`package.json` 的 `config` 改为 `addonName: Interlinear`、`addonID: interlinear@muanyan-mjq`、`addonRef: interlinear`、`addonInstance: Interlinear`、`prefsPrefix: extensions.zotero.interlinear`；`name`/`description`/`repository`/`homepage`/`author` 同步改名，`contributors` 保留 `quillamio (original Bilingual Reader)`，`version` 仍 0.5.1，`license` 仍 AGPL-3.0-or-later。scaffold 的 `name/id/namespace/prefs.prefix` 全部读自 `package.json config`，无额外格式要求（已核对 `zotero-plugin.config.ts` 与构建产物 `bootstrap.js`/`prefs.js`/`manifest.json`）。
- **PLUGIN_ID 单一来源**：`bilingualReader.ts` 与 `readerToolbar.ts` 都改为 `import { config } from "../package.json"` 后 `const PLUGIN_ID = config.addonID`，删除两处硬编码。
- **命名空间**：CSS 类（`interlinear-translation/-toolbar-button/-refresh-button/-export-button/-toolbar-section`）、`STYLE_ID=interlinear-style`、`PREFERENCES_PANE_ID=interlinear-preferences`、`dataset.interlinearRunning`、设置页全部元素 id（`interlinear-*`）、导出临时文件名前缀，统一改为 interlinear。
- **偏好迁移（共存安全）**：`settings.ts` 新增 `LEGACY_BASE`，`migrateLegacyPreferences()` 先修双前缀历史 bug（对 legacy 与新 base 各跑一遍），再 `migrateLegacyBranch()` 把 `extensions.zotero.bilingualreader.*` **复制**到 `extensions.zotero.interlinear.*`（仅当目标未设置），用 marker `interlinear.migratedFromBilingualReader` 保证只跑一次；缓存索引 `cache.v4.index` 里的完整 key 一并重写到新前缀（`rewriteCacheIndexKeys`）。**不清除** legacy 分支，原版插件若仍装着其状态不受影响。`translationCache.ts` 的 BASE 改为新前缀。
- **设置页 / README**：标题改 “Interlinear 中英对照阅读”，介绍与政策文案改名；项目链接改 `https://github.com/Muanyan-mjq/zotero-interlinear`；README 顶部加 “Based on quillamio/bilingual-reader, AGPL-3.0-or-later” 与 “请先卸载原版 Bilingual Reader” 提示，图标章节重写。
- **测试同步**：`test/startup.test.ts`（pane id、元素 id、介绍文案、GitHub 链接、prefs key、CSS 类、工具栏按钮改为断言 `<img src=…icon20.png>` 且无残留文字）、`test/readerToolbar.test.ts`（addonID 改读 config、CSS 类）、`test/readingLayout.test.ts`（译文块类名）。
- **图标**：源文件 `Zotero Translation Icon.png`（1254×1254 RGB PNG，红色 Z + A/文 卡片 + 圆角白底板）。用 Pillow LANCZOS 等比缩放生成各尺寸，**未改动图形内容**。替换/新增见下表；删除已被完全替换的 `mahjong-red-dragon.svg`；`favicon.png`/`favicon@0.5x.png` 重新由源图生成（保持原 RGBA 模式与 32/16 尺寸），使 `utils/ztoolkit.ts`、`modules/examples.ts` 的引用继续有效。工具栏对照按钮由 🀄 emoji 改为 `<img>`（20×20，`pointer-events:none`、`draggable=false`）；🔄 与 🖨️ 保持 emoji 不变。

### 图标文件与引用位置
| 文件 | 尺寸 | 引用位置 |
| --- | --- | --- |
| `addon/content/icons/icon16.png` | 16×16 | 备用（暂无直接引用） |
| `addon/content/icons/icon20.png` | 20×20 | `bilingualReader.ts` `TOGGLE_ICON_URL`（阅读器工具栏对照按钮） |
| `addon/content/icons/icon32.png` | 32×32 | 备用（暂无直接引用） |
| `addon/content/icons/icon48.png` | 48×48 | `addon/manifest.json` `icons.48`（插件管理器） |
| `addon/content/icons/icon96.png` | 96×96 | `addon/manifest.json` `icons.96`；`hooks.ts` 设置页顶部 brand；README logo |
| `addon/content/icons/favicon.png` | 32×32 | `utils/ztoolkit.ts:30`、`modules/examples.ts:76` |
| `addon/content/icons/favicon@0.5x.png` | 16×16 | `modules/examples.ts:141` |

清晰度判断（实际查看渲染图）：16/20px 下红色 Z 轮廓可辨、A/文 卡片糊成色块、卡片上的字母不可辨；32px 起 Z 清晰、卡片可辨但字母仍很小；48/96px 完全清晰。白色圆角底板保证深色主题下图标整体可见，但 **Zotero 实际工具栏/深色主题下的渲染效果不确定**（未实机截图）。

### 与原版同时安装是否冲突
会冲突但不崩溃：两者向同一个 `.toolbar .custom-sections` 注入按钮，类名不同故互不覆盖，结果是**工具栏出现两套按钮**；若同时开启，各自插入自己类名的译文块（`ensureTranslationBlock` 只认自己的类），同一段落会出现**两份译文**。偏好与缓存分支独立，新版只复制不删除 legacy。结论：**请先卸载原版**（README 已写明）。

### 改动文件
`package.json`、`package-lock.json`（仅根 name）、`src/bilingualReader.ts`、`src/readerToolbar.ts`、`src/readerUI.ts`、`src/hooks.ts`、`src/settings.ts`、`src/translationCache.ts`、`src/modules/preferenceScript.ts`、`addon/manifest.json`、`addon/content/preferences.xhtml`、`addon/content/icons/*`（新增 5 个 icon、重生成 2 个 favicon、删除 mahjong svg）、`README.md`、`test/startup.test.ts`、`test/readerToolbar.test.ts`、`test/readingLayout.test.ts`。

### 测试结果
- `npm run build`：通过。产物改名 `.scaffold/build/interlinear.xpi`（原 `bilingual-reader.xpi`）。
- `npm run lint:check`：通过，无告警。
- `npm run test:unit`：5 pass / 0 fail。
- `npm test` / `npm run test:review`（Zotero 内集成，headless 独立 profile）：**16 pass / 0 fail**。首跑因 scaffold 需从 CDN 拉浏览器版 chai.js 而直连超时；已用 7897 代理下载到 `.scaffold/cache/chai.js`（scaffold 缓存目录，非新增 npm 依赖），并显式设 `ZOTERO_PLUGIN_ZOTERO_BIN_PATH="C:\Program Files\Zotero\zotero.exe"`（scaffold 在 Windows 不自动探测）。`scripts/test-review.mjs` 用独立 profile/data 且 kill 命令为 no-op，不影响用户正在运行的 Zotero。

### 不确定项
- 图标在 Zotero 深色主题工具栏的实际观感：不确定（只看了本地渲染图，未实机）。
- `.github/workflows/ci.yml` 仍硬编码 `.scaffold/build/bilingual-reader.xpi` 与 “Bilingual Reader” release 标题；改名后 CI 会找不到 xpi。**按计划在 Step 10 统一修 CI/update.json**，本步仅记录。
- 偏好迁移的 marker 逻辑只在 headless 集成里间接覆盖（startup 用例读写新 prefs），未单独构造“装有原版 legacy prefs”的 profile 做迁移断言。

### 需要手动验证的清单
1. 安装 `.scaffold/build/interlinear.xpi`（工具→插件→齿轮→从文件安装），重启 Zotero。预期：插件管理器显示名称 **Interlinear**、图标为红色 Z + A/文 卡片（非麻将）。
2. 打开任意英文 PDF，进入阅读模式。预期：工具栏出现 **图标按钮**（红 Z）+ 🔄 + 🖨️ 三个控件，横排不竖叠；点图标按钮能开启/关闭对照。
3. 设置（Zotero 设置→Interlinear）。预期：顶部有 96px 图标 brand，标题 “Interlinear 中英对照阅读”，项目主页链接指向 `Muanyan-mjq/zotero-interlinear`。
4. 若之前装过原版 Bilingual Reader：先记下原版某项设置（如“不翻译末尾页数”），卸载原版、装新版后打开设置。预期：该值被带过来（迁移生效）；再打开原版 prefs.js 不应被清空（共存安全，仅复制）。
5. 深色主题下看工具栏图标与设置页图标。预期：白色底板使图标可见；若 Z 与背景对比不足请反馈（当前判断为“不确定”）。