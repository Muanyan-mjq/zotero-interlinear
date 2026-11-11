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

## Step G：设置页重做（五标签页、样式作用域修复、功能补全）

### 做了什么
- **根因修复：整页 CSS 从未生效**。`preferences.css` 全部规则以 `#interlinear-settings-root` 为作用域，但该 groupbox 只包住标题、保存栏和导航；所有功能区块都是它的兄弟节点，因此卡片、字段、颜色控件、状态点、焦点环等样式在真实页面里全部落空。现在把整个设置页（hero、隐私提示、保存栏、标签栏、全部 section、页脚）收进 `#interlinear-settings-root`，并用 `.interlinear-page` 统一宽度与内边距；集成用例新增 `root.contains(appearance-section)` 与卡片 `border-top-width > 0` 断言，防止回退。
- **五标签页**：服务 / 显示与交互 / 译文外观 / 术语表 / 高级。`SETTINGS_TABS` + `data-tab` + `data-engine` 统一控制可见性：section 必须属于当前标签，provider section 还必须是当前引擎。标签支持鼠标、`ArrowLeft/Right`、`Home/End` 与 roving tabindex；切换后滚动到该标签第一个可见 section，并遵守 `prefers-reduced-motion`。
- **信息架构**：原 11 个区块按用途重新分组。服务页含后端、语言、当前 provider；显示页含布局与单段翻译；外观页含实时预览、排版和颜色；术语表独立；高级页含范围、速度、缓存、关于与项目链接。保存栏与标签栏合并为一个 sticky 容器，滚动时一起吸顶。
- **视觉重做**：统一卡片、字段两栏网格（154px 标签 + 弹性控件）、帮助文字、按钮/输入/下拉、状态点、警告徽标、颜色控件与预览；状态颜色只用于圆点/徽标，正文始终用 `CanvasText`，保证深色主题可读。所有交互控件有 `:focus-visible` 焦点环；窄窗口（≤640px）字段改为单列；减少动态效果时关闭过渡。
- **功能补全**：
  - 自定义字体非法时不再静默回退为「继承」：保存时保留上一字体、回填输入框与下拉、清空内联错误，并在保存状态显示黄色警告（新增 FTL 键 `appearance-font-family-invalid-save`）。
  - OpenAI 兼容 / Claude / Gemini 的 API 密钥新增「显示 / 隐藏」按钮（`aria-pressed`），避免盲输。
  - 移除设置页里重复的 `h2 Interlinear`：Zotero 自己会在 pane 顶部插入 h1，保留它作为唯一页面标题；插件图标与简介放在其下。版本号移入页脚 `Interlinear v0.5.1 · AGPL-3.0-or-later · 基于 quillamio/bilingual-reader`。
  - 删除旧 `settings-nav-*` 与 `interlinear-save-bottom` 相关代码/文案，避免双份维护。
- **测试**：新增 3 个集成用例（五标签切换与 CSS 生效、非法字体保存保留旧值、API 密钥显示/隐藏）；语言行用例从「内联 min-width」改为「独立 field 行 + 标签不换行」，与新的网格布局一致。

### 改动文件
- 重写：`addon/content/preferences.xhtml`、`addon/content/preferences.css`。
- 修改：`src/modules/preferenceScript.ts`、`src/hooks.ts`（品牌图标插入 hero slot）、`addon/locale/en-US/addon.ftl`、`addon/locale/zh-CN/addon.ftl`、`test/startup.test.ts`、`README.md`、`README-zh-CN.md`、`CHANGELOG.md`、`docs/dev/PROGRESS.md`、`typings/i10n.d.ts`（构建生成）。

### 测试结果
- `npm run build`：通过。
- `npm run lint:check`：通过，无告警。
- `npm run test:unit`：**131 pass / 0 fail**。
- `npm run test:review`（Zotero headless 独立 profile）：**51 pass / 0 fail**。
- 另用 `.scaffold/ui-preview.html`（静态近似页，非构建产物）在 Playwright 下以 900px 宽分别截图浅色与深色主题，检查卡片、字段对齐、标签、颜色控件与警告的布局；截图在本地 `.scaffold/`，未纳入仓库。

### 对 Step E「待我决定」的回应
1. 导出流程仍使用阻塞式 `alert`/`confirm`：**未改**，属于阅读器侧交互，不在本次设置页范围内。
2. 非法自定义字体保存时静默回退：**已修复**（保留旧字体 + 警告）。
3. 重复加载的监听器叠加：`registerPrefsScripts` 仍以 `root.dataset.initialized` 提前返回，同一文档不会重复注册；未额外改造 pane 生命周期。
4. 版本号：仍为 0.5.1，未在本步改动版本策略。

### 不确定项 / 未目视验证
- 真实 Zotero 设置窗口中的最终观感**未截图**：headless 测试只断言 DOM、计算样式与交互，Playwright 截图基于静态近似页，不能完全代表 Zotero 的 XUL 布局与滚动容器。
- `position: sticky` 在 Zotero 偏好页实际滚动容器中的吸顶效果**未目视验证**；若不生效，保存栏与标签栏会退化为普通顶部栏，功能不受影响。
- `color-mix()`、`text-wrap: pretty/balance`、`accent-color` 在 Zotero 10 的 Gecko 中按标准支持，但**未逐项真机确认**；不支持的声明会被忽略，不会破坏布局。
- 标签切换调用 `scrollIntoView({behavior:"smooth"})`，在部分 XUL 滚动容器中可能只滚动到 section 顶部；已加 `scroll-margin-top:112px` 预留 sticky 高度。
- 深色主题依赖 `Canvas`/`CanvasText` 系统色；状态色只用于小圆点/徽标，正文对比度按系统色保证，但**未在真实 Zotero 深色主题下目视**。
- 未在真实 Zotero 中测试键盘 Tab 顺序与标签箭头键；集成测试只覆盖 DOM 结构与可见性。

### 需要手动在 Zotero 里验证的清单
1. 打开设置→Interlinear：确认只有一个页面标题（Zotero 的 h1），下方是插件图标 + 简介、隐私提示、保存栏和五个标签。
2. 点击五个标签：每次只显示对应 section；服务页只显示当前引擎的 provider 卡片；标签切换后页面滚动到该标签开头；←/→/Home/End 可切换标签。
3. 滚动设置页：保存栏与标签栏吸顶且背景不透明；修改任意字段出现「有未保存的更改」，保存后消失。
4. 服务页：切换五种后端，确认 provider 卡片随之切换；点「测试连接」确认状态点与文字；点密钥旁的「显示 / 隐藏」切换明文，焦点回到输入框。
5. 外观页：改字号、字体、行高、段距、主题、四个颜色控件，确认预览即时更新；「跟随主题」时预览为棋盘格而非挤压文字；对比度低于 4.5 时出现警告。
6. 字体选择「自定义…」输入 `Arial; color: red` 后保存：确认弹出黄色警告、字体保留原值、输入框回填，而不是静默变成「继承」。
7. 高级页：确认范围、速度、缓存、关于与 GitHub 链接都在；缓存统计与清除可用。
8. 窄窗口（约 600px）：字段变单列、标签不换行、页面无横向滚动；键盘 Tab 遍历所有控件有清晰焦点环。
9. 切换 Zotero 浅/深主题与中英文：确认卡片、帮助文字、状态点、警告与页脚均可读，无残留英文/中文。

# 外观自定义 v2（feat/appearance-v2）

## 基线

- 从 `feat/ui-polish` @ `a1e687b`（ui: rebuild the settings pane as five tabs）切出 `feat/appearance-v2`。
- 基线测试：`npm run build` 通过，`npm run lint:check` 通过，`npm run test:unit` 131 pass，`npm run test:review` 51 pass。
- 本任务不 push、不改 remote、不改写历史、不合并分支；每个 Step 单独提交。
- 本仓库 `npm test` 会使用默认/开发 profile；实际使用 `npm run test:review`（Zotero headless + 独立 profile）作为集成测试入口，避免影响正在运行的 Zotero。

## Step 1：设置页顶部与标签栏重做

### 标签页的来历（先读代码后的结论）

- 标签页是在本轮之前的 **Step G**（`feat/ui-polish` 的 `a1e687b`）引入的：把原 Step 15/D 的“快速跳转”芯片（`.interlinear-nav-button`，点击 `scrollIntoView`）替换为五个 `role=tab` 按钮，并用 `data-tab` 控制 section 显隐。
- “快速跳转”芯片是 Step 15（`856940f`）加入的页内导航，只有服务/显示/外观/范围/术语表/维护六个入口，与页面实际 11 个区块顺序不一致，且 `速度与稳定性`、`单段翻译` 等区块没有入口。
- Step G 同时**删除**了 `interlinear-speed-section` 底部的第二个“保存设置”按钮（`interlinear-save-bottom`），只保留顶部保存按钮。当前代码与测试都不再引用底部按钮。
- 因此本次不是“新造标签页”，而是重做 Step G 的顶部：把保存按钮从左侧大红色主按钮改为右侧 Zotero 原生强调色按钮，把标签改为左侧、保存与状态右侧的紧凑吸顶工具栏。

### 做了什么
- **顶部工具栏**：`.interlinear-sticky` 内改为 `.interlinear-toolbar` 单行：左侧标签（可横向滚动、不折行溢出），右侧状态文字 + 未保存提示 + 保存按钮。窄窗口（≤640px）时操作区换到第二行并右对齐。
- **原生按钮**：查证 Zotero 10 设置页 CSS（`chrome/content/zotero-platform/win/preferences.css`）后使用其变量：`--accent-blue`、`--accent-white`、`--fill-quinary/quarternary/senary`。保存按钮为 28px 高、4px 圆角、字重 400、`--accent-blue` 背景；品牌红只保留在 section 标题前的 6px 小方块。无法确认这些变量在所有 Zotero 主题下都存在，因此全部带 fallback（`#4072e5` 等）。
- **标签**：字重 500；选中态只保留 2px 下划线（不再同时灰底）；悬停用极浅的 `--fill-senary`；左右方向键/Home/End 已存在并保留；窄窗口横向滚动。
- **状态四态**：
  - `saved`：✓ + “所有更改已保存”（初始与保存成功恢复后的默认态）。
  - `dirty`：小圆点 + “有未保存的更改”；对应标签按钮显示小圆点（`data-dirty`）。
  - `success`：✓ + “已保存”，2.5 秒后自动回到 `saved`。
  - `error`：! + “保存失败：原因”；保存抛错时保留 dirty 状态，不清理标签红点。
  - 颜色只用于图标/圆点，文字始终 `CanvasText`；对比度不依赖颜色。
- **保留表单值与滚动位置**：切换标签不重建表单，DOM 值原样保留；每个标签的滚动位置存 `WeakMap<Document, Map<tab, scrollTop>>`，切换时保存旧标签、在下一 tick 恢复新标签。离开有未保存更改的标签时，在顶部显示 4 秒非阻塞提示“切换标签页不会丢弃未保存的更改”，并保留标签红点。
- **保存错误处理**：`saveSettings` 改为返回 warning 列表；点击保存时 try/catch。成功显示短暂“已保存”，非法字体/快捷键等 warning 显示 5 秒黄色状态，异常显示带 detail 的失败状态。

### 改动文件
`addon/content/preferences.xhtml`、`addon/content/preferences.css`、`src/modules/preferenceScript.ts`、`addon/locale/en-US/addon.ftl`、`addon/locale/zh-CN/addon.ftl`、`test/startup.test.ts`、`typings/i10n.d.ts`（构建生成）、`docs/dev/PROGRESS.md`。

### 测试结果
- `npm run build`：通过。
- `npm run lint:check`：通过。
- `npm run test:unit`：131 pass / 0 fail。
- `npm run test:review`（等价集成测试，独立 profile）：51 pass / 0 fail；新增的脏标记用例断言 `dirty` 状态、标签红点、切换标签后的非阻塞提示与返回后仍为 dirty。

### 不确定项 / 无法目视验证
- 无法在本机用 headless 截图证明 Zotero 设置页的真实观感；Step 8 会尝试 `canvas.drawWindow`，若失败会明确写“无法目视验证”。
- `--accent-blue`/`--fill-*` 变量在 Zotero 10 的浅/深主题下是否都定义：已查证 Windows 平台 `preferences.css` 有定义，但其他平台/主题未逐一确认；已提供 fallback。
- 标签横向滚动条在 Gecko 设置页中的实际宽度与触控板表现未目视。
- 滚动位置恢复依赖 `doc.scrollingElement` 或 `window.scrollTo`；若 Zotero 用内层 `browser` 滚动，`scrollTop` 可能无效，届时表现为不恢复滚动位置（不影响表单值）。

### 我需要手动在 Zotero 里验证的清单
1. 打开设置→Interlinear：顶部应为紧凑单行，左侧五个标签，右侧状态 + 保存；保存按钮是 Zotero 原生蓝色，不再是整块品牌红。
2. 修改任意字段：状态变为“有未保存的更改”+ 小圆点，对应标签出现小圆点；切换标签时出现非阻塞提示，值不丢失，切回后仍是 dirty。
3. 在长页面（外观/高级）滚到中部，切到另一个标签再切回：滚动位置应恢复；若未恢复，记录 Zotero 窗口宽度与滚动容器。
4. 点保存：成功状态显示“已保存”约 2.5 秒后回到“所有更改已保存”；把字体输入改成非法值再保存，应显示黄色 warning 而不是成功。
5. 用键盘聚焦标签，按 ←/→/Home/End：焦点与选中态同步；Tab 键可到达保存按钮。
6. 把窗口缩到约 600px：标签可横向滚动、不溢出；状态文字不被截断，操作区换行到第二行。
7. 切换 Zotero 浅/深主题：保存按钮、状态图标、标签下划线与文字对比度可读。

## Step 2：字体系统重做（P1）

### 起点与接手范围

- Claude Code 完成了 `src/appearance.ts` 的字体模型、CSS 构造器，以及 XHTML 里的字号模式/字重/斜体/行距/方向等控件骨架；`src/modules/preferenceScript.ts` 的 `readAppearanceForm` 在替换后一度编译失败，字体列表/检测/字体栈 UI 全部未完成。
- 本步补齐：纯字体目录与检测模块、收藏与检测缓存、搜索式字体列表、字体栈构建器、始终可见的高级 CSS 输入、自动语言字体栈、字重/斜体/字距/相对字号、文字方向、阅读器 `dir` 属性、缓存键回归测试。
- 默认值仍为“继承阅读器字体”，因此默认 CSS 输出与 Step 1 前一致；只有用户显式选择字体或字重等属性时才追加声明。

### 字体目录与检测（纯函数）

- 新增 `src/fontCatalog.ts`（无 import，供 Node 类型剥离直接加载）：232 个候选字体，覆盖 Windows/macOS/Linux 的 Latin、简体/繁体中文、日文、韩文、阿拉伯、希伯来、泰文、天城文、等宽与系统别名；每个候选带 `group`（sans/serif/mono/zh/ja-ko/other）与 `script`。
- 检测方式：`canvas.measureText` 对同一段文字分别测量 `monospace`、`serif`、`sans-serif` 三个基线，与候选字体宽度比较；差值 > 0.5px 视为已安装。这是 Firefox 115 没有本地字体枚举 API 时的替代方案，不依赖指纹接口。
- 检测按 24 个候选一块、`setTimeout(0)` 分片执行，不阻塞设置页；结果写入 `appearance.fontDetection` 缓存（版本 1、30 天 TTL、最多 512 条），再次打开直接使用缓存；“重新扫描”强制重测。
- “显示全部候选”开关在检测不可用或被防指纹策略抹平时仍可浏览/选择全部字体；未检测到的行加 `data-undetected="true"` 与警告图标，只警告不阻止保存。
- 字体名验证与 `appearance.ts` 规则一致（`\p{L}\p{N}` 开头、字母/数字/空格/点/下划线/连字符、≤80 字符、拒绝 `url()`/`expression`/控制字符）；因 Node 单测无法解析无扩展名 TS import，`fontCatalog.ts` 内联了一份同规则验证器，并在单测里用 `appearance.ts` 的验证器交叉核对全部候选。

### 字体 UI

- 搜索框 + 显示全部 + 检测状态（`role=status`，`aria-live=polite`）+ 重新扫描。
- 列表按“阅读器默认 / 收藏 / 无衬线 / 衬线 / 等宽 / 中文 / 日韩 / 其他”分组；每行用自身字体渲染样张（CJK 用中文/日文/韩文样张），行内提供“设为主字体 / 收藏 / 加入回退”。
- 顶部固定项：继承阅读器字体、系统无衬线、系统衬线、系统等宽。
- 字体栈：主字体 + 最多 6 个有序回退 + 一个 generic 兜底；chip 支持上移/下移/移除，修改后立即写入高级输入并刷新预览。
- 高级 CSS `font-family` 输入始终可见且可编辑；非法内容保留在输入框中并显示行内错误，保存时给出黄色 warning、保留上一份有效字体，不清空用户输入。
- 收藏写入 `appearance.fontFavorites`（最多 24 个、去重、大小写不敏感），收藏操作立即持久化但不把设置页标脏。

### 文本属性与方向

- 字重 100–900（默认 400）、斜体开关、字距 −0.05–0.3em（默认 0）、字号模式 px（10–32，默认 16）或 em 比例（0.9–1.2，默认 1）。
- 文字方向 auto/ltr/rtl：auto 按目标语言判断 RTL（ar/he/fa/ur 等）；阅读器译文块写入 `dir` 属性，CSS 使用 `text-align: start`，切换设置后对已打开的阅读器同步更新 `dir`。
- 目标语言专属默认字体栈（autoFontByLanguage，默认开）：CJK/阿拉伯/希伯来/泰文/天城文各给跨平台栈；用户显式选择的字体栈优先于语言默认栈。

### 缓存键

- 抽出 `src/translationCacheKey.ts`（无 import 纯函数），缓存键只含引擎标记、itemKey、源文本长度/哈希、目标语言；新增 Node 回归测试，断言外观字段从未进入缓存模块（源码扫描），并验证相同翻译输入键稳定、四类输入变化会改变键。
- 因此改字体/颜色/字距/方向不会触发重新翻译，只重新应用 CSS。

### 改动文件

`src/fontCatalog.ts`（新）、`src/translationCacheKey.ts`（新）、`src/appearance.ts`、`src/settings.ts`、`src/bilingualReader.ts`、`src/translationCache.ts`、`src/modules/preferenceScript.ts`、`addon/content/preferences.xhtml`、`addon/content/preferences.css`、`addon/locale/en-US/addon.ftl`、`addon/locale/zh-CN/addon.ftl`、`test/fontCatalog.node.test.mjs`（新）、`test/translationCacheKey.node.test.mjs`（新）、`test/startup.test.ts`、`package.json`、`typings/i10n.d.ts`（构建生成）。

### 测试结果

- `npm run build`：通过。
- `npm run lint:check`：通过（修掉两处 `no-control-regex`，等价改用 `\p{Cc}`，未放宽验证）。
- `npm run test:unit`：149 pass / 0 fail（字体目录 13 项 + 缓存键 5 项为新增）。
- `npm run test:review`（Zotero headless，独立 profile）：52 pass / 0 fail。新增用例覆盖：非法高级字体保存保留旧值并 warning、字体列表/搜索/收藏/字体栈、字体检测与缓存、显示全部时未检测字体标记。
- 检测可靠性记录（Gecko 115 / Windows / headless Zotero）：232 个候选中测得 40 个，列表行数与缓存条目数完全一致；虚构字体 `__InterlinearNoSuchFont__` 未出现；常用 Arial/Georgia/Consolas/微软拼音字体族按预期被识别。若用户开启 `privacy.resistFingerprinting` 导致测量被抹平，界面会显示检测失败/空结果，但仍可通过“显示全部候选”手选。

### 不确定项 / 未目视验证

- 未在真实 Zotero 设置窗口中目视字体列表高度、滚动与 sticky 分组标题；headless 只断言 DOM 与状态。
- `canvas.measureText` 在开启防指纹的 Gecko 中可能让所有字体宽度相同，检测会返回空；该场景只做了降级设计，未在开启 `privacy.resistFingerprinting=true` 的 Zotero 中实测。
- 列表样张是否真的以对应字体渲染，取决于系统是否安装该字体；未安装时浏览器回退到 generic，属预期行为。
- 字体栈最多 6 个回退是硬限制，超出时“加入回退”按钮无反馈（当前实现直接忽略），是否需要提示留待 Step 8 评估。

### 我需要手动在 Zotero 里验证的清单

1. 打开设置→外观：字体列表应自动扫描并显示检测状态；等待结束后列表只显示已装字体，点击“显示全部候选”能看到未装字体且带 `?` 警告标记。
2. 搜索 `Georgia`：列表过滤到对应行，行内样张用 Georgia 渲染；清空搜索恢复分组列表。
3. 点击某字体的星标：该字体出现在“收藏”分组顶部；关闭再打开设置页后收藏仍在。
4. 点击某字体行：主字体 chip 出现，高级输入同步为 CSS 栈；用 `+` 加两个回退，再用 ↑/↓/× 调整/删除，预览即时变化。
5. 在高级输入里输入 `Arial; color: red`：出现行内错误；点保存后出现黄色警告、字体保留上一份有效值，输入框回填有效值。
6. 字重选 700、勾选斜体、字距 0.1、字号模式 em 1.1：预览与已打开阅读器的译文块同步变化；改回默认后样式恢复。
7. 目标语言切到阿拉伯语（或手动把方向设为 RTL）：译文块文字右对齐、标点位置正确；切回中文/英文恢复 LTR。
8. 修改任意字体/颜色设置后，已翻译的文档不应重新请求翻译；观察网络面板或缓存命中状态确认。

## Step 3：颜色系统重做（P1）

### 做了什么
- **数据模型**：`AppearanceSettings` 新增 `colors: Record<ColorRole, ThemeColor>`，`ColorRole` 覆盖 text/background/underline/ribbon/border/source/loading/error；每个角色有 `mode: theme | single | split` 与 `light/dark` 值。旧的 `color/background/underlineColor/ribbonColor` 字段保留并由 `normalizeAppearance` 从 `colors` 派生，旧偏好与旧缓存读取兼容。
- **自实现取色器**（无新依赖）：SV 面板 + 色相条 + 透明度滑块 + HEX + R/G/B + H/S/L 数值输入；SV 面板支持方向键（Shift 加速），色相/透明度/数值输入均可键盘操作；同时保留原生 `input[type=color]` 作为“系统取色器”入口。当文档没有 `PointerEvent` 时（自定义面板不可用）自动降级为直接打开原生取色器。
- **色板与复用**：`buildColorPalette()` 生成 5 行 × 8 列色板；最近使用最多 12 个、我的颜色最多 24 个，存 JSON 偏好（`appearance.recentColors` / `appearance.savedColors`），读取时严格校验为 hex、去重、限长；取色器提供复制/粘贴 HEX（Clipboard API 不可用时回退 `execCommand`）。
- **浅深分别配色**：每个颜色卡片有“跟随主题 / 统一颜色 / 浅深分别设置”三态下拉；split 时显示深色行，浅色与深色各有独立 HEX/取色器；预览卡片增加“预览深色主题”开关，`buildTranslationCSS(..., { colorScheme })` 让预览在浅/深之间切换。阅读器里自动模式额外输出 `:root[data-color-scheme="dark"]` 覆盖块。
- **适用颜色项**：译文文字、译文背景、下划线、左侧色带、译文边框、原文淡化色、加载中状态色、出错状态色；每张卡片都有“恢复默认”。原文淡化目前以颜色 + 透明度形式输出，后续 Step 4 会接入透明度范围。
- **对比度**：新增 `parseColorToRgba`、`rgbaToHsl`、`hslToRgba`、`compositeRgba`、`contrastRatioOver`；文字色/背景色带 alpha 时先合成到当前主题底色，再计算 WCAG 对比度；浅色与深色各检查一次，低于 4.5:1 显示非阻塞警告并给出两个比值。
- **存储**：旧值（3/6 位 hex、rgb()、命名色）读取兼容；新值带 alpha 时规范化为 8 位 HEX（`#RRGGBBAA`）；`appearance.v2` JSON 保存完整结构，旧逐字段偏好继续同步写入，便于回退与旧代码读取。验证只接受 `#RGB/#RRGGBB/#RRGGBBAA`、rgb()/hsl() 与字母命名色，拒绝分号、花括号、`url()`、`expression` 等注入。
- **设置页结构**：删除 XHTML 中四段静态颜色控件，改为 `#interlinear-appearance-color-controls` 宿主，由 `COLOR_CONTROLS` 表动态构建 8 张卡片，避免颜色项与 HTML 双份维护。

### 改动文件
`src/appearance.ts`、`src/settings.ts`、`src/modules/preferenceScript.ts`、`addon/content/preferences.xhtml`、`addon/content/preferences.css`、`addon/locale/en-US/addon.ftl`、`addon/locale/zh-CN/addon.ftl`、`test/appearance.node.test.mjs`、`test/startup.test.ts`、`typings/i10n.d.ts`（构建生成）、`docs/dev/PROGRESS.md`。

### 测试结果
- `npm run build`：通过。
- `npm run lint:check`：通过。
- `npm run test:unit`：162 pass / 0 fail（新增颜色解析、HSL/RGB 互转、alpha 合成、对比度、旧值兼容、恶意输入等用例）。
- `npm run test:review`（Zotero headless，独立 profile）：53 pass / 0 fail。新增/更新用例覆盖：split 深浅色写入、深色预览、额外颜色角色（border/source/loading/error）存在、色板/最近使用/我的颜色、取色器打开与 HEX 同步、非法颜色拒绝、主题模式对比度警告。

### 不确定项 / 未目视验证
- 自定义取色器在真实 Zotero 设置窗口中的布局、滚动与触摸板拖动未目视；headless 只断言 DOM/状态与生成的 CSS。
- Clipboard API 在 Zotero chrome 文档中的可用性未实测；复制/粘贴失败会显示状态文字并使用回退路径。
- 8 位 HEX 在旧版阅读器/打印导出中的 alpha 表现取决于 Gecko；打印模式会改用 6 位/显式颜色，不会把深色主题带入纸张。
- 颜色角色 `source` 目前输出为 `color`；是否会让 Zotero 原生高亮观感受影响未在真实 PDF 上验证，Step 4 会改为更保守的 opacity 方案并补回归。
- 深色覆盖块依赖阅读器设置 `:root[data-color-scheme="dark"]`；未在所有 Zotero 主题上确认该属性是否会设置，代码同时输出显式 scheme 的 CSS 作为兜底。

### 我需要手动在 Zotero 里验证的清单
1. 打开设置→外观→颜色：确认 8 张颜色卡片（文字/背景/下划线/色带/边框/原文/加载/错误）按统一布局显示，每张都有模式下拉、预览、取色器、HEX、恢复默认。
2. 点“自定义…”打开取色器：拖动 SV 面板、色相条、透明度滑块，确认 HEX/RGB/HSL 同步、预览变化；用键盘方向键移动 SV 光标；按 Esc/关闭按钮退出。
3. 在“我的颜色”保存一个颜色，关闭再打开设置页，确认仍在；复制 HEX 后粘贴到另一个颜色卡片。
4. 把文字颜色设为 split，浅色 #333333、深色 #EEEEEE，勾选“预览深色主题”，确认预览变浅色字；切到阅读器深色主题，确认译文块使用深色值。
5. 把文字色 #777777、背景 #FFFFFF：确认出现浅色/深色两个对比度比值的警告；改成 #000000 后警告消失；保存不被阻止。
6. 输入非法值 `red; } body { display:none` 或 `url(evil)`：确认被拒绝、显示行内错误、不写入偏好，页面样式无异常。
7. 修改颜色后保存，确认已打开的阅读器立即变化且没有重新发起翻译请求；关闭重开仍保持。
8. 在浅色/深色 Zotero 主题下检查 8 张卡片的文字、边框、状态点对比度，并确认取色器面板不被裁切（滚动到视口内）。

## Step 4：下划线、色带与译文块样式系统（P1）

### 做了什么
- **文字装饰**：`textDecoration` 支持 underline/overline/line-through 多选（旧 `underline` 布尔继续同步为是否包含 underline）；线型 solid/double/dotted/dashed/wavy；粗细 0=自动、0.5–8px；距文字 -1=自动、0–12px；skip-ink 自动/关闭；颜色复用 `colors.underline`（含浅深分别与透明度）。CSS 输出 `text-decoration`、`text-decoration-style`、`text-decoration-thickness`、`text-underline-offset`、`text-decoration-skip-ink`、`text-decoration-color`。
- **段落分隔线**：`divider` 开关、线型、粗细 1–6px、与文字距离 0–2em、颜色角色 `divider`；输出 `border-bottom`，距离通过增加 `padding-bottom` 实现。**“随文字”长度未实现**：它需要把整段文本包进 inline 元素或使用 background-image 裁剪，会改变块布局/选择行为；当前只提供整行分隔线，已记入 BACKLOG。
- **色带**：位置 left/right、宽度 1–12px、线型 solid/dashed/dotted/double、圆角 0–8px（物理左上/左下或右上/右下圆角）、与文字间距 0–2em（加到该侧内边距）；关闭时保留旧的 `border-left: none` 输出。
- **译文块布局**：垂直/水平内边距 0–2em、圆角 0–16px、边框宽 0–4px + 线型 + `colors.border`、左缩进 0–4em（`margin-inline-start`）、首行缩进 0–4em、对齐 start/justify/center、最大宽度 0=不限 / 40–100ch、整体不透明度 40–100%、原文与译文间距 0–2em、显示译文时原文淡化 40–100%（`sourceDim`，输出独立 `.interlinear-source { opacity }` 规则）。
- **默认输出冻结**：新增两个精确快照测试，固定默认 reader/print CSS 与改动前逐字节一致；所有新 CSS 声明只在非默认值时追加。默认色带仍是 `border-left: 4px solid #2f6fdf`，默认 padding/margin 保持不变。
- **单测**：多装饰组合、divider/右色带/块布局输出、越界夹取、恶意/未知枚举回落、`maxWidthCh` 0/40–100、opacity/sourceDim 夹取；新增集成用例修改全部 Step 4 控件并断言 `getAppearance()`、旧偏好与已打开阅读器的 `<style>`。
- **原生高亮回归**：`test/readingLayout.test.ts` 在真实 Zotero 阅读器 fixture 中，在译文块上追加 padding、四边 border、右色带、圆角、左缩进与首行缩进后，仍断言高亮对齐误差 <2px、存储 PDF 坐标不变。
- **设置页**：外观页新增“文字装饰 / 段落分隔线 / 色带 / 译文块布局”四张卡片；分隔线与色带关闭时对应输入自动禁用；所有标签/帮助/枚举走 Fluent。

### 改动文件
`src/appearance.ts`、`src/modules/preferenceScript.ts`、`addon/content/preferences.xhtml`、`addon/locale/en-US/addon.ftl`、`addon/locale/zh-CN/addon.ftl`、`test/appearance.node.test.mjs`、`test/startup.test.ts`、`test/readingLayout.test.ts`、`typings/i10n.d.ts`（构建生成）、`docs/dev/PROGRESS.md`。

### 测试结果
- `npm run build`：通过。
- `npm run lint:check`：通过。
- `npm run test:unit`：165 pass / 0 fail。
- `npm run test:review`（Zotero headless，独立 profile）：54 pass / 0 fail（新增 Step 4 控件保存用例；readingLayout 对齐回归用例已扩展）。

### 不确定项 / 未目视验证
- `text-decoration-thickness`、`text-underline-offset`、`text-decoration-skip-ink` 在 Zotero 10 的 Gecko 中按标准支持（Firefox 70+），但未在真实 PDF 上逐项截图。
- 逻辑圆角（`border-top-*-radius`）与右色带组合在 RTL 文本下的视觉表现未目视；当前使用物理边，色带位置与书写方向无关。
- “随文字”分隔线未实现，原因见上；已写入 `docs/dev/BACKLOG.md`。
- `sourceDim` 用 `opacity` 淡化原文，可能同时淡化原文上的原生高亮覆盖层；集成测试只断言几何位置，未目视确认高亮颜色是否变淡。默认 100% 不生效，不影响现有用户。
- 最大宽度以 `ch` 为单位，实际宽度取决于当前字体；窄屏下 `max-width` 可能小于可用宽度，属预期。
- 分栏模式下新增的块 padding/border 是否让左右列换行未在真实 PDF 上验证；几何观察器会跟随高度变化。

### 我需要手动在 Zotero 里验证的清单
1. 设置→外观→文字装饰：同时勾选下划线/上划线/删除线，线型选波浪、粗细 2px、距离 4px、取消 skip-ink；保存后译文块应同时出现三种装饰，线型/粗细/偏移生效。
2. 打开“段落分隔线”，选虚线、2px、距离 0.5em：译文块下方出现分隔线，文字与线之间多出 0.5em。
3. 色带改为右侧、6px、点线、圆角 4px、与文字间距 0.5em：译文块右侧出现点线色带，右侧内边距增加，圆角只出现在右侧。
4. 译文块布局：垂直 padding 0.6、水平 1.2、圆角 10、边框 2px 双线、左缩进 1em、首行缩进 0.5em、两端对齐、最大宽度 72ch、不透明度 80%：保存后逐项观察；窄屏下最大宽度不应导致横向滚动。
5. 把“显示译文时淡化原文”设为 60%：译文显示时原文变淡；关闭对照后原文恢复；检查 Zotero 原生高亮是否仍可见、位置不偏移。
6. 在左右双栏模式下重复第 1–4 步：确认两列仍并排、不换行、高亮矩形仍覆盖原文；滚动和缩放后位置不漂移。
7. 点 🖨️ 导出：确认打印稿保留字重/斜体/字距/装饰/分隔线/色带，深色主题不会印成深色底。
8. 切换浅/深主题：确认色带、分隔线、边框的默认颜色对比度可读；显式颜色在两种主题下都按设置输出。

## Step 6：界面跟随与阅读器内体验（P2）

### 做了什么
- **划词弹窗 / 阅读助手跟随**：新增 `uiFollowAppearance`（默认开）。开启时，弹窗通过 `--interlinear-ui-font-family`、`--interlinear-ui-font-size` 使用与译文相同的字体/字号；阅读助手根节点在 `onRender` 时同步字体与字号。弹窗宽度新增 `popupMaxWidth`（280–720px，默认 380），`readerInteractions` 在打开时读取并用于定位与宽度；关闭跟随时回退 13px。
- **导出外观**：新增 `exportMode`（默认 `reader` = 与阅读器一致；`print` = 打印专用浅底黑字）。`readerUI` 按该值选择 `buildTranslationCSS(..., "reader" | "print")`，reader 模式传入当前浅/深 scheme；导出的 JSON 外观方案不包含任何 Provider 配置或密钥。
- **翻译范围**：新增 `scope.body/titles/captions/listItems/notes`（默认全开）。`collectParagraphs` 动态拼接选择器；全部关闭时返回空列表并沿用既有“未找到可翻译段落”错误。参考文献跳过逻辑不变。
- **加载/错误状态**：保留 `colors.loading/error`；新增 `stateAnimation`（默认关，保持现状）与 `reduceMotion`。开启动画时注入 `interlinear-pulse`；无论开关如何，`@media (prefers-reduced-motion: reduce)` 都会关闭动画。
- **译文块操作**：译文块显式 `user-select: text`；右键或双击译文块打开菜单：重新翻译此段 / 复制译文 / 复制原文。重新翻译走 `translateReaderParagraph(..., { force: true })`：跳过缓存命中、复用 `paragraphRequests` 去重，仍通过同一 Provider 与缓存写入；复制使用 Clipboard API，失败回退隐藏 textarea + `execCommand`，并显示 1.6 秒非阻塞提示。
- **设置页**：外观页新增“界面与导出”卡片（跟随开关、弹窗宽度、导出模式、动画、减少动画）；显示页新增“翻译范围”卡片（正文/标题/图注/列表项/旁注）。全部文案走 Fluent。

### 改动文件
`src/appearance.ts`、`src/settings.ts`、`src/modules/preferenceScript.ts`、`src/bilingualReader.ts`、`src/readerInteractions.ts`、`src/readerUI.ts`、`src/chatPane.ts`、`addon/prefs.js`、`addon/content/preferences.xhtml`、`addon/locale/en-US/addon.ftl`、`addon/locale/zh-CN/addon.ftl`、`test/startup.test.ts`、`typings/i10n.d.ts`（构建生成）、`docs/dev/PROGRESS.md`。

### 测试结果
- `npm run build`：通过。
- `npm run lint:check`：通过。
- `npm run test:unit`：169 pass / 0 fail。
- `npm run test:review`（Zotero headless，独立 profile）：57 pass / 0 fail。新增用例：
  - 翻译范围：仅正文开启时，p/h1/figcaption/li/aside 混合文档只产生 1 个请求与 1 个译文块。
  - 译文块右键菜单：3 个动作、重新翻译带 `force=true`、双击再次打开。
- 既有 provider/缓存/快捷键/悬停用例全部保持通过。

### 不确定项 / 未目视验证
- 划词弹窗跟随后在真实深色阅读器中的字体/宽度观感未目视；固定定位与滚动重定位行为沿用既有实现（滚动后弹窗不跟随）。
- 阅读助手在 ItemPane 重新挂载时是否总是触发 `onRender` 未实测；若宿主复用 DOM 而不重新渲染，字体需重开侧栏后更新。
- Clipboard API 在 Zotero reader iframe 中的可用性未实测；失败时回退路径会显示“复制失败”。
- 导出“与阅读器一致”会把深色主题的译文块带到浅色导出页，这是有意行为；打印模式仍强制浅底黑字。
- 动画默认关闭；开启后 `prefers-reduced-motion` 的媒体查询在 Zotero 10 中是否按系统设置生效未实测（标准 CSS 行为）。
- 右键/双击菜单在真实 PDF 阅读器中的定位与遮挡未目视；`readerMenu` 已有外部点击/Esc/滚动关闭逻辑。

### 我需要手动在 Zotero 里验证的清单
1. 设置→外观→界面与导出：关闭“跟随译文字体和字号”后，划词弹窗与阅读助手回到 13px；重新开启并改字号/字体后，两者同步变化。
2. 调整“划词弹窗最大宽度”到 280 与 720，选中一段文字：弹窗宽度随之变化，且不超出视口。
3. 导出模式选“与阅读器一致”：在深色主题下导出，译文块保持深色；切到“打印专用”后重新导出，译文块为浅底黑字。
4. 显示页→翻译范围：只保留正文，刷新一篇含标题/图注/列表/旁注的论文；确认只翻译正文，参考文献仍跳过。
5. 打开“加载动画”：刷新时“正在翻译…”有脉冲动画；系统开启“减少动态效果”后动画停止；关闭开关后无动画。
6. 右键译文块：菜单含重新翻译/复制译文/复制原文；点重新翻译会重新请求该段（其他段不重复请求）；复制成功出现“已复制”提示。
7. 双击译文块同样打开菜单；拖动选择译文文字可正常复制；错误/暂停块点击重试仍可用。
8. 浅/深主题下检查菜单、提示、弹窗与阅读助手的对比度。

## Step 5：外观方案（P2）

> 说明：Step 5 的代码与 Step 6 在同一个提交（`cbde85d`）中落地。会话中断导致两步未分开提交；功能与测试记录按 Step 分开写在本文档中。

### 做了什么
- **内置方案 6 套**：默认、护眼纸张、学术衬线、高对比、暗色优化、极简。每套是 `DEFAULT_APPEARANCE` 上的完整覆盖，应用时先保存当前外观为撤销快照，再写入偏好并同步整张表单（字体栈/字重/颜色/装饰/块布局/预览）。顶部状态显示“已应用 X”，可点“撤销上次应用”恢复。
- **我的方案**：名称输入 + 保存当前 / 应用 / 重命名 / 删除；存 `appearance.presets` JSON，最多 20 个，名称 60 字符、控制字符剔除、大小写不敏感去重；同名保存视为覆盖。
- **导入/导出**：`src/appearanceFiles.ts` 复用 ztoolkit.FilePicker + Zotero.File；JSON 格式 `{format:"interlinear-appearance", version:2, appearance, presets}`，导出只含外观与我的方案，不含任何 Provider/API Key。导入限制 256KB，校验 format/version，未知键忽略并在状态行报告数量，所有值经 `normalizeAppearance` 夹取/拒绝；不执行任何内容。
- **重置全部外观**：带 `confirm` 确认，应用默认方案；可撤销。
- **schema 版本**：`appearance.schema` 当前为 3（颜色角色/字体/装饰字段增加时递增）；`appearance.v2` 保存完整结构，旧逐字段偏好继续同步写入。导入接受 version 1–2（1 视为旧结构，经 normalize 迁移）。
- **单测**：`normalizeAppearancePresets` 去重/截断/拒绝非法项；导入拒绝超大/坏 JSON/错误 format/未来版本；未知键报告；恶意字体/颜色不进入结果；导出往返且不含 provider 字段。
- **集成测试**：应用“学术衬线”后 `getAppearance().textAlign === "justify"`、字体主项为 Georgia，表单下拉同步；撤销恢复；保存/应用/删除“我的方案”。

### 改动文件
`src/appearance.ts`、`src/settings.ts`、`src/appearancePresets.ts`（新）、`src/appearanceFiles.ts`（新）、`src/modules/preferenceScript.ts`、`addon/content/preferences.xhtml`、`addon/locale/en-US/addon.ftl`、`addon/locale/zh-CN/addon.ftl`、`test/appearance.node.test.mjs`、`test/startup.test.ts`、`typings/i10n.d.ts`（构建生成）。

### 测试结果
- `npm run build`：通过。
- `npm run lint:check`：通过。
- `npm run test:unit`：169 pass / 0 fail（Step 5 时点）。
- `npm run test:review`：55 pass / 0 fail（Step 5 时点；含预设应用/撤销/我的方案用例）。

### 不确定项
- 文件选择器与真实文件读写未在设置窗口中手工点击验证；集成测试只覆盖纯函数与表单。
- 应用方案会立即写入偏好并刷新阅读器；如果用户在其它标签还有未保存设置，全局“未保存”状态仍保留，这是有意的（不能替用户丢掉别的改动）。
- “撤销上次应用”只在当前设置窗口生命周期内有效，关闭窗口后丢失。
- 内置方案是固定数据；以后改默认值需要同步更新方案，未做版本迁移。
- 导入时同名“我的方案”会被导入文件覆盖；没有逐项确认。

### 我需要手动在 Zotero 里验证的清单
1. 外观页顶部六个方案按钮：逐个点击，确认预览与已打开阅读器立即变化；点“撤销上次应用”恢复点击前的外观。
2. 输入名称保存当前为“我的方案”，关闭再打开设置页确认仍在；应用/重命名/删除各一次。
3. 导出一个 JSON，检查不含 apiKey/endpoint/prompt；改几项外观后导入，确认值恢复且状态行报告未知键数量。
4. 导入一个 300KB 文件或损坏 JSON：确认状态行显示错误且外观不被改写。
5. 点“重置全部外观”：确认弹窗出现；确认后恢复默认，取消则不变；随后可撤销。
6. 在浅/深主题下检查方案按钮、状态行与撤销按钮的可读性。

## Step 7：快捷键与触发（P2）

### 做了什么
- **新增两个可配置快捷键**：显示/隐藏译文（默认 `Alt+Shift+T`，默认关闭）、循环切换排版（默认 `Alt+Shift+D`，默认关闭）。复用现有录制控件：点击输入框按键录制，Backspace/Delete 恢复默认；`readerInteractions` 在 `keydown` 中先于单段翻译快捷键匹配。
- **冲突检测**：`shortcutsEqual` 精确比较修饰键与按键；`isReservedShortcut` 保守列出 Ctrl/Cmd + A/C/F/L/N/O/P/Q/R/S/T/V/W/X/Y/Z 等 Zotero/浏览器常见快捷键。三者任意重复或命中保留组合时，设置页显示非阻塞黄色警告；保存时把该警告并入 warning 状态，但不阻止保存。
- **悬停修饰键**：`hoverModifier` 可选 none/alt/ctrl（默认 none，保持现状）。Alt 模式下按住 Alt 悬停仍显示虚线高亮，同时按停留时间触发自动翻译；Ctrl 模式下未按 Ctrl 不启动计时。同段移动 >6px 才重新计时，滚动/移出/按下鼠标/选区/弹窗仍会取消。
- **打开论文时自动翻译**：`autoTranslateOnOpen` 可选 off（默认）/ cached / always。
  - cached：`showCachedTranslations` 只收集已有缓存的段落，插入译文块并直接置 done，不发任何请求；若没有缓存段落则不做任何事。
  - always：等同自动点一次工具栏开关，启动全文翻译；设置页在选择 always 时显示“可能产生 API 费用”的警告。
  - 每个 reader 只尝试一次（WeakSet），已有非 empty 开关状态时跳过。
- **测试**：快捷键纯函数单测（精确比较、保留组合）；集成用例保存三项新设置、断言偏好与冲突提示；既有 57 个集成用例保持通过。

### 改动文件
`src/shortcut.ts`、`src/settings.ts`、`src/modules/preferenceScript.ts`、`src/readerInteractions.ts`、`src/bilingualReader.ts`、`addon/prefs.js`、`addon/content/preferences.xhtml`、`addon/locale/en-US/addon.ftl`、`addon/locale/zh-CN/addon.ftl`、`test/shortcut.node.test.mjs`、`test/startup.test.ts`、`typings/i10n.d.ts`（生成）。

### 测试结果
- `npm run build`：通过。
- `npm run lint:check`：通过。
- `npm run test:unit`：171 pass / 0 fail。
- `npm run test:review`（Zotero headless，独立 profile）：58 pass / 0 fail。

### 不确定项
- `isReservedShortcut` 的保留键列表是保守启发式，不代表 Zotero 全部快捷键；只警告不阻止。
- 新快捷键默认关闭，避免与用户现有 Zotero 快捷键冲突；需要用户主动开启。
- Alt 悬停修饰键与原有“Alt 悬停高亮”共用 Alt；同时按住 Alt 时两者都会表现，已在代码中复用同一计时器，但真实鼠标路径未目视。
- `always` 自动翻译在真实 PDF 打开时是否早于阅读模式就绪、是否会与服务商限流冲突未实测；`prepareAndRun` 会等待阅读模式，失败会走非阻塞错误提示。
- cached 模式只显示缓存段落，不会翻译未缓存段落；用户看到的是混合状态（部分段落有译文），这是“仅此前翻译过的论文”的预期。
- 新快捷键只在交互控制器附加后生效；未开启过对照的阅读器仍需先触发一次工具栏/悬停/快捷键以附加控制器（既有行为）。

### 我需要手动在 Zotero 里验证的清单
1. 设置→显示与交互：开启“显示/隐藏快捷键”，录制 `Ctrl+Alt+T`；在阅读器按该组合键，译文显示/隐藏切换；再按一次恢复。
2. 开启“排版循环快捷键”，录制 `Ctrl+Alt+D`；连按四次，四种布局依次切换，工具栏 `◫` 标题同步。
3. 把显示/隐藏快捷键改成与单段翻译相同的 `Alt+Enter`：设置页出现冲突警告；保存后仍可保存但状态为 warning。
4. 悬停修饰键选“按住 Ctrl”：不按 Ctrl 悬停不翻译；按住 Ctrl 停留到时间后翻译；Alt 悬停高亮仍正常。
5. 选“按住 Alt”：按住 Alt 悬停出现虚线高亮并自动翻译；松开 Alt 移动不触发。
6. 自动翻译选“仅缓存”：打开一篇之前翻译过的论文，译文块直接出现且不发请求；打开没翻译过的论文不出现译文。
7. 自动翻译选“总是”：打开新论文自动开始全文翻译；设置页能看到费用警告；再次打开同一阅读器不重复启动。
8. 关闭自动翻译，确认打开论文不再自动显示/翻译；切换浅/深主题检查新增下拉与警告的可读性。

## Step 8：设置页整体检查与自查修复

### 做了什么
- **默认值/范围/保存/读取路径核对**：外观新增字段全部进入 `AppearanceSettings`、`normalizeAppearance`、`appearance.v2`、`readAppearanceForm`、`hydrateStyleControls`/`hydrateFontControls`、`applyAppearanceToForm`；翻译范围与 Step 7 设置进入 `settings.ts`、`addon/prefs.js`、设置页保存/加载。数值范围在读取与写入两侧夹取，枚举走白名单。
- **“保存后立即应用”核实**：外观保存调用 `refreshTranslationStyles()` + `refreshDisplayModes()`，已打开阅读器即时更新；显示模式/悬停/快捷键在下次交互读取；翻译范围与 skipLastPages 需要下次全量翻译才生效，设置页帮助文案已说明。
- **信息架构/折叠**：外观页的“文字装饰 / 段落分隔线 / 色带 / 译文块布局 / 界面与导出”收进原生 `<details>`，默认折叠；保留方案、预览、排版、颜色在首屏。600px 下字段单列、标签不换行、标签栏横向滚动；宽屏最大宽度 880px。
- **一致性**：颜色/字体/装饰/块布局控件统一“标签 + 控件 + 帮助文字”网格；数值输入统一宽度、单位后缀；所有新增文案 en/zh 同步（511 ↔ 511 键）。
- **文档**：新增 `docs/dev/SETTINGS.md`（全部偏好键/类型/范围/默认/作用/缓存影响）；新增 `docs/dev/BACKLOG.md`（P3 与暂不可行项）；README 中英文与 CHANGELOG 更新到当前实现。
- **自查发现的问题**：
  - 直接 `readNumberInput` 空输入会被 `Number("") === 0` 解析为 0，因此新控件必须在 `hydrateStyleControls` 中回填；已实现并有集成用例覆盖。
  - 预设应用后表单需要整体回填，否则预览与阅读器已变但控件仍旧；已实现 `applyAppearanceToForm`。
  - 动态颜色卡片与旧静态卡片的重复 ID：已删除旧静态 DOM，改为宿主 + 表驱动渲染。
  - 显示模式快捷键/按钮共用 `cycleDisplayMode`；修复传 `toolbarDoc` 以保证测试/即时按钮状态。
  - Step 5 与 Step 6 因会话中断落在同一提交（`cbde85d`），已在 PROGRESS 标注，不再拆分历史。
  - 字体检测列表把“已检测到”的字体也标成 `?`：`state.detected` 保留原大小写，而 `filterFontCandidates` 内部转小写，导致 `undetected` 判断大小写不匹配；已在渲染前构造小写集合，并补集成断言。
  - 自动翻译“总是”的警告在切回非 always 后不消失：警告同步函数只在初始化时调用；改为切换回显示页时也同步。
  - “翻译范围”在显示页与高级页重名：显示页改为“内容范围”，高级页改为“页面范围”。
  - 聊天上下文不读取翻译范围：`collectChatContext` 增加 `paragraphSelector` 选项，`chatPane` 按 `scope.*` 构造选择器。
  - 版本号提升到 **0.6.0**（外观 v2、字体/颜色/装饰/方案/触发方式均为新功能）。

### 截图自检
- `canvas.drawWindow` 直截 Zotero 窗口在 headless 下失败（scaffold 只报 `undefined`），临时截图测试已删除。
- 改用更可靠的近似方案：临时集成测试打开真实偏好页、切到每个标签，等待字体检测完成，把 `#interlinear-settings-root` 的**初始化后真实 DOM**（含动态颜色卡片、字体列表、表单值、展开的 preview shadow 内容）序列化到 `.scaffold/preview-{tab}.html`，再用 Playwright/Chromium 加载同一份 `preferences.css` 截图。为了全页截图，临时把 sticky 改为 static、把 `file://` 图标换成本地相对路径；这些只是截图预览处理，不进入产品代码。
- 产物：`docs/dev/screenshots/service.png`、`display.png`、`appearance.png`、`appearance-dark.png`、`service-dark.png`、`glossary.png`、`advanced.png`。已据此检查顶部工具栏、标签、方案区、字体列表、颜色卡、折叠组与深浅主题；并修复了下述问题。
- **限制**：这不是真实 Zotero GUI 截图，XUL/平台主题的原生差异、真实滚动容器与字体光栅化未覆盖；真实 GUI 仍建议人工过一遍。

### 测试结果（最终）
- `npm run build`：通过。
- `npm run lint:check`：通过。
- `npm run test:unit`：171 pass / 0 fail。
- `npm run test:review`（Zotero headless，独立 profile）：58 pass / 0 fail。
- `npm test`：未运行（本机无 `.env`；`test:review` 是独立 profile 的安全等价入口）。

### 仍待决定 / 未完成
1. **真实 Zotero GUI 目视验证**：已于 2026-11-11 完成偏好页真实截图与目视检查，见下方 Step 9；阅读器内流程仍未截图验证。
2. **导出流程阻塞式 alert/confirm**：未改，见 BACKLOG。
3. **阅读器工具栏右键菜单历史问题**：未在用户机器复测；侧边栏面板仍兜底。
4. **P3 全部项**：见 `docs/dev/BACKLOG.md`，未实现。
5. **Step 5/6 同提交**：历史已形成，按“不改写历史”约束保留。

### 我需要手动在 Zotero 里验证的清单（最终）
1. 打开设置→五个标签：顶部工具栏、保存状态四态、标签切换保留滚动/表单值；600px 与宽屏都不溢出。
2. 外观页：内置方案应用/撤销、我的方案保存/应用/重命名/删除、JSON 导入导出/重置；高级组默认折叠且展开后布局正常。
3. 字体：检测状态、搜索/分组/收藏、字体栈增删排序、高级 CSS 非法值警告。
4. 颜色：自实现取色器、HEX/RGB/HSL/透明度、浅深分别配色、最近/我的颜色、对比度警告。
5. 装饰/分隔线/色带/块布局：逐项修改并观察阅读器与导出；左右分栏下高亮不偏移。
6. 显示与交互：悬停修饰键（none/Alt/Ctrl）、单段/显示隐藏/排版循环快捷键、冲突提示、自动翻译（关/仅缓存/总是）。
7. 导出/划词弹窗/阅读助手：导出模式、弹窗宽度、界面跟随、深浅主题对比度。
8. 译文块右键/双击：重新翻译、复制译文/原文；错误块点击重试；缓存/请求不重复。

## Step 9：真实 GUI 目视验证与后端链路端到端（2026-11-11）

### 做了什么

- **真实 Zotero GUI 截图**：新增 `test-gui/capture.test.ts` + `scripts/test-gui.mjs`，以非 headless、独立 profile 启动 Zotero，通过 `canvas.drawWindow` 直接截取真实偏好窗口。产物为 `docs/dev/screenshots/*-gui.png`（共 15 张）：五个标签、颜色组、取色器、外观方案、高级组、浅/深主题、历史近似“窄窗口”。旧的 Chromium 近似图保留不动。
- **目视发现并修复的问题**（各自独立提交）：
  1. `5881331` 自动模式预览不跟随 Zotero 深色主题（先写集成用例复现）。
  2. `8d24e24` “重命名”按钮从方案名称行移入“我的方案”行。
  3. `c38389d` **自定义取色器完全无样式**：它被挂到偏好页 `body`，没有对应 CSS，实际渲染成覆盖在左侧栏上、底部被裁切的裸控件。改为挂载到 `#interlinear-settings-root`，新增 209 行作用域化 popover 样式，并把顶部坐标钳制在窗口内；集成用例新增“面板位于 settings root 内 + computed position 为 fixed”断言。
  4. `dba4fcd` 颜色卡的“深色主题”行在“跟随主题/统一颜色”下仍然显示：`.interlinear-color-row { display: flex }` 覆盖了 `hidden` 属性；补 `.interlinear-color-row[hidden] { display: none }`，用 computed display 断言钉住。
- **取色器细节**：范围行标签列 64→78px 并 `nowrap`，避免“不透明度 %”折成两行；截图脚本在拍完取色器后恢复“跟随主题”，防止后续浅/深主题截图继承临时的 #333333。
- **后端链路端到端（真实 HTTP）**：新增 `test-e2e/` + `scripts/test-e2e.mjs`，验证了三组：
  - 本地 mock HTTP 服务（127.0.0.1:18923）逐个走通 OpenAI 兼容 `/v1/chat/completions`、Claude `/v1/messages`、Gemini `:generateContent`、Ollama `/api/chat` 的端点、鉴权头、请求体与响应解析；翻译与聊天返回均为预期标记。
  - 真实本机 Ollama（qwen2.5:7b）：翻译与聊天均返回中文，耗时约 5.6s。
  - 真实 Google 翻译：经 Clash 代理 `127.0.0.1:7897`，`translate_a/single` 返回中文，耗时约 1.4s。
- **工具产物**：`test-gui/`、`test-e2e/`、`scripts/test-gui.mjs`、`scripts/test-e2e.mjs` 目前是验证工具，是否长期保留待决定。

### 测试结果

- `npm run build`：通过。
- `npm run lint:check`：通过。
- `npm run test:unit`：171 pass / 0 fail。
- `npm run test:review`（Zotero headless，独立 profile）：**59 pass / 0 fail**（含取色器挂载/定位与深色行隐藏的新断言）。
- `node scripts/test-gui.mjs`：1 pass，重新生成 15 张真实 GUI 截图。
- `node scripts/test-e2e.mjs`（mock 独立启动）：3 pass（四协议 mock、真实 Ollama、真实 Google）。

### 不确定项 / 未验证

- **官方付费模型未实测**：OpenAI/Claude/Gemini 没有用户 API 密钥，只验证了本地 mock 的线上协议路径；无法证明官方服务当前模型名、限流与响应格式完全一致。
- 截图只覆盖**偏好页**；阅读器内工具栏/右键菜单/导出弹窗/译文块菜单/阅读助手在真实 PDF 上的表现仍未截图验证。
- “窄窗口”截图实际为 800px 宽：Zotero 窗口存在最小宽度，`resizeTo(620)` 被抬高，600px 单列布局仍未真实验证。
- 取色器在小窗口下会被钳制到视口顶部并可能盖住正在编辑的颜色行；可滚动，但实机手感未评估。
- 本次临时启动的 Ollama 与 mock 服务、以及 `.scaffold/` 下的诊断文件尚未清理。

### 需要用户手动验证

1. 用真实 PDF 跑一次全文翻译，确认进度、暂停/继续、取消、失败重试与高亮不偏移。
2. 右键阅读器工具栏图标是否仍然无响应（历史问题）。
3. 若愿意提供官方 API key：分别测试 OpenAI/Claude/Gemini 的“测试连接”和一段真实翻译。
4. 取色器在 800px 以内窄窗口中的弹出位置与滚动是否顺手。

# Zotero 10/11 兼容加固 + API 密钥安全（feat/hardening）

## 基线

- 从 `main` @ `f2f7da8`（docs: refresh appearance screenshots from the GUI harness）切出 `feat/hardening`，其上叠加调研分支的 `7588b10`（两份 RESEARCH 文档）。基线内 `feat/hardening` 与 `main` 的差异仅为 `docs/dev/RESEARCH-zotero11.md`、`docs/dev/RESEARCH-key-security.md`。
- 基线测试（切分支前实测）：`build` 通过、`lint:check` 通过、`test:unit` 173 pass、`test:review` 在 Zotero 10.0.8 与 Zotero 11.0-dev.5 上均 59 pass。
- 测试环境：Zotero 10 = `C:/Program Files\Zotero\zotero.exe`；Zotero 11 = `%TEMP%\z11\Zotero_win-x64\zotero.exe`（官方 dev 渠道 ZIP，`platform.ini` 为 `Milestone=153.0`）。两者都通过 `scripts/test-review.mjs` 使用 `.scaffold/test/profile` 隔离 profile，未触碰日常使用的 Zotero profile。
- 每个 Step 均执行 `build` / `lint:check` / `test:unit` / `test:review`（Zotero 10 与 11 各一次）。删除类命令需临时关闭本地文件删除保护（`CODEBUDDY_SAFE_DELETE_ENABLED=0`），只影响 scaffold 自己的测试目录。

## Step 1：设置页 CSP 迁移

### 做了什么

- **去掉内联 `onload`**：`addon/content/preferences.xhtml` 的根节点只剩 `<groupbox id="interlinear-settings-root">`，不再有 `onload="…onPrefsEvent('load', …)"`。
- **改用注册脚本引导**：`src/hooks.ts` 的 `Zotero.PreferencePanes.register()` 增加 `scripts: ["content/preferences-init.js"]`；新增 `addon/content/preferences-init.js` 完成原 onload 的工作。
- **时序差异（查证后处理）**：读 Zotero 11 dev 构建的 `chrome/content/zotero/preferences/preferences.js::_loadPane()` 后确认两件事：
  1. `pane.scope = new Cu.Sandbox(window, { sandboxPrototype: window, sameZoneAs: window })`，脚本用 `Services.scriptloader.loadSubScript(script, pane.scope)` 加载 —— 所以脚本里的 `window`/`document` 通过原型链解析到**设置窗口本体**，能拿到 `document.getElementById(...)`。
  2. 脚本在 **`Zotero.File.getContentsFromURL(pane.src)` 与 `pane.container.append(fragment)` 之前**执行，因此脚本运行时面板 DOM 还不存在，不存在可监听的 load 事件。`preferences-init.js` 改为轮询等待 `#interlinear-settings-root`（50ms 间隔、15s 超时），再调 `hooks.onPrefsEvent("load", { window })`。
- **重复加载**：`registerPrefsScripts()` 已有 `root.dataset.initialized === "true"` 守卫、`installPreferencesBrand()` 已有 `#interlinear-brand-icon` 守卫；`_loadPane()` 本身按 `pane.loaded` 去重，切换标签不会重复执行脚本，因此不额外加状态。
- **全仓核对**：`addon/` 下 `.xhtml/.html` 现在 0 个内联事件属性、0 个内联 `<script>`、0 个 `javascript:` URL；`src/` 里注入的工具栏/右键菜单/聊天面板/划词弹窗/预览/导出 HTML 全部用 DOM API 或模板字符串构建，0 命中（导出 HTML 只有内联 `<style>`，`script-src` 不拦 style）。
- **静态测试**：新增 `test/inlineHandlers.node.test.mjs`（4 条用例），扫描 `addon/**/*.{xhtml,html}` 与 `src/**/*.ts` 的内联事件属性、内联 `<script>`、`javascript:` URL、`setAttribute("on…")`，并断言设置页确实注册了 `preferences-init.js`、脚本里确实有等待根节点的逻辑。已加入 `npm run test:unit` 列表。
- **测试适配**：面板初始化从「插入 DOM 时同步触发」变成「插入后异步引导」，19 处 `openPreferences()` 之后新增 `await waitForPrefsReady(win)`（等待 `dataset.initialized === "true"`，与既有「五标签切换」用例同一信号）。这是同步就绪信号，没有放宽任何断言。

### CSP 开关复测（Zotero 11 dev，隔离 profile）

- 做法：向 `.scaffold/test/profile/prefs.js` 追加 `user_pref("security.chrome_baseline_csp.enabled", true)` 后跑 `test:review`。
- 结果：迁移**前**跑一次仍是 59 passed（没有出现设置页失效）；迁移**后**再跑同样 59 passed。
- 结论：**无法证明该构建真的启用了基线 CSP**（若启用，迁移前那一次的内联 `onload` 理应被拦）。可能原因：该 pref 在此 dev 构建里未生效；或面板片段经 `parseXULToFragment` + `importNode` 插入，内联处理器在无 CSP 的惰性文档里编译，插入后不被复查。**未验证的推断，已记入待决定**。实验后已把该 pref 从测试 profile 移除，避免污染后续步骤。

### 改动文件

`addon/content/preferences.xhtml`、`addon/content/preferences-init.js`（新）、`src/hooks.ts`、`test/inlineHandlers.node.test.mjs`（新）、`test/startup.test.ts`、`package.json`、`docs/dev/PROGRESS.md`。

### 测试结果

- `npm run build`：通过。
- `npm run lint:check`：通过。
- `npm run test:unit`：177 pass / 0 fail（新增 4 条静态用例）。
- `npm run test:review`：Zotero 10.0.8 **59 passed**；Zotero 11.0-dev.5 **59 passed**。
- 首次尝试时 Zotero 10 报 1 fail、Zotero 11 报 4 fail（均为「断言紧跟在 `openPreferences` 之后，读到未回填的表单值」），按上面的 `waitForPrefsReady` 修好后两版本全绿。

### 未目视验证

- 真实 GUI 里打开设置→Interlinear 的首屏时序（脚本轮询期间是否出现一帧空白）。headless 只断言 DOM。
- CSP 真正生效后的表现（见上）。

### 我需要手动在 Zotero 里验证的清单

1. 打开设置→Interlinear：五个标签、表单值、预览卡片是否正常出现，无空白帧或闪烁。
2. 快速连续切换五个标签，再关闭重开设置窗口，确认不重复绑定、不报错。
3. 若手上有开启 `security.chrome_baseline_csp.enabled` 的 Zotero 11 构建，复测同一页面。

## Step 2：P0 脱敏（redactSecrets / logError）

### 做了什么

- 新增 `src/utils/redact.ts`（无 import，供 Node 类型剥离直接加载）：
  - `redactSecrets(text, knownSecrets)`：先替换本次会话持有的密钥原文（≥4 字符才处理，避免误伤短词），再用形状正则遮蔽 `sk-…`、`sk-ant-…`、`AIza…`、`Bearer <token>`、`x-api-key: <token>`、`x-goog-api-key: <token>`、`Authorization: <token>`（`Authorization` 用负向前瞻避免吞掉后面的 `Bearer`，保证输出仍是 `Authorization: Bearer ***`）。
  - `redactError(error, knownSecrets)`：保留 `name`/`stack`，只替换其中的密钥。
- 新增 `src/utils/log.ts`：`logError()`（统一走 `Zotero.logError(redactError(...))`，永不抛错）、`redactForDisplay()`（UI 文案脱敏）、`setLogSecretsProvider()`（由 `settings.ts` 注册，惰性读取三个 key）。
- **接入点**：
  - 5 个 provider 的错误格式化：`openai.ts`/`claude.ts`/`gemini.ts`/`chat.ts` 的 `httpError()` 入口统一 `detail = redactSecrets(detail)`；`google.ts` 两处 `detail` 直接包 `redactSecrets()`。
  - `src/modules/preferenceScript.ts`：10 处把错误原文塞进状态的 `String(error?.message || error)` 全部改为 `redactForDisplay(...)`（三个 provider 的连接测试 + 术语表/预设/导入等失败提示）。
  - 全仓 `Zotero.logError(` → `logError(`（9 个文件、27 处），统一脱敏后再交给 Zotero。
  - 把 `src/utils` 纳入 `lint:check` / `lint:fix` 的扫描范围。
- **单测**：`test/redact.node.test.mjs`（9 条），覆盖已知密钥多次出现、三种密钥形状、头部回显（文本与 JSON 两种写法）、`redactError` 保留 stack、nullish/非字符串输入、以及 7 条“无密钥文本不得改写”的正例（含 `task-management`、`disk-usage`、中文错误文案、sha512 摘要、模型名）。断言方式为“输出中不得出现原文，也不得出现密钥的任意 8 字符窗口”。

### 改动文件

`src/utils/redact.ts`（新）、`src/utils/log.ts`（新）、`src/providers/{openai,claude,gemini,google,chat}.ts`、`src/settings.ts`、`src/modules/preferenceScript.ts`、`src/{bilingualReader,chatPane,hooks,readerInteractions,readerToolbar,readerUI,readingLayout}.ts`、`test/redact.node.test.mjs`（新）、`package.json`。

### 测试结果

- `npm run build`：通过。
- `npm run lint:check`：通过。
- `npm run test:unit`：186 pass / 0 fail（新增 9 条）。
- `npm run test:review`：Zotero 10.0.8 **59 passed**；Zotero 11.0-dev.5 **59 passed**。

### 未目视验证 / 不确定

- 真实服务返回的 401 报文里，密钥形状若不是 `sk-`/`AIza` 前缀（例如自定义网关自己生成的 token），只能依赖“已知密钥原文替换”这一层——只要本次会话确实持有该 key，就能遮住；**未有真实 401 响应做过端到端验证**。
- `Authorization` 头部回显的 JSON 形式（带转义引号）只做了字符串级验证，未用真实响应体验证。

### 我需要手动在 Zotero 里验证的清单

1. 在设置页填入一个错误 key（如 `sk-test-000…`），点“测试连接”：失败提示里不应出现完整 key 或 8 位以上片段。
2. 打开帮助→调试输出，确认日志里没有 key。
3. 触发一次需要报错的路径（例如把 endpoint 填成不存在的域名），确认提示可读、没有被过度打码。

## Step 3：HTTPS/回环校验 + 拒绝重定向

### 做了什么

- 新增 `src/utils/endpointSafety.ts`（无 import，可被 Node 直接加载）：`assessEndpoint()` 判定 `https` 放行、`http` 仅允许 loopback（`localhost`/`*.localhost`/`127.0.0.0/8`/`::1`/`::ffff:127.0.0.1`）与私网（`10/8`、`172.16/12`、`192.168/16`、`169.254/16`、`fc00::/7`、`fe80::/10`），其余 `http://` 标记为 `public-http` 需要确认。
  - 处理了 `new URL()` 把 `::ffff:127.0.0.1` 归一化成 `::ffff:7f00:1` 的情况（否则 IPv4-mapped 回环会被误判成公网）。
  - 明确不做“字符串前缀匹配”：`127.0.0.1.evil.com`、`localhost.evil.com`、`192.168.1.1.evil.com` 都判为公网。
- **保存时二次确认（内联，不用系统弹窗）**：`preferences.xhtml` 新增 `#interlinear-save-confirm` 容器（`role=alert`、默认隐藏），`preferenceScript.ts` 新增 `findInsecureEndpoints()` / `showSaveConfirm()`；点保存时若存在公网 `http://` 端点，先展示“哪些主机、为什么”，用户点“仍然保存”才真正写入，点“取消”回到未保存状态。改了端点输入框会收起该提示。
- **端点提示**：openai / claude / gemini 三个带密钥的 endpoint 下方动态插入 `settings-endpoint-key-target-help`（“请求会把 API 密钥发送到这个地址，只填写你信任的端点”），插入是幂等的（按 id 去重）。
- **拒绝重定向**：新增 `src/providers/secureRequest.ts`（`NO_REDIRECT_OPTIONS = { followRedirects: false }`、`isRedirectStatus()`、`getRedirectLocation()`、`redirectErrorMessage()`），openai/claude/gemini/google/chat/ollama 六个请求全部带上该选项，并在非 2xx 分支最前面判断 3xx → 抛“端点发生了重定向，请在设置里直接填写最终地址”。依据是 `xpcom/http.js`：`followRedirects:false` 时 Zotero 在 `asyncOnChannelRedirect` 里取消通道，并返回 `status=3xx` + 只支持 `Location` 的替身对象，且**把重定向当 success**，所以必须在 provider 里显式判 3xx。
- **单测**：`test/endpointSafety.node.test.mjs`（8 条）覆盖 https/回环/私网/公网/仿冒/非法值/IPv6/带端口/带 userinfo/大小写；Ollama 默认 `http://127.0.0.1:11434` 有专门用例确认不被误伤。
- **集成测试**：新增「should refuse to follow a redirect that would resend the key」——用测试替身让 `Zotero.HTTP.request` 返回 302（与 Zotero 真实返回形态一致），断言：抛错、只发生 1 次请求（第二个主机从未被请求）、`options.followRedirects === false`、报错是重定向消息、错误信息不含密钥。

### 改动文件

`src/utils/endpointSafety.ts`（新）、`src/providers/secureRequest.ts`（新）、`src/providers/{openai,claude,gemini,google,chat,ollama}.ts`、`src/modules/preferenceScript.ts`、`addon/content/preferences.xhtml`、`addon/content/preferences.css`、`addon/locale/{en-US,zh-CN}/addon.ftl`（各 +6 键，535 → 541）、`typings/i10n.d.ts`（构建生成）、`test/endpointSafety.node.test.mjs`（新）、`test/startup.test.ts`、`package.json`。

### 测试结果

- `npm run build`：通过（需先 `npx zotero-plugin build` 重新生成 `typings/i10n.d.ts`，否则 tsc 不认识新键）。
- `npm run lint:check`：通过。
- `npm run test:unit`：194 pass / 0 fail（新增 8 条）。
- `npm run test:review`：Zotero 10.0.8 **60 passed**；Zotero 11.0-dev.5 **60 passed**。
- 首次跑红的原因：断言 `message` 含重定向地址，但集成测试里 `getString()` 会退化为消息 id（`_getString` 在 `addon` 全局不存在时返回 `interlinear-<id>`），改为断言消息 id 后通过。**这是测试环境的既有行为，不是回归。**

### 未目视验证 / 不确定

- 内联确认区的真实观感（宽度、换行、深浅主题对比度）未目视。
- 真实服务发生 302 时的行为只做了替身测试，没有对真实公网端点验证（避免向第三方发请求）。
- 是否该对 `http://` 的 Google 免费接口也提示：当前一并提示（它也会把原文发出去），未与产品确认。

### 我需要手动在 Zotero 里验证的清单

1. 把 OpenAI endpoint 改成 `http://api.example.com/v1/chat/completions` 后点保存：出现内联警告，点“仍然保存”才写入，点“取消”保持未保存。
2. 改成 `http://127.0.0.1:11434/v1/chat/completions`：不应出现警告（回环放行）。
3. 三个 endpoint 输入框下方都能看到“密钥会发送到这个地址”的提示；切换深浅主题确认对比度。
4. 若有一个会 302 的端点（可用本地代理模拟）：测试连接应报“端点发生了重定向”，而不是静默跟随。

## Step 4：OSKeyStore 存储（src/secrets.ts）

### 做了什么

- 新增 `src/secrets.ts`，只使用 Zotero 10 与 11 **共有**的接口（`Zotero.OSKeyStore.available / isEncrypted / encrypt / decrypt`），不碰 10 专有的 `confirmUnencryptedFallback`、`_usable`、`_error`。每次调用都有特性检测 + try/catch。
- **存储形态**：仍写原来的三个偏好键，值变成 `oskv1:<ciphertext>`（Zotero 自己给同步 API key 用的同一前缀）。底层由 Mozilla `OSKeyStore.sys.mjs` 提供密钥，即 macOS Keychain / Windows DPAPI / Linux libsecret。
- **同步读取**：`initSecrets()` 在启动时把所有已加密值解密进内存 `Map`；`getSecret()` 保持同步（缓存优先，未命中回落到“非前缀的明文”，绝不把密文当密钥返回）。`translateText()`、聊天发送、三个“测试连接”入口在首次使用前 `await whenSecretsReady()`。
- **写入**：`setSecret()` 先更新缓存再异步加密落盘，**回读确认以 `oskv1:` 开头**才算成功；失败时把原值写回（不会毁掉一个还能用的密钥），并记录 `lastWriteError` 供 UI 读取。
- **迁移**：`migratePlaintextSecrets()` 幂等（第二次看到前缀就跳过），失败保留明文、只提示一次、不阻塞翻译。旧明文读取路径保留（至少保留一个大版本，见 README）。
- **三态**：
  - 可用 → 加密落盘；
  - 不可用（无 `Zotero.OSKeyStore`，如 Linux 无 Secret Service）→ **不写任何明文**，值只留在内存（`session` 状态），并 `warn("keystore-unavailable")` 通知 UI；
  - 解密失败（换机器/换系统用户/密文损坏）→ `needs-reentry`，**不清空 pref**，`getSecret()` 返回空字符串（provider 会报“请先填写密钥”），等用户重新输入。
- **测试**：`test/startup.test.ts` 新增 `describe("API key storage")` 6 条（加密落盘、幂等迁移、钥匙串不可用时不写明文、垃圾密文不清空、初始化后同步读取、清除密钥）；测试里 key 一律是 `sk-test-000111222333444555`。

### 改动文件

`src/secrets.ts`（新）、`src/settings.ts`、`src/hooks.ts`、`src/bilingualReader.ts`、`src/chatPane.ts`、`src/modules/preferenceScript.ts`、`test/startup.test.ts`、`package.json`、`docs/dev/PROGRESS.md`。

### 测试结果

- `npm run build`：通过。
- `npm run lint:check`：通过（`src/secrets.ts` 已加入 lint 列表）。
- `npm run test:unit`：194 pass / 0 fail（本步未新增 node 单测，逻辑在集成层验证）。
- `npm run test:review`：Zotero 10.0.8 **66 passed**；Zotero 11.0-dev.5 **66 passed**（钥匙串在两边都可用，6 条用例未被 skip）。

### 偏差与说明

- **集成测试里有两个不同的模块实例**：设置页跑在打包后的插件里，而测试直接 import `src/`，两边各有自己的内存缓存。因此断言“保存后密钥可用”不能读测试侧 `getSecret()`，改为轮询 `Zotero.Prefs.get(key, true)` 并断言以 `oskv1:` 开头（`waitForStoredSecret()`）。同理，Gemini 聊天用例改为通过 `setSecret()` 写入，而不是直接改偏好（否则缓存不会更新）。
- 首轮跑红 2 条，都是上述原因，不是功能缺陷；调整后两版本全绿。

### 未实测（按约定不猜）

- macOS 钥匙串授权弹窗的时序与是否阻塞 UI。
- Linux 无 Secret Service 时的真实表现：代码走 `session` 分支，但没有真机验证；也没有验证 Zotero 10 的 `Zotero.OSKeyStore.available` 在该环境下返回 false 还是 `encrypt` 抛错。
- profile 换机器/换 OS 用户后的 `needs-reentry` 真实路径（只用 `oskv1:not-a-real-ciphertext` 模拟过）。
- 崩溃时内存中的明文是否会进入转储：未验证，属平台行为。

### 我需要手动在 Zotero 里验证的清单

1. 填一个假 key 保存后，`prefs.js` 里该键的值应以 `oskv1:` 开头、不含明文。
2. 重启 Zotero：设置页应显示“已使用系统钥匙串加密”，翻译仍能带 key 请求（可用“测试连接”看 401 而不是“请先填写密钥”）。
3. 把 `prefs.js` 里的值改成 `oskv1:garbage` 后重启：应显示“需要重新输入”，且该键不被清空。
4. 若在 Linux 上：无 libsecret 时应显示“仅本次会话有效”，且 `prefs.js` 不出现明文。

## Step 5：设置页密钥 UI

### 做了什么

- **三个密钥字段**（openai / claude / gemini）各新增一个状态文字（`role=status`、`aria-live=polite`）和一个“清除密钥”按钮。
- **掩码显示**：已保存的密钥在输入框里显示 `••••••••` + 末四位（长度为 4 以内则只显示掩码），并打上 `data-masked="true"`；聚焦即清空等待新输入；失焦且仍为空时把掩码恢复，避免“看起来没设置”。
- **显示/隐藏 8 秒自动回遮蔽**：点“显示”后 8 秒自动切回 `password` 并复位按钮文案与 `aria-pressed`。
- **输入即 trim**：`input` 事件里立刻去掉首尾空白，避免“看着一样、保存时被静默改掉”。
- **清除密钥**：同步清内存缓存 + 删偏好 + 清空输入框 + 刷新状态，并在保存状态行提示“密钥已清除”。
- **四种状态**：`已使用系统钥匙串加密` / `未加密保存` / `仅本次会话有效` / `需要重新输入`，用 `data-state` 控制图标（✓ 或 !）与对比度；空状态不占位。
- **钥匙串不可用时的二次确认（内联，非系统弹窗）**：点保存时若用户填了新密钥且 `isKeystoreAvailable() === false`，在 `#interlinear-save-confirm` 里给出三个按钮：`仅本次会话`（默认、聚焦）/ `仍然不加密保存` / `取消`。选“不加密”后 `setSecret(..., { allowPlaintext: true })`，随后状态持续显示“未加密保存”。**任何路径都不会静默写明文。**
- **保存时不覆盖未改动的密钥**：`readSecretInput()` 在“仍是掩码”时返回 `undefined`，`saveSettings` 跳过写入；为防止程序化赋值被误判成掩码，判定条件是“`data-masked` 为真**且**值仍等于当前掩码”。
- **保存后刷新**：密钥是异步落盘的，保存后 150ms 与 800ms 各刷新一次状态与掩码（不阻塞保存状态提示）。
- **文案**：新增 9 个键（en/zh 各一次，535 → 550，两边一致）；同时把三条 `provider-*-api-key-help` 从“明文保存”改为“加密保存”，避免与新行为矛盾。

### 改动文件

`src/modules/preferenceScript.ts`、`addon/content/preferences.xhtml`、`addon/content/preferences.css`、`addon/locale/{en-US,zh-CN}/addon.ftl`、`typings/i10n.d.ts`（生成）、`test/startup.test.ts`、`docs/dev/PROGRESS.md`。

### 测试结果

- `npm run build`：通过。
- `npm run lint:check`：通过。
- `npm run test:unit`：194 pass / 0 fail。
- `npm run test:review`：Zotero 10.0.8 **67 passed**；Zotero 11.0-dev.5 **67 passed**（新增「masks a stored key and clears it from the pane」，覆盖掩码、状态文字与清除按钮）。
- 文案改动后又完整跑了一遍两版本，仍 67 / 67。

### 未目视验证

- 掩码字体在 13px 下的观感、`••••••••` 在窄窗口是否被截断。
- 8 秒自动回遮蔽与“显示”按钮的交互手感。
- 内联确认区三个按钮在 600px 下的换行与焦点顺序（代码里把第一个按钮 `focus()`，键盘 Tab 顺序按 DOM）。
- 深浅主题下 `data-state="plaintext"`/`needs-reentry` 的警告图标对比度。

### 我需要手动在 Zotero 里验证的清单

1. 填入假 key 保存：输入框变成 `••••••••` + 末四位，状态显示“已使用系统钥匙串加密”。
2. 点输入框：内容清空，可直接输入新 key；不输入直接点走：掩码恢复。
3. 点“显示”：8 秒后自动回到遮蔽；再点“显示/隐藏”手动切换正常。
4. 点“清除密钥”：输入框清空、`prefs.js` 中该键消失、状态文字消失。
5. 在 Linux（无 libsecret）或临时把 `Zotero.OSKeyStore` 置空：保存时出现三个按钮的内联确认，选“仅本次会话”后状态为“仅本次会话有效”；选“仍然不加密保存”后 `prefs.js` 里是明文且状态持续显示“未加密保存”。
