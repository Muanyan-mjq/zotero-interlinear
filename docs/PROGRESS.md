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
## Step 2：外观设置（2a 字号/颜色 + 2b 全量外观）

### 做了什么
- 新增 `src/appearance.ts` 作为**唯一外观模型与 CSS 生成器**：`AppearanceSettings`、`DEFAULT_APPEARANCE`、`normalizeAppearance()`、`isValidColor()`、`buildTranslationCSS(className, settings, "reader" | "print")`。阅读器实时样式与打印导出共用同一个函数，避免两套样式漂移。
- 可配置项（全部持久化到 `extensions.zotero.interlinear.appearance.*`）：
  - 字号 `fontSize`：10–32 px，默认 16。
  - 文字颜色 `color`：留空继承 Zotero 主题；仅接受 hex/rgb(a)/纯字母命名色。
  - 字体 `fontFamily`：逗号分隔的 CSS 字体名，留空继承阅读器字体；只允许 `[a-z0-9 ,._-]`，不允许引号、括号、分号、反斜杠或换行。
  - 行高 `lineHeight`：1–2.5，默认 1.75；持久化为整数百分比（如 175）。
  - 段落间距 `paragraphSpacing`：0–3 em，默认 1.25；持久化为整数百分之一 em（如 125）。
  - 背景色 `background`：留空透明；与文字颜色同样校验。
  - 主题 `theme`：`auto`（跟随 Zotero）/`light`（#f6f6f6 背景 + #222 文字）/`dark`（#2b2b2b + #e8e8e8）；显式文字颜色/背景优先于主题。
  - 下划线 `underline` + `underlineColor`：开关 + 可选颜色（留空跟随文字颜色）。
  - 左侧色带 `ribbon` + `ribbonColor`：默认开启、颜色 `#c7354a`。**确认结果：原译文块左侧那条红色竖线就是色带**（原 CSS `border-left: 4px solid #c7354a`），现已可开关和改色；关闭输出 `border-left: none`。
- `normalizeAppearance()` 统一做范围钳制、非法颜色回退、非法字体清空、非法主题回退；`buildTranslationCSS()` 只输出已归一化的值，因此设置页输入无法注入额外 CSS。
- 打印模式（`readerUI.ts` 导出）忽略深色阅读主题：背景固定透明、文字默认 #222，避免把深色块印到纸上；字体、行高、段距、下划线、色带仍按设置输出（色带宽度 2.2pt）。
- 设置页新增完整外观分组：字号、文字颜色、字体、行高、段落间距、背景色、主题下拉、下划线开关 + 颜色、色带开关 + 颜色；标签与帮助文字全部通过 Fluent（en-US/zh-CN）填充，无新增硬编码中文。
- 保存后调用 `refreshTranslationStyles()`，对已打开的所有 PDF 阅读器重写 `<style id="interlinear-style">`，无需关闭重开 PDF。
- 2a 与 2b 合并为同一个 Step 2 提交，避免历史上出现只完成一半外观设置的中间状态。

### 改动文件
- 新增：`src/appearance.ts`、`test/appearance.node.test.mjs`。
- 修改：`src/settings.ts`（外观 prefs 读写，`setAppearance` 先与当前值合并再归一化，避免局部保存清空其他字段）、`src/bilingualReader.ts`（`installStyles` 改用 `buildTranslationCSS`，新增 `refreshTranslationStyles`）、`src/readerUI.ts`（打印导出改用 `buildTranslationCSS(..., "print")`）、`src/modules/preferenceScript.ts`（填充/保存/即时刷新）、`addon/content/preferences.xhtml`、`addon/prefs.js`、`addon/locale/en-US/addon.ftl`、`addon/locale/zh-CN/addon.ftl`、`package.json`（lint 脚本加入 `src/appearance.ts`；`test:unit` 加入 appearance 测试）、`test/startup.test.ts`（集成用例扩展）、`typings/i10n.d.ts`、`typings/prefs.d.ts`（构建时生成）。

### 测试结果
- `npm run build`：通过（先跑 `npx zotero-plugin build` 重新生成 typings，否则新 prefs/FTL key 会让 `tsc` 失败）。
- `npm run lint:check`：通过，无告警。
- `npm run test:unit`：**24 pass / 0 fail**（translationPipeline 5 + appearance 19）。外观测试覆盖默认值、字号/行高/段距钳制、颜色与字体注入拒绝、主题解析与显式覆盖、下划线/色带开关、打印模式忽略深色主题。
- `npm run test:review`（Zotero 内集成，headless 独立 profile）：**17 pass / 0 fail**。外观用例实际打开偏好窗口，断言默认值、保存后的 11 个 prefs、打开的阅读器 `<style>` 内容，以及非法颜色不泄漏进 CSS。

### 不确定项
- 深色主题、字体族、打印导出的实际观感：**不确定**（只断言了生成的 CSS，未在真实 PDF 上逐项截图；字体能否命中取决于系统/Zotero 内置字体）。
- 打印导出的段距由原固定 `0.7em` 改为跟随 `paragraphSpacing`（默认 1.25em），属于有意的行为变化；若用户觉得打印过松，可在设置里调到 0。
- `font-family` 以未加引号形式输出以保留 `serif` 等通用关键字；含空格的真实字体名在 CSS 中合法，但若某字体名本身包含数字开头等极端情况，浏览器可能忽略该字体而回退。未做字体可用性检测。

### 需要手动验证的清单
1. 打开英文 PDF 并开启对照，进 Zotero 设置→Interlinear→译文外观，改字号 20、行高 2、段距 2、字体 `Georgia, serif`，保存。预期：已打开的阅读器译文块立即变大、变松，无需重开 PDF。
2. 主题选“深色”，文字颜色与背景色留空，保存。预期：译文块深底浅字；再把文字颜色设为 `#ff0000`，预期文字变红而背景仍深色。
3. 勾选“译文加下划线”，下划线颜色留空，保存。预期：译文出现下划线且颜色跟随文字；再填 `#00ff00`，预期下划线变绿。
4. 取消“显示左侧色带”，保存。预期：译文块左侧红线消失；重新勾选并把色带颜色改为 `#123456`，预期竖线变蓝黑。
5. 点 🖨️ 导出打印版，用打印预览查看。预期：译文为白底黑字、字号按设置换算为 pt、色带/下划线仍保留；深色主题不会带入打印稿。
6. 在文字颜色里输入 `red; } body { display:none` 并保存。预期：设置被拒绝（pref 变空、译文恢复跟随主题），页面无任何异常样式。

## Step 3：Provider 层（Google 默认 + OpenAI 兼容 + Ollama + Translate for Zotero）

### 做了什么
- 新增 `src/providers/` 独立 provider 层：
  - `types.ts`：`ProviderId`、`ProviderContext`、`ProviderTranslation`、`TranslationProvider` 接口。
  - `googleProtocol.ts` / `openaiProtocol.ts`：纯协议函数（无 Zotero API），供 Node 单测直接导入。Google 负责 base URL 归一化、`client=gtx` 查询构造、响应 segment 合并；OpenAI 负责 Chat Completions 地址归一化、请求体构造、`choices[0].message.content`（含数组与 `<think>` 剥离）、XHR 响应体与错误详情提取。
  - `google.ts`：POST 表单到 `…/translate_a/single`，无需 API 密钥；`testGoogleConnection()` 用 “Hello” 做 15 秒超时探测。
  - `openai.ts`：OpenAI 兼容 Chat Completions，适配 Ollama `/v1`、LM Studio、中转服务与官方 API；API Key 为空时不发 `Authorization`；错误详情截断 300 字符且**永不包含密钥**；`testOpenAIConnection()` 使用最小 system prompt。
  - `ollama.ts`：原生 `/api/chat`，`stream:false`、`keep_alive:"30m"`、temperature 0.1。
  - `pdftranslate.ts`：把原有 Translate for Zotero 调用迁入 provider，保留 `langto` 与 `isFailureText` 判定。
  - `prompts.ts`：语言名映射、`buildLanguageDirective()`（OpenAI 系统提示词追加）、`buildOllamaSystemPrompt()`（中性学术翻译 + BRSEG 保留规则的 PR #19 思路）。
  - `index.ts`：按 `getEngine()` 构造 provider；设置页只依赖纯协议模块，避免循环依赖。
- 新增 `src/translationFailure.ts`：把 `isFailureText()` 从 `bilingualReader.ts` 抽出，并补充 Google/OpenAI 的新失败文案特征。
- `bilingualReader.ts`：删除本地 `translateWithPDFTranslate`/`translateWithOllama` 与重复失败判定，统一走 `getTranslationProvider(engine)`；缓存读写传入目标语言；并发上限按引擎调整（Ollama 串行、Google 最多 2、其余按设置）。
- `settings.ts`：
  - `TranslationEngine` 改为 4 值 `google | openai | ollama | pdftranslate`，默认 **google**。
  - 新增 `google.baseUrl`、`openai.{endpoint,model,apiKey,prompt,temperature}`、`language.{source,target}` 读写与校验；OpenAI 端点保存时归一化为完整 Chat Completions 地址。
  - `getOpenAISystemPrompt()` = 用户提示词 + 自动语言指令。
  - `getCacheEngineTag()` 纳入 provider 配置：Google 含归一化端点；OpenAI 含端点/模型/提示词与温度哈希；Ollama 含地址/模型；语言对非默认时追加 `:{source}>{target}`。**任何 API Key 都不进入缓存键**。
- `translationCache.ts`：新增 `DEFAULT_TARGET_LANG = "zh-CN"` 与 `safeLanguage()`；键格式为 `…{targetLang}`，默认目标语言保持旧键兼容；迁移写入也带目标语言。
- 设置页重构：
  - 引擎下拉 4 项（Google 默认 / OpenAI 兼容 / Ollama / Translate for Zotero），选项文字通过 Fluent。
  - 新增“语言”分组：原文语言 14 项（含自动检测）、译文语言 13 项；选项在运行时由 `SOURCE_LANGUAGES`/`TARGET_LANGUAGES` + Fluent 生成。
  - 新增 Google 分组：服务地址 + 测试连接。
  - 新增 OpenAI 兼容分组：接口地址、模型、API 密钥（password 输入）、温度、系统提示词（textarea）+ 测试连接。
  - 顶部新增隐私提示（Fluent）：**段落文本会发送到你选择的翻译服务**。
  - 四个后端分组按当前引擎显示/隐藏；测试按钮使用 provider 的探测函数并输出本地化状态。
- `addon/prefs.js`：默认引擎改 `google`，新增 `google.baseUrl`、`openai.*`、`language.*` 默认值；Ollama/外观默认保持。
- en-US / zh-CN `addon.ftl` 新增 provider 界面、语言名、测试状态与全部 provider 错误文案。
- OpenAI provider 代码改编自 quillamio/bilingual-reader PR #20（作者 daxiaxiong88，AGPL-3.0-or-later）：文件头已注明来源与改动；本提交说明同样注明。Ollama 提示词采用上游 PR #19 的中性学术翻译与分段标记保留规则。

### 改动文件
- 新增：`src/providers/{types,googleProtocol,openaiProtocol,prompts,google,openai,ollama,pdftranslate,index}.ts`、`src/translationFailure.ts`、`test/providers.node.test.mjs`。
- 修改：`src/settings.ts`、`src/translationCache.ts`、`src/bilingualReader.ts`、`src/modules/preferenceScript.ts`、`addon/content/preferences.xhtml`、`addon/prefs.js`、`addon/locale/en-US/addon.ftl`、`addon/locale/zh-CN/addon.ftl`、`package.json`（lint 与 unit 列表）、`test/startup.test.ts`、`typings/i10n.d.ts`、`typings/prefs.d.ts`（构建生成）。

### 测试结果
- `npm run build`：通过（先 `npx zotero-plugin build` 生成新 FTL/prefs typings）。
- `npm run lint:check`：通过，无告警。
- `npm run test:unit`：**34 pass / 0 fail**（pipeline 5 + appearance 19 + providers 10）。provider 测试覆盖 Google 端点/查询/响应解析、OpenAI 端点归一化/请求体/内容提取/错误截断/XHR 响应体。
- `npm run test:review`（Zotero 内集成，headless 独立 profile）：**19 pass / 0 fail**。新增用例：
  - 偏好页 4 个引擎选项、默认 google、14/13 个语言选项、Google 默认地址与分组可见性。
  - Google 翻译链路：断言 POST、`/translate_a/single`、`sl=en`、`tl=zh-CN`、译文写入 DOM、缓存标签含 `google:` 与 `:en>zh-CN`。
  - OpenAI 链路：断言完整 `/v1/chat/completions`、`Bearer` 头、请求体消息，且**缓存标签不含 API Key**。
- 实网探测（非集成断言）：`translate.googleapis.com` 直连超时；经 `HTTPS_PROXY=http://127.0.0.1:7897` 的 curl 返回有效 JSON。Zotero.HTTP 是否继承系统代理**未在 headless 中实测**（集成用例全部 stub 了 HTTP）。

### 不确定项
- Google 免费 `client=gtx` 端点不是官方付费 API，稳定性与条款风险**不确定**；部分网络环境可能直接不可用，需用户填写可信镜像/代理或改用其他后端。
- Google 的 POST 表单在该端点可用性只经 curl 验证；Zotero 内真实请求未跑通实网（仅 mock）。
- 默认 OpenAI 端点指向本机 Ollama 的 `/v1`。未装 Ollama 的用户点“测试连接”会得到网络错误，这是预期行为，但设置页尚未做“首次使用引导”文案。
- 语言代码直接透传：Google 接受 `auto`/`zh-CN` 等；OpenAI/Ollama 走自然语言指令。个别中转服务对 `zh-CN` 这类代码的接受度**不确定**。
- `preferences.xhtml` 中“翻译范围/速度/缓存/Ollama/刷新说明”等旧分组仍是硬编码中文；按计划留给 Step 9 统一 i18n。Step 3 新增的所有文本均为 Fluent。
- API Key 仅存于 Zotero prefs（明文偏好存储，与 Zotero 其他插件一致）；未额外接入系统钥匙串。

### 需要手动验证的清单
1. 安装 `.scaffold/build/interlinear.xpi` 后打开设置→Interlinear。预期：引擎默认 **Google 翻译**；顶部显示隐私提示；下方只显示 Google 分组。
2. 点 Google 分组的“测试连接”。预期：能联网时显示“连接成功，测试译文：你好”；无法直连时显示带 detail 的网络错误。若失败，把服务地址改为你信任的镜像后重试。
3. 改引擎为 **OpenAI 兼容接口**。预期：Google 分组隐藏，出现接口地址/模型/API 密钥/温度/系统提示词。填本机 Ollama `http://127.0.0.1:11434/v1/chat/completions`、模型 `gpt-oss:20b`，密钥留空，测试连接。预期：成功且请求无 Authorization 头。
4. 填一个需要密钥的服务（如官方 OpenAI），输入密钥后测试连接。预期：成功；随后打开 Zotero 调试输出，确认日志中没有密钥字符串。
5. 把原文语言设为英语、译文语言设为日语，保存并翻译一段。预期：Google 请求含 `sl=en&tl=ja`；切换回中文后重新翻译不会命中日语缓存。
6. 打开一篇论文，先 Google 翻两段，再切到 pdftranslate 刷新。预期：两种后端的缓存互不串用；切回 Google 时已翻段落直接命中缓存。
7. 在 OpenAI 接口地址填 `not-a-url` 并保存。预期：回退到默认 `http://127.0.0.1:11434/v1/chat/completions`，不会保存非法值。

## Step 4：显示模式与段落对齐

### 做了什么
- 新增 `src/displayMode.ts`：`DisplayMode = "top-bottom" | "side-by-side" | "target-only" | "source-only"`、`DISPLAY_MODES`、`DEFAULT_DISPLAY_MODE = "top-bottom"`、`normalizeDisplayMode()`、`buildDisplayModeCSS()`。
- 采用**纯 CSS 模式切换，不移动 Zotero 的正文节点**：
  - 在 `#sdt-content` 上写 `data-interlinear-display="<mode>"`，所有规则都以此为作用域。
  - 创建译文块时给对应原文元素加 `interlinear-source` 类，并保持“原文 → 译文块”的相邻兄弟关系不变；因此原生批注 range 仍指向同一批文本节点，`refreshReadingLayout()` 只触发 `_handleViewUpdate(true)` 重算矩形。
  - `top-bottom`：不加任何布局规则，维持原文在上、译文在下。
  - `side-by-side`：原文与译文都改为 `inline-block`、`width:49%`、`vertical-align:top`；译文 `margin: 0 0 <段距>em 1%`。每个“原文+译文”对自然占一行，不改变 DOM 结构。
  - `target-only`：隐藏带 `interlinear-source` 的原文（只隐藏已生成译文的段落，未翻译页/参考文献保持原样）。
  - `source-only`：隐藏 `interlinear-translation` 译文块，原文保持可见。
- `settings.ts`：新增 `displayMode` 偏好（默认 `top-bottom`）与 `getDisplayMode()/setDisplayMode()`。
- `bilingualReader.ts`：
  - `installStyles()` 追加显示模式 CSS；`prepareAndRun()` 在清理旧译文后应用当前模式。
  - 新增导出 `refreshDisplayModes()`：设置保存后对已打开 PDF 阅读器立即切换，无需重新翻译。
  - `clearTranslations()` 关闭对照时移除所有 `interlinear-source` 类与 `#sdt-content` 上的模式属性。
- 设置页新增“显示模式”分组（4 项，Fluent en-US/zh-CN）；保存时同时调用 `refreshTranslationStyles()` 与 `refreshDisplayModes()`。
- 打印导出保持原行为：克隆正文时两份文本都在，打印 CSS 不包含显示模式规则，因此打印稿始终同时包含原文与译文（避免用户只想隐藏屏幕内容却把译文漏印）。

### 改动文件
- 新增：`src/displayMode.ts`、`test/displayMode.node.test.mjs`。
- 修改：`src/settings.ts`、`src/bilingualReader.ts`、`src/readingLayout.ts`（导出 `refreshReadingLayout`）、`src/modules/preferenceScript.ts`、`addon/content/preferences.xhtml`、`addon/prefs.js`、`addon/locale/en-US/addon.ftl`、`addon/locale/zh-CN/addon.ftl`、`package.json`、`test/startup.test.ts`、`typings/i10n.d.ts`、`typings/prefs.d.ts`。

### 测试结果
- `npm run build`：通过。
- `npm run lint:check`：通过，无告警。
- `npm run test:unit`：**40 pass / 0 fail**（新增 6 个显示模式测试：默认/归一化、target-only 只隐藏原文、source-only 只隐藏译文、左右双栏列宽与段距、不产生绝对定位/transform、top-bottom 无隐藏规则）。
- `npm run test:review`（Zotero headless 独立 profile）：**20 pass / 0 fail**。新增用例实际翻译两个段落后，依次切换 4 种模式，断言：
  - 译文块始终紧跟在对应原文之后（`source.nextElementSibling === block`，refPath 一致）；
  - 原文元素始终 `isConnected`，切换模式不会移动或重建正文节点；
  - `#sdt-content` 的 `data-interlinear-display` 随模式更新；
  - 样式表包含三套模式规则；
  - 关闭对照后 `interlinear-source` 类与模式属性被清除、译文块全部移除。
- 偏好页用例同时断言显示模式下拉默认 `top-bottom`、4 个选项，以及通过“保存设置”写入 `displayMode=side-by-side`。

### 不确定项
- 左右双栏在真实 Zotero PDF 页面中的视觉效果**不确定**：只断言了 CSS 与 DOM 关系，未在真实论文上逐页截图。具体风险：
  - 原文含标题、列表项（`li`）、图注（`figcaption`）时，`inline-block` 可能改变列表符号/缩进观感；
  - 若 Zotero 页面容器的可用宽度扣除 padding 后小于 100%，`49% + 1% + 49%` 可能让每对换行（预期行为），但也可能出现右列被挤到下一行；
  - 原文与译文仅顶部对齐，长段落不会逐行对齐。
- `target-only` 下原文被 `display:none`，依赖原文节点定位的原生高亮在屏幕上不可见；这是隐藏原文的必然结果，未破坏 range/几何数据，但“高亮仍显示”**做不到**。
- `source-only` 仍会照常发起翻译并写入缓存/生成隐藏译文块（为了切回其他模式时立即显示）；若用户只想要原文，当前仍会消耗翻译请求。后续可在 Step 5/9 视需要改成“仅缓存命中”。
- 真实 Zotero 若对 `#sdt-content` 内的 `p`/`li` 设置 `!important` 的 `display`，双栏规则可能被覆盖；未在实机验证。

### 需要手动验证的清单
1. 打开英文 PDF，开启对照，保持“原文在上，译文在下”。预期：与升级前一致。
2. 设置里改为“左右双栏”，保存。预期：已打开的阅读器立即变成左原文/右译文两列，无需点 🔄；每个译文与对应段落同一行，长段落顶部对齐。
3. 在双栏模式下滚动、选中原文、加一条高亮。预期：高亮矩形仍覆盖原文文字，位置不偏移；Zotero 批注侧栏可正常跳转。
4. 改为“只看译文”，保存。预期：原文消失，只看到译文块；关闭对照（点工具栏图标）后原文全部恢复。
5. 改为“只看原文”，保存。预期：译文块消失，原文完整；再切回“原文在上，译文在下”时译文立即出现（命中缓存，不发新请求或仅发少量请求）。
6. 打开含列表/图注的论文，重复第 2 步。预期：列表符号与图注仍可读；若出现错位请记录段落类型（`li`/`figcaption`）与截图。
7. 点 🖨️ 导出打印版。预期：打印稿始终同时包含原文与译文，不受当前显示模式影响。

## Step 5：触发方式（全文进度/取消/重试 + 划词弹窗 + Alt 单段）

### 做了什么
- 新增 `src/readerInteractions.ts`（纯 DOM 模块，便于 Node/集成测试注入）：只负责识别手势与渲染选区弹窗，翻译动作通过 `InteractionHost` 回调交给 `bilingualReader`。
  - **划词弹窗**：`mouseup` 后读取选区，非折叠且去空白后 ≥ 2 字符才显示；弹窗锚定在选区 `getBoundingClientRect()`，固定宽度 380px，左右/上下按视口钳制。内容为“翻译选区”“关闭（×）”和结果区；翻译中/成功/失败分别用 `data-state` 与本地化文案；选区文本超过 8000 字符时截断。
  - **Alt 单段**：`Alt+mousemove` 给最近的 `[data-ref-path]` 原文加 `.interlinear-source-hover` 虚线高亮；`Alt+点击` 阻止默认行为并对该段执行按需翻译；`Alt+Enter` 优先翻译悬停段，否则翻译选区起点所在段落。仅识别 `#sdt-content` 内、且不在 `.interlinear-translation` / 弹窗内的元素。
  - `Esc` 关闭弹窗并清除悬停；点击弹窗外部关闭；`dispose()` 移除全部监听与弹窗节点。
- `src/bilingualReader.ts`：
  - 新增 `translateSelectedText(reader, rawText)`：空白归一化后先查缓存（目标语言、引擎 tag 与批量翻译一致），未命中则走 provider（超时 + 独立取消令牌），失败/空结果抛错，不写缓存。
  - 新增 `translateReaderParagraph(reader, source)`：仅对 `#sdt-content` 内有 `refPath` 的源段落生效；命中缓存直接写块；未命中先显示“正在翻译…”再请求，成功后写缓存并置 `done`，失败置 `error` 并抛出（由交互层捕获记录），无论成败都刷新阅读布局。
  - `ensureReaderInteractions()` 在 `prepareAndRun` 中按文档幂等附加，阅读器清理时 dispose。
  - **全文进度**：`RunState` 增加 `completed`/`total`；工具栏新增 `span.interlinear-progress`，运行时显示 `已完成/总数`；切换按钮的 title/aria-label 在运行时变为“翻译中…（n/m）”，空闲恢复原文案。
  - **取消**：再次点击工具栏对照按钮会递增 generation、取消 `CancellationToken`、清空进度并移除未完成译文块（已成功段落保留）；关闭阅读器/清理时同样取消。
  - **重试**：没有单独的“重试”按钮——失败段可再次 `Alt+点击` 重试；批量失败/暂停后点 🔄 只会重跑未缓存段落（命中缓存的不再请求）。连续失败达到上限显示“已暂停…请检查翻译服务后点击刷新按钮重试”（该文案原本已存在，改为 Fluent）。
  - 原有加载/失败/等待文案全部改用 Fluent：`paragraph-waiting`、`paragraph-translating`、`paragraph-translating-progress`、`paragraph-translate-failed`、`paragraph-paused`、`selection-*`、`toolbar-*`。
- `src/utils/locale.ts`：找不到 `addon` 全局（集成测试直接 import `src/*` 的测试域）时回退返回消息 id，避免 `addon is not defined` 让全部用例失败；真实插件内行为不变。
- 设置页显示模式分组下新增 `interaction-help` 说明（Fluent），介绍划词弹窗与 Alt 手势。
- en-US / zh-CN `addon.ftl` 新增 Step 5 全部键；`package.json` 的 lint 列表加入 `src/readerInteractions.ts`。

### 改动文件
- 新增：`src/readerInteractions.ts`。
- 修改：`src/bilingualReader.ts`、`src/utils/locale.ts`、`src/modules/preferenceScript.ts`、`addon/content/preferences.xhtml`、`addon/locale/en-US/addon.ftl`、`addon/locale/zh-CN/addon.ftl`、`package.json`、`test/startup.test.ts`、`typings/i10n.d.ts`（构建生成）。

### 测试结果
- `npm run build`：通过。
- `npm run lint:check`：通过，无告警。
- `npm run test:unit`：**40 pass / 0 fail**（本步无新增纯函数，未新增 unit 用例）。
- `npm run test:review`（Zotero headless 独立 profile）：**23 pass / 0 fail**。新增 3 个用例：
  - 按需翻译单段 + 选区：断言译文块插入、源段加类、第二次请求命中缓存（只发 1 次请求）、选区空白归一化与返回值/缓存命中。
  - 选区弹窗 + Alt 手势：注入假 Selection/Range 与同步定时器，断言弹窗显示、点击“翻译选区”得到结果；Alt+悬停加类、Alt+点击与 Alt+Enter 分别触发 `refPath` 为 `0`/`1` 的段落；dispose 后弹窗与悬停类清除。
  - 全文进度与取消：用延迟 promise 卡住请求，断言工具栏进度 `0/1` 可见、按钮 title 变为“翻译中”；第二次点击取消后进度隐藏、title 恢复、未完成块移除；迟到的 promise 不会写回译文。
- 调整：外观注入用例原先断言“CSS 不以 `color:` 开头”，但新增弹窗 CSS 合法包含 `color: CanvasText`，改为断言非法输入 `#ff0000` 与 `body {` 不出现，语义不变。

### 不确定项
- 弹窗、悬停虚线、进度在**真实 Zotero PDF 上的观感未验证**（集成测试用独立 HTML 文档与假 Selection，非真实阅读器）。
- 弹窗为 `position: fixed`，打开后不随 PDF 滚动跟随；滚动后弹窗会停在原视口位置，直到点击外部/Esc/重新选择。未做滚动重定位。
- 弹窗配色用 `Canvas/CanvasText` 系统色，深色主题下应自动反转，但未截图确认。
- macOS 的 Option+点击/回车是否被系统或其他插件抢占**不确定**；仅按计划实现 Alt。
- 单段/选区按需翻译使用独立的 `CancellationToken`，不随批量“取消”停止；若同一段同时处于批量与按需翻译中，两者可能互相覆盖（后完成者写入）。
- 交互只在首次开启对照（进入阅读模式文档）后附加；未开启对照时没有划词弹窗，这是有意行为。
- 选区翻译上限 8000 字符（超出截断）为防误发超长文本的保守值，未做可配置。

### 需要手动验证的清单
1. 打开英文 PDF 并开启对照，选中一段英文。预期：出现弹窗；点“翻译选区”显示译文；点击弹窗外部或按 Esc 关闭。
2. 按住 Alt 移动鼠标。预期：当前段落出现虚线高亮；Alt+点击该段立即出现译文（或“正在翻译…”）；普通点击/普通回车不触发。
3. `Alt+Enter`（有悬停段落时；无悬停时先选中文字）。预期：只翻译悬停段或选区所在段落，不影响其他段。
4. 点 🔄 触发全文翻译。预期：工具栏出现 n/m 进度、按钮 title 变为“翻译中…（n/m）”；中途再点图标按钮取消，进度消失、未完成块被移除、已成功段落保留。
5. 把 Google 地址改成不可达并刷新，连续失败到上限。预期：未完成段落显示“已暂停：连续翻译失败…”，改回可用服务后点 🔄 只重跑未完成段落。
6. 深色主题下查看弹窗背景与悬停虚线。预期：弹窗可见、文字可读；若对比不足请附截图。
7. 在 `target-only`（只看译文）模式下选中译文文字。预期：不弹出翻译弹窗（弹窗只针对原文段落）。

## Step 6：Claude 与 Gemini provider

### 做了什么
- `TranslationEngine` / `ProviderId` 扩展为 6 值：`google | openai | claude | gemini | ollama | pdftranslate`；默认仍是 Google。
- 新增 **Anthropic Claude**（官方 Messages API）：
  - `src/providers/claudeProtocol.ts`：`normalizeClaudeEndpoint()` 接受官方域名、代理前缀或完整 `/v1/messages` 地址；`buildClaudeRequestBody()` 生成 `model/max_tokens/temperature/system/messages[{role:user,content:[{type:text,text}]}]`；`extractClaudeContent()` 只拼接 `type === "text"` 的块（忽略 thinking/tool_use）；错误详情截断 300 字符。
  - `src/providers/claude.ts`：`Zotero.HTTP.request` POST，请求头 `x-api-key`、`anthropic-version: 2023-06-01`、`anthropic-dangerous-direct-browser-access: true`；`max_tokens` 固定 4096；错误信息不含密钥。`testClaudeConnection()` 用 64 token 的最小请求探测。
- 新增 **Google Gemini**（官方 `generateContent`）：
  - `src/providers/geminiProtocol.ts`：`buildGeminiEndpoint()` 支持官方 base、代理前缀、完整 `:generateContent` 地址，自动补 `/v1beta/models/<model>:generateContent`；`normalizeGeminiModel()` 去掉 `models/` 前缀；请求体为 `systemInstruction` + `contents[{role:user,parts}]` + `generationConfig.temperature`；`extractGeminiContent()` 拼接文本 part 并跳过 `thought: true` 的思考内容。
  - `src/providers/gemini.ts`：API 密钥通过 `x-goog-api-key` 请求头发送（不放进 URL），错误详情截断 300 字符。
- `src/providers/index.ts`：注册两个新 provider，并导出 `testClaudeConnection` / `testGeminiConnection`。
- `src/settings.ts`：新增 `claude.{endpoint,model,apiKey,prompt,temperature}` 与 `gemini.{baseUrl,model,apiKey,prompt,temperature}` 读写与校验（Claude 温度 0–1，Gemini 0–2；端点保存时归一化；模型去 `models/` 前缀）。系统提示词 = 用户提示词 + 自动语言指令。
- **缓存键**：`claude:<归一化端点>:<模型>:<提示词+温度哈希><语言对>`、`gemini:<baseUrl>:<模型>:<提示词+温度哈希><语言对>`；两个 API 密钥都不进入缓存键，轮换密钥不会使缓存失效。
- 设置页：引擎下拉 6 项；新增 Claude / Gemini 两个分组（端点、模型、API 密钥 password 输入、温度、系统提示词、测试连接按钮），按当前引擎显示/隐藏；保存时写入全部字段；测试连接使用 provider 探测函数并输出本地化状态。
- `addon/prefs.js` 新增 10 个默认值：`claude.endpoint=https://api.anthropic.com/v1/messages`、`claude.model=claude-sonnet-4-5`、`claude.temperature=0.2`、`gemini.baseUrl=https://generativelanguage.googleapis.com`、`gemini.model=gemini-2.5-flash`、`gemini.temperature=0.2`，提示词默认为空（读取时回退通用学术提示词）。
- en-US / zh-CN `addon.ftl` 新增引擎名、两组标签/帮助、测试状态与全部 provider 错误文案；介绍文案同步提及 Claude 与 Gemini。
- 未新增 npm 依赖；未复制上游代码，Claude/Gemini 协议按官方 API 文档实现。

### 改动文件
- 新增：`src/providers/claudeProtocol.ts`、`src/providers/claude.ts`、`src/providers/geminiProtocol.ts`、`src/providers/gemini.ts`。
- 修改：`src/providers/types.ts`、`src/providers/index.ts`、`src/settings.ts`、`src/modules/preferenceScript.ts`、`addon/content/preferences.xhtml`、`addon/locale/en-US/addon.ftl`、`addon/locale/zh-CN/addon.ftl`、`addon/prefs.js`、`test/providers.node.test.mjs`、`test/startup.test.ts`、`typings/i10n.d.ts`、`typings/prefs.d.ts`（构建生成）。

### 测试结果
- `npm run build`：通过。
- `npm run lint:check`：通过，无告警。
- `npm run test:unit`：**49 pass / 0 fail**（新增 9 个协议用例：Claude 端点归一化/请求体/内容提取/错误截断；Gemini 端点拼接/模型归一化/请求体/内容提取（跳过 thought）/错误截断）。
- `npm run test:review`（Zotero headless 独立 profile）：**26 pass / 0 fail**。新增 3 个用例：
  - 偏好页：6 个引擎选项；Google 引擎下 Claude/Gemini 分组隐藏；`interlinear-claude-endpoint/model`、`interlinear-gemini-base-url/model` 默认值正确；两个测试按钮存在。
  - 偏好保存：切到 Claude 时只显示 Claude 分组，切到 Gemini 时只显示 Gemini 分组；保存后 10 个新 prefs 全部正确（Claude 端点由 `/v1` 补全为 `/v1/messages`）。
  - Claude 翻译链路：断言 POST 到 `https://api.anthropic.com/v1/messages`、`x-api-key`、`anthropic-version`、消息体与 `system` 含语言指令、译文写入 DOM、缓存标签以 `claude:` 开头且不含密钥（响应中的 thinking 块被忽略）。
  - Gemini 翻译链路：断言 URL 为 `…/v1beta/models/gemini-2.5-flash:generateContent`、`x-goog-api-key`、`contents` 与 `systemInstruction`、译文写入 DOM、缓存标签以 `gemini:` 开头且不含密钥（thought part 被忽略）。
- 首跑失败 1 项：测试误以为引擎选 Claude 时 Gemini 分组也应可见；改为双向切换断言后通过。

### 不确定项
- **默认模型名未对真实 API 验证**：`claude-sonnet-4-5`、`gemini-2.5-flash` 是截至实现时官方文档中的名称，可能随服务商更新而失效；两个模型字段都可由用户修改。没有可用 API 密钥，未做真实网络请求。
- Zotero 的 XHR 是否会被 Anthropic 视为浏览器来源、是否必须带 `anthropic-dangerous-direct-browser-access` 头**不确定**；带上该头在官方 API 下无害，但某些中转可能拒绝未知头。
- Gemini 密钥按官方推荐的 `x-goog-api-key` 头发送；若某些中转只接受 `?key=` 查询参数，当前实现不兼容。
- Claude `max_tokens` 固定 4096，未做设置项；超长批次（2800 字符输入）理论上足够，但若目标语言显著膨胀可能被截断（`stop_reason=max_tokens` 未单独提示）。
- 两个新 provider 与现有 BRSEG 批量标记的兼容性只在单元/集成 mock 中验证，未用真实模型跑长文档；若模型改写了分段标记，批量会回退为逐段请求（已有逻辑）。
- Claude/Gemini 的真实并发/限流行为未知；沿用“自定义并发上限”，Google 仍限制为 2、Ollama 串行。
- 错误详情可能包含服务商返回的提示文字，已截断 300 字符；未发现密钥进入错误路径，但未逐字审计所有中转的响应格式。

### 需要手动验证的清单
1. 打开设置→Interlinear，引擎下拉应出现 **Anthropic Claude** 与 **Google Gemini**；切换时只显示对应分组。
2. 填入真实 Claude API 密钥，点“测试连接”。预期：返回 “Hello” 的译文；若失败显示 HTTP 状态与 detail，且 detail 中不含密钥。
3. 填入真实 Gemini API 密钥，点“测试连接”。预期：同上；URL 不包含密钥。
4. 分别用 Claude / Gemini 翻译一段英文论文。预期：译文写入对应段落、`data-state=done`；再次刷新命中缓存（不再发请求）。
5. 轮换 API 密钥后重新翻译同一段落。预期：仍命中缓存（密钥不参与缓存键）。
6. 把模型改成不存在的名称 / 删除密钥后测试。预期：分别提示模型错误、密钥未填写；不会静默回退到其他后端。
7. 若使用中转：填写自定义端点/服务地址，确认最终请求路径符合中转要求（Claude 以 `/v1/messages` 结尾，Gemini 以 `:generateContent` 结尾）。
8. 打开 Zotero 调试输出，确认日志中没有出现两个密钥字符串。

## Step 7：术语表导入导出与缓存键

### 做了什么
- 新增纯函数模块 `src/glossary.ts`：
  - `parseGlossary()` 支持 CSV 与 TSV：自动按首个有效行选择分隔符；支持 `"..."` 引号、字段内逗号/换行、`""` 转义引号；跳过空行、`#` 注释行与可选的 `source,target` / `原文,译文` 表头；同一原文重复出现时后者覆盖前者并移到末尾。
  - `normalizeGlossary()`：去除首尾空白、丢弃空字段、单条原文/译文上限 200 字符、最多 2000 条。
  - `serializeGlossary()`：固定输出 `source,target` 表头，仅在含逗号/引号/换行时加引号并转义，保证 `parseGlossary(serializeGlossary(x))` 往返一致。
  - `glossaryHash()`：对规范化后的 `source\u0000target` 列表做 FNV-1a，输出 8 位十六进制；空术语表返回空串（不改变已有缓存键）。
  - `buildGlossaryDirective()`：生成中文提示词片段 `- 原文 => 译文`，默认预算 3000 字符；超预算时保留已能容纳的条目并追加“（另有 N 条术语未列入）”，完整提示词仍包含使用术语的要求。
- `src/settings.ts`：新增 `extensions.zotero.interlinear.glossary` 读写；`getGlossaryEntries/Directive/Hash` 均从原始文本解析。OpenAI、Claude、Gemini 的系统提示词自动追加术语表指令；Ollama 在 `src/providers/index.ts` 中追加同样的指令。Google 翻译与 Translate for Zotero 不读取术语表。
- **缓存键**：`ollama/openai/claude/gemini` 四类引擎在语言对之后追加 `:g:<术语表哈希>`；术语表为空时不追加，旧缓存继续命中。缓存键只含哈希，不含术语原文，更不含 API 密钥。
- 设置页新增“术语表”分组：多行文本框、导入…、导出…、状态行。导入时解析文件并回填规范化 CSV（需点“保存设置”后生效）；导出时解析当前文本框并写入 CSV；空表或文件选择取消时给出本地化状态。
- 新增 `src/glossaryFiles.ts`，把版本敏感的 `ztoolkit.FilePicker` 与 `Zotero.File.getContentsAsync/putContentsAsync` 集中在一处，并注明 Zotero 7–10 的兼容范围。
- en-US / zh-CN `addon.ftl` 新增术语表标题、格式帮助、导入/导出按钮、文件对话框标题、导入/导出/空表/错误状态；帮助文案明确说明仅对 LLM 后端生效。
- `addon/prefs.js` 新增 `glossary = ""` 默认值；`package.json` 的 `test:unit` 加入 `test/glossary.node.test.mjs`，lint 列表加入两个新源文件。
- 未新增 npm 依赖；未复制上游代码。

### 改动文件
- 新增：`src/glossary.ts`、`src/glossaryFiles.ts`、`test/glossary.node.test.mjs`。
- 修改：`src/settings.ts`、`src/providers/index.ts`、`src/modules/preferenceScript.ts`、`addon/content/preferences.xhtml`、`addon/locale/en-US/addon.ftl`、`addon/locale/zh-CN/addon.ftl`、`addon/prefs.js`、`package.json`、`test/startup.test.ts`、`typings/i10n.d.ts`、`typings/prefs.d.ts`（构建生成）。

### 测试结果
- TDD：先写 `test/glossary.node.test.mjs` 的 7 个用例并运行，因 `../src/glossary.ts` 不存在而失败（RED）；实现后转为 GREEN。期间修正了测试自身误用 chai `assert.include` 的问题，改为 Node 原生断言。
- `npm run build`：通过（新增 FTL 键后需先执行 `npx zotero-plugin build` 生成 `typings/i10n.d.ts`，否则 `tsc` 会报未知 Fluent ID）。
- `npm run lint:check`：通过，无告警。
- `npm run test:unit`：**56 pass / 0 fail**（新增 7 个术语表用例：CSV 引号/逗号、TSV/注释/重复覆盖、非法行、长度上限、序列化往返、哈希稳定性、指令截断）。
- `npm run test:review`（Zotero headless 独立 profile）：**27 pass / 0 fail，退出码 0**。新增/扩展：
  - 偏好页：术语表文本框默认空、帮助文案非空、导入/导出按钮存在。
  - 偏好保存：填入两行术语并保存，断言 pref 文本；切换引擎为 OpenAI 后缓存标签以 `:g:<8位十六进制>` 结尾且不含术语原文；修改术语后标签变化。
  - OpenAI 翻译链路：注入 `gene\t基因`，断言请求 `messages[0]` 含 `gene => 基因`、缓存标签含 `:g:` 且不含 API 密钥。
- 首次 `test:review` 在输出 `27 passed` 后打印过一次 Go `deadlock` 信息但退出码为 0；随后完整复跑输出干净，未见用例失败。

### 不确定项
- **文件选择器与文件读写未在真实设置窗口点击验证**：集成测试只断言按钮存在，没有打开原生文件对话框。`ztoolkit.FilePicker` 的过滤器语法（`*.csv; *.tsv; *.txt`）与 `Zotero.File.getContentsAsync(path, "utf-8")` 的返回类型在 Zotero 10 下未手动确认，可能导致导入/导出失败或返回非字符串。
- 导入时用规范化 CSV 覆盖文本框，会丢失原文件的注释、列顺序与其他列；只保留前两列。若用户希望保留原格式，需要改为“原样回填”。
- 术语表指令预算按 JS 字符数计算，中文与英文按同一字符计；超长术语（接近 200 字符）时可能只容纳很少条目。截断只提示“另有 N 条未列入”，未提供分批机制。
- 术语表只对 OpenAI/Claude/Gemini/Ollama 生效；Google 与 Translate for Zotero 忽略术语表，已在帮助文案中说明，但用户可能仍期望全部后端一致。
- 缓存键追加 `:g:<hash>` 会使开启术语表后的旧缓存不再命中，这是有意行为；关闭术语表可回到旧键。未做迁移或双键回退。
- CSV 解析对“字段前有空格再跟引号”的写法按普通文本处理，不视为引号字段；对非标准 CSV（分号分隔、Excel 导出的 BOM）未特殊处理。UTF-8 BOM 会进入首个字段，可能导致表头识别失败或首条术语原文带 BOM。

### 需要手动验证的清单
1. 打开设置→Interlinear，确认“术语表”分组可见，文本框为空，导入/导出按钮有本地化文字。
2. 准备一个 UTF-8 CSV（含 `source,target` 表头、一条带逗号的引号字段、一条重复原文），点“导入…”。预期：文本框显示规范化后的 CSV，状态显示导入条数，重复项只保留最后一条。
3. 点“导出…”，保存为 `glossary.csv`。预期：文件内容以 `source,target` 开头，重新导入后条目一致；取消对话框不报错。
4. 填一条术语（如 `gene,基因`），保存设置，选择 OpenAI 兼容 / Claude / Gemini / Ollama 任一后端翻译一段包含该词的英文。预期：请求的系统提示词包含 `gene => 基因`；译文使用“基因”。
5. 在设置中修改该术语的译文并保存，再次刷新翻译。预期：缓存键变化，重新请求；改回原译文后若旧缓存仍在则命中。
6. 清空术语表并保存。预期：缓存键恢复为不含 `:g:` 的形式；翻译请求不再包含术语表指令。
7. 选择 Google 翻译或 Translate for Zotero，填入术语表后翻译。预期：行为不受影响（这两个后端不读取术语表）。
8. 导入一个超过 3000 字符的术语表，用 LLM 后端翻译。预期：提示词只包含部分条目并注明未列入数量，翻译仍能完成。

## Step 8：阅读器侧边栏聊天

### 做了什么
- 用官方 `Zotero.ItemPaneManager.registerSection()` 注册 `interlinear-chat` 面板（`src/chatPane.ts`），仅在阅读器标签页启用（`onItemChange` 中 `setEnabled(tabType === "reader")`）；header 用 16px 图标、sidenav 用 20px 图标；正文由 `bodyXHTML` 提供：隐私提示、上下文范围下拉、对话记录、输入框、发送/清空按钮、状态行。
- 复用 Step 3 的 provider 层：`src/providers/types.ts` 新增 `ChatProvider` 接口，`src/providers/index.ts` 新增 `getChatProvider()`。OpenAI 兼容 / Claude / Gemini / Ollama 四种 LLM 后端支持聊天；Google 翻译与 Translate for Zotero 不支持，界面提示“当前引擎不支持聊天”，不发送请求。
- 上下文范围三选一：选中段落 / 当前页（视口附近段落）/ 全文。`src/chatContext.ts` 从 SDT 视图收集段落文本，排除参考文献区、译文节点、隐藏节点和嵌套列表；全文统一 12000 字符预算，超出时优先在段落边界截断（边界位置需大于预算 60%，否则硬截断），并在状态行提示已截断。
- 会话按 itemKey 存内存（`src/chatSession.ts`）：最多保留 20 轮，超出丢弃最旧；不同条目互不影响；重启 Zotero 即清空。
- 聊天 system prompt（`src/providers/chatPrompts.ts`）包含目标语言显示名，并在术语表非空时追加 `buildGlossaryDirective()` 的指令。
- 隐私提示常驻面板顶部：“聊天内容会发送到你选择的模型服务。请勿粘贴敏感信息。”
- 上下文块只注入最新一条用户提问；历史里只存原始问答，避免每轮重复携带全文。请求期间禁用发送；失败时保留输入内容可直接重试；切换条目后，旧请求的响应不会写入新条目的界面。
- 阅读器解析：优先在 `Zotero.Reader._readers` 中按 `itemID` 匹配；父条目没有阅读器时，回退到其 PDF 附件对应的 reader。
- 新增 FTL 键：en-US / zh-CN `addon.ftl` 共 24 个（隐私、范围、输入框、按钮、空态、思考中、角色标签、截断提示、各类状态与错误）；`mainWindow.ftl` 各 2 个 section 头键。全部 UI 文案走 Fluent。
- 未新增 npm 依赖；无上游代码复制。

### 改动文件
- 新增：`src/chatContext.ts`、`src/chatSession.ts`、`src/chatPane.ts`、`src/providers/chatProtocol.ts`、`src/providers/chatPrompts.ts`、`src/providers/chat.ts`、`test/chat.node.test.mjs`。
- 修改：`src/providers/types.ts`、`src/providers/index.ts`、`src/hooks.ts`（启动时注册、关闭时注销）、`src/bilingualReader.ts`（导出 `getReaderDocument`）、`addon/locale/en-US/addon.ftl`、`addon/locale/zh-CN/addon.ftl`、`addon/locale/en-US/mainWindow.ftl`、`addon/locale/zh-CN/mainWindow.ftl`、`package.json`（`test:unit` 与 lint 列表）、`test/startup.test.ts`、`typings/i10n.d.ts`（构建生成）。

### 测试结果
- TDD：先写 `test/chat.node.test.mjs` 的 12 个用例，因模块不存在而失败（RED）；实现后转 GREEN。期间发现 Node 24 类型剥离无法解析 src 模块间的无扩展名 import，因此 `chatPrompts.ts` 改为只依赖类型、目标语言显示名由调用方传入。
- `npm run build`：通过。
- `npm run lint:check`：通过，无告警。
- `npm run test:unit`：**68 pass / 0 fail**（56 个旧用例 + 12 个聊天用例）。
- `npm run test:review`（Zotero headless 独立 profile）：**33 pass / 0 fail，退出码 0**。新增 6 个集成用例：面板注册（仅阅读器启用、l10n 键、bodyXHTML 结构）、三种上下文收集、段落边界截断、仅 LLM 后端暴露聊天、OpenAI 请求含术语表并能解析回复、Gemini 密钥走 header 且 URL 不含密钥。
- 集成测试中 Zotero 会把 paneID 以 pluginID 命名空间化（变为 `interlinear-interlinear-chat`），断言改用 `endsWith`。

### 不确定项
- `Zotero.ItemPaneManager.registerSection()` 属于 Zotero 7+ 的扩展 API，版本敏感；使用点已集中在 `src/chatPane.ts` 并注释。未在 Zotero 6 验证（模板最低版本本身要求 7+，低风险）。
- 全文上下文来自 SDT 段落：若尚未完成全文翻译，聊天只能看到已渲染的段落文本；不会读取 PDF 原始文字层。
- 12000 字符预算按 JS 字符数计算，中英文同权；极长单段会硬截断，可能断在句子中间。
- 第一版不流式输出（需求允许）：等待期间只显示“思考中…”，长回答需等完整响应。
- 历史只保留 20 轮且只存原始问答；上下文快照只在当次请求注入。追问时模型不保留旧的全文上下文，这是有意的体积取舍。
- 不显示 token 用量，不做费用估算。
- 只支持已打开阅读器的条目；没有 reader 时提示“未找到阅读器”。

### 需要手动验证的清单
1. 安装 xpi，打开一篇 PDF 阅读器标签，右侧条目面板应出现“阅读助手”图标；在条目信息（library）标签页不应显示该面板。
2. 打开面板：顶部隐私提示、范围下拉（选中段落/当前页/全文）、空对话占位、输入框与发送/清空按钮均显示当前界面语言文案。
3. 选 OpenAI 兼容引擎并配置好密钥，选中一段英文，范围选“选中段落”，提问“这段在说什么？”。预期：中文回答且引用了该段；对话区出现“你/助手”两条气泡。
4. 范围改为“当前页”再次提问；滚动到文档别处再问。预期：上下文跟随当前视口段落变化。
5. 范围改为“全文”提问概括性问题；用一篇超长文档验证状态行出现“上下文已截断（N 字符）”提示。
6. 连续追问两轮，确认模型能理解“它/这个方法”等指代（内存历史生效）；切换到其他条目再切回，对话仍在；重启 Zotero 后清空。
7. 选择 Google 翻译后打开聊天面板，预期提示“当前引擎不支持聊天”，不会发出请求。
8. 填错密钥或断网发送，预期状态行显示 HTTP/网络错误详情（不含密钥），输入框内容保留，可直接重试。
9. 在设置里填 `gene,基因` 后提问“解释 gene 这个概念”，预期回答遵守术语表译法。
10. 对含 PDF 附件的父条目通过条目信息面板打开聊天，预期能定位到附件阅读器的上下文，而不是提示未找到阅读器。

## Step 9：移除 Translate for Zotero 依附、工具栏小图标与右键菜单、i18n 补全

### 做了什么
- 彻底移除 Translate for Zotero 运行时依赖：删除 `src/providers/pdftranslate.ts`；`ProviderId` 收缩为 `google | openai | claude | gemini | ollama`，Google 成为隐式默认与所有旧值的回退（包括旧配置里的 `pdftranslate`）；`getCacheEngineTag()` 不再接收服务参数，Google 命名空间兜底；偏好设置里删除 pdftranslate 选项与整段“PDF Translate”UI；`translationFailure.ts` 删除 PDFTranslate 专用错误匹配；`getChatProvider()` 只对 Google 返回 null。
- 阅读器工具栏图标从 24px 收到 16px（图片与 emoji 按钮同步），按钮 `minWidth` 24px、内边距 2px；保留左键切换全文翻译、进度文本、刷新与导出按钮。
- 新增 `src/readerMenu.ts`：文档级浮层菜单，支持勾选项、分隔线、外部点击/Escape/失焦/滚动/缩放自动关闭，所有监听器在关闭时移除。
- 右键工具栏小图标弹出全部功能：开启/停止翻译、刷新、取消任务（未运行时禁用）、四种显示模式（当前项打勾）、导出中英对照 PDF、打开阅读助手面板、打开插件设置。显示模式选择会写回偏好并即时重绘；聊天面板在侧栏未展开时先展开再点击对应按钮。
- i18n 补全：`bilingualReader.ts` / `readerUI.ts` / `preferenceScript.ts` 中剩余硬编码中文全部改为 Fluent 键；`preferences.xhtml` 删除全部静态中文，改为带 id 的空元素并由 `fillStaticLabels()` 注入；新增约 75 个 FTL 键（en-US / zh-CN 各一份）。故意保留的中文仅限模型提示词、正则、术语表解析与聊天提问前缀，不属于界面文案。
- 修 FTL 解析：Fluent 字符串字面量不支持 `\n` 转义，改用 `{"\u000A\u000A"}`；否则这两条消息会被解析器丢弃且不进入生成的 `typings/i10n.d.ts`。
- 未新增 npm 依赖；无上游代码复制。

### 改动文件
- 新增：`src/readerMenu.ts`。
- 删除：`src/providers/pdftranslate.ts`。
- 修改：`src/bilingualReader.ts`、`src/readerUI.ts`、`src/settings.ts`、`src/translationFailure.ts`、`src/providers/index.ts`、`src/providers/types.ts`、`src/modules/preferenceScript.ts`、`addon/content/preferences.xhtml`、`addon/locale/en-US/addon.ftl`、`addon/locale/zh-CN/addon.ftl`、`README.md`、`package.json`（lint 列表加入 `readerMenu.ts`）、`test/startup.test.ts`、`typings/i10n.d.ts`（构建生成）。

### 测试结果
- `npm run build`：通过（`tsc --noEmit` + scaffold 打包）。
- `npm run lint:check`：通过，无告警。
- `npm run test:unit`：**68 pass / 0 fail**。
- `npm run test:review`（Zotero headless 独立 profile）：**33 pass / 0 fail，退出码 0**。集成用例覆盖：引擎选项仅五个原生后端、旧值 `pdftranslate` 回退 Google 且 PDFTranslate 调用次数为 0、16px 图标、右键菜单包含全部 10 个动作、点击显示模式会写偏好并关闭菜单。
- 覆盖率缺口：菜单定位/关闭逻辑与 `revealChatPane()` 只在模拟 DOM 与 fake reader 中验证。

### 不确定项
- `revealChatPane()` 依赖主窗口 `.btn[data-pane]` 且值以 `-interlinear-chat` 结尾；若 Zotero 调整侧栏按钮结构，菜单里的“阅读助手”可能提示不可用。
- 右键菜单为原生 DOM 浮层，不是 XUL 菜单；在 Zotero 深色主题下沿用 CSS 变量，但未做真实主题切换验证。
- 旧配置 `pdftranslate` 静默映射 Google，不提示用户“引擎已变更”；如需显式提示可后续补充。
- 聊天/术语表仍对 Google 不可用（Google 翻译无对话/提示词接口），属预期限制。
- 菜单与图标的真实 Zotero UI 右键行为尚未手工验证，集成测试使用合成 `contextmenu` 事件。

### 需要手动验证的清单
1. 在真实 Zotero 阅读器中确认工具栏图标为 16px，且左键仍可开启/停止全文翻译。
2. 右键小图标：菜单应在鼠标位置弹出，含 10 个条目；点击空白处、按 Escape、切换窗口后应自动关闭。
3. 依次点击四种显示模式：段落布局即时变化，重新打开菜单时当前模式带勾。
4. 未运行翻译时“取消任务”应为禁用态；运行中点击应停止并恢复按钮状态。
5. 点击“导出中英对照 PDF”“阅读助手”“插件设置”，确认分别打开导出流程、右侧聊天面板与偏好设置页。
6. 将界面切换为英文，重新打开偏好设置与阅读器，确认设置页、工具栏提示、导出对话框与错误提示全部为英文，无残留中文。
7. 用旧配置（引擎曾为 Translate for Zotero）启动，确认自动使用 Google 且不再出现 PDFTranslate 相关选项或错误。

## Step 10：清理与发布准备

### 做了什么
- 删除未被任何代码引用的模板示例：`src/modules/examples.ts`、`addon/content/zoteroPane.css`、`addon/locale/*/preferences.ftl`；同时移除 `preferences.xhtml` 中对已删除 FTL 的 `<linkset>` 引用。
- 清理模板本地化条目：`mainWindow.ftl` 只保留阅读助手 section 文案；`addon.ftl` 删除 `startup-*`、`menuitem-*`、`prefs-title`、`prefs-table-*`、`tabpanel-*` 等示例键。
- 简化模板状态：`src/addon.ts` 删除未使用的 `env`、`prefs`（columns/rows）、`dialog` 与空 `api`；`src/hooks.ts` 删除无人调用的 `onNotify`、`onShortcuts`、`onDialogEvents` 及 dialog 清理。
- README：增加英文概览（功能、后端、安装、使用、限制）；更新测试平台说明、图标表中 favicon 的真实用途、开发命令与构建产物路径。
- CHANGELOG 增加 v0.5.1 发布条目，汇总更名、原生后端、右键菜单、外观/显示模式、术语表、聊天、导出与完整 i18n。
- 修复发布工作流：产物名从 `bilingual-reader.xpi` 改为实际生成的 `interlinear.xpi`，Release 标题改为 Interlinear；更新元数据 Release 标题同步更名。
- 未新增 npm 依赖；未修改 addonID（`interlinear@muanyan-mjq`）与 `update.json` 生成逻辑。

### 改动文件
- 删除：`src/modules/examples.ts`、`addon/content/zoteroPane.css`、`addon/locale/en-US/preferences.ftl`、`addon/locale/zh-CN/preferences.ftl`。
- 修改：`src/addon.ts`、`src/hooks.ts`、`addon/content/preferences.xhtml`、`addon/locale/en-US/mainWindow.ftl`、`addon/locale/zh-CN/mainWindow.ftl`、`addon/locale/en-US/addon.ftl`、`addon/locale/zh-CN/addon.ftl`、`README.md`、`CHANGELOG.md`、`.github/workflows/ci.yml`、`typings/i10n.d.ts`（构建生成）。

### 测试结果
- `npm run build`：通过（`tsc --noEmit` + scaffold 打包）。
- `npm run lint:check`：通过，无告警。
- `npm run test:unit`：**68 pass / 0 fail**。
- `npm run test:review`（Zotero headless 独立 profile）：**33 pass / 0 fail**。
- 构建产物确认：`.scaffold/build/interlinear.xpi`，`update.json` 中的 addonID 与下载路径均为 Interlinear。

### 不确定项
- GitHub Actions 未在本机实际触发；发布 job 的产物名、标题与 `[release]` 触发条件只做了静态修改，未做真实 Release 演练。
- README 的英文部分是概览而非逐句对照翻译，中文仍为主文档。
- `docs/ANALYSIS.md` 是改造前的代码分析快照，保留了旧 PDFTranslate 相关内容，后续可作为历史资料，不再代表当前实现。
- `addon/bootstrap.js` 顶部仍保留对 Make It Red 示例的注释来源说明，属许可证/来源标注，未删除。
- 未在真实 Zotero 图形界面中手工回归右键菜单与英文界面（集成测试为 headless + 合成事件）。

### 需要手动验证的清单
1. 安装 `.scaffold/build/interlinear.xpi`，确认插件管理器显示名称 Interlinear、图标正常、无模板示例菜单或面板。
2. 打开偏好设置，确认页面、速度、缓存、Ollama、刷新说明与项目主页各区块文案完整，中英文切换无空标签。
3. 右键阅读器小图标，逐项验证 10 个动作；确认“阅读助手”能展开右侧栏并切换到聊天面板。
4. 切换英文界面，检查工具栏提示、导出确认框、错误提示与设置页无残留中文。
5. 在 GitHub 上以 `[release]` 提交信息触发一次发布流程（或手动 dry-run），确认上传的是 `interlinear.xpi` 且 Release 标题为 Interlinear。
6. 检查 Zotero 自动更新：`update.json` 的版本、下载链接与本次 xpi 的哈希一致。


## Step 11：修复真实 Zotero 中工具栏按钮无图标、右键无响应

### 做了什么
- 根因定位到 Zotero 上游 `chrome/content/zotero/xpcom/reader.js`：`renderToolbar` 事件里的 `append()` 会执行 `Components.utils.cloneInto(args, this._iframeWindow, ...)`。用 Zotero 内临时诊断测试实测：该调用对 DOM 节点直接抛出 `Encountered unsupported value type writing stack-scoped structured clone`，所以真实环境中工具栏控件根本没有插入成功——这同时解释了“按钮图标不显示”和“右键没有任何效果”。集成测试里的 fake append 直接插入原节点，因此没有暴露该问题。
- `src/readerToolbar.ts` 新增 `resolveToolbarAppend()`：当阅读器文档存在 `.toolbar .custom-sections` 时，改为直接把控件插入我们自己的 `.interlinear-toolbar-section`，完全绕开 Zotero 的克隆路径；只有找不到该容器时才回退到事件自带的 `append`。
- `renderReaderToolbar()` 用解析后的直接注入函数替换事件 append，其余事件字段原样传给两个渲染器；`reconcileReaderToolbars()` 复用同一路径，删除了重复的注入闭包。
- 原来的 `interlinear-toolbar-section` 容器逻辑保留并改名为通用工具栏容器（不再是“fallback”），继续强制横向 inline-flex，避免 Zotero `.section` 样式把按钮竖排。
- 未改按钮创建函数本身：直连 DOM 后 `img`/emoji 子节点和内联样式都保留，16px 图标与右键上下文菜单恢复。
- 新增回归用例：让 fake `append` 像真实 Zotero 一样同步抛错，断言控件仍位于直连 section 中、图标仍在、`contextmenu` 仍能打开菜单。

### 改动文件
- 修改：`src/readerToolbar.ts`、`test/readerToolbar.test.ts`。

### 测试结果
- `npm run build`：通过（`tsc --noEmit` + scaffold 打包）。
- `npm run lint:check`：通过，无告警。
- `npm run test:unit`：**68 pass / 0 fail**。
- `npm run test:review`（Zotero headless 独立 profile）：**34 pass / 0 fail**（新增 cloneInto 抛错回归用例通过）。

### 不确定项
- 集成测试无法证明真实 GUI 的像素级图标渲染；但诊断已证实 Zotero 的 cloneInto 路径会直接抛错，修复完全绕开了它。
- 直接注入依赖阅读器工具栏存在 `.toolbar .custom-sections`（Zotero 10 当前结构）；若上游改名，会回退到 Zotero append，而该路径在当前 Gecko 对 DOM 节点会抛错，控件将不出现（不会影响 Zotero 其他功能）。
- React 重挂载 `.custom-sections` 时会清空子节点，依赖 Zotero 重新派发 `renderToolbar` 事件恢复；该事件本身无去重问题（渲染器仍按 class 检查）。

### 需要手动验证的清单
1. 安装新 `.scaffold/build/interlinear.xpi`，打开一篇 PDF，确认工具栏上三个控件都有可见图标（插件图标、刷新、导出）。
2. 左键插件图标：应开启/停止全文翻译；运行中图标旁显示已完成/总数进度。
3. 右键插件图标：菜单应出现在鼠标位置，含 10 个动作，可切换四种显示模式、导出、打开聊天与设置。
4. 点击刷新按钮应重新翻译；点击导出按钮应弹出导出确认。
5. 关闭并重新打开阅读器后重复上述操作，确认 React 重渲染不会导致按钮重复或失效。


## Step 12：可配置的悬停自动翻译与快捷键单段翻译

### 做了什么
- 补齐原需求 Step 5.3：鼠标在段落上停留可自动翻译该段，停留时长可配置（200–5000 ms，默认 800 ms）；可在设置页单独关闭。滚动、移出段落、按下鼠标、存在非折叠选区或选区弹窗打开时都会取消待触发的悬停翻译。
- 悬停只对 `#sdt-content` 内的 `[data-ref-path]` 段落生效；已存在译文块（等待/加载/完成/错误/暂停）、纯空白或单字符段落会跳过，避免重复失败请求。
- 快捷键单段翻译改为可配置：新增纯函数模块 `src/shortcut.ts`，负责解析、格式化、校验与精确匹配（修饰键必须完全一致）。默认仍为 `Alt+Enter`；拒绝 Escape、重复修饰键、非末尾按键，以及没有 Ctrl/Alt/Meta 的普通字母/数字，避免劫持阅读器输入。设置页提供开关与按键录制输入框（按 Backspace 恢复默认）。
- 设置页新增“单段翻译”区块：悬停开关、停留毫秒数、快捷键开关、快捷键录制框，全部通过 Fluent 中英文案渲染；关闭悬停时停留时间输入框自动禁用。
- 悬停、快捷键与整篇翻译共用 `paragraphRequests` WeakMap：单段触发会复用全文调度中的在途请求；全文调度遇到在途单段请求会等待并优先读取缓存，不会对同一段同时发起两次 HTTP 请求。
- 保留原有 Alt+单击段落、Alt 悬停高亮与划词弹窗行为；`Alt+Enter` 仅在快捷键未被修改时继续生效。

### 改动文件
- 新增：`src/shortcut.ts`、`test/shortcut.node.test.mjs`。
- 修改：`src/readerInteractions.ts`、`src/bilingualReader.ts`、`src/settings.ts`、`src/modules/preferenceScript.ts`、`addon/content/preferences.xhtml`、`addon/prefs.js`、`addon/locale/en-US/addon.ftl`、`addon/locale/zh-CN/addon.ftl`、`test/startup.test.ts`、`package.json`、`README.md`、`CHANGELOG.md`、`typings/i10n.d.ts`、`typings/prefs.d.ts`（后两者构建生成）。

### 测试结果
- `npm run build`：通过（`tsc --noEmit` + scaffold 打包）。
- `npm run lint:check`：通过，无告警。
- `npm run test:unit`：**73 pass / 0 fail**（新增 5 个快捷键解析/匹配用例）。
- `npm run test:review`（Zotero headless 独立 profile）：**35 pass / 0 fail**（新增悬停驻留与可配置快捷键用例；设置默认值与保存用例已扩展）。

### 不确定项
- 悬停默认开启。移动鼠标经过段落会触发单段翻译，首次使用时可能比旧版产生更多按需请求；设置页可关闭或调长延迟。选择默认开启是为了让需求中的悬停行为开箱可见。
- 自动化测试用手动定时器验证驻留逻辑，无法覆盖真实鼠标坐标与 `elementFromPoint` 在高分屏/缩放下的表现；已做几何复核，但仍需真人鼠标验证。
- 快捷键录制在设置窗口中依赖 `KeyboardEvent.key`；不同键盘布局的符号键会被忽略，只接受字母、数字、F1–F12 与少量命名键。
- 交互控制器仍在首次开启对照（`prepareAndRun`）后附加；未开启过双语模式的阅读器不会响应悬停或快捷键（与既有单段交互一致）。

### 需要手动验证的清单
1. 打开 PDF，点击工具栏图标开启对照，把鼠标停在未翻译段落上约 0.8 秒，确认只翻译该段且译文插入正确位置。
2. 在段落间快速移动、滚动页面、按住鼠标或选中文字，确认待触发的悬停翻译被取消，不会误发请求。
3. 设置页关闭“悬停自动翻译”后，重复第 1 步确认不再触发；调长停留时间后确认延迟变化。
4. 设置页点击快捷键输入框，按 `Ctrl+Shift+T`，保存后回到阅读器按该组合键，确认翻译当前悬停/光标所在段落；再按 `Alt+Enter` 确认旧快捷键不再触发。
5. 关闭“启用快捷键翻译”后保存，确认组合键不再触发；按 Backspace 恢复默认并验证 `Alt+Enter` 生效。
6. 开启全文翻译的同时把鼠标停在正在排队的段落上，确认该段只出现一次请求（译文最终一致，无重复错误块）。

