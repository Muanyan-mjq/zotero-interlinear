# 截图审查（README 用图）

审查日期：2026-11-11。来源：`docs/dev/screenshots/`（全部为仓库内已有文件）。

## 结论

- 只有带 `-gui` 后缀的 13 张是**真实 Zotero 窗口截图**，由 `npm run test:gui`（`test-gui/*.ts` → `canvas.drawWindow(win, …)`）在真实 GUI 进程里抓取。
- 不带 `-gui` 的 9 张是**设置页 HTML 预览**（页面自述 “Zotero pane heading (not part of the plugin)”），不是真实 Zotero，**不能进 README**。
- 被采用的 5 张已复制到 `docs/images/`（体积均 < 130KB，未压缩、未修饰，只做文件复制）。
- 全部截图为 **Zotero 深色主题**；没有浅色主题、也没有阅读器内的原文/译文对照画面。

## 逐张清单

| 文件 | 尺寸 | 体积 | 目视？ | 结论 | 原因 |
|---|---|---|---|---|---|
| advanced-gui.png | 1085×823 | 86KB | 是 | 可用但未采用 | 真实窗口；“页面范围/速度与稳定性”与 README 叙述关联弱 |
| advanced.png | 885×1501 | 113KB | 否 | 排除 | HTML 预览，非真实 Zotero |
| appearance-advanced-gui.png | 1085×823 | 67KB | 否 | 可用但未采用 | 真实窗口；仅折叠面板展开态，信息量低于已选图 |
| appearance-colors-gui.png | 1085×823 | 106KB | 是 | 未采用 | 真实窗口；顶部“文字颜色”卡片被裁掉一半 |
| appearance-dark-gui.png | 1085×823 | 68KB | 否 | 可用但未采用 | 真实窗口；与 appearance-gui 重复度高 |
| appearance-dark.png | 885×2327 | 161KB | 否 | 排除 | HTML 预览 |
| appearance-gui.png | 1085×823 | 80KB | 是 | **采用** → `docs/images/settings-appearance.png` | 含方案按钮 + 实时预览卡片，无敏感信息 |
| appearance-light-gui.png | 1085×823 | 67KB | 否 | 可用但未采用 | 真实窗口；与 appearance-gui 高度重复（“浅色”指预览区） |
| appearance-narrow-gui.png | 800×823 | 58KB | 是 | **采用** → `docs/images/settings-narrow.png` | 真实窗口；展示窄宽度下单列布局与折叠组 |
| appearance-picker-gui.png | 1085×823 | 120KB | 是 | **采用** → `docs/images/settings-color-picker.png` | 真实窗口；自实现取色器完整可见 |
| appearance-presets-gui.png | 1085×823 | 72KB | 否 | 可用但未采用 | 真实窗口；与 appearance-gui 同区域，信息重复 |
| appearance.png | 885×2327 | 160KB | 否 | 排除 | HTML 预览 |
| display-gui.png | 1085×823 | 81KB | 是 | **采用** → `docs/images/settings-display.png` | 真实窗口；排版/悬停/快捷键 |
| display.png | 885×1570 | 106KB | 否 | 排除 | HTML 预览 |
| glossary-gui.png | 1085×823 | 70KB | 否 | 可用但未采用 | 真实窗口；术语表区域当前为空，画面信息量低 |
| glossary.png | 900×1400 | 52KB | 否 | 排除 | HTML 预览 |
| service-dark-gui.png | 1085×823 | 69KB | 否 | 可用但未采用 | 真实窗口；与 service-gui 重复 |
| service-dark.png | 900×1400 | 68KB | 否 | 排除 | HTML 预览 |
| service-gui.png | 1085×823 | 81KB | 是 | **采用** → `docs/images/settings-service.png` | 真实窗口；密钥输入框为空，无用户名/路径 |
| service-light-gui.png | 1085×823 | 68KB | 否 | 可用但未采用 | 真实窗口；与 service-gui 重复 |
| service-narrow-gui.png | 800×823 | 59KB | 否 | 可用但未采用 | 真实窗口；窄宽度观感与 appearance-narrow 重复 |
| service.png | 900×1400 | 67KB | 是 | 排除 | HTML 预览（页面自述不是插件的一部分） |

“目视？”= 本次实际逐张看过的文件（7 张）。其余按命名、尺寸与生成脚本（`test-gui/*.ts` 只产出 `-gui` 后缀）归类，**未逐张目视**，因此一律不进入 README；如需启用请先自行确认。

## 敏感信息核对（针对已目视的 7 张）

- 无用户名、无邮箱、无本机绝对路径、无文献条目列表。
- 三个 API key 输入框均为空（截图时未填任何密钥）。
- 画面只含 Zotero 设置窗口的 Interlinear 面板；窗口标题栏未包含在截图范围内（`drawWindow` 从 0,0 起裁窗口内容）。

## 缺口（README 仍需要、但现有截图没有）

1. 阅读器内“原文在上、译文在下”的实拍（浅色主题）。
2. 左右双栏排版实拍。
3. 深色主题下的上下对照实拍。
4. 工具栏按钮“译文显示中”与“已隐藏”两种状态。

原因：`test-gui` 目前只驱动设置页；阅读器截图还需要导入演示 PDF、打开阅读模式并触发翻译，而本机到 `translate.googleapis.com` 的连接当前不可用（`curl` 状态 000，10s 超时），无法产出**真实**译文。按任务约定不伪造译文，因此保留 README 中的占位注释。
