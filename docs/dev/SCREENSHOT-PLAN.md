# README 真实截图：可行性记录与缺口清单

日期：2026-11-11。结论：**阅读器内的译文截图无法在本机自动生成**，原因是翻译服务不可达；设置页截图已可用（见 `docs/dev/SCREENSHOT-REVIEW.md` 与 `docs/images/`）。

## 1. 截图方式（已验证可行）

- 本仓库已有 `npm run test:gui`（`scripts/test-gui.mjs` + `test-gui/*.ts`）：用 scaffold 启动**真实 GUI Zotero**（不带 `-headless`）、隔离 profile，面板加载完后调用
  `ctx.drawWindow(win, 0, 0, w, h, "#ffffff")`（`test-gui/*.ts:54-70`）把窗口内容画进 canvas，再写成 PNG。
- 依据：`docs/dev/screenshots/*-gui.png` 就是这样产出的，尺寸 1085×823，与窗口内容一致。
- 因此“在 chrome 环境里 drawWindow 捕获”这条路是通的，操作系统级截屏（PowerShell/.NET）作为备选没有必要，本次也没有使用。

## 2. 阻塞点：真实翻译不可用

- 直接请求 Google 免费接口（插件默认后端）：
  `curl -o /dev/null -w "%{http_code} %{time_total}" "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=hello"`
  → **status 000，10s 超时**（2026-11-11 20:12 GMT+8 实测）。
- 按任务约定不能用假译文冒充，因此“等译文渲染完成再截图”这一步无法完成；本次不产出任何阅读器截图。

## 3. 还缺什么（需要你手动补，或等网络可用后我重跑）

存放位置统一为 `docs/images/`，命名如下（README 里已预留同名占位注释）：

| 文件名 | 内容 | 建议做法 |
|---|---|---|
| `docs/images/reader-inline.png` | 上下对照（浅色主题） | 打开一篇 CC BY 论文阅读模式，点工具栏 Interlinear 开始翻译，等段落译文出现后截整个阅读器窗口 |
| `docs/images/reader-side-by-side.png` | 左右双栏（浅色主题） | 用工具栏 `◫` 切到“左右分栏”后截同一篇 |
| `docs/images/reader-dark.png` | 深色主题下的上下对照 | Zotero 设置→常规→主题改深色，重开阅读器再截 |
| `docs/images/toolbar-shown.png` | 工具栏：译文显示中 | 翻译完成后截工具栏区域（可裁到只剩工具栏） |
| `docs/images/toolbar-hidden.png` | 工具栏：译文已隐藏 | 点一次开关隐藏译文后截同一区域 |

要求（与你给的任务一致）：只用真实运行截图；不要拼接；密钥输入框留空；不要出现用户名、路径或与演示无关的文献条目；窗口标题栏如有个人信息请裁掉。

## 4. 演示论文

未选定、未下载。原因：没有可截的译文，选论文没有意义；且下载 PDF 只为截图服务、不进仓库。
等网络可用后建议选 arXiv 上标注 **CC BY 4.0** 的论文（例如 `arXiv:1706.03762` 这类），到论文页面核对许可证后，把标题/作者/许可证/链接记进图注与本文档。

## 5. 若要我继续自动化

在网络可用时，需要新增一个 `test-gui` 用例（同一 harness、同一隔离 profile）：

1. 通过 `Zotero.Items` + `Zotero.Attachments.importFromFile` 导入演示 PDF；
2. `Zotero.Reader.open(itemID)` 打开阅读器并等待 `#sdt-content`；
3. 触发全文翻译并轮询到译文块处于 `done`；
4. 对 reader 的 `_iframeWindow` 调用同一个 `capture()`；
5. 切换 `displayMode` 与主题，重复上述步骤。

这段代码尚未编写：它依赖真实网络与真实 PDF，写了也无法在当前环境验证，按“不要硬凑”的要求先不提交。
