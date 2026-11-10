<p align="center">
  <img src="addon/content/icons/icon96.png" width="96" alt="Interlinear" />
</p>

# Interlinear

**Zotero 10 阅读模式 PDF 段落中英对照翻译。**

> Based on [quillamio/bilingual-reader](https://github.com/quillamio/bilingual-reader), AGPL-3.0-or-later.

> **请先卸载原版 Bilingual Reader 再安装本插件。** 两者会向同一个阅读器工具栏区域注入按钮；本插件首次启动时会把原版的偏好设置与翻译缓存复制到新的命名空间，原版数据不会被清除。

在 Zotero 10 的 PDF 阅读模式中读取结构化段落，将英文原文与中文译文按段落连续显示，适合论文精读。

> 本插件由 GPT 编写。

<details>
<summary><b>English</b></summary>

**Interlinear** shows source paragraphs and their translations consecutively inside Zotero 10's PDF reader.

**Features**

- Small toolbar icon: left-click toggles paragraph translation; right-click opens a menu with every action. A second toolbar button cycles display modes (translation below, side by side, target only, source only).
- Built-in backends: Google Translate (default, no key), OpenAI-compatible APIs, Anthropic Claude, Google Gemini, and Ollama. No other plugin is required.
- Full-document translation with progress, cancellation, automatic pause after repeated failures, and click-to-retry on failed or paused paragraphs.
- Per-paragraph hover translation (configurable delay and on/off) and a configurable keyboard shortcut; both work as soon as reading mode is ready, without starting a full translation first, and reuse in-flight full-document requests instead of calling the service twice.
- Selection translation from a popup, short-paragraph batching, concurrency limits, request throttling, and timeouts.
- Translation queue prioritizes the visible viewport and re-sorts while you page through the document.
- Glossary import/export with prompt injection for LLM backends and post-translation replacement for every backend, including Google. Cache keys include provider configuration and the glossary hash.
- Translation cache, trailing-page skipping, configurable source/target languages, full appearance settings (font presets, size, color pickers and swatches with an inherit-theme option, line and paragraph spacing, theme, underline, ribbon), inline connection-test feedback for every backend, and a reading-assistant chat sidebar with selection/page/document context. Side-by-side mode aligns the first line of source and translation.
- Export the current bilingual reading view as a searchable PDF attached to the Zotero item.
- Non-blocking in-reader notices for errors instead of modal alerts.
- UI available in English and Simplified Chinese.

**Install**

Install from **Releases** (`Tools → Plugins → gear → Install Plugin From File`), then open an English PDF in Zotero and click the Interlinear icon. Please uninstall the original Bilingual Reader first; this plugin copies its preferences and cache into a new namespace on first start.

**Configuration**

Open `Settings → Interlinear`:

- Backend: Google / OpenAI-compatible / Claude / Gemini / Ollama, each with its endpoint, model, and key. Keys are stored as plaintext in Zotero preferences and are never written to logs or cache keys.
- Source and target languages, display mode.
- Appearance of translations.
- Hover translation toggle and dwell delay, shortcut toggle and key combination.
- Glossary import/export, trailing pages to skip, concurrency, request gap, maximum characters and paragraphs per request, timeout, pause threshold, and cache cleanup.

**Known limits**

- Defaults to English → Simplified Chinese; other language pairs depend on the selected backend and model.
- Tables and math are not translated cell-by-cell.
- Scanned PDFs depend on Zotero's text layer.
- Zotero reader internals may change between releases.

**Acknowledgements**

Based on [quillamio/bilingual-reader](https://github.com/quillamio/bilingual-reader). The original copyright notices and LICENSE are preserved.

**License**

AGPL-3.0-or-later.

</details>

## 主要功能

- 阅读器工具栏上的小型 Interlinear 图标：左键开启 / 关闭段落中英对照，右键打开全部功能菜单。
- 工具栏另有显示模式按钮：单击在“译文在下 / 左右并排 / 仅译文 / 仅原文”之间循环切换。
- 右键菜单：开启 / 关闭、重新翻译全文、取消任务、四种显示模式、导出双语 PDF、打开阅读助手、翻译设置。
- 内置翻译后端：**Google 翻译**（默认，无需密钥）、**OpenAI 兼容接口**、**Anthropic Claude**、**Google Gemini**、**Ollama**，不再依赖其他插件。
- 自动缓存已完成译文，并按后端、语言与术语表区分缓存。
- 支持短段落合并、受控并发、请求节流、超时与连续失败暂停；失败或暂停的段落可直接点击重试，错误以阅读器内非阻塞提示显示。
- 翻译队列优先处理当前视口内的段落，并在翻页时重新排序。
- 可设置“不翻译末尾页数”，用于跳过参考文献。
- 支持术语表、单段翻译与选区翻译、阅读助手侧栏聊天；术语表会注入 LLM 提示词，并在所有后端（包括 Google）返回后做统一替换。
- 鼠标在段落上停留可自动翻译该段（停留时间可配置，可关闭）；也可用自定义快捷键翻译当前段落，单段请求会与全文翻译去重。
- 可配置原文与译文语言；外观（字号、颜色、字体、行高、段落间距、主题、下划线、色带）均可调整。
- 将当前双语阅读结果导出为 PDF，并添加为当前文献的 Zotero 附件。

## 环境

- Zotero 10.x
- Windows 上完成开发与 Zotero headless 集成测试；CI 在 Ubuntu 与 macOS 上执行构建
- 翻译后端自行选择：Google 翻译开箱即用；OpenAI 兼容 / Claude / Gemini 需要填写对应的接口、模型与密钥；Ollama 需要本地或可访问的 Ollama 服务。

## 安装

从本仓库 **Releases** 下载最新版 `.xpi` 文件，然后在 Zotero 中：

```text
工具 → 插件 → 右上角齿轮 → 从文件安装插件
```

安装后如有提示，请重启 Zotero。

## 使用

1. 在 Zotero 10 中打开英文 PDF。
2. 左键点击阅读器顶部的 **Interlinear 图标**（红色 Z 与 A/文 翻译卡片）。
3. 等待 Zotero 生成阅读模式结构化文本。
4. 中文译文会显示在对应英文段落下方。
5. 右键点击该图标可打开功能菜单：重新翻译、取消、切换显示模式、导出 PDF、打开阅读助手、进入翻译设置。

可以配置：

- 翻译后端（Google / OpenAI 兼容 / Claude / Gemini / Ollama）及各自的接口、模型与密钥；密钥以明文形式保存在 Zotero 偏好设置中，不会写入日志或缓存键；
- 原文与译文语言；
- 译文外观：字号、行高、段落间距、主题、下划线、色带；颜色统一使用取色器与快捷色块，可勾选“跟随主题”；字体提供 Georgia、Times New Roman、Arial、微软雅黑、宋体等预设，也可手动输入；
- 显示模式；
- 单段翻译：悬停自动翻译开关与停留时间、快捷键开关与组合键；无需先开启全文对照，阅读模式就绪后即可直接悬停或按快捷键；
- 各翻译后端的“测试连接”，会就地显示运行中、成功、警告或失败原因；
- 术语表导入 / 导出；
- 不翻译末尾页数；
- 最大并发请求；
- 请求启动间隔；
- 单次请求最大字符数；
- 单次合并段落数；
- 请求超时；
- 连续失败后暂停；
- 翻译缓存清理。

## PDF 导出

当前导出目标是生成**重新排版的可搜索双语 PDF**，再作为附件加入当前 Zotero 文献条目。

它不是在出版社原始 PDF 页面上直接覆盖中文，因此复杂图片、延迟加载内容或特殊排版可能无法完全保留。该功能仍在持续适配 Zotero 10 的打印接口。

## 当前限制

- 默认英文 → 简体中文，可在设置中调整原文与译文语言；其他语言对的实际效果取决于所选后端与模型。
- 表格暂不逐单元格翻译。
- 数学公式不会作为普通文本翻译。
- 扫描版 PDF 取决于 Zotero 能否生成可用文本。
- Zotero 阅读模式属于内部实现，后续 Zotero 更新可能需要重新适配。

## 图标

插件图标由本项目作者提供（红色 Z 与 A/文 翻译卡片，圆角方形底板），源文件为仓库根目录的
`Zotero Translation Icon.png`（1254×1254）。各尺寸由该源文件等比缩放生成，未改动图形内容，全部本地打包，运行时不依赖外部网络。

| 文件 | 尺寸 | 用途 |
| --- | --- | --- |
| `addon/content/icons/icon16.png` | 16×16 | 小尺寸备用 |
| `addon/content/icons/icon20.png` | 20×20 | 阅读器工具栏对照按钮（界面中显示为 16px） |
| `addon/content/icons/icon32.png` | 32×32 | 中尺寸备用 |
| `addon/content/icons/icon48.png` | 48×48 | 插件管理器图标 |
| `addon/content/icons/icon96.png` | 96×96 | 插件管理器高清图标、设置页顶部 |
| `addon/content/icons/favicon.png` | 32×32 | ztoolkit 进度窗口默认图标 |
| `addon/content/icons/favicon@0.5x.png` | 16×16 | 小尺寸备用 |

重译（🔄）与导出（🖨️）按钮仍使用 emoji，与主图标一起缩小显示。

## 开发

```bash
npm install
npm run build        # 类型检查 + 打包 xpi
npm run lint:check
npm run test:unit    # Node 单元测试
npm run test:review  # Zotero headless 集成测试（需设置 ZOTERO_PLUGIN_ZOTERO_BIN_PATH）
```

构建产物位于 `.scaffold/build/interlinear.xpi`。

## 许可证

AGPL-3.0-or-later。原项目 [quillamio/bilingual-reader](https://github.com/quillamio/bilingual-reader)
的版权声明与 LICENSE 全部保留；本仓库由 Muanyan-mjq 维护。
