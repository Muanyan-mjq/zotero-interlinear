<p align="center">
  <img src="addon/content/icons/icon96.png" width="96" alt="Interlinear" />
</p>

# Interlinear

在 Zotero 10 里精读外文论文：每个原文段落下面，直接跟着它的译文。

Interlinear 接入桌面版 PDF 阅读器的阅读模式，逐段获取结构化文本的译文并渲染在原文旁边——不用再复制粘贴到翻译软件里来回切换。

[English](README.md) · [更新日志](CHANGELOG.md) · [贡献指南](CONTRIBUTING.md)

<!-- 截图占位（发布前在干净的 Zotero 10 配置下补拍）：
     docs/images/toolbar-toggle.png       阅读器工具栏：Interlinear 开关、显示模式按钮与进度
     docs/images/settings-appearance.png  设置页：实时预览卡片与保存栏
     docs/images/side-by-side.png         左右分栏阅读效果
-->

## 功能

- **内置五种翻译服务。** Google 翻译开箱即用、无需密钥；OpenAI 兼容接口、Anthropic Claude、Google Gemini、Ollama 在设置页填好即可使用，不依赖任何其他插件。
- **四种显示布局。** 译文在下、左右并排、仅译文、仅原文。旁边的显示模式按钮一键循环切换；左右并排时原文与译文首行对齐，且不影响 Zotero 原生高亮的位置。
- **一个工具栏开关。** 工具栏主按钮首次点击开启全文翻译，之后用于显示/隐藏译文；翻译进行中点击会暂停并隐藏，再次点击显示译文并继续未完成的段落。每个阅读器的状态互相独立。
- **读到哪翻到哪。** 鼠标停留、自定义快捷键、Alt 单击、划词弹窗，四种方式都能只翻当前段落，无需先开启全文翻译。
- **可控的全文翻译。** 工具栏显示进度、可随时取消；队列优先翻译当前视口并在翻页时重排；支持短段落合并、并发与节流、超时、连续失败自动暂停；失败段落点击即可重试。
- **术语表。** 支持 CSV / TSV 导入导出；术语会注入大模型提示词，并在所有服务（包括 Google）的返回结果上统一强制替换。
- **阅读助手。** 侧边栏聊天，可针对选中段落、当前页或全文提问（仅大模型类服务可用）。
- **双语 PDF 导出。** 把当前对照阅读结果重新排版为可搜索 PDF，自动存为该文献的 Zotero 附件。
- **译文外观自定义与实时预览。** 预览卡片复用阅读器的同一套 CSS，调整字号、颜色或布局时即时更新。字号、字体选择器（跨平台字体栈 + 自定义字体）、取色器与快捷色块的文字/背景/下划线/色带颜色、行高、段落间距、浅色/深色/跟随主题、下划线、左侧色带（默认蓝色）。
- **翻译缓存。** 按服务、语言对与术语表区分缓存，设置页可一键清理。
- 界面提供英文与简体中文；错误以阅读器内非阻塞提示条显示。

## 安装

1. 从 [Releases](https://github.com/Muanyan-mjq/zotero-interlinear/releases) 下载最新的 `interlinear.xpi`。
2. 在 Zotero 中打开 **工具 → 插件 → 右上角齿轮 → 从文件安装插件…**，选择该 `.xpi`。
3. 如有提示，重启 Zotero。

仅支持 **Zotero 10 桌面版**。从原插件迁移过来的用户请先看[致谢](#致谢)一节。

## 配置

打开 **编辑 → 设置 → Interlinear**。设置页带快速导航、外观实时预览，以及滚动时保持可见的保存栏；有改动未保存时会显示提示：

- **服务**：选择翻译后端，填写各自的接口地址、模型与密钥；选择原文与译文语言。每个后端都有"测试连接"按钮，就地显示测试中、成功或具体失败原因。
- **显示**：默认布局、悬停翻译（开关与停留时间）、单段翻译快捷键。
- **外观**：实时预览 + 上述外观项；颜色统一用取色器与快捷色块，并可勾选"跟随主题"。
- **范围**：跳过末尾页数（如参考文献），以及速度与可靠性参数：并发数、请求间隔、单次请求上限、超时、连续失败暂停阈值。
- **术语表**：导入 / 导出术语文件。
- **维护**：翻译缓存用量查看与清理。

> **隐私提示。** 开启翻译即表示段落文本会发送给你选择的服务。API 密钥以明文保存在 Zotero 偏好设置中，不会写入日志或缓存键。敏感文档请勿使用不可信的服务翻译。

## 使用

1. 在 Zotero 中打开 PDF，进入**阅读模式**。
2. 左键点击工具栏的 Interlinear 图标开始全文对照；已有译文后，同一按钮用于隐藏译文回到原文、再次点击恢复显示。翻译进行中点击会暂停并隐藏，再次显示译文时继续未完成段落。右键图标可重新翻译、取消、导出或打开设置。
3. 旁边的显示模式按钮循环切换四种布局。失败或暂停的段落会显示重试入口，点击只重试该段。
4. 阅读过程中，悬停段落、按快捷键、Alt 单击或划词即可只翻译当前部分；全文翻译进行中时，这些单段触发会复用在途请求，不会重复调用服务。
5. 在阅读器侧边栏打开阅读助手，可就选中段落、当前页或全文提问；工具栏菜单可将当前双语结果导出为 PDF 附件。

## 已知限制

- 仅支持桌面版 Zotero 10；不支持移动端与 Zotero 7。
- 依赖 Zotero 阅读模式的内部接口（非公开 API），Zotero 升级后可能失效，需要重新适配。
- 数学公式不翻译；表格不逐单元格翻译；图片内容不提取。
- 扫描版 PDF 的效果取决于 Zotero 自身文本层的质量。
- 导出是重新排版的双语 PDF，不是在出版社原始页面上叠加译文。
- 默认英文 → 简体中文；其他语言对的效果取决于所选服务与模型。

## 路线图（计划中）

以下为计划项，尚未实现，没有承诺的时间表：

- 表格逐单元格翻译。
- 跟进未来 Zotero 版本的阅读模式接口变化并适配。

## 开发

```bash
npm install
npm run build        # 类型检查 + 打包 .scaffold/build/interlinear.xpi
npm run lint:check   # ESLint
npm run test:unit    # Node 单元测试，无需 Zotero
npm start            # 开发服务器；先在 .env 配置 ZOTERO_PLUGIN_ZOTERO_BIN_PATH
```

集成测试使用真实的无头 Zotero：

```bash
ZOTERO_PLUGIN_ZOTERO_BIN_PATH="/path/to/zotero" npm run test:review
# 或标准入口：
ZOTERO_PLUGIN_ZOTERO_BIN_PATH="/path/to/zotero" npm test
```

Windows 下路径通常为 `C:\Program Files\Zotero\zotero.exe`。CI 在每次推送到 `main` 时执行 lint、Ubuntu/macOS 构建与测试套件。

## 许可证

[AGPL-3.0-or-later](LICENSE)。

## 致谢

Interlinear 基于 [quillamio/bilingual-reader](https://github.com/quillamio/bilingual-reader)（AGPL-3.0-or-later）开发；改编来源与模板出处完整记录在 [NOTICE.md](NOTICE.md)。如果你之前使用原版 Bilingual Reader，请先卸载它再安装 Interlinear——首次启动时，旧版设置与翻译缓存会复制到 Interlinear 自己的命名空间，原有数据不会被清除。