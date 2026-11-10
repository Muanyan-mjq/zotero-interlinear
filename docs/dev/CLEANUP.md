# 项目清理与独立化记录

- 起点：`dev` @ `856940f`（step 15），另含 `104d532`（step 16，色带默认改蓝）。
- 工作分支：`chore/cleanup`。
- 目标仓库：`https://github.com/Muanyan-mjq/zotero-interlinear.git`。这是一个新建的空仓库，与旧 fork 没有 GitHub fork 关系；本地历史与署名继续保留。
- 约束：不推送、不修改 remote、不合并分支、不改写历史。`origin` 已在本地指向新仓库，`upstream` 仍指向 `quillamio/bilingual-reader`，本次清理不触碰两者。
- 验证基线（2026-11-10，step 16 后）：`npm run build` 通过，`npm run lint:check` 通过，`npm run test:unit` 76 pass / 0 fail，`npm run test:review` 38 pass / 0 fail，xpi 122,527 字节。
- 说明：`docs/ANALYSIS.md` 是改造前基线，其中提到的很多模板残留已被更早的 `ab3eb00`（step 10）删除；本清单以当前工作树和引用关系为准，不直接照搬该报告。

## Step 1：可删除清单（只读审计，不执行删除）

### A. 风险 none（模板/死代码，已确认无引用）

| 项 | 证据 | 处理 |
| --- | --- | --- |
| `doc/README-zhCN.md`（410 行）、`doc/README-frFR.md`（415 行） | 两份都是 `zotero-plugin-template` 的模板 README，标题仍为 “Zotero Plugin Template”；仓库内没有任何文件链接到 `doc/` | 删除整个 `doc/` |
| `src/utils/prefs.ts`（36 行） | `getPref` / `setPref` / `clearPref` 在 `src/`、`test/` 中只有声明本身，零调用；实际偏好读写集中在 `src/settings.ts` 的 `Zotero.Prefs` 包装 | 删除文件 |
| `src/utils/window.ts`（10 行） | `isWindowAlive` 只有声明与 `export`，零调用 | 删除文件 |
| `src/utils/ztoolkit.ts` 第 34–48 行 `MyToolkit` 类及其 `BasicTool` / `unregister` / `UITool` 导入 | 模板提供的“按需引入 toolkit 模块”示例，`createZToolkit()` 实际只用 `ZoteroToolkit`；全仓库无 `MyToolkit` 引用 | 删除类与相关导入 |
| `addon/locale/{en-US,zh-CN}/addon.ftl` 的 `language-title` | 两个语言文件各有 1 行；`src/`、`addon/content/preferences.xhtml`、测试均未使用（其余语言键通过 `language-name-${code}` 动态使用） | 删除两条并重新生成 `typings/i10n.d.ts` |
| `addon/content/icons/printer.svg`（32 行） | 全仓库无 `printer.svg` 引用；导出按钮使用 emoji `🖨️`（`src/readerUI.ts:8`）。文件本身是 Noto Emoji 的 Apache-2.0 资源，删除后不再需要该第三方署名 | 删除 |
| `.release-v0.1.2`、`.release-v0.1.3`、`.release-v0.1.6` | 上游 `[release]` 提交留下的三行标记文件；当前 scaffold 0.8.2 的构建/发布代码中不存在 `.release-` 文件名逻辑，仓库内也无引用 | 删除 |
| `src/bilingualReader.ts` `prepareAndRun(reader, refresh)` 的 `refresh` 形参 | 唯一两个调用点（`toggleBilingualReading`、`refreshBilingualReading`）都传 `false`；`refreshBilingualReading` 自己已先 `clearTranslations`。`ANALYSIS.md §7.2` 也把它列为死参数 | 去掉形参与 `if (refresh) clearTranslations` 分支 |

### B. 风险 low（可选清理，建议本阶段一并做）

| 项 | 证据 | 处理 |
| --- | --- | --- |
| `.vscode/toolkit.code-snippets` | 模板附带的 toolkit API 代码片段，构建与测试不读取；项目只用到 toolkit 的 `ZoteroToolkit` / `FilePicker` / `ProgressWindow` | 暂不删，列入“待决定” |
| `addon/content/icons/favicon@0.5x.png` | 无直接引用；README 标注“小尺寸备用”；`ztoolkit` 只显式设置 `favicon.png` | 保留 |
| `addon/content/icons/icon16.png` / `icon32.png` | `icon16` 由 `chatPane` 的 footer icon 使用；`icon32` 是 `interlinearIcon.ts` 的生成源，不直接被运行时引用 | 保留（生成源） |

### C. 当前版本已不存在（更早提交已删，无需重复处理）

- `src/modules/examples.ts`：已由 `ab3eb00`（step 10）删除。Step 2 需要的 `registerReaderItemPaneSection` 示例仍可从 `ab3eb00^` 的 Git 历史中取出。
- `addon/content/zoteroPane.css`：已由 `ab3eb00` 删除，当前 `addon/content/` 只剩 `preferences.css`、`preferences.xhtml` 与图标。
- 模板遗留的 `addon.ftl` 示例键：已在 step 10 清理，当前仅剩 `language-title` 一个未使用键。

### D. 风险 medium / “待我决定”（不自动删除）

| 项 | 现状与建议 |
| --- | --- |
| 内部 `bilingual*` 命名 | `src/bilingualReader.ts` 文件名、`cleanupBilingualReader`、`renderBilingualToolbarButtons`、`toggleBilingualReading`、`isBilingualRunning` 等仍带旧名。它们不面向用户，重命名会波及 `src/` 与 `test/startup.test.ts` 的大量导入，收益低、回归面大。建议保留；只在 README/发布说明里继续保留旧项目署名。 |
| `.github/workflows/release.yml` | 已解决（Step 4）：补齐 `"release": "zotero-plugin release"` 脚本，手动 dispatch 路径恢复可用；`ci.yml` 的 `[release]` 流程不变。 |
| `.github/workflows/issue-bot.yml` | 模板自带的 issue bot，依赖外部 reusable workflow。对个人新仓库可用但不是必需；保留不会影响构建。 |
| `@types/chai` | `chai@6` 自带类型，`@types/chai` 可能冗余；但它不参与 `npm run build` 的类型检查（`tsconfig` 只含 `src`/`typings`），删不删只影响编辑器/集成测试类型提示。按“不动依赖”原则保留。 |
| `prettier` | 没有 npm script 调用它，但 `.prettierignore`、VSCode 推荐扩展和 `package.json` 的 `prettier` 配置都在用；保留。 |
| `typings/prefs.d.ts` | 生成文件；删除 `src/utils/prefs.ts` 后暂时没有消费者，但 scaffold 会按 `addon/prefs.js` 重新生成，保留以免下次构建产生噪声 diff。 |
| `docs/ANALYSIS.md` | 改造前基线报告，含旧文件名与旧偏好前缀，但也是有价值的历史证据；保留。 |
| `favicon@0.5x.png`、`icon16.png`、`icon32.png` | 见 B 表；均保留。 |

### E. 旧品牌残留审计

| 位置 | 结论 |
| --- | --- |
| 用户可见链接 | `package.json` 的 `repository` / `homepage`、设置页 `PROJECT_URL`、`test/startup.test.ts` 断言均已指向 `https://github.com/Muanyan-mjq/zotero-interlinear`。 |
| 旧项目链接 | 仅保留在 README 的 “Based on quillamio/bilingual-reader”、`CHANGELOG.md` 历史条目、`docs/` 历史记录、`src/providers/openai*.ts` 的 PR #20 改编署名、`package.json` 的 `contributors`。这些属于必须保留的署名，不删除。 |
| 旧更新地址 | 当前 `addon/manifest.json` 的 `update_url` 是 `__updateURL__` 占位符，由 `zotero-plugin.config.ts` 基于新仓库 URL 生成；仓库内没有硬编码旧更新地址。 |
| 旧偏好命名空间 | `src/settings.ts` 的 `LEGACY_BASE = "extensions.zotero.bilingualreader"` 与 `migrateLegacyPreferences()` 是旧用户数据迁移逻辑，必须保留；测试只使用新前缀，无迁移专项测试。 |
| 模板 URL | `your-github-name/repo-name`、`zotero-chinese.com`、`udn.realityripple.com`、模板 badge 等只存在于 `doc/` 两份模板 README，随 A 表删除。 |
| 模板示例代码 | 已在 step 10 删除，当前 `src/modules/` 只剩真正使用的 `preferenceScript.ts`。 |

### F. 导出、测试夹具、脚本与依赖审计

- 未被任何外部文件导入的导出：`src/utils/prefs.ts` 的 3 个函数、`src/utils/window.ts` 的 `isWindowAlive`（均按 A 表删除）；其余导出即使只在本文件内使用，也是函数签名/默认值的一部分，不属于死代码。
- 测试与夹具：`test/` 下 7 个 `.node.test.mjs` 全部被 `test:unit` 脚本显式列出；`test/startup.test.ts`、`test/readerToolbar.test.ts`、`test/readingLayout.test.ts` 由 scaffold 的 `test` 入口自动发现；`test/tsconfig.json` 供测试类型检查使用。没有孤立测试文件或未使用夹具，全部保留。
- 脚本：`scripts/test-review.mjs` 由 `npm run test:review` 使用；无其他脚本。
- 依赖：`zotero-plugin-toolkit`、`zotero-types`、`typescript`、`eslint`、`@zotero-plugin/eslint-config`、`mocha`、`chai`、`@types/mocha`、`@types/node`、`zotero-plugin-scaffold` 均有实际用途；`prettier` 与 `@types/chai` 见 D 表。本阶段不卸载任何依赖。
- 偏好键：`addon/prefs.js` 的全部键都能在 `src/settings.ts` 找到对应的读取/写入（包括 OpenAI/Claude/Gemini 的 prompt 与 temperature），没有死偏好键。

### G. 安全/隐私扫描（本阶段只记录，不改历史）

- 未发现真实 API key、密码、私钥或个人信息；设置页的 `type="password"` 是输入控件，不是密钥值。
- 未发现硬编码的绝对路径；`.env` 已被 `.gitignore` 忽略，仓库只跟踪 `.env.example`。
- 未发现 `TODO` / `FIXME` / `HACK` 标记。
- 本地 `git config` 作者为 `MU anyan <muanyan7@gmail.com>`；这是提交历史的一部分，本阶段不改写。

## Step 2：保留清单与参考示例（已执行）

保留：

- `LICENSE`、README 的上游署名与致谢、`package.json` 的 `contributors`、`CHANGELOG.md` 历史、全部 Git 历史。
- `src/providers/openai.ts` / `openaiProtocol.ts` 文件头的 PR #20 改编署名。
- 全部测试与夹具（除非其测试对象被删除）；`.github/workflows`（Step 4 只修指针，不整体删除）。
- 现有偏好的迁移代码与旧命名空间常量。
- 全部真正使用的源码、图标、locale 键、脚本、构建配置。
- 内部 `bilingual*` 命名（见 D 表建议）。

参考示例：已从 `git show ab3eb00^:src/modules/examples.ts` 提取 `registerReaderItemPaneSection` 到 `docs/reference/itempane-section-example.ts`；文件头注明来源提交、上游模板、用途，并确认该文件不在 `tsconfig` 的 `include` 中（只读参考，不参与构建）。该示例可用于将来扩展阅读助手侧栏或 Zotero 条目面板。

## Step 3：删除执行结果（按类别，一类一个 `cleanup:` 提交，已完成）

| # | 类别 | 提交 | 内容 | 验证 |
| --- | --- | --- | --- | --- |
| 1 | 模板文档 | `1ae8400` | 删除 `doc/README-zhCN.md`、`doc/README-frFR.md`（825 行） | build / lint / 76 单测通过 |
| 2 | 死工具模块 | `4220c09` | 删除 `src/utils/prefs.ts`、`src/utils/window.ts`，移除 `ztoolkit.ts` 的 `MyToolkit` 类与导入（67 行） | build / lint / 76 单测通过 |
| 3 | 未使用 locale 键 | `bc72739` | 删除两个语言文件的 `language-title`，重新生成 `typings/i10n.d.ts`（3 行） | build / lint / 76 单测通过 |
| 4 | 死参数 | `987ccb6` | 移除 `prepareAndRun` 的 `refresh` 形参与分支（-7/+3 行） | build / lint / 76 单测 + 38 集成测试通过 |
| 5 | 未使用资源/标记 | `046da08` | 删除 `addon/content/icons/printer.svg` 与 `.release-v0.1.2/3/6`（35 行） | build / lint / 76 单测通过 |

共删除约 937 行；每类均通过 `npm run build`、`npm run lint:check`、`npm run test:unit`，无变红回退。第 4 类触及阅读器主路径，额外跑了 `npm run test:review`（38 pass）。medium 项未做自动删除。

## Step 4：独立化执行结果（已完成，`58e1ecc`）

- `package.json`：补充 `bugs` 指向新仓库 issues；`repository` / `homepage` / `author` / `contributors` 此前已指向新仓库并保留上游署名，未改动。
- 发布流程缺口：`release.yml`（手动 dispatch）调用的 `npm run release` 在仓库里从未存在过（上游模板契约缺失）。按“只修指针、不删工作流”原则，新增 `"release": "zotero-plugin release"` 脚本（scaffold CLI 自带 `release` 命令），手动发布路径恢复可用；`ci.yml` 的 `[release]` 提交触发发布流程保持不变，两条路径并存。
- 更新地址核验：构建产物 `.scaffold/build/update.json` 的 `update_link` 已指向 `Muanyan-mjq/zotero-interlinear` 的 v0.5.1 xpi；`addon/manifest.json` 用 `__updateURL__` 占位符由配置生成；`test/startup.test.ts:169` 的项目链接断言已是新仓库。
- 新增 `NOTICE.md`：记录上游 quillamio/bilingual-reader（AGPL）、PR #20（daxiaxiong88，OpenAI 兼容后端）、PR #19（分段标记规则）、zotero-plugin-template / Make It Red 模板来源与图标作者；README 中英两处署名小节均链接到它。
- README：已是中英双语且覆盖功能/安装/开发/限制/署名，仅修正图标表两处事实错误（icon16 实为阅读助手侧栏底部图标；icon32 是工具栏内联 data URL 图标的生成源）。
- `.gitignore` 审计：`.env`、`.scaffold`、`build`、`logs`、`node_modules` 均已覆盖；跟踪中的 `.env.example` 只有占位符，无真实密钥；根目录 `Zotero Translation Icon.png` 为有意跟踪的图标源文件。无需改动。
- 密钥/绝对路径/个人信息扫描结论同 Step 1 G 表：未发现泄露项，不改写历史。

## Step 5：验收结果（2026-11-10，已完成）

验证（最终工作树）：

- `npm run build`：通过（tsc + 生产打包）。
- `npm run lint:check`：通过。
- `npm run test:unit`：76 pass / 0 fail。
- `npm test`：已跑（设置 `ZOTERO_PLUGIN_ZOTERO_BIN_PATH` 与 `ZOTERO_PLUGIN_KILL_COMMAND` 防误杀本机 Zotero），38 pass / 0 fail。
- `npm run test:review`：38 pass / 0 fail（Step 3 第 4 类后跑过；最终状态与当时仅差元数据/文档，且 `npm test` 已在最终状态覆盖同一套集成测试）。

xpi 体积：清理前 122,527 字节 → 清理后 120,731 字节（−1,796 字节，约 −1.5%）。

残留 grep（署名除外）：

- 旧插件 ID（`bilingual-reader@` / `@quillamio`）：`src/`、`addon/`、`test/`、`scripts/`、`.github/` 零残留。
- 旧偏好前缀 `extensions.zotero.bilingualreader`：仅 `src/settings.ts:43` 的迁移常量（必须保留）与 `NOTICE.md` 说明文字。
- 旧仓库 URL：仅 README / NOTICE / 文件头 PR 署名 / `package.json contributors` / `docs/` 历史记录。
- 模板 URL（`your-github-name`、`zotero-chinese.com` 等）：随 `doc/` 删除，零残留。

“待我决定”清单（均未动，建议保留）：

- 内部 `bilingual*` 命名（文件名与函数名）：不面向用户，重命名回归面大。
- `.github/workflows/issue-bot.yml`：模板 issue bot，无害。
- `@types/chai`、`prettier`：依赖不动原则；prettier 仍被编辑器配置使用。
- `typings/prefs.d.ts`：scaffold 生成文件，保留避免噪声 diff。
- `docs/ANALYSIS.md`、`docs/PROGRESS.md` 等历史文档：历史证据。
- `favicon@0.5x.png` 备用图标、`.vscode/toolkit.code-snippets`：无害备用。

人工验证清单（需在 Zotero 10 实机执行）：

1. 安装 `.scaffold/build/interlinear.xpi`，确认插件管理器显示 Interlinear 0.5.1 且图标正常。
2. 打开英文 PDF → 阅读模式，左键工具栏图标开启对照，确认译文在原文下方、左侧色带为默认蓝色 `#2f6fdf`（老用户已存偏好则保持其原色）。
3. 右键图标菜单：重新翻译、取消、四种显示模式循环、导出 PDF、阅读助手、设置均可用。
4. 设置页修改任一颜色/字体并保存，重开阅读器确认生效；各后端“测试连接”就地显示结果。
5. 悬停单段与快捷键单段翻译在未开启全文对照时可用。
6. 若曾用旧版 Bilingual Reader：先卸载旧版，再启动本插件验证迁移（偏好与缓存复制到新命名空间，旧数据不删）。
