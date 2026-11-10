# Interlinear 设置项总表

本文档与 `src/settings.ts`、`src/appearance.ts`、`addon/prefs.js` 保持同步。
所有偏好都在 `extensions.zotero.interlinear.` 下（下文省略前缀）。
外观的完整结构另存为 JSON 偏好 `appearance.v2`；旧逐字段偏好继续写入以兼容旧代码。

## 1. 翻译服务与语言

| 偏好键 | 类型 | 范围 / 取值 | 默认 | 作用 | 影响缓存键 / 需重新翻译 |
|---|---|---|---|---|---|
| `engine` | string | google / openai / claude / gemini / ollama | google | 当前翻译后端 | 是（引擎标签进入缓存键） |
| `language.source` | string | auto + 13 种语言 | auto | 原文语言 | 是（非默认语言对进入缓存键） |
| `language.target` | string | 13 种目标语言 | zh-CN | 译文语言、RTL/自动字体判断 | 是（目标语言进入缓存键） |
| `google.baseUrl` | string | URL | https://translate.googleapis.com | Google 免费接口/镜像地址 | 是（归一化端点进入标签） |
| `openai.endpoint` | string | Chat Completions URL | http://127.0.0.1:11434/v1/chat/completions | OpenAI 兼容接口 | 是（端点/模型/提示词/温度哈希） |
| `openai.model` | string | 非空 | gpt-oss:20b | 模型名 | 是 |
| `openai.apiKey` | string | 任意 | 空 | 鉴权密钥（明文存 prefs，不进缓存键/日志） | 否 |
| `openai.prompt` | string | 任意 | 内置学术翻译提示词 | 系统提示词 | 是 |
| `openai.temperature` | number | 0–2 | 0.2 | 采样温度 | 是 |
| `claude.endpoint` | string | Messages API URL | https://api.anthropic.com/v1/messages | Claude 接口 | 是 |
| `claude.model` | string | 非空 | claude-sonnet-4-5 | 模型 | 是 |
| `claude.apiKey` | string | 任意 | 空 | x-api-key（明文） | 否 |
| `claude.prompt` | string | 任意 | 内置提示词 | 系统提示词 | 是 |
| `claude.temperature` | number | 0–1 | 0.2 | 温度 | 是 |
| `gemini.baseUrl` | string | 服务地址 | https://generativelanguage.googleapis.com | Gemini 接口 | 是 |
| `gemini.model` | string | 非空 | gemini-2.5-flash | 模型 | 是 |
| `gemini.apiKey` | string | 任意 | 空 | x-goog-api-key（明文） | 否 |
| `gemini.prompt` | string | 任意 | 内置提示词 | 系统提示词 | 是 |
| `gemini.temperature` | number | 0–2 | 0.2 | 温度 | 是 |
| `ollama.url` | string | URL | http://127.0.0.1:11434 | Ollama 地址 | 是 |
| `ollama.model` | string | 非空 | gpt-oss:20b | 模型 | 是 |
| `glossary` | string | CSV/TSV，≤2000 条 | 空 | 术语表（LLM 后端提示词 + 译后替换） | 是（术语哈希进入缓存键，所有引擎） |

## 2. 调度与范围

| 偏好键 | 类型 | 范围 | 默认 | 作用 | 影响缓存键 / 需重新翻译 |
|---|---|---|---|---|---|
| `requestGapMs` | number | 0–5000 ms | 250 | 请求启动间隔 | 否 |
| `maxConcurrent` | number | 1–3 | 2 | 并发请求上限（Ollama 实际串行） | 否 |
| `maxCharsPerRequest` | number | 500–8000 | 2800 | 单次请求字符上限 | 否 |
| `maxBatchParagraphs` | number | 1–12 | 6 | 单次合并段落数 | 否 |
| `maxConsecutiveErrors` | number | 1–20 | 3 | 连续失败暂停阈值 | 否 |
| `requestTimeoutMs` | number | 5000–300000 ms | 60000 | 单请求超时 | 否 |
| `skipLastPages` | number | 0–50 | 1 | 跳过末尾页（参考文献） | 否；下次全量翻译生效 |
| `scope.body` | boolean | true/false | true | 翻译正文段落 `p` | 否；下次全量翻译生效 |
| `scope.titles` | boolean | true/false | true | 翻译 `h1`–`h6` | 否 |
| `scope.captions` | boolean | true/false | true | 翻译 `figcaption` | 否 |
| `scope.listItems` | boolean | true/false | true | 翻译 `li` | 否 |
| `scope.notes` | boolean | true/false | true | 翻译 `aside.sdt-note` | 否 |

## 3. 显示与交互

| 偏好键 | 类型 | 范围 / 取值 | 默认 | 作用 | 影响缓存键 / 需重新翻译 |
|---|---|---|---|---|---|
| `displayMode` | string | top-bottom / side-by-side / target-only / source-only | top-bottom | 译文块布局 | 否 |
| `interaction.hoverTranslate` | boolean | true/false | true | 悬停自动翻译开关 | 否 |
| `interaction.hoverDelayMs` | number | 200–5000 ms | 800 | 悬停停留时间 | 否 |
| `interaction.hoverModifier` | string | none / alt / ctrl | none | 悬停时必须按住的修饰键 | 否 |
| `interaction.shortcutEnabled` | boolean | true/false | true | 单段翻译快捷键开关 | 否 |
| `interaction.shortcut` | string | 合法组合键 | Alt+Enter | 单段翻译快捷键 | 否 |
| `interaction.toggleShortcutEnabled` | boolean | true/false | false | 显示/隐藏快捷键开关 | 否 |
| `interaction.toggleShortcut` | string | 合法组合键 | Alt+Shift+T | 显示/隐藏译文 | 否 |
| `interaction.displayShortcutEnabled` | boolean | true/false | false | 排版循环快捷键开关 | 否 |
| `interaction.displayShortcut` | string | 合法组合键 | Alt+Shift+D | 循环四种排版 | 否 |
| `interaction.autoTranslateOnOpen` | string | off / cached / always | off | 打开 PDF 时自动显示缓存或全文翻译 | cached：只读缓存；always：会发请求 |

快捷键冲突：与另一个 Interlinear 快捷键完全相同，或命中 Ctrl/Cmd + A/C/F/L/N/O/P/Q/R/S/T/V/W/X/Y/Z 等常见组合时显示警告；只警告，不阻止保存。

## 4. 外观（逐字段兼容偏好）

| 偏好键 | 类型 | 范围 | 默认 | 作用 |
|---|---|---|---|---|
| `appearance.fontSize` | number | 10–32 | 16 | 译文字号（px 模式） |
| `appearance.color` | string | 合法 CSS 颜色 | 空 | 译文文字色（旧字段，主题模式为空） |
| `appearance.fontFamily` | string | 安全 CSS 字体栈 | 空 | 最终 font-family（旧字段） |
| `appearance.lineHeightPercent` | number | 100–250 | 175 | 行高 ×100 |
| `appearance.paragraphSpacing` | number | 0–300 | 125 | 段后距 ×100（em） |
| `appearance.background` | string | 合法 CSS 颜色 | 空 | 译文背景（旧字段） |
| `appearance.theme` | string | auto / light / dark | auto | 译文块配色主题 |
| `appearance.underline` | boolean | true/false | false | 是否下划线（与 textDecoration 同步） |
| `appearance.underlineColor` | string | 合法 CSS 颜色 | 空 | 下划线颜色（旧字段） |
| `appearance.ribbon` | boolean | true/false | true | 左侧色带开关 |
| `appearance.ribbonColor` | string | 合法 CSS 颜色 | #2f6fdf | 色带颜色（旧字段） |
| `appearance.schema` | number | 1–99 | 3 | 外观 schema 版本 |
| `appearance.v2` | JSON string | 见下节 | 无 | 完整外观结构；存在时优先读取 |

## 5. 外观 v2 结构（`appearance.v2`）

`normalizeAppearance()` 会对所有字段做白名单/夹取；非法颜色、字体、枚举会回退默认。默认输出由快照测试固定。

| 字段 | 类型 | 范围 / 取值 | 默认 | 作用 |
|---|---|---|---|---|
| `fontSize` | number | 10–32 | 16 | px 字号 |
| `fontSizeMode` | string | px / em | px | 字号单位 |
| `fontSizeEm` | number | 0.9–1.2 | 1 | 相对阅读器字号 |
| `fontStack` | object | `{primary, fallbacks[≤6], generic}` | 空 | 结构化字体栈 |
| `fontFamily` | string | 安全 CSS 字体栈 | 空 | 派生/高级 CSS 值 |
| `fontWeight` | number | 100–900（步进 100） | 400 | 字重 |
| `fontStyle` | string | normal / italic | normal | 斜体 |
| `letterSpacing` | number | -0.05–0.3 em | 0 | 字距 |
| `autoFontByLanguage` | boolean | true/false | true | 无显式字体时按目标语言选栈（zh 继承阅读器字体） |
| `textDirection` | string | auto / ltr / rtl | auto | 文字方向；auto 按目标语言判断 |
| `lineHeight` | number | 1–2.5 | 1.75 | 行高 |
| `paragraphSpacing` | number | 0–3 em | 1.25 | 段后距 |
| `theme` | string | auto / light / dark | auto | 配色主题 |
| `colors` | object | 9 个角色 × `{mode, light, dark}` | 见下 | 颜色系统 |
| `textDecoration` | string[] | underline / overline / line-through | [] | 文字装饰 |
| `textDecorationStyle` | string | solid/double/dotted/dashed/wavy | solid | 装饰线型 |
| `textDecorationThickness` | number | 0=自动，0.5–8 px | 0 | 装饰粗细 |
| `textUnderlineOffset` | number | -1=自动，0–12 px | -1 | 装饰距文字 |
| `textDecorationSkipInk` | string | auto / none | auto | 是否避开字母下沿 |
| `divider` | boolean | true/false | false | 段落分隔线开关 |
| `dividerStyle` | string | solid/dashed/dotted/double | solid | 分隔线线型 |
| `dividerWidth` | number | 1–6 px | 1 | 分隔线粗细 |
| `dividerOffset` | number | 0–2 em | 0 | 分隔线与文字距离 |
| `ribbon` | boolean | true/false | true | 色带开关 |
| `ribbonPosition` | string | left / right | left | 色带位置 |
| `ribbonWidth` | number | 1–12 px | 4 | 色带宽度 |
| `ribbonStyle` | string | solid/dashed/dotted/double | solid | 色带线型 |
| `ribbonRadius` | number | 0–8 px | 0 | 色带侧圆角 |
| `ribbonPadding` | number | 0–2 em | 0 | 色带与文字间距 |
| `blockPaddingY` | number | 0–2 em | 0.45 | 译文块垂直内边距 |
| `blockPaddingX` | number | 0–2 em | 0.95 | 译文块水平内边距 |
| `blockRadius` | number | 0–16 px | 0 | 译文块圆角 |
| `blockBorderWidth` | number | 0–4 px | 0 | 译文块边框宽 |
| `blockBorderStyle` | string | solid/dashed/dotted/double | solid | 边框线型 |
| `blockIndent` | number | 0–4 em | 0 | 左缩进（margin-inline-start） |
| `firstLineIndent` | number | 0–4 em | 0 | 首行缩进 |
| `textAlign` | string | start / justify / center | start | 对齐 |
| `maxWidthCh` | number | 0=不限，40–100 ch | 0 | 最大宽度 |
| `opacity` | number | 40–100 % | 100 | 译文块不透明度 |
| `sourceDim` | number | 40–100 % | 100 | 显示译文时原文淡化 |
| `sourceGap` | number | 0–2 em | 0.65 | 原文与译文间距 |
| `uiFollowAppearance` | boolean | true/false | true | 划词弹窗/阅读助手跟随译文字体字号 |
| `popupMaxWidth` | number | 280–720 px | 380 | 划词弹窗最大宽度 |
| `exportMode` | string | reader / print | reader | 导出 PDF 外观 |
| `stateAnimation` | boolean | true/false | false | 加载占位动画 |
| `reduceMotion` | boolean | true/false | false | 减少动画（并始终尊重系统 prefers-reduced-motion） |

### 颜色角色

| 角色 | 用途 | 主题模式默认（浅/深） |
|---|---|---|
| `text` | 译文文字 | 继承阅读器 |
| `background` | 译文背景 | 继承阅读器 |
| `underline` | 文字装饰颜色 | 跟随文字 |
| `ribbon` | 色带 | #2f6fdf / #4f8ff0 |
| `border` | 译文块边框 | #d9d9d9 / #4a4a4a |
| `divider` | 段落分隔线 | #d9d9d9 / #4a4a4a |
| `source` | 原文淡化颜色 | #666666 / #a8a8a8 |
| `loading` | 加载中状态 | #666666 / #a8a8a8 |
| `error` | 出错状态 | #c7354a / #ff8a9a |

每个角色有 `mode = theme | single | split`；`single` 用 `light`，`split` 分浅/深。带 alpha 的颜色规范化为 8 位 HEX。

## 6. 外观 UI 偏好

| 偏好键 | 类型 | 上限 | 作用 |
|---|---|---|---|
| `appearance.fontFavorites` | JSON string[] | 24 | 收藏字体（去重、大小写不敏感） |
| `appearance.fontDetection` | JSON object | 512 字体 / 30 天 TTL | 字体检测缓存（版本 1） |
| `appearance.recentColors` | JSON string[] | 12 | 取色器最近使用 |
| `appearance.savedColors` | JSON string[] | 24 | “我的颜色” |
| `appearance.presets` | JSON array | 20 | “我的方案”（名称 + 完整外观） |

## 7. 缓存

| 偏好键 | 类型 | 作用 |
|---|---|---|
| `cache.v4.index` | JSON object | LRU 索引（条目数/字符数，上限 1500 条 / 600 万字符） |
| `cache.v4.{engineHash}.{itemKey}.{len}.{textHash}.{targetLang}` | string | 单条译文；引擎标签包含 provider 配置指纹、语言对、术语表哈希（不含 API Key） |

**不会进入缓存键**：外观（字体/颜色/装饰/块布局）、显示模式、悬停/快捷键、翻译范围、导出模式、UI 跟随。修改这些只重新应用 CSS/收集范围，不会重新请求已有译文。

**会进入缓存键/需要重新翻译**：引擎、端点、模型、提示词、温度、原文/目标语言、术语表（哈希）。轮换 API Key 不影响缓存命中。

## 8. 安全与校验

- 所有颜色只接受 `#RGB/#RRGGBB/#RRGGBBAA`、`rgb()/rgba()`、`hsl()/hsla()` 与纯字母命名色；拒绝分号、花括号、`url()`、`expression`、换行。
- 字体名只接受 Unicode 字母/数字/空格/点/下划线/连字符，≤80 字符；拒绝引号/括号/逗号/分号/花括号/反斜杠/控制字符。
- 数值在读取与保存两侧夹取；枚举走白名单；导入 JSON ≤256KB，未知键忽略并报告。
- API Key 以明文存 Zotero preferences，不写入日志、缓存键或导出文件。
