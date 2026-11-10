# Markdown 文档盘点

盘点日期：2026-11-10，分支 `chore/cleanup`。覆盖仓库全部 `.md` 文件（含未跟踪文件检查，无遗漏）。

| 路径 | 内容来源 | 处理方式 |
| --- | --- | --- |
| `README.md` | Qoder 在本项目改造期间编写 | 重写为英文主文档（全新结构） |
| `README-zh-CN.md` | 新增 | 新写中文文档 |
| `CHANGELOG.md` | 上游 fork 时期沿用的版本历史 + Qoder 追加的条目 | 重写：按 Keep a Changelog 重新开始，旧历史保留在 Git 历史中 |
| `NOTICE.md` | Qoder 编写（Step 4 独立化） | 保留：来源项目、PR #19/#20、许可证、模板来源署名不变 |
| `CONTRIBUTING.md` | 新增 | 新写简短贡献指南 |
| `docs/ANALYSIS.md` | Qoder 编写（改造前基线分析） | 移至 `docs/dev/ANALYSIS.md`，内容原样 |
| `docs/CLEANUP.md` | Qoder 编写（清理与独立化记录） | 移至 `docs/dev/CLEANUP.md`，内容原样 |
| `docs/PROGRESS.md` | Qoder 编写（逐步开发日志） | 移至 `docs/dev/PROGRESS.md`，内容原样 |
| `docs/REFERENCE-isCopyman.md` | Qoder 编写（同名项目的架构参考笔记） | 移至 `docs/dev/REFERENCE-isCopyman.md`，内容原样 |
| `docs/RELEASE-CHECKLIST.md` | Qoder 编写（发布检查单） | 移至 `docs/dev/RELEASE-CHECKLIST.md`，内容原样 |
| `docs/dev/MD-INVENTORY.md` | 本文件 | 新增 |

其他位置检查：

- `.github/`：只有 workflows（`ci.yml`、`release.yml`、`issue-bot.yml`）、`dependabot.yml`、`renovate.json`，没有 issue/PR 模板或任何 `.md` 文件，无需改写。
- `docs/reference/itempane-section-example.ts`：代码参考示例（非 Markdown、非过程文档），保留在原路径，`NOTICE.md` 仍引用它。
- 没有原作者撰写的 Markdown 文件遗留；上游署名集中在 `NOTICE.md`、源码文件头与 README 致谢节。