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



## Step 13：补齐剩余需求缺口（重试 / 视口重排 / 术语表替换 / 显示按钮 / 文档）

### 做了什么
- **非阻塞错误提示**：`showError` 不再调用 `alert`，改为在阅读器文档顶部显示可关闭、12 秒自动消失的提示条（`role="alert"`），同时写入 `Zotero.logError`。全文/刷新/设置打开失败与聊天不可用都走该路径；同一文档重复出错只更新文本，不堆叠提示条。
- **失败段落点击重试**：译文块在 `error` / `paused` 状态下显示“点击重试该段翻译”提示，并具备 `role="button"`、`tabIndex=0`。单击或按 Enter/Space 会找到前一个原文段落并复用单段翻译流程；若用户正在选中错误文本复制，则不会触发重试。状态切换到 loading/done 时自动移除按钮语义与提示。
- **视口动态重排**：全文队列从一次性 `packBatchItems` + 游标改为 `remaining` 集合 + `claimNextJob()`；每次领取任务前重新读取剩余段落相对视口的位置并排序。小文档（≤120 段）每次领取都重排；大文档最多每 400 ms 测量一次，避免反复布局测量拖慢队列。
- **术语表结果替换**：新增 `applyGlossaryToTranslation()`，按最长术语优先、单次正则替换、拉丁术语加 ASCII 词边界、大小写不敏感，支持正则特殊字符与 `$` 目标文本；源与目标相同的条目跳过。`translateText` 在所有后端返回后统一调用，因此 Google 也能保证术语一致。
- **Google 缓存键**：`getCacheEngineTag()` 的 Google 分支补上 `:g:<hash>`，术语表变化会使 Google 缓存失效；对术语表条目增加按原文文本的模块级缓存，避免每段重复解析 CSV。
- **显示模式工具栏按钮**：工具栏新增 `◫` 按钮，单击按“译文在下 → 左右并排 → 仅译文 → 仅原文”循环，`title/aria-label` 随当前模式更新；右键仍打开完整菜单。清理阅读器时一并移除该按钮。
- **文档与说明**：设置页三种 API 密钥说明明确写出“以明文形式保存在 Zotero 偏好设置中”；README 英文部分补全功能、安装、配置、限制、致谢与许可证，中文限制改为“可配置语言对”；新增 `docs/RELEASE-CHECKLIST.md` 汇总版本、自动化、隐私、Zotero 手测与发布步骤；CHANGELOG 补充本轮功能。

### 改动文件
- 新增：`docs/RELEASE-CHECKLIST.md`。
- 修改：`src/bilingualReader.ts`、`src/readerInteractions.ts`、`src/settings.ts`、`src/glossary.ts`、`addon/locale/en-US/addon.ftl`、`addon/locale/zh-CN/addon.ftl`、`test/startup.test.ts`、`test/glossary.node.test.mjs`、`README.md`、`CHANGELOG.md`、`typings/i10n.d.ts`（构建生成）。

### 测试结果
- `npm run build`：通过（`tsc --noEmit` + scaffold 打包）。
- `npm run lint:check`：通过，无告警。
- `npm run test:unit`：**76 pass / 0 fail**（新增 3 个术语替换用例）。
- `npm run test:review`（Zotero headless 独立 profile）：**38 pass / 0 fail**（新增视口重排、非阻塞提示、失败块重试用例；工具栏与 Google 用例已扩展）。

### 不确定项
- 视口重排依赖 `getBoundingClientRect()`；真实 Zotero 阅读模式中懒加载页面可能先返回 0 高度，段落会在后续领取时再次测量并纠正顺序，但短时间内可能仍按旧顺序发出 1–2 个请求。
- 点击重试会替换错误文本；若用户想复制错误信息，需在按下鼠标拖选后直接复制，单击会触发重试（代码会检测非折叠选区并跳过）。
- 术语表替换对拉丁术语使用严格词边界，“gene”不会替换“genes”内部；如需覆盖词形变化，应在术语表中显式添加复数形式。
- 非阻塞提示条固定在阅读器内容顶部；真实阅读器缩放或全屏下的位置与主题对比度尚未人工截图确认。
- 显示按钮使用 `◫` 字符；若系统字体缺少该字形，可能显示为方框，需实机确认。

### 需要手动验证的清单
1. 制造一次翻译失败（例如断网或填错端点），确认没有阻塞弹窗，阅读器顶部出现提示条；点击 × 可关闭，12 秒后自动消失。
2. 让某段翻译失败或触发连续失败暂停，点击该译文块或聚焦后按 Enter，确认只重试该段；选中错误文本后单击不应触发重试。
3. 开启全文翻译后立即滚动到文末，确认后续请求优先翻译当前可见段落；再滚回开头，确认顺序随视口变化。
4. Google 后端下导入 `gene,基因` 与 `neural network,神经网络`，确认返回英文中的术语被替换；修改术语表后确认缓存重新生成（不会复用旧译文）。
5. 点击工具栏 `◫` 按钮四次，确认四种模式依次切换、标题同步更新、Zotero 高亮坐标不偏移。
6. 在设置页查看 OpenAI/Claude/Gemini 密钥说明，确认包含“明文形式保存在 Zotero 偏好设置中”。
7. 按 `docs/RELEASE-CHECKLIST.md` 完整走一遍手动验收。


## Step 14：还原阅读器图标，并在侧边栏聊天页内加入“功能与设置”面板

### 做了什么
- 工具栏图标改为直接使用插件自带的 `addon/content/icons/icon32.png`：生成 `src/interlinearIcon.ts`（base64 data URI 常量），运行期用 16×16 的 `<img>` 渲染，外观与提供的 Logo 像素一致。阅读器文档基准 URL 是 `resource://zotero/reader/...`，`chrome://` 图片地址在其中无法加载；data: 图片可正常显示。
- 针对右键菜单在用户机器上仍无响应的问题，在右侧边栏已有的 Interlinear 聊天页顶部新增可折叠的“功能与设置”面板（不占用阅读器工具栏）。面板提供：开启/停止对照、刷新译文、取消翻译、导出 PDF、打开设置，以及四种显示模式下拉框。
- 面板按钮先通过 `findReaderForItem` 定位当前条目对应的阅读器再执行动作；没有打开的阅读器时点击不产生副作用。文案经 Fluent 渲染，其余按钮复用既有 `toolbar-menu-*` 词条。
- 合并 dev 的 Step 13 时，把新增的 `◫` 显示按钮从“节点级监听 + createToolbarButton 扩展参数”改为既有的 document 级委托（`registerToolbarHandlers`），与开关/刷新按钮保持一致；避免在真实阅读器中再次依赖不可靠的节点监听。
- 集成测试同步更新：图标断言改为 `img` + `data:image/png;base64,` 前缀 + 16px 尺寸；侧边栏 section 的 `bodyXHTML` 断言新增 7 个控件 ID；保留并验证显示按钮的循环切换断言。

### 改动文件
- 新增：`src/interlinearIcon.ts`（由图标生成的 base64 常量）。
- 修改：`src/bilingualReader.ts`、`src/chatPane.ts`、`addon/locale/en-US/addon.ftl`、`addon/locale/zh-CN/addon.ftl`、`typings/i10n.d.ts`、`package.json`（lint 文件列表）、`test/startup.test.ts`、`test/readerToolbar.test.ts`、`docs/PROGRESS.md`。

### 测试结果
- `npm run build`：通过（`tsc --noEmit` + scaffold 打包）。
- `npm run lint:check`：通过，无告警。
- `npm run test:unit`：**76 pass / 0 fail**。
- `npm run test:review`（Zotero headless 独立 profile）：**38 pass / 0 fail**。
- 另用临时探针在真实 Zotero 阅读器中以原生鼠标事件复核：document 捕获阶段能收到指向插件按钮的 `contextmenu`，菜单节点可见且可命中；该探针为排查用途，验证后已删除。

### 不确定项
- 右键菜单在自动化环境（真实阅读器 + 原生事件）中可见可用，但在用户机器上仍无反应，根因尚未定位；侧边栏面板是兜底入口，不代表右键问题已修复。
- 侧边栏面板依赖 ItemPaneManager 的自定义 section 渲染；Zotero 升级若调整该 API 需要回归。
- 图标以 16px 渲染 32px 源图，没有单独的 HiDPI 2x 素材；高分屏下可能略软。
- 面板沿用既有的按条目查找阅读器逻辑；条目同时被多个窗口打开时只会操作最先找到的阅读器。

### 需要手动验证的清单
1. 重新安装新的 `interlinear.xpi` 并重启 Zotero，打开 PDF：工具栏图标应与插件 Logo 完全一致。
2. 打开右侧边栏 Interlinear 页面，点击顶部“功能与设置”，确认面板展开且五个按钮与显示模式下拉框可见。
3. 在有打开阅读器的条目上依次点击开启/停止、刷新、取消、导出、设置，并切换四种显示模式，确认行为与工具栏一致。
4. 在未打开阅读器的条目上打开侧边栏页面并点击面板按钮，确认不报错。
5. 再次右键工具栏图标，确认在你的环境中是否仍然无反应，以便决定是否需要继续排查。
6. 点击工具栏 `◫` 显示按钮，确认四种模式仍能循环切换（合并后改走 document 委托）。

---

## Step 15：设置页易用性、取色器/字体预设、分栏对齐与悬停修复

### 做了什么
- **设置页结构**：新增 `addon/content/preferences.css` 并在 `hooks.ts` 的 `Zotero.PreferencePanes.register` 中注册。顶部固定“保存”操作栏（状态文本 + 未保存提示）、六个区块的快速导航（服务 / 显示 / 外观 / 范围 / 术语表 / 维护），页面底部保留第二个保存按钮。任何控件发生 `input`/`change` 后显示“有未保存的更改”，保存成功后清空。
- **颜色全部改为取色器 + 色块**：译文颜色、背景、下划线颜色、色带颜色改用原生 `<input type="color">`，旁边提供 8 个圆形快捷色块；前三种颜色增加“跟随主题”复选框（勾选时禁用取色器并保存为空值），色带颜色提供“恢复默认”。旧值若是 3 位/8 位 hex、`rgb()` 或命名色，打开设置时通过临时元素计算为 `#rrggbb` 再填入取色器；保存时仍经过 `normalizeAppearance` 校验。
- **字体预设**：新增继承、Georgia、Times New Roman、Arial、微软雅黑、宋体六个预设按钮，仍保留手动输入框；当前值对应的预设高亮。
- **连通测试反馈**：Google / OpenAI / Claude / Gemini / Ollama 的测试按钮旁新增状态行，区分运行中、成功（附返回文本）、警告（Ollama 缺少模型 / 未返回模型列表）与失败（附具体错误），失败不再只写日志。
- **左右分栏对齐**：分栏模式下把原文的 `margin-block-start` 归零、译文块的 `padding-top` 归零，消掉译文比原文高出一行的问题；源节点位置不变，注释区间不受影响。
- **悬停/快捷键生命周期**：交互控制器不再只从 `prepareAndRun` 附加。工具栏渲染时立即调用 `watchReaderInteractions`，只要阅读器出现 `#sdt-content` 就附加监听；同时监听阅读器外层文档的 iframe `load`（捕获阶段）并做 0/150/500/1500/3000 ms 有界重试，覆盖“先打开阅读器、之后才开启阅读模式”和分栏第二视图后创建的情况。
- **悬停判定**：`elementFromPoint` 返回 `null`（标注遮罩、页缝、透明层）不再被当成“指针已离开”；同一段内只有指针移动超过 6px 才重新开始停留计时；窗口失焦会取消待触发计时。单段触发首次运行时按需安装译文样式、显示模式与高亮对齐观察器，避免在未翻译的阅读器上做无谓的布局观察。
- **测试**：设置页集成用例改断言取色器类型、默认色（`#333333` / `#f6f6f6` / `#c7354a`）、跟随主题复选框、8 个色块与字体预设；悬停用例新增“同段小幅移动不重新计时、明显移动才重新计时”；分栏单元用例新增顶部外边距/内边距归零断言。

### 改动文件
- 新增：`addon/content/preferences.css`。
- 修改：`addon/content/preferences.xhtml`、`addon/locale/en-US/addon.ftl`、`addon/locale/zh-CN/addon.ftl`、`typings/i10n.d.ts`、`src/hooks.ts`、`src/modules/preferenceScript.ts`、`src/displayMode.ts`、`src/readerInteractions.ts`、`src/bilingualReader.ts`、`README.md`、`CHANGELOG.md`、`test/startup.test.ts`、`test/displayMode.node.test.mjs`、`docs/PROGRESS.md`。

### 测试结果
- `npm run build`：通过（`tsc --noEmit` + scaffold 打包）。
- `npm run lint:check`：通过，无告警。
- `npm run test:unit`：**76 pass / 0 fail**。
- `npm run test:review`（Zotero headless 独立 profile）：**38 pass / 0 fail**。
- 期间曾因早期监听器提前调用 `observeReadingLayout` 导致两条原生高亮布局回归用例失败（“Without the fix, the cached highlight stays behind” 与重绘次数 4≠3）；改为只在真正发生单段翻译时按需安装布局观察器后恢复通过。

### 不确定项
- 分栏首行对齐按 CSS 盒模型修正，已在单元/集成断言中覆盖；真实 Zotero 的字体度量与主题仍建议人工看一眼。
- 悬停修复覆盖了已定位的四个原因（未附加监听、`elementFromPoint` 空命中、同段移动重置计时、失焦后触发），但无法在 headless 自动化中复现用户机器的真实鼠标路径；若仍无效，需要用户说明阅读模式是否已开启、悬停开关与延迟设置。
- 取色器只接受 `#rrggbb`；旧命名色在设置页会显示为解析后的 hex，保存后可能由命名色变为 hex（显示等价）。
- 字体预设依赖本机已安装字体；缺失时由 CSS 字体栈回退，效果取决于系统。
- 色块按钮使用 `background-color`，在高对比度主题下可能对比不足。

### 需要手动验证的清单
1. 打开设置页：确认顶部保存栏、区块导航、未保存提示与底部保存按钮都在；修改任意输入后提示出现，保存后消失。
2. 依次操作四个颜色控件：点快捷色块与取色器，确认译文立即变化；勾选“跟随主题”后取色器变灰，保存后阅读器跟随 Zotero 主题；色带“恢复默认”恢复为 `#c7354a`。
3. 点击各字体预设，确认译文块字体变化；手动输入其他字体名仍可保存。
4. 对每个后端点击“测试连接”：确认按钮旁出现运行中、成功、警告或失败及具体原因；失败时页面不再毫无反馈。
5. 切换到左右分栏，确认英文与中文首行齐平，不再出现译文高一行。
6. 不先点击工具栏开启全文对照：在阅读模式中直接悬停一个段落，确认到达停留时间后翻译；按住 Alt 按快捷键确认同样可用。
7. 快速划过多个段落、在段落内小幅移动、滚动页面、切换到其他窗口，确认不会误触发；在分栏的另一侧重复悬停，确认同样生效。

---

# UI 打磨任务（feat/ui-polish 分支）

从 `af6fed3` 新建 `feat/ui-polish`，提交前缀 `ui:` / `fix:`。范围：工具栏开关、设置页颜色控件/实时预览/字体排版、全面自查、文档同步；不新增翻译功能、不动 Providers/chat。每子步骤跑 `npm run build`、`npm run lint:check`、`npm run test:unit`、`npm run test:review`（Zotero headless 独立 profile，安全 no-op kill），如实记录。

## Step A：阅读器工具栏按钮改为「显示/隐藏/暂停」开关

### 做了什么
- **纯状态机** `src/readerToggle.ts`（无 DOM、无 Zotero）：6 状态 `empty | running | shown | shown-paused | hidden | hidden-paused`，8 事件 `toggle | shortcut | refresh | run-finished | run-paused | run-cancelled | paragraph-translated | reset`，7 效果 `start-run | resume-run | pause-run | hide | show | mark-paused | clear-translations`。`transition(state,event)` 查表返回 `{state,effects}`；`refresh` 恒返回 `running + [clear-translations,show,start-run]`，`reset` 恒回 `empty`。辅助谓词 `isTranslationVisible/isTranslationHidden/isRunActive`。同步效果在 dispatch 内执行，异步效果（start/resume/clear）由调用方编排。
- **每个阅读器独立状态**：`toggleStates` WeakMap 按 reader 存状态。`getToggleState` 对非 empty/running 状态做 reconcile——若 SDT 文档已无译文块（阅读器重渲染/换文档/重开）则回退 empty，避免脏状态。
- **隐藏 ≠ 清除**：`setTranslationsHidden(reader,true)` 删除 `#sdt-content` 的 `data-interlinear-display` 并置 `data-interlinear-hidden="true"`；因为所有显示模式 CSS 都以 `data-interlinear-display` 为作用域，移除该属性即恢复原生布局（含左右分栏的 margin/inline-block 全部还原），译文块与结果、缓存仍留在 DOM。`installStyles` 增加 `[data-interlinear-hidden="true"] .interlinear-translation{display:none}`。显示时反向操作并按 `getDisplayMode()` 重写模式属性。**隐藏/显示都不改保存的 displayMode 偏好**。两次操作后都显式 `refreshReadingLayout(doc)`（布局 MutationObserver 不监听 data-* 属性），触发原生高亮坐标重算。
- **运行中点击 = 暂停 + 隐藏**：`running + toggle → hidden-paused + [pause-run,hide]`；`pause-run` 复用 `cancelRun`（递增 generation + 取消令牌）并把 loading 块置 paused，已完成段落保留。再次点击 `hidden-paused + toggle → running + [show,resume-run]`，`prepareAndRun` 经 `collectParagraphs` 命中缓存、`ensureTranslationBlock` 复用相邻兄弟块，只重跑未完成段落。修复复用路径：兄弟块若有缓存译文但状态非 done，补置 done（避免续跑时显示旧的 paused 文案）。
- **隐藏期间的交互**：悬停自动翻译暂停（`readerInteractions` 新增 `isTranslationHidden` 选项，在 arm 与驻留计时触发两处都 gate）；划词弹窗仍可用；快捷键/Alt 单段触发会先 `dispatchToggle(reader,"shortcut")` 把阅读器切回显示再翻译该段（`hidden + shortcut → shown+[show]`，`hidden-paused + shortcut → shown-paused+[show]`，即只揭示不续跑全文）——此为有意决策，已记录。
- **按钮状态可视**：`updateToolbarProgress` 写 `aria-pressed`（visible 为 true），active 时用中性半透明填充 `rgba(127,127,127,0.28)` + 4px 圆角（浅/深主题都可辨），不重绘图标；title/aria-label 随状态切换：running→「翻译中…（n/m）」、hidden-paused→「显示译文并继续翻译」、hidden→「显示译文」、shown/shown-paused→「隐藏译文（显示原文）」、empty→原文案。新增 3 个 Fluent 键（en/zh 同步）。
- **右键菜单精简为 4 项**：重新翻译全文、取消翻译（仅 running 时启用）、导出双语 PDF、打开设置。移除菜单里的显示模式切换、开关、阅读助手项（显示模式仍可由工具栏 `◫` 按钮与侧边栏下拉切换；聊天仍在侧边栏）；删除 `revealChatPane()` 与 `toolbar-menu-chat`/`toolbar-menu-chat-unavailable` 两个 FTL 键（保留 `toolbar-menu-toggle`，侧边栏 chatPane 仍用）。
- **生命周期接线**：`finishRun`→`run-finished`；`cancelBilingualReading`→`run-cancelled`；worker 死对象中止与连续失败暂停→`run-paused`；单段翻译成功（缓存命中与新请求两条路径）→`paragraph-translated`；`refreshBilingualReading`→`refresh`；`cleanupBilingualReader` 删除 toggleStates。错误统一经 `reportToggleError`（跳过死对象/取消，否则 reset + 非阻塞 showError）。
- **顺带修一个无关的测试隔离 bug（`fix:` 性质）**：`test:review` 用持久 profile（`.scaffold/test/profile`），其 `prefs.js` 残留 `user_pref("…gemini.model","gemini-2.5-pro")`（由 provider 设置保存用例写入并被「恢复到 previous」自我延续）。「通过 Gemini 翻译」用例从不显式设 model，依赖默认 flash，于是确定性失败（期望 flash 收到 pro）。根因是该用例隐式依赖环境偏好；修复为在用例内显式 `set(modelPref,"gemini-2.5-flash")` 并在 finally 恢复 previous，使其不受 profile 污染影响。此 bug 与开关功能无关，Step A 代码不触碰 gemini 偏好。

### 改动文件
- 新增：`src/readerToggle.ts`、`test/readerToggle.node.test.mjs`（42 个纯函数用例）。
- 修改：`src/bilingualReader.ts`、`src/readerInteractions.ts`、`addon/locale/en-US/addon.ftl`、`addon/locale/zh-CN/addon.ftl`、`package.json`（lint 与 test:unit 列表）、`test/startup.test.ts`（显示模式/进度取消/菜单用例改写 + 新增 `reader toggle` 4 用例 + Gemini 用例隔离修复）、`test/readingLayout.test.ts`（新增隐藏/再显示高亮对齐回归用例）、`typings/i10n.d.ts`（构建生成）。

### 测试结果
- `npm run build`：通过（`tsc --noEmit` + scaffold 打包）。新增 FTL 键后先 `npx zotero-plugin build` 重新生成 typings，否则 tsc 报未知 Fluent ID。
- `npm run lint:check`：通过，无告警。
- `npm run test:unit`：**118 pass / 0 fail**（新增 42 个状态机用例：逐 transition 表驱动、refresh/reset 全状态、两条生命周期序列、谓词真值表）。
- `npm run test:review`（Zotero headless 独立 profile）：**43 pass / 0 fail**。新增 `reader toggle` 4 用例（运行中暂停保留已完成并只续跑未完成、双阅读器独立、Alt 点击揭示隐藏译文且不重发已完成块、隐藏时 gate 悬停）+ readingLayout 隐藏/再显示高亮对齐用例（断言对齐误差 <2、存储 PDF 坐标 rects[0][1] 恒为 690 不变）。
- 诚实记录：首次 `test:review` 为 **42 pass / 1 fail**，失败项是上述 Gemini 用例（profile 残留 pro）；定位为测试隔离 bug 并修复后，**带着同一污染 profile 复跑仍 43 pass**，证明修复对泄漏状态稳健。此前会话另观察到一次 `npm test` 首跑「Expected: undefined / Received: undefined」的偶发失败、复跑即绿，未再复现，按偶发记录而非已修复 bug。

### 不确定项 / 未目视验证
- 按钮 active 半透明填充在 Zotero 真实浅/深主题下的观感：**未目视验证**（headless 只断言 aria-pressed 与内联样式值）。
- 隐藏后原生布局（尤其左右分栏 margin/列宽）的像素级还原：**未目视验证**（只断言 display 属性移除、hidden 属性置位、源节点 isConnected、模式 CSS 作用域）。
- 隐藏/再显示后原生高亮在真实 PDF 上的对齐：**未目视验证**（集成断言对齐误差与存储坐标不变，非真实论文逐页截图）。
- 隐藏期间快捷键/Alt 单段「先揭示再翻译该段」为有意决策；若用户期望隐藏时单段也保持隐藏，需另行调整。
- 运行中点击暂停复用 cancelRun，在途 XHR 不被物理中止，响应靠 isCurrentRun 丢弃；与既有取消行为一致。

### 我需要手动在 Zotero 里验证的清单
1. 打开英文 PDF，点工具栏图标开启对照。预期：译文出现，按钮呈 active 态（半透明底），title 为「隐藏译文（显示原文）」；浅/深主题都清晰可辨。
2. 译文显示时再点图标。预期：所有译文隐藏、恢复原生排版（若之前是左右分栏，margin/列宽完全还原），按钮 title 变「显示译文」；已翻译结果与缓存保留。
3. 隐藏后再点图标。预期：译文立即重现（命中缓存、不发新请求），title 回「隐藏译文（显示原文）」；高亮坐标不偏移。
4. 全文翻译运行中点图标。预期：暂停并隐藏，已完成段落保留、未完成块变「已暂停」，title 变「显示译文并继续翻译」；再点一次只续跑未完成段落（已完成段不重发请求）。
5. 右键图标。预期：菜单仅 4 项（重新翻译全文 / 取消翻译 / 导出双语 PDF / 打开设置）；未运行时「取消翻译」为禁用态。
6. 隐藏状态下把鼠标停在未翻译段落。预期：不触发悬停自动翻译；但划词弹窗仍可用；按快捷键或 Alt 点击某段会先揭示译文再翻译该段。
7. 打开两个 PDF 标签各自切换。预期：两个阅读器开关状态互不影响；关闭再重开同一 PDF 后按钮回到未翻译初始态。
8. 在左右分栏模式下加一条高亮，再隐藏/显示译文。预期：高亮矩形始终覆盖原文文字、位置不偏移，批注侧栏可正常跳转。

## Step B：可复用颜色控件（文字/背景/下划线/色带）

### 做了什么
- **纯函数先行（TDD）**：`src/appearance.ts` 新增 `normalizeHexInput`（接受 `#RGB`/`#RRGGBB`，可省略 `#`，统一展开并转成大写 6 位；非法返回 null）、`hexToRgb`、WCAG 相对亮度与 `contrastRatio`（非 hex 输入返回 null，结果保留两位小数）、`meetsContrastAA`（阈值常量 `CONTRAST_AA_MIN = 4.5`）、`resolveEffectiveColor(stored, theme, role)`（显式值优先；继承时 light/dark 解析为调色板色，auto 返回空串以便预览显示棋盘格）。`readerColors` 重构为复用 `resolveEffectiveColor`，行为不变。先写 8 个 Node 用例看其失败再实现，appearance 单测共 27 个全绿。
- **可复用控件**：`preferenceScript.ts` 用 `ColorControlConfig` 表 + `initColorControl(doc, config)` 统一构建 4 个颜色控件（文字/背景/下划线/色带），删除旧的 `setColorControl`/`bindInheritToggle`/`renderColorPresets` 与通用 `COLOR_PRESETS`。**取色器（`input type=color`）仍是唯一持久化来源**：`readColorControl` 不变，保存读 `picker.value`，十六进制输入只是双向同步的显示层。
  - **真实颜色预览方块**：每个控件一个 `…-preview`，`refreshColorUI` 用 `resolveEffectiveColor` 解析当前表单态（取色器值 + 继承勾选 + 主题）得到有效色；有效色为空（auto+继承）时显示棋盘格 + 「继承 / 透明」文字说明，否则填实色。下划线继承时跟随文字有效色；色带恒为已存值。
  - **继承禁用 + 说明**：继承选项单独成行（`…-inherit-row`），勾选时禁用取色器、十六进制输入与全部预设，并显示一行解释文字（`…-inherit-help`，Fluent）。
  - **十六进制双向同步**：输入合法值即时归一化并写回取色器（小写 `#rrggbb`）、显示层转大写、解除继承；非法值不写取色器，失焦时显示内联错误（`…-error`）并回退到取色器当前值，**不写偏好**。校验全部走 `normalizeHexInput`。
  - **预设分用途**：文字 8 色（保持集成断言）、背景 6 色、强调色（下划线/色带）8 色；每个预设是实心圆点，`title`/`aria-label` 为「本地化颜色名 (hex)」，选中态用 `data-active` + outline 环标记，禁用态降透明度。容器标题按用途取 `appearance-text/background/accent-preset-title`。
  - **统一恢复默认**：每个控件一个 `…-reset` 按钮（色带沿用原 id `interlinear-appearance-ribbon-color-reset`），文字/背景/下划线重置为继承（空值），色带重置为默认蓝 `#2f6fdf`。
  - **非阻塞对比度警告**：`interlinear-appearance-contrast-warning`，仅当文字与背景都为显式值且 `contrastRatio < 4.5` 时显示带比值的通知（Fluent 变量 `{ $ratio }`），否则隐藏；不弹窗、不阻断保存。
  - **主题联动**：主题下拉 `change` 即时 `refreshColorUI`，继承态预览随浅/深主题解析。
- **标记与样式**：`preferences.xhtml` 4 个颜色块改为 `html:div.interlinear-color-control` 卡片（主行：标签/预览/取色器/十六进制/恢复默认；继承行；预设；错误；帮助），背景块后新增对比度警告元素。`preferences.css` 全部作用域于 `#interlinear-settings-root`，新增预览（含 `repeating-conic-gradient` 棋盘格）、十六进制（等宽大写）、恢复默认按钮、继承说明、内联错误、对比度警告与预设选中环/禁用样式，复用既有 CSS 变量。
- **Fluent en/zh 同步**：新增 `appearance-color-reset`、`appearance-color-hex-label`、`appearance-color-hex-invalid`、`appearance-color-preview-inherit`、`appearance-contrast-warning`（含 `$ratio`）、三个继承说明、三个预设容器标题、16 个 `color-name-*`；移除被取代的 `appearance-color-preset-title` 与 `appearance-ribbon-color-reset`，并澄清四个颜色帮助文案提到十六进制与恢复默认。`fillAppearanceLabels` 补齐 reset/inherit-help 映射，色带 reset 改指共享键。

### 改动文件
- 修改：`src/appearance.ts`、`src/modules/preferenceScript.ts`、`addon/content/preferences.xhtml`、`addon/content/preferences.css`、`addon/locale/en-US/addon.ftl`、`addon/locale/zh-CN/addon.ftl`、`test/appearance.node.test.mjs`（+8 用例）、`test/startup.test.ts`（外观用例补新元素只读断言 + 新增 1 个交互用例）、`typings/i10n.d.ts`（构建生成）。

### 测试结果
- `npm run build`：通过。新增 FTL 键后先 `npx zotero-plugin build` 重新生成 typings 再 tsc。
- `npm run lint:check`：通过，无告警。
- `npm run test:unit`：**126 pass / 0 fail**（appearance 27 个，含新增 8 个纯函数用例）。
- `npm run test:review`（Zotero headless 独立 profile）：**44 pass / 0 fail**。新增交互用例在真实 Zotero 偏好窗口验证：合法 hex 同步到取色器并解除继承、非法 hex 失焦报错并回退并不改取色器、恢复默认回到继承禁用态、`#777777`/`#ffffff`（4.48:1）触发对比度警告而 `#000000`/`#ffffff`（21:1）清除、主题切深色时继承文字预览解析为 `rgb(232,232,232)`、切回 auto 恢复棋盘格。原外观保存用例仍绿（取色器为唯一持久化来源，直接设 `picker.value` 后保存读值不变）。

### 不确定项 / 未目视验证
- 预览棋盘格 + 「继承 / 透明」文字在真实浅/深主题下的可读性、预设选中环与卡片间距观感：**未目视验证**（headless 只断言 `data-inherit`、内联背景色与文案）。
- `repeating-conic-gradient` 在 Zotero（Firefox 115 内核）渲染：API 自 Firefox 83 起支持，理论可用，但**未目视验证**实际棋盘格效果。
- 十六进制输入 `text-transform: uppercase` 仅为视觉大写，值本身已归一化为大写；与取色器小写 `#rrggbb` 并存属预期（保存读小写取色器值）。
- 对比度警告只对 hex 颜色计算；若历史偏好里存了命名色/rgb（非 hex），`contrastRatio` 返回 null 因而不警告——保守行为，非 bug。

### 我需要手动在 Zotero 里验证的清单
1. 打开设置→译文外观。预期：四个颜色各成一张卡片，含预览方块、取色器、十六进制框、恢复默认按钮；继承选项单独成行并带说明。
2. 文字颜色默认「跟随主题」勾选。预期：取色器/十六进制/预设均禁用，预览显示棋盘格 + 「继承 / 透明」；把主题切到深色，预览变为深主题文字色（浅灰）。
3. 取消继承，在十六进制框输入 `#abc`。预期：取色器同步为 `#AABBCC`、预览显示该实色、对应预设若匹配则出现选中环；输入 `zzz` 后失焦，出现红色内联错误并回退到上一个合法值，偏好不被改写。
4. 点某颜色「恢复默认」。预期：文字/背景/下划线回到继承禁用态，色带回到默认蓝。
5. 文字设 `#777777`、背景设 `#ffffff`（均取消继承）。预期：出现非阻塞对比度警告（约 4.48:1，低于 4.5）；把文字改 `#000000` 警告消失；保存不被阻断。
6. 点预设圆点。预期：取色器与十六进制同步、继承解除、选中环标记当前色；悬停有放大、title 显示「颜色名 (hex)」。
7. 保存后重开设置。预期：显示值 = 存储值 = 有效色一致；切主题再切回，继承预览正确解析。
8. 切换 Zotero 浅/深主题与中英文语言。预期：卡片、棋盘格、警告、预设名案均正确本地化且对比度可读。

## Step C：译文外观实时预览卡片

### 做了什么
- **预览卡片**：`preferences.xhtml` 在「译文外观」groupbox 顶部（标题之后）新增 `html:div.interlinear-appearance-preview-card`，含本地化标题 `…-preview-label`、预览宿主 `html:div#interlinear-appearance-preview`、帮助文案 `…-preview-help`。卡片用既有 CSS 变量描边内边距，预览区 `background: Canvas; color: CanvasText`。
- **样式隔离（Shadow DOM）**：`initializeAppearancePreview` 对宿主 `attachShadow({ mode: "open" })`，在 shadow 内放一个 `<style>` 与一个 `id="sdt-content"` 的内容容器（一段 `.interlinear-source` 原文 + 一段 `.interlinear-translation` 译文，演示文案取自 Fluent）。**选 Shadow DOM 而非 iframe 或全局作用域**的原因：阅读器样式表会注入 `#sdt-content` 等全局选择器，若预览直接写在偏好页 light DOM，`buildDisplayModeCSS` 的 `#sdt-content[…]` 规则会泄漏并影响偏好页其它元素；Shadow DOM 把这套选择器封闭在预览内部，零泄漏，同时 `Canvas`/`CanvasText` 系统色仍透过宿主继承 Zotero 主题（与划词弹窗同一保守做法），无需 iframe 的额外文档与加载开销。
- **复用真实样式构建器（不抄样式）**：`refreshAppearancePreview` 用当前表单值调用 `buildTranslationCSS("interlinear-translation", appearance, "reader")` + `buildDisplayModeCSS("interlinear-translation", "interlinear-source", appearance.paragraphSpacing)` 写入 shadow 的 `<style>`，并把 `normalizeDisplayMode` 结果写到内容容器的 `data-interlinear-display`。因此预览与阅读器/导出用的是**同一份纯函数 CSS**，左右分栏等模式即时反映；译文块 `lang` 跟随 `getTargetLanguage()`。
- **表单读取单一来源**：新增 `readAppearanceForm(doc)` 汇总全部外观字段；`saveSettings` 重构为 `setAppearance(readAppearanceForm(doc))`，预览与保存读同一函数，保证「所见即所存」。
- **即时刷新 wiring**：`registerPrefsScripts` 在 `initializeAppearancePreview` 后刷新一次；`refreshColorUI` 末尾调 `refreshAppearancePreview`（覆盖预设圆点点击——它不冒泡 input/change）。其余字段靠**文档级** `input`/`change` 委托刷新。
- **调试中定位的根因（重要）**：最初把委托监听挂在 `#interlinear-settings-root` 上，预览不随字号等字段更新。逐步诊断（在 CSS 里临时打 DIAG 标记观察 refresh 是否触发及读到的值）发现：**`interlinear-settings-root` groupbox 在第 65 行就闭合，只包含标题/简介/操作栏/导航；各功能 section（含外观第 542 行）是它的兄弟节点而非后代**，所以 root 级监听收不到表单事件。颜色控件之所以正常，是因为它们把监听直接绑在各自元素上。修复：预览委托改挂 `doc`（Document 是所有 section 的祖先），input/change 冒泡到文档即刷新。集成用例由红转绿。

### 改动文件
- 修改：`src/modules/preferenceScript.ts`（`readAppearanceForm`/`initializeAppearancePreview`/`refreshAppearancePreview`、`refreshColorUI` 调用、`saveSettings` 重构、文档级委托 wiring、`fillAppearanceLabels` 预览文案映射）、`addon/content/preferences.xhtml`（预览卡片）、`addon/content/preferences.css`（预览卡片/宿主/帮助样式）、`addon/locale/en-US/addon.ftl`、`addon/locale/zh-CN/addon.ftl`（`appearance-preview-label/help/source/target`）、`test/startup.test.ts`（新增 1 个实时预览集成用例，先写看其失败）、`typings/i10n.d.ts`（构建生成）。

### 测试结果
- `npm run build`：通过（修复 `createElementNS` 返回 `Element` 无 `dataset` 的 TS 报错，将译文块 cast 为 `HTMLElement`）。
- `npm run lint:check`：通过，无告警。
- `npm run test:unit`：**126 pass / 0 fail**。
- `npm run test:review`（Zotero headless 独立 profile）：**45 pass / 0 fail**。新增用例在真实偏好窗口验证：宿主存在 open shadow root，内含 `<style>`/`#sdt-content`/`.interlinear-source`/`.interlinear-translation`；字号改 24 触发 input 后样式含 `font-size: 24px;`；显示模式切 side-by-side 触发 change 后样式含对应 `#sdt-content[data-interlinear-display="side-by-side"]` 规则且容器属性同步；文字勾选继承 + 主题切 dark 后样式含 `color: #e8e8e8;`。该用例先写并看其失败（root 委托不触发），修复后转绿。

### 不确定项 / 未目视验证
- 预览卡片在真实浅/深主题下的观感、`Canvas`/`CanvasText` 是否如预期跟随 Zotero 主题、shadow 内演示段落间距与左右分栏比例：**未目视验证**（headless 只断言 shadow 结构与生成的 CSS 文本）。
- Shadow DOM `mode: "open"` 在 Firefox 115 内核可用（长期标准 API），`Canvas`/`CanvasText` 系统色透过 shadow 宿主继承亦为标准行为；保守选用，但**未目视验证**深色实际渲染。
- 预览演示文案为固定中英示例（en/zh 两 locale 同值），不随界面语言切换示例文本本身——属预期（示例展示排版，非翻译结果）。
- **留给 Step E 的候选 bug**：`registerDirtyTracking(doc, root)` 同样把 change/input 挂在 `#interlinear-settings-root`，因 section 是兄弟节点，表单字段改动可能不会触发「未保存」脏标记（部分 handler 如 engine change 显式调 `markDirty` 除外）。本步未改它以免扩大范围；Step E 审计时确认并改为文档级委托。

### 我需要手动在 Zotero 里验证的清单
1. 打开设置→译文外观。预期：顶部出现「实时预览」卡片，内有一段原文 + 一段译文，样式与阅读器一致（色带、字号、行距）。
2. 改字号/行距/段距。预期：预览即时变化，无需保存；预览区背景跟随 Zotero 浅/深主题。
3. 把显示模式切到「左右分栏」。预期：预览立即变成原文左、译文右两栏；切回上下对照恢复。
4. 文字勾选继承并把主题切深色。预期：预览译文文字变浅灰（`#e8e8e8`）、背景变深；取消继承选实色后预览用该色。
5. 点颜色预设圆点。预期：预览即时更新（预设点击不冒泡 input，靠 `refreshColorUI` 驱动）。
6. 保存后重开设置。预期：预览呈现的值 = 刚保存的值（预览与保存共用 `readAppearanceForm`）。
7. 确认预览样式没有泄漏到偏好页其它区域（导航/其它 section 排版不受 `#sdt-content` 规则影响）。
8. 切换 Zotero 中英文与浅/深主题。预期：预览标题/帮助本地化，演示段落与系统色对比度可读。

## Step D：设置页字体排版与布局（D1/D2/D3）

### 做了什么
- **D1 修复语言行溢出与标签换行**：原文/译文语言原本共用一个 hbox（标签 180px + 两个 220px 下拉 + 间距，总宽 ≥650px），在 ~600px 宽度下「译文语言」标签换行并出现右缘截断。拆成两个独立 hbox，各含 `min-width:180px` 标签 + 220px 下拉，与其它行一致。先写集成用例断言两个下拉的 `parentElement` 不同且译文标签带 `min-width`，看其失败后再改。
- **D2 字体选择器下拉**：把旧的字体预设圆点按钮换成一个 `select#interlinear-appearance-font-select`，选项为：继承、系统无衬线、衬线（Georgia）、等宽、自定义…。自定义项选中时展开隐藏行（`#interlinear-appearance-font-custom-row`），其中 `#interlinear-appearance-font-family` 文本输入仍是唯一持久化值，并在 input/blur 时用 `isValidFontFamily` 做内联错误提示（`#interlinear-appearance-font-family-error`），不合法的 CSS 分词不写偏好。**Gecko 字体枚举结论**：Firefox 115 无 `queryLocalFonts`（Chromium 专有、需权限），Zotero 也未向插件暴露枚举 API，**不确定** → 按任务约定改用精选跨平台字体堆栈列表，不枚举本机字体。纯函数先行（TDD）：`appearance.ts` 新增 `FONT_CUSTOM_VALUE`、`FONT_STACK_PRESETS`（继承 + 跨平台 sans/serif/mono，全部通过 `normalizeFontFamily`）、`resolveFontSelection`（把已存堆栈映射回匹配预设/继承/自定义）、`isValidFontFamily`（空或安全分词为真）；新增 5 个 Node 用例先红后绿。每个预设选项用自身字体渲染（`option.style.fontFamily`），**在 Gecko 下拉菜单内的效果未目视验证**。
- **D3 排版/单位/焦点/粘性保存栏/a11y**：`preferences.css` 新增：①顶部操作栏 `position: sticky; top:0; z-index:3; background: Canvas; color: CanvasText`，滚动时保存按钮保持可达且不透明；②统一 `:focus-visible` 焦点环（button/select/input/textarea/a[href]，`outline: 2px solid Highlight; offset:2px`）；③标题层级（h2 1.5em / h3 1.15em）；④字段 label `white-space: nowrap` 防换行；⑤`.interlinear-unit` 行内单位后缀样式。xhtml 为 6 个数字输入补单位后缀 span：字号(px)、段距(em)、跳过末页(pages)、请求间隔(ms)、请求超时(ms)、最大字符(chars)；Fluent 新增 `unit-ms/px/em/chars/pages`（en/zh），`fillStaticLabels` 补 6 条映射。导航 chip 本就是 `<button>`，键盘可操作，焦点环由统一规则覆盖。**两栏网格**：现有「固定 `min-width:180px` 标签 + 弹性控件」已等同两列布局，未整体改写为 CSS grid（XUL `hbox` 与 grid 兼容性未验证、且无法目视验证，保守不冒险）。
- **清洁**：删除被下拉取代的字体预设按钮相关代码（`fontPresetKey`/`syncFontPresetState`/`renderFontPresets`、`FONT_PRESETS`、`.interlinear-font-presets`/`.interlinear-font-preset` CSS、旧 `appearance-font-preset-*` Fluent 键），无遗留死代码。

### 改动文件
- 修改：`src/appearance.ts`（字体预设纯函数）、`src/modules/preferenceScript.ts`（`initFontSelector`/`validateFontInput`/`clearFontError`、`fillStaticLabels` 单位与自定义标签映射、`fillAppearanceLabels`）、`addon/content/preferences.xhtml`（语言两行、字体下拉 + 自定义行、6 个单位后缀 span）、`addon/content/preferences.css`（粘性操作栏、焦点环、标题层级、label 不换行、单位样式、删除旧预设样式）、`addon/locale/en-US/addon.ftl`、`addon/locale/zh-CN/addon.ftl`、`test/appearance.node.test.mjs`（+5 用例）、`test/startup.test.ts`（语言行回归用例、字体选择器用例、单位后缀断言、保存用例改用下拉）、`typings/i10n.d.ts`（构建生成）。

### 测试结果
- `npm run build`：通过。新增 FTL 键后先 `npx zotero-plugin build` 重新生成 typings。
- `npm run lint:check`：通过，无告警。
- `npm run test:unit`：**131 pass / 0 fail**（新增字体选择纯函数 5 个）。
- `npm run test:review`（Zotero headless 独立 profile）：**47 pass / 0 fail**。新增/更新用例验证：语言两下拉分属不同父行且译文标签带 min-width；字体下拉选 Georgia 写入隐藏输入、选「自定义」展开自定义行、非法堆栈失焦报错、合法后清空错误；单位后缀非空；原保存用例改用下拉后仍正确保存 `Georgia, serif` 并生成对应 CSS。

### 不确定项 / 未目视验证
- 粘性保存栏在 Zotero 偏好页实际滚动容器（可能是 richlistbox/browser 而非文档滚动）中是否真正吸顶：**未目视验证**；若不生效仅退化为普通操作栏，无功能损失。
- `option.style.fontFamily` 让每个字体选项以自身字体显示，在 Gecko 原生下拉菜单中的实际效果：**未目视验证**（部分平台忽略 option 字体）。
- `label { white-space: nowrap }` 在超长本地化标签或极窄窗口下可能撑宽行：**未目视验证**；当前字段标签均较短。
- `Highlight`/`Canvas`/`CanvasText` 系统色在浅/深主题下的对比与观感：**未目视验证**。
- 未整体改为 CSS grid 两栏（保守），现有 hbox + min-width 标签已达两列效果。

### 我需要手动在 Zotero 里验证的清单
1. 设置→服务。预期：原文语言、译文语言各占一行，标签不换行、右缘无截断；窗口缩到 ~600px 也不横向溢出。
2. 设置→译文外观→字体。预期：下拉含「继承/系统无衬线/衬线(Georgia)/等宽/自定义…」；选预设立即改变预览；选「自定义…」出现输入行。
3. 自定义输入 `Arial; color:red` 后失焦。预期：出现红色内联提示、不写入非法值；改成 `Georgia, serif` 提示消失。
4. 数字输入右侧显示单位（像素/em/毫秒/字符/页）。预期：中英文各自本地化（如「像素」「毫秒」）。
5. 设置页滚动。预期：顶部保存栏吸顶，始终可点保存；底部保存按钮仍可用。
6. 键盘 Tab 遍历。预期：按钮/下拉/输入/导航 chip 均有清晰焦点环，Enter/Space 可激活导航 chip 滚动到对应区块。
7. 切换浅/深主题。预期：粘性栏背景不透明、文字可读、焦点环可见。
8. 打开/关闭「自定义」后再保存重开。预期：已存字体正确回显到下拉（匹配预设或回落到自定义并展开输入）。

## Step E：全面自查（设置页 / 阅读器状态 / 错误处理 / 本地化）

### 做了什么
- **修复：表单修改不触发「未保存」提示**。`registerDirtyTracking` 原先把 change/input 委托挂在 `#interlinear-settings-root`，而各功能 section 是它的兄弟节点（Step C 已定位的同一根因），绝大多数字段改动不会点亮保存提示。先写集成用例（清空提示 → 改字号并派发 input → 断言提示非空）看其失败，再把监听改挂 `doc` 后转绿（commit `42d644c`）。
- **设置模型逐项核对**：`preferences.xhtml` 的 min/max/step 与 `settings.ts` 的读写 clamp 完全一致——请求间隔 0–5000、并发 1–3、最大字符 500–8000、批量段数 1–12、连续错误 1–20、超时 5000–300000、跳过末页 0–50、悬停延迟 200–5000；外观字号 10–32、行高 1–2.5（存储 ×100 → 100–250）、段距 0–3（×100 → 0–300）。越界值在读取与写入两侧都会被夹回，不依赖表单校验。
- **术语表链路**：`applyGlossaryToTranslation(result.text, getGlossaryEntries())` 在 `bilingualReader.ts:221` 对所有引擎的译文统一做后替换（含 Google）；缓存键通过 `getCacheEngineTag()` 携带目标语言 + 术语表哈希，命中后仍会重放替换，术语改动不会读到过期缓存。缓存标签不含 API key、endpoint 密钥或原文。
- **「保存后立即应用」核实**：`saveSettings` 末尾调用 `refreshTranslationStyles()` + `refreshDisplayModes()`，对已打开阅读器重刷样式与显示模式；集成用例 “should save appearance settings and re-apply them to open readers” 覆盖。工具栏开关/悬停/快捷键等由 getter 实时读取，下一次交互即生效，无需重开阅读器。
- **主题与本地化**：en-US / zh-CN Fluent 键 **311 ↔ 311 完全对齐**，`preferenceScript.ts` 里 `getString` 引用的键在 en 全部存在；`src/` 中的中文字面量仅限 LLM 提示词、术语表表头别名、旧译文错误识别正则与分句标点，均非界面文案。语言切换按 Zotero 约定需重启应用，未做运行时热切换。深/浅主题依赖 `Canvas`/`CanvasText`/`Highlight` 系统色与外观主题调色板。
- **多阅读器隔离与泄漏**：开关状态、交互控制器、错误提示分别用 `WeakMap` 按 reader/doc 键控；交互监听在 `controller.dispose()` 中成对移除（mousemove/mouseleave/mouseup/click/keydown/mousedown/scroll + window blur）；重试定时器均为有界数组并在重新调度/清理时 `clearTimeout`；插件关闭时 `unregisterReaderToolbar()` 清空 reconcile 定时器、注销 `renderToolbar` 监听、清理全部 reader 状态与工具栏节点，`unregisterChatPane()` 同步注销。未发现常驻轮询或跨 reader 共享的可见状态。
- **错误处理与密钥**：五个连通测试全部 catch 后写入 running/success/warning/error 状态（不会抛未处理 rejection）；译文请求失败走阅读器内非阻塞提示（既有集成用例覆盖）；`src/` 无任何 `console.*`/`Zotero.debug`/`dump`，密钥仅出现在 Authorization / x-api-key / x-goog-api-key 请求头，Gemini 明确不进 URL，错误详情只截取响应体 200 字符；设置页三个密钥输入为 `type="password"`，帮助文案写明「明文存储于 Zotero 偏好，不写入日志或缓存标签」。

### 改动文件
- 修改：`src/modules/preferenceScript.ts`（`registerDirtyTracking` 改文档级委托）、`test/startup.test.ts`（新增脏标记集成用例）。
- 仅审查未改：`addon/content/preferences.xhtml`、`settings.ts`、`readerToolbar.ts`、`bilingualReader.ts`、`appearance.ts`、`readerUI.ts`、`chatPane.ts`、`translationCache.ts`、两份 `addon.ftl`。

### 测试结果
- `npm run build`：通过。
- `npm run lint:check`：通过，无告警。
- `npm run test:unit`：**131 pass / 0 fail**。
- `npm run test:review`（Zotero headless 独立 profile）：**48 pass / 0 fail**。新增脏标记用例先红后绿；既有用例覆盖主题预览、颜色控件、字体校验、保存后重应用、单阅读器隔离、多阅读器独立开关、非阻塞错误提示、密钥不泄漏。

### 待我决定
1. **导出流程仍使用阻塞式 `alert`/`confirm`**（`src/readerUI.ts:38–49` 的 `showMessage`/`confirmMessage`，导出成功、失败与「继续导出？」三类调用）。建议：成功/失败改为阅读器内非阻塞提示（已有 `showErrorNotice` 基建可复用）；「是否继续导出」属于需要用户确认的破坏性操作，可保留 `confirm` 或改成一个内联确认条。**理由**：全文翻译失败已是非阻塞，导出仍弹系统对话框，交互不一致；但改确认语义会改变现有导出流程，故留作决定。
2. **非法自定义字体保存时静默回落为「继承」**：`setAppearance` 经 `normalizeAppearance` 会把非法字体栈存成空串，保存状态仍显示成功。建议保存前校验并阻止/明确提示；目前输入/blur 已有内联错误，属于低风险润色。
3. **设置页重复加载的监听器叠加（不确定）**：若同一偏好窗口内多次触发 pane load，`doc` 级 input/change 监听会重复注册（效果为多次刷新预览/重复 markDirty，无功能破坏，窗口关闭即释放）。未加去重守卫，因为去重会导致再次打开面板时不重新回填外部变更的设置。**不确定** Zotero 10 的实际 pane 生命周期，留待真机观察。
4. **版本号重置**（0.5.1 → 0.1.0/1.0.0）仍待定。

### 无法目视验证
- 本次没有可用的 Zotero UI 无头截图通道（测试运行器只断言 DOM/CSS 文本，不产出偏好页截图）：控件观感、粘性保存栏、深色主题对比度、原生下拉内字体预览、焦点环与键盘遍历均为**未目视验证**。
- `WeakMap` 状态在真实 reader 关闭后由 GC 回收的时机、偏好窗口重复加载的监听叠加行为：**未目视验证**（代码审查结论，运行时未观测）。

### 我需要手动在 Zotero 里验证的清单
1. 打开设置，改任意一个数字/下拉但不保存。预期：顶部出现黄色「未保存」提示；点保存后提示消失。
2. 底部保存按钮与顶部保存按钮各点一次。预期：都显示保存成功，且无需滚动回顶部就能保存。
3. 打开一篇已翻译的 PDF，再改设置里的译文字号/行高/主题并保存。预期：已打开的阅读器立即变化，无需关闭重开。
4. 配好 API key 后逐个点「测试连接」。预期：按钮短暂禁用并显示“测试中”，随后显示成功（含示例译文）或失败原因；失败不弹系统对话框。
5. 在阅读器里制造一次翻译失败（如断网）。预期：阅读器内出现非阻塞错误提示（不弹系统 alert），提示可关闭，重试后恢复。
6. 打开两个阅读器，分别切换显示/隐藏。预期：两个阅读器状态互不影响；关闭其一后另一个仍可正常翻译。
7. 切换 Zotero 界面语言（重启后）与浅/深主题。预期：设置页所有标签/帮助/状态文案完整本地化、无英文残留，深色下文字与控件可读。
8. 用键盘 Tab / Shift+Tab 遍历设置页。预期：焦点环清晰，所有按钮、导航 chip、下拉与输入框均可键盘操作。

## Step F：文档与发布说明同步

### 做了什么
- **README（英文 + 简体中文）同步为当前真实行为**：
  - 工具栏：主按钮由「点击翻译/再点清除」改为「开关」语义——首次点击开始全文翻译，之后显示/隐藏译文；运行中点击暂停并隐藏，再次显示时继续未完成段落；每个阅读器状态独立。新增独立「显示模式」按钮循环四种布局。
  - 右键菜单按代码实际项描述：重新翻译、取消、导出双语 PDF、翻译设置（不再声称菜单里有布局/聊天）。
  - 阅读助手改为从阅读器侧边栏打开；导出入口写明在工具栏菜单。
  - 外观项改为「实时预览 + 字体选择器（跨平台字体栈 + 自定义）+ 取色器/色块（文字/背景/下划线/色带）」。
  - 配置页说明补充：区块跳转、外观实时预览、滚动时可见的保存栏、未保存提示；连通测试描述为「测试中/成功/失败原因」。
- **CHANGELOG**：新增 `## [Unreleased]`，按 Added/Changed/Fixed 记录工具栏开关、实时预览、字体选择器、可复用颜色控件、设置页导航/粘性保存栏/单位/焦点环/未保存提示，以及两处修复（全字段脏标记、译文语言标签换行）。0.5.1 历史条目保持原样。
- **截图占位**：两份 README 在导航链接后加入 HTML 注释占位，列出待补拍的三张图（工具栏开关、设置页实时预览、左右分栏）与目标路径 `docs/images/`，不插入破图。
- **未实现功能检查**：README 功能条目逐条对照代码（五后端、四布局、单段四种触发、全文/取消/重试、术语表、聊天、导出、外观、缓存、双语 UI）；路线图仍明确标注「计划中」，未把计划项写成已实现。

### 改动文件
- 修改：`README.md`、`README-zh-CN.md`、`CHANGELOG.md`。

### 测试结果（纯文档变更，代码未动）
- `npm run build`：通过。
- `npm run lint:check`：通过，无告警。
- `npm run test:unit`：**131 pass / 0 fail**。
- `npm run test:review`（Zotero headless 独立 profile）：**48 pass / 0 fail**。

### 未完成 / 需人工补拍
- 三张 README 截图仅留占位注释，实际截图需在干净 Zotero 10 profile 中人工拍摄后放入 `docs/images/` 并替换注释为图片链接。
- README 中「保存栏滚动时保持可见」依据 CSS `position: sticky` 实现，实际吸顶效果**未目视验证**（见 Step D）。
