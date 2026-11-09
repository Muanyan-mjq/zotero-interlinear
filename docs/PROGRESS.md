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
