<p align="center">
  <img src="addon/content/icons/icon96.png" width="96" alt="Interlinear" />
</p>

# Interlinear

**Zotero 10 阅读模式 PDF 段落中英对照翻译。**

> Based on [quillamio/bilingual-reader](https://github.com/quillamio/bilingual-reader), AGPL-3.0-or-later.

> **请先卸载原版 Bilingual Reader 再安装本插件。** 两者会向同一个阅读器工具栏区域注入按钮；本插件首次启动时会把原版的偏好设置与翻译缓存复制到新的命名空间，原版数据不会被清除。

在 Zotero 10 的 PDF 阅读模式中读取结构化段落，将英文原文与中文译文按段落连续显示，适合论文精读。

> 本插件由 GPT 编写。

## 主要功能

- 一键开启 / 关闭段落中英对照（阅读器工具栏上的插件图标按钮）。
- 默认调用 **Translate for Zotero** 的翻译服务（推荐使用google，其次必应）。
- 可选 **Ollama** 本地或云端模型。
- 自动缓存已完成译文。
- 支持短段落合并、受控并发、请求节流、超时与连续失败暂停。
- 可设置“不翻译末尾页数”，用于跳过参考文献。
- 🔄 可取消当前任务并按最新设置重新翻译。
- 🖨️ 可尝试将当前双语阅读结果导出为 PDF，并添加为当前文献的 Zotero 附件。

## 环境

- Zotero 10.x
- macOS 为主要测试平台
- 使用 Translate for Zotero 时，需要先安装并配置：
  https://github.com/windingwind/zotero-pdf-translate

## 安装

从本仓库 **Releases** 下载最新版 `.xpi` 文件，然后在 Zotero 中：

```text
工具 → 插件 → 右上角齿轮 → 从文件安装插件
```

安装后如有提示，请重启 Zotero。

## 使用

1. 在 Zotero 10 中打开英文 PDF。
2. 点击阅读器顶部的 **Interlinear 图标按钮**（红色 Z 与 A/文 翻译卡片）。
3. 等待 Zotero 生成阅读模式结构化文本。
4. 中文译文会显示在对应英文段落下方。
5. 点击 **🔄** 可重新调度翻译。
6. 点击 **🖨️** 可导出双语 PDF。

可以配置：

- Translate for Zotero / Ollama；
- Translate for Zotero 固定跟随其当前默认服务；
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

- 目前主要面向英文 → 简体中文。
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
| `addon/content/icons/icon20.png` | 20×20 | 阅读器工具栏对照按钮 |
| `addon/content/icons/icon32.png` | 32×32 | 中尺寸备用 |
| `addon/content/icons/icon48.png` | 48×48 | 插件管理器图标 |
| `addon/content/icons/icon96.png` | 96×96 | 插件管理器高清图标、设置页顶部 |
| `addon/content/icons/favicon.png` | 32×32 | 模板工具栏 / 菜单图标 |
| `addon/content/icons/favicon@0.5x.png` | 16×16 | 模板菜单小图标 |

重译（🔄）与导出（🖨️）按钮仍使用 emoji，暂未替换。

## 开发

```bash
npm install
npm run build
npm run test
```

## 许可证

AGPL-3.0-or-later。原项目 [quillamio/bilingual-reader](https://github.com/quillamio/bilingual-reader)
的版权声明与 LICENSE 全部保留；本仓库由 Muanyan-mjq 维护。
