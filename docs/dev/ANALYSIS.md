# Bilingual Reader 源码分析报告（Interlinear 改造前基线）

- 分析对象：本仓库 `main` 分支，版本 0.5.1（commit 819b351），fork 自 quillamio/bilingual-reader。
- 分析方式：通读全部 `src/`、`addon/`、`test/`、`scripts/`、构建配置与 CI 文件；上游 open PR 通过 `gh` 查看（2026-11-09）。
- 许可证：AGPL-3.0-or-later（`LICENSE`、`package.json:24`）。后续所有改动必须保持该许可证并保留原作者版权声明；摘取上游 PR 代码时同样适用 AGPL 署名要求。
- 标注约定：凡写"不确定"的地方，均注明已查看的文件与缺失的证据。

---

## 1. 项目结构、技术栈、构建与本地调试

### 1.1 目录结构

```
addon/                  打包进 xpi 的静态资源
  bootstrap.js          插件生命周期入口（install/startup/shutdown）
  manifest.json         WebExtension 清单（占位符由构建替换）
  prefs.js              默认偏好值（scaffold 加前缀 extensions.zotero.bilingualreader.）
  content/preferences.xhtml   设置页 UI
  content/zoteroPane.css      模板残留（只有 .makeItRed 示例，未被使用）
  content/icons/              红中图标
  locale/{en-US,zh-CN}/*.ftl  Fluent 文案（大部分是模板残留，见 §7）
src/
  index.ts              JS 入口：创建 Addon 实例，挂到 Zotero.BilingualReader
  addon.ts              Addon 类：data/hooks/api 容器
  hooks.ts              生命周期钩子：注册工具栏监听、设置页、迁移旧偏好
  readerToolbar.ts      工具栏注册/启动补挂/卸载清理
  bilingualReader.ts    核心：段落收集、翻译调度、译文块插入（约 1000 行）
  readerUI.ts           🖨️ 导出双语 PDF
  readingLayout.ts      插入译文后同步 Zotero 原生高亮标注坐标
  translationPipeline.ts 纯函数：长文拆分、批量打包、批量结果校验
  translationCache.ts   译文缓存（Zotero 偏好存储 + LRU）
  settings.ts           全部偏好读写 + 旧版偏好迁移
  cancellationToken.ts  自有取消令牌（沙箱无 AbortController）
  modules/preferenceScript.ts  设置页逻辑
  modules/examples.ts   模板示例代码，未被任何入口引用（死代码，但含可参考的 API 示例）
  utils/                locale/prefs/window/ztoolkit 封装
test/                   3 个 Zotero 内集成测试 + 1 个纯 Node 单测
scripts/test-review.mjs headless 测试运行器
doc/                    模板残留 README（zotero-plugin-template 的文档，与本项目无关）
typings/                全局类型与 prefs 类型映射（prefs.d.ts 由 scaffold 生成）
```

### 1.2 技术栈与构建

- TypeScript 5.9 + esbuild（由 `zotero-plugin-scaffold` 0.8.2 驱动），bundle 目标 `firefox115`（`zotero-plugin.config.ts:36`）。
- 运行时依赖只有 `zotero-plugin-toolkit` ^5.1.0-beta.13；类型来自 `zotero-types`。
- 入口链路：`addon/bootstrap.js:30` 用 `Services.scriptloader.loadSubScript` 加载构建产物 `content/scripts/bilingualreader.js` → `src/index.ts:9` 创建 `Addon` 并注册 `Zotero.BilingualReader` → `bootstrap.js:34` 调 `hooks.onStartup()`。
- 构建命令：`npm run build` = `tsc --noEmit` + `zotero-plugin build`（`package.json:27`）。产物在 `.scaffold/build/`，xpi 为 `.scaffold/build/bilingual-reader.xpi`（文件名证据：`.github/workflows/ci.yml` release 步骤）。
- 占位符替换：`manifest.json`/`bootstrap.js` 里的 `__addonName__`、`__addonRef__`、`__addonInstance__` 等由 scaffold 按 `package.json` 的 `config` 段替换（`zotero-plugin.config.ts:18-25`）。**改名 Interlinear 时主要改 `package.json:11-17` 的 config，但要注意 §7 列出的牵连点。**
- CI：`.github/workflows/ci.yml` 跑 lint + ubuntu/macos 构建 + Zotero 内测试；commit message 含 `[release]` 时自动发 GitHub Release 并上传 `update.json` 供 Zotero 自动更新。

### 1.3 本地调试

- 复制 `.env.example` 为 `.env`，填 `ZOTERO_PLUGIN_ZOTERO_BIN_PATH`（Windows 下 Zotero.exe 路径，反斜杠转义）和 `ZOTERO_PLUGIN_PROFILE_PATH`（用 `zotero.exe -p` 建的开发专用 profile）。
- `npm start`（= `zotero-plugin serve`）：scaffold 启动 Zotero 开发实例并监听源码变化热重载。scaffold 内部实现本次未读，热重载的具体粒度（整插件重装还是脚本替换）**不确定**，以实际跑一次为准。
- `npm test`（= `zotero-plugin test --no-watch`）：在真实 Zotero 实例里跑 mocha 集成测试（`test/*.test.ts`），需要 `.env` 里的 Zotero 路径。
- `npm run test:unit`：纯 Node 单测（`node --test test/translationPipeline.node.test.mjs`），不需要 Zotero，适合翻译管线的快速回归。注意 Windows 下要跑这个具体文件路径形式，裸 `node --test tests/` 在本机有已知问题。
- `npm run test:review`：`scripts/test-review.mjs`，headless + 独立 profile 跑测试并留日志 `.scaffold/review-zotero.log`。
- 手动测试：构建后在 Zotero「工具 → 插件 → 齿轮 → 从文件安装插件」选 xpi；改代码后重新 build + 重装，或用 `npm start`。

---

## 2. 段落来源与切分

**结论：插件完全不自己解析 PDF，段落文本和切分全部来自 Zotero 10 阅读模式（内部代号 SDT）生成的结构化 HTML。**

证据链（均在 `src/bilingualReader.ts`）：

1. `prepareAndRun()`（:773）先调 `Zotero.SDT.ensure(itemID, { isPriority: true })`（:791）触发 Zotero 生成结构化数据。
2. `ensureReadingMode()`（:358）取阅读模式 iframe 文档：`reader._internalReader._primarySDTView._iframeDocument`（split view 时取 `_secondarySDTView`，见 `getActiveSDTView()` :268）；若未开启则调私有接口 `internal._setReadingMode(primary, true)`，然后以 100ms 间隔轮询最多 150 次（15 秒硬编码）等 `#sdt-content` 出现。
3. `collectParagraphs()`（:474）用 CSS 选择器收集段落：
   `#sdt-content` 下的 `p[data-ref-path]`、`h1`–`h6[data-ref-path]`、`figcaption[data-ref-path]`、`aside.sdt-note[data-ref-path]`、`li[data-ref-path]`。
   段落文本 = `element.textContent` 压缩连续空白（:500）；少于 2 字符跳过。`data-ref-path` 是 Zotero 生成的结构路径（如 `3.1.0`），插件只消费它。
4. 结构数据（页码目录）来自 `view.getData().structure` 或 `view._structure`（`getSDTStructure()` :285）。

### 特殊内容的处理

| 内容 | 处理 | 证据 |
|---|---|---|
| 参考文献 | 双重跳过：① `isTranslatableElement()`（:412）排除 `.sdt-reference` 内的元素；② `skipLastPages`（默认 1 页）按物理页跳过，`getPageIndexForRef()`（:444）用 `structure.catalog.pages[i].contentRange` 把 refPath 映射到页码，`shouldSkipByPage()`（:467）判定 | `bilingualReader.ts`、`settings.ts:119` |
| 公式 | 不翻译。选择器不含 math 块；README「当前限制」明确说明 | `bilingualReader.ts:480-491`、`README.md:73` |
| 图片 | 选择器不含 `img`/`figure` 本体，只译 `figcaption`。上游 PR #21 证实 SDT 数据包有时整个缺失 image 块（图的位置空白） | PR #21 描述 |
| 双栏 | **插件无任何双栏处理**，段落顺序完全依赖 Zotero SDT 的输出顺序。SDT 自身如何识别双栏不在本仓库 | 不确定：未查看 Zotero 源码 |
| 页眉页脚 | **插件无任何显式处理**。是否被 SDT 排除在阅读模式之外取决于 Zotero 自身 | 不确定：已查 `bilingualReader.ts` 全文与 `test/`，无相关逻辑；需查 Zotero 源码确认 |
| 表格 | 不逐单元格翻译（README 限制）；`li` 含嵌套段落时跳过避免重复（:418-425） | `README.md:72` |

### 请求层面的"二次切分与合并"

段落虽然是 Zotero 切好的，插件在发请求前还会重组（`src/translationPipeline.ts`）：

- `packBatchItems()`（:104）：把相邻短段落合并进一次请求，受 `maxCharsPerRequest`（默认 2800）和 `maxBatchParagraphs`（默认 6）双重上限。
- `buildBatchPayload()`（:68）：每段前加 `[[BRSEG_0000]]` 式标记。
- `parseBatchResult()`（:77）：严格校验标记数量、顺序、每段非空；任何损坏都返回 null，调用方回退为逐段翻译（`bilingualReader.ts:693-701`），保证段落对齐。
- `splitTextForRequest()`（:32）：超长单段按句子正则拆分，再兜底 `hardSplitText()`（:13）按空格/逗号硬切。

---

## 3. 对照页的实现与 Zotero API

### 译文如何显示在原文下面

- `ensureTranslationBlock()`（`bilingualReader.ts:519`）：对每个源元素执行 `source.after(block)`，插入一个 `div.bilingual-reader-translation`，带 `lang="zh-CN"`、`data-source-ref-path`、`data-source-page`、`data-state`（loading/done/error/paused）属性。就是同一个文档流里的相邻兄弟节点，所以译文天然紧跟原文段落。
- `installStyles()`（:383）：往 SDT iframe 的 `<head>` 注入 `<style id="bilingual-reader-style">`，样式全部硬编码：红色左边框 `#c7354a`、`line-height: 1.75`、`font-size: 1em`、`margin: 0.65em 0 1.25em` 等。
- 关闭时 `clearTranslations()`（:557）移除所有译文块。

### UI 挂载用到的 Zotero API

**官方插件 API：**

- `Zotero.Reader.registerEventListener("renderToolbar", renderReaderToolbar, PLUGIN_ID)`（`readerToolbar.ts:118`）：工具栏渲染事件，回调收到 `{ reader, doc, append }`，三个按钮（🀄 对照、🔄 重译、🖨️ 导出）通过 `append()` 挂进阅读器工具栏（`bilingualReader.ts:940`、`readerUI.ts:384`）。
- `Zotero.PreferencePanes.register()`（`hooks.ts:10`）：注册设置页。
- `Zotero.HTTP.request()`：Ollama 请求；`Zotero.Items.get()`、`Zotero.Attachments.importFromFile()`（导出附件）、`Zotero.Prefs`、`Zotero.getMainWindow()`、`Zotero.logError()`。
- `Zotero.ItemPaneManager.registerSection()`：本插件未用，但 `src/modules/examples.ts:265` 有完整的阅读器侧栏示例（对 §8d 聊天侧栏直接有用）。

**私有内部 API（版本敏感，README 已承认）：**

- `reader._internalReader`、`_primarySDTView` / `_secondarySDTView`、`_lastViewPrimary`（`bilingualReader.ts:264-274`）
- `view._iframeDocument` / `view._iframe.contentDocument`（:276）
- `internal._setReadingMode()`（:369）、`Zotero.SDT.ensure()`（:791）
- `view._handleViewUpdate(true)`（`readingLayout.ts:26`）
- `Zotero.Reader._readers`（`readerToolbar.ts:49`，启动补挂用）
- `Zotero.PDFTranslate.api.translate()`（另一插件的公开 API，见 §4）
- `chrome://zotero/content/HiddenBrowser.mjs` + `browsingContext.print()`（`readerUI.ts:245,297`，PDF 导出）

### 两个值得注意的配套机制

- **启动补挂**：`reconcileReaderToolbars()`（`readerToolbar.ts:48`）处理"插件启动前已打开的阅读器"，立即扫一遍 + 250/1000/3000ms 三次有界重试，之后靠官方事件，无永久轮询。
- **高亮对齐**：`readingLayout.ts` 的 `observeReadingLayout()` 用 MutationObserver + ResizeObserver 盯 `#sdt-content`，译文插入/长高后调 `view._handleViewUpdate(true)` 让 Zotero 原生高亮标注重算坐标；特意只观察内容不观察标注覆盖层，避免刷新死循环（有回归测试 `test/readingLayout.test.ts`）。

---

## 4. 翻译调用与依赖关系

### 现状：两个后端，一个分发函数

`translateText()`（`bilingualReader.ts:234`）按 `getEngine()` 分发：

**① Translate for Zotero（默认）** — `translateWithPDFTranslate()`（:151）：

```text
Zotero.PDFTranslate.api.translate(text, { pluginID, itemID, langto: "zh-CN" })
→ 读 task.result / task.status / task.service
```

- 依赖关系：**运行时软依赖**，无 npm 包关系。用户需自行安装 zotero-pdf-translate；`Zotero.PDFTranslate` 不存在时抛错引导安装（:156-160）。
- 故意**不传 `service` 参数**，固定跟随 Translate for Zotero 当前默认服务（v0.3.0 起的设计，CHANGELOG 有记录；`test/startup.test.ts:183` 断言了这一点）。缓存标记通过 `getResolvedPDFTranslateService()`（`settings.ts:127`）读它的 `translateSource` 偏好来跟踪实际服务。
- 失败判定靠 `isFailureText()`（:70）正则启发式 + `task.status` 检查。

**② Ollama** — `translateWithOllama()`（:180）：

- `Zotero.HTTP.request("POST", "{baseURL}/api/chat")`，`stream: false`、`keep_alive: "30m"`、`temperature: 0.1`。
- system prompt 硬编码为"**生物医学**论文翻译助手"（:193）——对其他领域有偏置，上游 PR #19 就是一行修复。
- Ollama 强制串行（并发=1，:623）。

### 调度层（两个后端共用）

`translateParagraphs()`（:609）：视口距离优先排序（`getViewportDistance()` :597）→ 批量打包 → 并发 worker（默认 2，上限 3）→ 全局启动间隔节流（`waitForStartSlot()` :655）→ 每请求超时竞速（`raceWithTimeoutAndCancellation()` :93）→ 连续失败 `maxConsecutiveErrors`（默认 3）后暂停并标记未完成块。取消用自有 `CancellationToken`（沙箱没有 `AbortController`）。

### 改成自带 Google + OpenAI 兼容接口要改哪里

| 文件 | 改动 |
|---|---|
| `src/bilingualReader.ts` | 新增 `translateWithGoogle()`、`translateWithOpenAI()`；改 `translateText()`（:234）分发逻辑。建议顺势把三个 `translateWith*` 抽成独立 provider 模块 |
| `src/settings.ts` | `TranslationEngine` 联合类型（:3）扩为 `"google" \| "openai" \| ...`；新增 endpoint/key/model 的 get/set；`getCacheEngineTag()`（:139）把 provider 配置纳入缓存键 |
| `addon/prefs.js` | 新默认值 |
| `addon/content/preferences.xhtml` | 新后端分区（仿 Ollama 分区 :196-222） |
| `src/modules/preferenceScript.ts` | 新控件的读写与"测试连接"按钮（仿 `testOllama()` :93） |
| `typings/prefs.d.ts` | scaffold 自动生成，build 后更新 |
| `src/translationCache.ts` | 不用改逻辑，但 engineTag 必须含新 provider 的配置指纹，否则换模型/换 prompt 会误用旧缓存 |

**重要参考：上游 PR #20 已经实现了 OpenAI 兼容后端**（见 §7.3），其 `src/openaiClient.ts`（76 行）+ `translationPipeline.ts` 新增的端点归一化/请求体/错误格式化函数可以直接摘取（同为 AGPL，保留署名）。Google 翻译后端上游没有实现，需自写。

---

## 5. 缓存与状态

### 译文缓存（`src/translationCache.ts`）

- **存储位置：Zotero 偏好系统**（`Zotero.Prefs.get/set(key, true)`，物理上在 profile 的 `prefs.js`），不是独立文件/数据库。
- 键格式（:54）：`extensions.zotero.bilingualreader.cache.v4.{FNV哈希(engineTag)}.{itemKey}.{原文长度}.{FNV哈希(原文)}.zh-CN`。
  - `engineTag` 区分后端与实际服务（`settings.ts:139`）：Ollama 是 `ollama:{url}:{model}`；PDFTranslate 是 `pdftranslate:{实际服务名}`。换服务/换模型不会误用旧译文。
  - 哈希是 FNV-1a 32 位（:42），原文长度入键降低碰撞概率。
- **LRU 上限**：1500 条 / 600 万字符（:9-10）；索引是 JSON 存在 `cache.v4.index` 一个偏好里，500ms 防抖写入（:99），每次翻译运行结束和插件卸载时 `flushTranslationCacheIndex()` 强制落盘（`bilingualReader.ts:823`、`hooks.ts:76`）。
- 失败文本不入缓存（`saveCachedTranslation()` :175 先查 `isFailureText`）；读到失败缓存会就地清除（:157-161）。
- v3 旧缓存懒迁移（:146-154）；v0.1.3 的畸形前缀偏好由 `migrateLegacyPreferences()`（`settings.ts:153`）一次性修复。
- 设置页有缓存统计与一键清除（`preferenceScript.ts:138-151`）。

### 运行状态

- `runStates` WeakMap（`bilingualReader.ts:59`）：每个 reader 一份 `{ generation, running, cancellation }`，重开/刷新/关闭都会递增 generation 并取消旧任务，异步回调回来先验 `isCurrentRun()`（:325）防止写进已销毁的 DOM。
- `documentElement.dataset.bilingualReaderRunning` 标记运行中。

### 用户设置项（共 10 个，`addon/prefs.js` + `src/settings.ts`）

| 偏好键（前缀 `extensions.zotero.bilingualreader.`） | 默认 | 范围 |
|---|---|---|
| `engine` | `pdftranslate` | pdftranslate / ollama |
| `ollama.url` | `http://127.0.0.1:11434` | 字符串 |
| `ollama.model` | `gpt-oss:20b` | 字符串 |
| `requestGapMs` | 250 | 0–5000 |
| `maxConcurrent` | 2 | 1–3 |
| `maxCharsPerRequest` | 2800 | 500–8000 |
| `maxBatchParagraphs` | 6 | 1–12 |
| `maxConsecutiveErrors` | 3 | 1–20 |
| `requestTimeoutMs` | 60000 | 5000–300000 |
| `skipLastPages` | 1 | 0–50 |

**目前没有任何外观类设置**（字体/字号/颜色/行距全部硬编码）。

---

## 6. 设置界面与新增外观选项的落点

### 现状链路

1. `addon/content/preferences.xhtml`：XUL `groupbox` + HTML 控件的静态 UI；根元素 `onload` 调 `Zotero.BilingualReader.hooks.onPrefsEvent('load', { window })`。
2. `hooks.ts:9` `registerPreferencesPane()` 用 `Zotero.PreferencePanes.register()` 注册， pane id `bilingual-reader-preferences`；`onPrefsEvent()`（:93）转调 `registerPrefsScripts()`。
3. `src/modules/preferenceScript.ts:187` `registerPrefsScripts()`：回填当前值 → 绑定事件；`saveSettings()`（:60）点"保存设置"才写 `Zotero.Prefs`。改完要回阅读器点 🔄 生效（UI 文案明确说明）。

### 新增"字体、字号、颜色、行距、间距"要改 5 处

1. `addon/prefs.js`：加默认值（如 `appearance.fontSize` 等）。
2. `src/settings.ts`：加 get/set（数字项复用 `getNumberPref` 的夹取模式）。
3. `addon/content/preferences.xhtml`：加一个"译文外观" groupbox。
4. `src/modules/preferenceScript.ts`：`registerPrefsScripts()` 回填 + `saveSettings()` 保存。
5. `src/bilingualReader.ts` `installStyles()`（:383）：把硬编码 CSS 改为从 settings 生成。**注意已注入的 style 有 `if (doc.getElementById(STYLE_ID)) return` 短路（:384），改设置后需要更新已有 style 节点内容或重建，否则 🔄 后不生效。**
6. （同步项）`src/readerUI.ts` `buildExportHTML()`（:189-199）导出 PDF 的 CSS 里还有一份独立的硬编码译文样式，要不要跟随外观设置需一并决定。

---

## 7. 风险与质量清单

### 7.1 结构性风险

1. **大量私有 API 依赖**（§3 清单）：`_internalReader`、`_setReadingMode`、`_handleViewUpdate`、`_readers`、`SDT.ensure` 等都不是稳定插件 API，Zotero 升级随时可能失效。README 已承认。代码里对此有防御（try/catch + dead object 检测），但无法根治。
2. **模板残留死代码**：`src/modules/examples.ts`（866 行，无入口引用）、`doc/`（模板 README）、`addon/content/zoteroPane.css`（.makeItRed）、大部分 ftl 文案（`preferences.ftl` 还写着"插件模板设置示例"）。实际 UI 文案全部硬编码中文，**没有真正的 i18n**——英文用户看到的也是中文界面。
3. **改名 Interlinear 的牵连点**（fork 后必踩）：
   - `PLUGIN_ID` 常量重复硬编码在 `bilingualReader.ts:35` 和 `readerToolbar.ts:4`，与 `package.json` 的 `addonID` 三处需一致；
   - `test/startup.test.ts:52` 断言设置页介绍文案全文、:61-64 断言 GitHub 链接 href、:20 用 addonID 查 AddonManager——改文案/改名/改链接都会挂测试；
   - 偏好前缀 `extensions.zotero.bilingualreader` 若改名，老用户缓存与设置丢失，需要类似 `migrateLegacyPreferences()` 的迁移；
   - CSS 类名、`STYLE_ID`、`data-bilingual-reader-running` 等命名空间是否一并改名需权衡（改得更干净 vs 迁移成本）。

### 7.2 具体 bug 风险 / 硬编码 / 错误处理缺口

| 位置 | 问题 |
|---|---|
| `bilingualReader.ts:193` | Ollama system prompt 硬编码"生物医学"，其他领域译文有偏置（上游 PR #19 修的就是这个） |
| `bilingualReader.ts:36` | `TARGET_LANG = "zh-CN"` 硬编码，目标语言不可配 |
| `bilingualReader.ts:70-80` | `isFailureText()` 正则启发式：合法译文里若恰好出现"此翻译服务不可用"等字样会被误判为失败并丢缓存 |
| `bilingualReader.ts:93-125` | 超时/取消只是"不再等待"，**底层 HTTP 请求和 PDFTranslate 任务并未真正中止**，仍在后台跑完（无法传 abort 信号给这两个 API） |
| `bilingualReader.ts:374` | 阅读模式等待硬编码 150×100ms=15s |
| `bilingualReader.ts:391` + `readerUI.ts:192` | 红色 `#c7354a` 硬编码两处，改色要改两个文件 |
| `bilingualReader.ts:623` | Ollama 强制并发=1，设置页的最大并发对它无效（未在 UI 说明） |
| `bilingualReader.ts:597-634` | 视口优先只在运行开始算一次，翻译过程中用户翻页不会重新排序 |
| `translationPipeline.ts:36` | 句子正则在 `Fig. 1`、`e.g.`、`et al.` 处误断句（影响拆分质量，不影响对齐） |
| `bilingualReader.ts:444-472` | 页码跳过依赖 `structure.catalog.pages`；structure 缺失时 pageIndex=undefined → 末尾页不会被跳过，只剩 `.sdt-reference` 一道防线 |
| `translationCache.ts` | 译文存 prefs.js：单文件膨胀（上限约 12MB UTF-16）、可能随 Zotero 偏好同步机制扩散；FNV-1a 32 位哈希理论碰撞 |
| `bilingualReader.ts:572-585` | `showError()` 用 `alert()` 阻塞弹窗，长任务出错体验差；无单段重试按钮（只有全局 🔄） |
| `bilingualReader.ts:773` | `prepareAndRun(reader, refresh)` 的 `refresh` 形参两个调用点都传 false（:839、:853），是死参数 |
| `settings.ts` / 未来 key 存储 | 现有 Ollama 无 key；将来 OpenAI key 若存 prefs 即明文落盘 prefs.js，需在 UI 提示 |
| `readerUI.ts:263` | 导出用 `data:` URL 加载整篇 HTML，超长论文可能撞 URL 长度/内存上限（未实测，不确定） |

### 7.3 上游待处理 PR（2026-11-09 实际看到 9 个 open，其中 5 个人工 + 4 个 dependabot）

用户提到"6 个待处理 PR"，以实际查询为准。值得参考的：

| PR | 内容 | 对 Interlinear 的价值 |
|---|---|---|
| **#20** feat(openai): OpenAI-compatible translation backend（+698 行） | 新增 `src/openaiClient.ts`；端点归一化（兼容各种 base URL 写法）、可配 endpoint/key/model/prompt/temperature；ModelScope/BigModel/SiliconFlow/Gemini 预设；缓存键含 endpoint+model+prompt 哈希+temperature；用 `responseType:"text"` 自行解析 JSON 以暴露真实 HTTP 错误；设置页 UI + 单测齐全 | **§8a 的 OpenAI 半边几乎可以直接摘取**，省去大量设计。注意它把 prompt/温度也纳入缓存键的做法值得照抄 |
| **#19** fix(ollama): domain-neutral prompt（1 行） | 把生物医学 prompt 换成领域中性学术 prompt，保留 BRSEG 标记要求 | 无论是否自写 provider 层都应先合入这一行 |
| **#21** feat(reader): backfill missing figures（+1732 行，draft，叠在 #20 上） | SDT 缺 image 块时，从 Fig. 标题位置+正文栏簇推算裁剪区，用阅读器自己的 `renderRegionCrops`（私有 API）渲染页面区域补图；双栏图保持在本栏 | 解决"对照页缺图"。版本敏感、作者自标 draft，建议观望或摘思路；其双栏裁剪几何计算可参考 |
| **#14 / #15** trial: Word Wise 生词提示（作者明确"不合并、仅本地试用"） | 工具栏 🎰 按钮；ECDICT 构建时生成本地精简英汉词典，本地词义即时显示，未收录词走翻译后端；按每千词密度控制提示量；专业术语独立额度；自定义颜色/上下位置；修复了 Zotero 10 跨上下文 `createTreeWalker` 的坑（改直接 DOM 递归） | 不合并但**对 §8c 术语表有直接参考价值**：本地词典构建管线、密度控制、跨上下文 DOM 遍历的坑 |
| #2/#3/#4/#18 | dependabot 依赖升级 | 无功能价值；#4 升 TypeScript 7 跨度大，谨慎 |

---

## 8. 改造建议（最小改动方案 + 难度评估）

### 8a. 自带翻译 Provider 层（Google 默认 + OpenAI 兼容）— 难度：中

**方案：**

1. 新建 `src/providers/` 目录，定义统一接口：`translate(text, ctx) → { text, engineTag }`。把现有 `translateWithPDFTranslate` / `translateWithOllama` 从 `bilingualReader.ts` 平移进去，`bilingualReader.ts:234` 的 `translateText()` 改为按 provider id 查表分发。调度层（批量、并发、节流、缓存）完全不动。
2. **OpenAI 兼容 provider：直接摘上游 PR #20** 的 `openaiClient.ts` 与 `translationPipeline.ts` 辅助函数（端点归一化、请求体、错误格式化），设置页分区也可参考其 `preferences.xhtml` 增量。保留署名与 AGPL。
3. **Google provider 需自写**：免费路径是 `translate.googleapis.com/translate_a/single?client=gtx` 类端点（无 key），用 `Zotero.HTTP.request` 发 GET/POST 即可；务必把 base URL 做成可配置——免费端点有限流与网络可达性风险（本机网络环境下 Google 直连不通，需可配镜像/代理端点）。批量 BRSEG 标记对 Google 同样适用，但 Google 可能翻译/吞标记，现有 `parseBatchResult` 严格校验 + 逐段回退机制正好兜住。
4. 设置：`engine` 偏好扩展为 `google | openai | pdftranslate | ollama`（后两者保留兼容），新增 `openai.endpoint / openai.apiKey / openai.model / google.baseUrl`；`getCacheEngineTag()` 纳入 endpoint+model（+prompt 哈希，抄 PR #20）。
5. 设置页加"测试连接"（仿 `testOllama()`）。key 明文存 prefs 的事实要在 UI 注明。

**改动文件**：§4 表格所列 7 处 + 新 provider 目录。**预估工作量**：OpenAI 半边因 PR #20 存在而很小；Google 端点联调是主要不确定性。

### 8b. 译文外观设置 — 难度：低（建议第一个做）

**方案**：按 §6 的 5+1 处落点，加 `appearance.fontFamily / fontSize / color / lineHeight / paragraphGap` 五个偏好；`installStyles()` 改为从 settings 生成 CSS（可用 CSS 变量挂在 `#sdt-content` 上，style 只写一份）；处理 `:384` 的 style 短路问题（更新内容而非简单 return）；导出 CSS（`readerUI.ts:189`）第一版可不动，后续再跟随。设置页控件用现成 number input / select / `input[type=color]` 模式即可。

### 8c. 术语表（同一术语译法一致）— 难度：中

**方案（两条机制叠加）：**

1. **prompt 注入**（对 OpenAI/Ollama 有效）：术语对（`term → 译法`）拼进 system prompt。Google 免费接口不支持 prompt，此机制对它无效。
2. **译后一致性替换**（对所有后端有效，Google 的唯一途径）：维护术语→译法映射，译文返回后把该术语的其他译法统一替换为目标译法。需要维护"术语的可能译法"集合，或简化为：只保证术语本身以原文形式保留时替换成固定译法（更稳但覆盖窄）。第一版建议：术语表存 `Zotero.Prefs` 一个 JSON 偏好（或独立 JSON 文件，便于导入导出），设置页加一个多行编辑框（`原文=译法` 每行一条）；在 `translateText()` 返回后统一过一层替换。
3. **缓存键必须带术语表哈希**，否则改术语表后旧译文 still 命中旧缓存（PR #20 把 prompt 哈希入键就是同款问题）。
4. 批量请求时术语表随 BRSEG payload 一起发（prompt 路线），替换路线天然兼容批量。

参考 PR #15 的 ECDICT 本地词典管线可做"自动提取候选术语"的进阶版，第一版不必做。

### 8d. 侧边栏聊天（以当前论文为上下文追问）— 难度：中高

**方案：**

1. **UI 落点有现成模板**：`src/modules/examples.ts:265` `registerReaderItemPaneSection()` 演示了官方 `Zotero.ItemPaneManager.registerSection()` 完整用法——`onItemChange` 里 `setEnabled(tabType === "reader")` 限定阅读器标签页，`bodyXHTML` 自定义界面，`onRender/onAsyncRender` 渲染。把示例代码改造为聊天面板（消息列表 + 输入框），在 `hooks.onStartup()` 注册即可，无需私有 API 挂载。
2. **上下文来源**：复用 `collectParagraphs()` 的 `sourceText` 数组（纯文本，已在内存），或更省 token 地只取当前视口附近段落 + 用户选中文本（`reader` 的选区 API 需另查，不确定）。整篇论文塞进 prompt 会超长，第一版建议"标题+摘要+当前段落±前后各 N 段"的滑动窗口。
3. **模型调用**：复用 8a 的 OpenAI 兼容 provider，把翻译接口泛化为 `chat(messages)`；流式输出第一版可不做（`stream:false` 整段返回）。
4. 会话状态按 itemKey 存内存即可，持久化聊天记录可后续加。

**依赖顺序**：8d 依赖 8a 的 provider 层；8c 的 prompt 注入机制也能被 8d 复用（聊天时带术语表）。

### 建议的实施顺序

**8b（外观）→ 8a（provider）→ 8c（术语）→ 8d（聊天）**。8b 最小且能走通"prefs → settings → 设置页 → 阅读器样式"全链路，为后面三个功能铺路；8a 有 PR #20 可抄；8c/8d 都建立在 8a 之上。

---

## 附录：不确定项汇总

1. **Zotero SDT 的生成管线**（本地模型/云端/缓存格式）：本仓库只有消费端证据（`Zotero.SDT.ensure`、`structure.catalog.pages`、测试 fixture 的 `processor.type="pdf"`、PR #21 提到的"SDT pack/cache"）。未查看 Zotero 源码，不确定其如何切分双栏、排除页眉页脚。
2. **`npm start` 热重载粒度**：scaffold 内部实现未读，需实跑验证。
3. **导出 PDF 对超长论文的上限**（`data:` URL 方案）：未实测。
4. **Google 免费翻译端点的当前可用性与限流阈值**：本仓库无相关代码，未做网络探测；方案中已按"可配 base URL"对冲。
5. 上游 PR 数量：用户预期 6 个，实际查询时为 9 个 open（5 人工 + 4 dependabot），以 §7.3 为准。