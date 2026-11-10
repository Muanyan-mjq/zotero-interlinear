# Interlinear 外观 v2 — 交接文档（2026-11-10）

给下一个 agent：先读本文件，再读 `docs/dev/PROGRESS.md` 的“外观自定义 v2”、
`docs/dev/SETTINGS.md`、`docs/dev/BACKLOG.md`。不要重新实现已完成的部分。

## 当前状态

- 仓库：`D:\DeepLearning_Code\project\zotero-interlinear`
- 分支：`feat/appearance-v2`（从 `feat/ui-polish` @ `a1e687b` 切出，后来 merge 了 main 的 PR #1 合并提交）
- 版本：`0.6.0`
- 上一 PR：`#1 feat/ui-polish` 已由用户合并进 `main`
- 本分支提交（按时间）：
  - `0e43fd1` feat: rebuild the font system with detection, stacks and RTL support
  - `d51589d` feat: rebuild the color system with a custom picker
  - `d4678d9` feat: add decoration, divider, ribbon and block style controls
  - `cbde85d` feat: let reader surfaces and scope follow appearance settings
  - `ba3cd5d` feat: add configurable shortcuts and auto-translate triggers
  - `53b2bd8` ui: collapse advanced appearance groups
  - `81f4c9e` docs: audit settings paths and add reference docs
  - `0472f2a` Merge origin/main into feat/appearance-v2
  - `0c95175` fix: correct font badges, warning sync and chat scope
- 注意：**Step 5（外观方案）与 Step 6 落在同一个提交 `cbde85d`**，因会话中断未拆开；按“不改写历史”约束保留。Step 7 单独提交 `ba3cd5d`。

## 已完成（不要重做）

- **P1 Step 1–4**：顶部工具栏/标签重做、字体检测与字体栈、颜色系统（自实现取色器/浅深配色/对比度）、文字装饰/分隔线/色带/译文块布局。
- **P2 Step 5–7**：6 套内置外观方案 + 我的方案 + JSON 导入导出 + 重置；翻译范围开关、弹窗/聊天字体跟随、导出模式、加载动画、译文块右键/双击菜单；显示隐藏/排版循环快捷键、悬停修饰键、打开论文自动翻译（关/仅缓存/总是）。
- **Step 8 已做**：设置项审计、默认值/范围/保存/读取核对、折叠式高级组、颜色卡默认折叠、聊天上下文跟随翻译范围、`SETTINGS.md`、`BACKLOG.md`、README/CHANGELOG 更新。
- **视觉自检**：用“真实初始化后 DOM + 同一份 preferences.css”序列化后交给 Playwright/Chromium 截图，产物在 `docs/dev/screenshots/`：
  - `service.png`、`display.png`、`appearance.png`、`appearance-dark.png`、`service-dark.png`、`glossary.png`、`advanced.png`
  - 这不是真实 Zotero GUI 截图；sticky 在截图时临时改为 static，preview 的 shadow DOM 被内联。**真实 Zotero GUI 仍未人工目视。**

## 测试基线（最后一次）

- `npm run build`：通过
- `npm run lint:check`：通过
- `npm run test:unit`：171 pass / 0 fail
- `npm run test:review`（Zotero headless，独立 profile）：58 pass / 0 fail
- `npm test`：未运行（本机无 `.env`；`test:review` 是独立 profile 的安全等价入口）
- 测试命令：
  ```powershell
  $env:ZOTERO_PLUGIN_ZOTERO_BIN_PATH = "C:\Program Files\Zotero\zotero.exe"
  npm run test:review
  ```

## 没完成 / 明天优先做

1. **真实 Zotero GUI 目视验证（最高优先）**
   - 安装 `.scaffold/build/interlinear.xpi`，逐个标签检查：顶部工具栏/保存四态、600px 与宽屏、浅/深主题、外观方案/字体检测/取色器/装饰/色带/块布局、翻译范围、快捷键、自动翻译、导出、弹窗、聊天。
   - 真实 GUI 截图放到 `docs/dev/screenshots/`（可覆盖现有近似图，或加 `*-gui.png`）；如果仍然做不到，在 `PROGRESS.md` 明确写“无法目视验证”。
2. **最终 UI 打磨（impeccable skill 的 polish 原则）**
   - 重点：`颜色与标记（9 项）` 展开后仍很长（约 4000px）；可考虑每个颜色卡折叠高级行、或改成两栏/紧凑模式。
   - “我的方案”下拉在截图里带一圈高亮/焦点环，确认真实 Zotero 中是否异常。
   - 字体列表高度 300px、行密度、`?` 徽章已修复；再确认搜索/收藏/字体栈交互。
   - 真实 Zotero 的 XUL 布局、滚动容器、系统字体光栅化与 Chromium 预览不同，任何改动以真实 GUI 为准。
3. **导出流程阻塞式 `alert`/`confirm`**（`src/readerUI.ts`）
   - 成功/失败/“继续导出”仍用系统对话框；建议成功/失败改成阅读器内非阻塞提示（可抽 `src/readerNotices.ts` 复用 `bilingualReader.showError` 的实现，注意循环依赖）。
   - “是否继续导出”可保留 confirm 或改成内联确认条；需要用户确认语义。
4. **工具栏右键菜单历史问题**
   - Step 14 记录用户机器上右键无响应；Step A 已精简菜单并走 document 委托，但未在用户机器复测。让用户实机试一次，仍不行就排查 `readerToolbar`/`readerMenu` 的事件路径。
5. **P3（不实现，仅 BACKLOG）**
   - 按论文覆盖外观、原文字体/字号覆盖 Zotero、多段落批量操作、外观跨设备同步、更多语言字体栈、译文徽章、术语高亮。
6. **“随文字”长度的分隔线**
   - 需要包裹 inline 元素或 background-image 裁剪，会影响布局/选择/高亮；当前只做整行，已记 BACKLOG。若要实现必须补真实 PDF 选择与高亮回归。
7. **字体检测的防指纹场景**
   - 开启 `privacy.resistFingerprinting` 时 `measureText` 可能被抹平；当前有“显示全部候选字体”兜底，但未实测该偏好。
8. **`npm test`**
   - 如有 `.env`/开发 profile，跑一次 `npm test` 与 `test:review` 对照；不要用会动用户正在使用的 Zotero profile 的默认命令。
9. **版本/发布**
   - 已提升 0.6.0，但 CI/Release 未实际触发；发布前按 `docs/dev/RELEASE-CHECKLIST.md` 走一遍，并确认 `[release]` 流程。
10. **Step 5/6 同提交**
    - 历史已形成；除非用户明确同意改写历史，否则不要拆。

## 已知约束（继续遵守）

- 不新增 npm 依赖；颜色/字体检测自己实现。
- 所有界面文字走 Fluent，en-US 与 zh-CN 键数量必须一致（当前 535 ↔ 535）。
- 用户可调值进入 CSS 前必须校验：枚举白名单、数值夹取、颜色只接受 `#RGB/#RRGGBB/#RRGGBBAA`、字体名分词；拒绝 `url()`、`@import`、花括号、分号、`expression`。
- 默认输出保持现状（快照测试固定）；预览/阅读器/导出/弹窗/聊天共用 `buildTranslationCSS` 等构建函数。
- 不 push、不改 remote、不改写历史、不合并分支，除非用户明确要求。
- 每个修复单独提交，前缀 `ui:`/`fix:`/`feat:`；每步跑 build/lint/test:unit/test:review，如实记录。

## 明天建议的起手顺序

1. 读本文件 + `PROGRESS.md` Step 8 + `BACKLOG.md`。
2. 真实 Zotero GUI 过一遍设置页（最高优先），把问题分成“明确 bug”与“待我决定”。
3. 明确 bug 直接修，单独提交；有风险/需要产品决策的写 `PROGRESS.md` 的“待我决定”。
4. 再决定是否处理导出 alert/confirm、右键菜单、颜色卡展开长度。
5. 最后更新 PROGRESS/SETTINGS/CHANGELOG/README，跑全套测试，向用户汇报。
