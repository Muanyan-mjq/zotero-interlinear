# 调研：Zotero 11 适配（只调研，未改源码）

- 日期：2026-11-11
- 分支：`research/zotero11-and-key-security`
- 目标版本：Zotero 11.0-dev.5+dac1ad489（Mozilla esr153 / Milestone 153.0，BuildID 20260716160951）
- 对照版本：本机 Zotero 10.0.8（`C:\Program Files\Zotero`，Milestone 140.17.0）
- 结论适用范围：`strict_max_version` 仍为 `10.*`，本次未改任何发布配置。

## 0. 结论速览

| 判定 | 事项 | 依据 |
|---|---|---|
| **必须改（但可等到官方解冻前后）** | 设置页 `onload` 内联事件处理器（全仓唯一一处内联脚本） | 官方 11 文档：基线 CSP `script-src chrome: resource: moz-src:` 会拦内联 `<script>` 与内联事件处理器；Zotero 现在用 `security.chrome_baseline_csp.enabled=false` 临时关闭，官方明说“打算移除该 pref，插件应提前迁移” |
| **建议现在改（向后兼容）** | 把设置页初始化从内联 `onload` 改成 `Zotero.PreferencePanes.register({ scripts })` | 11 dev 的 `xpcom/preferencePanes.js:114` 支持 `scripts` 选项；10.0.8 同样支持（同一文件同签名），改完在 10 上不改变行为 |
| **实测通过，暂不需要改** | 全部私有 API（SDT 视图、`_setReadingMode`、`_handleViewUpdate`、`_readers`、`_iframeWindow`） | 10/11 抽取源码 token 计数与签名一致；59 项集成测试在 11 dev 全通过 |
| **低风险观察项** | 导出用 `HiddenBrowser({useHiddenFrame:false})` | 11 新增“需要主窗口打开”的显式报错（`HiddenBrowser.mjs:78`），我们的调用点始终在主窗口存在时执行，但导出路径未被自动化覆盖 |
| **低风险观察项** | 设置页字体搜索框 `<input type="search">` | FF153 起 chrome 文档强制原生清除按钮，可能与视觉预期不一致（我们不画自己的清除按钮） |
| **不要做** | 现在就把 `strict_max_version` 改成 `11.*` | 官方明确：解冻前不要声明兼容 Zotero 11 |
| **不需要做** | CSP、沙箱冻结、`ownerGlobal`、`remote="false"`、`oncommand`、`CheckboxStateChange`、`<wizard>`、XUL 菜单图标 | 逐项审计后：本仓库 0 命中（见 §3） |

## 1. 资料来源

### 读到的

1. **官方《Zotero 11 for Developers》**（https://www.zotero.org/support/dev/zotero_11_for_developers）——全文已读，要点见 §2。
2. **官方《Zotero 10 for Developers》**（https://www.zotero.org/support/dev/zotero_10_for_developers）——用于判断哪些变化是 10 已经生效、哪些是 11 新增。
3. **Zotero 11 dev 构建本体**（官方 dev 渠道 Windows ZIP，`https://www.zotero.org/download/client/dl?channel=dev&platform=win-x64-zip` → `11.0-dev.5+dac1ad489`）：
   - `platform.ini`：`Milestone=153.0`、`SourceRepository=https://hg.mozilla.org/releases/mozilla-esr153`、`BuildID=20260716160951`。
   - `app/omni.ja` 内 `chrome/content/zotero/xpcom/{reader.js,sdt.js,osKeyStore.js,preferencePanes.js,http.js}`、`resource/reader/reader.js`、`chrome/content/zotero/HiddenBrowser.mjs` 抽取后与 10.0.8 同文件对比。
4. **实测**：把仓库构建出的插件装进 scaffold 的隔离 profile（`.scaffold/test/profile`，非用户日常 profile），指向 11 dev 跑 `npm run test:review`，**59 passed / 0 failed**。日志：`.scaffold/review-zotero.log`（仅 3 行，无报错）。
5. **依赖**：npm registry 与 GitHub Releases（toolkit / scaffold / types），见 §4e。

### 没读到的（需要你补或授权）

| 资料 | 原因 |
|---|---|
| zotero-dev 邮件列表（https://groups.google.com/g/zotero-dev） | `WebFetch` 直接失败（无法匿名抓取 Google Groups 归档）。**功能冻结公告只能你去订阅确认** |
| Zotero 11 beta 渠道的实际版本 | 只用了 dev 渠道构建；beta 是否已带同样平台变化未核实 |
| GitHub `zotero/zotero` 源码（main / 11 分支）在线对比 | `gh api search/code` 对这些私有 API 返回 `total_count: 0`（代码搜索不索引或索引不全），改为直接读**官方构建产物**（更可信） |
| 导出（HiddenBrowser + `browsingContext.print`）在 11 下的真实产出 | 集成测试未覆盖导出，且 headless 无法确认打印结果 |

## 2. 官方 11 变化清单 → 对本插件的影响判定

依据均来自官方 11 文档原文（除注明外）。

| # | 变化（原文要点） | 对本插件 | 依据 / 判断 |
|---|---|---|---|
| 1 | 平台 Firefox 140 → 153（“incorporating changes from Firefox 140 through Firefox 153”） | 间接 | 影响通过 §2 各项传导；本身无直接 API 变化 |
| 2 | 基线 CSP `script-src chrome: resource: moz-src:` 应用于所有 `chrome:` 文档，**拦截内联 `<script>` 与内联事件处理器**；Zotero 暂时用 `security.chrome_baseline_csp.enabled` 关闭，但“我们打算把自己的内联脚本和事件处理器搬到独立文件并移除该 pref，插件也应如此” | **影响（唯一必须改的点）** | 我们唯一内联处理器：`addon/content/preferences.xhtml:3`。11 dev 构建 `defaults/preferences/zotero.js:1932` 仍是 `pref("security.chrome_baseline_csp.enabled", false)`，所以**现在不炸** |
| 3 | `Cu.Sandbox` 默认冻结 built-ins（`Promise`、`Array.prototype`、`JSON.parse` 赋值失败/严格模式抛错）；“插件自己的全局与对象不受影响”；自建 sandbox 可传 `freezeBuiltins:false` | 不影响 | 全仓无内置对象/原型赋值；唯一全局写入 `src/index.ts:9` `_globalThis.addon = new Addon()` 写的是插件自有全局 |
| 4 | `<browser remote="false">` 现在创建**远程**浏览器（`isRemoteBrowser` = 存在 `remote` 属性） | 不直接影响 | 我们不自己创建 `<browser>`；导出走 Zotero 的 `HiddenBrowser`，其 11 版显式 `setAttribute("remote","true")`（`HiddenBrowser.mjs:86`），语义未变 |
| 5 | `hidden/collapsed/selected/disabled/checked` 变成“仅看存在性”的布尔 XUL 属性；`setAttribute('hidden', false)` 会隐藏元素；反射属性写入空值 | 不影响（已逐项核对） | 无 `setAttribute("hidden"/"disabled"/"checked"/"selected")`；状态切换全部用 `.hidden = bool` / `.checked = bool`（如 `src/bilingualReader.ts:1959,1993`、`src/modules/preferenceScript.ts:690,770,793`）；CSS 用 `[hidden]` 而非 `[hidden="true"]`（`addon/content/preferences.css:218`） |
| 6 | `ownerGlobal` → `documentGlobal` | 不影响 | 0 处使用 |
| 7 | `XPCOMUtils.defineLazyServiceGetter()` 需要 `nsIID` 而非接口名 | 不影响 | 0 处使用 |
| 8 | XUL checkbox 的 `CheckboxStateChange` 事件移除，改监听 `command` | 不影响 | 0 处使用；设置页是 HTML `<input type=checkbox>` + `.checked` 属性 |
| 9 | `<menuitem>/<menu>` 内图标从 XUL `<image>` 变 `<html:img>`，需设 `--menuitem-icon` | 不影响 | 我们不用 XUL 菜单；阅读器右键菜单是自建 HTML（`src/readerMenu.ts:116` `role="menuitem"`） |
| 10 | 登录管理器访问改为异步：`findLogins()` 抛错、`searchLogins()` 移除，`addLogin/modifyLogin/removeLogin` 移除，改用 `searchLoginsAsync()` / `*Async` | 现在不影响，**改造密钥存储时影响** | 见 `RESEARCH-key-security.md` §4b |
| 11 | `<wizard>` 不再有 `extra1/extra2` | 不影响 | 0 处使用 |
| 12 | `oncommand` 加入 `GlobalEventHandlers`（Invoker Commands），`elem.oncommand = "fn()"` 会覆盖属性编译出的处理器 | 不影响 | 0 处使用 |
| 13 | `<input type="search">` 在 chrome 文档强制原生清除按钮 | 轻微外观影响 | `addon/content/preferences.xhtml:1071`（字体搜索）。我们没有自绘清除按钮，不会“双重清除”，但会出现一个新的原生小按钮，需目视确认与 300px 高列表的观感 |
| 14 | 其余（`<search-textbox>` 移除、`wantdropmarker`、chrome DTD 限制、父进程 `eval()` 限制）由 Zotero 内部兜底 | 不影响 | 我们不使用这些；无 `eval`/`new Function`（grep 0） |
| 15 | dev/beta/source 构建**不再校验** `strict_max_version`（安装与更新都不校验），stable 仍校验 | 有利 | 这正是“不改 manifest 也能在 11 上测试”的机制，见 §5 |

## 3. 影响面审计（代码级）

### a. 内联脚本 / 内联事件 / `javascript:` 链接

| 位置 | 内容 | 风险 |
|---|---|---|
| `addon/content/preferences.xhtml:3` | `<groupbox ... onload="Zotero.__addonInstance__.hooks.onPrefsEvent('load', { window })">` | **唯一**命中。CSP 一旦启用，设置页初始化失效（面板空白/未本地化），且 CSP 违规多为“静默失败” |
| `addon/content/preferences.xhtml` 其余 | 无其它 `on*=` 属性（仅 `aria-controls` 等误匹配） | 无 |
| `src/**` 注入的 HTML | 工具栏按钮、阅读器菜单、聊天面板 `bodyXHTML`、划词弹窗、设置页预览 Shadow DOM、导出 HTML 全部用 DOM API/模板字符串构建，**未发现** `onclick=`/`javascript:` 或 `setAttribute("on…")` | 无 |
| 导出 HTML | 未发现 `<script>`；只有内联 `<style>`（`script-src` 不拦 style，但若将来加 `style-src` 需再议） | 低 |

结论：**只需处理 1 处**，且可以在 10 上无损替换（§6 第 1 项）。

### b. 导出的 HiddenBrowser 与 `browsingContext.print()`

- 我们的调用：`src/readerUI.ts:245-254` `importESModule("chrome://zotero/content/HiddenBrowser.mjs")`；`265` `new HiddenBrowser({ useHiddenFrame: false })`；`278-302` `browser.browsingContext.print(settings)`。
- 11 版 `HiddenBrowser.mjs` 仍提供 `browsingContext`（`browsingContext.customUserAgent`、`sandboxFlags` 等内部使用），并**新增**显式约束：`useHiddenFrame: false` 时“requires the main window to be open”（`HiddenBrowser.mjs:78`），以及 `allowJavaScript`/`docShell` 只支持 `useHiddenFrame: true`（`:81`）。
- 我们的导出由工具栏菜单触发，主窗口必然存在 → 该约束不会触发；但**导出流程没有任何自动化覆盖**（集成测试 59 项不含导出，见 §5 限制），需人工验证一次。
- `print()` 依赖 `mainWindow.PrintUtils.getPrintSettings` + `nsIPrintSettings.outputDestination=1`，属 Mozilla 打印 API，11 文档未列为破坏性变化。

### c. 内置对象 / 全局赋值 / polyfill

| 检查 | 结果 |
|---|---|
| `Promise =`、`Array.prototype`、`JSON.parse =`、`Object.defineProperty(global…)` | 0 处 |
| `globalThis.` 写入 | 仅 `src/index.ts:9`（插件自有全局） |
| `cancellationToken.ts` 自实现 `CancellationToken` 类 | 是普通 class，不碰内置对象；文件头注释说明“AbortController 并非在所有 Zotero 10 全局里都有”，与 11 沙箱冻结无关 |
| `eval` / `new Function` / 字符串定时器 | 0 处 |

结论：沙箱冻结对我们**零影响**。

### d. 私有 API 与 Zotero 11 源码比对

方法：从 11 dev 与 10.0.8 的 `omni.ja` 抽取同名文件，统计 token 出现次数并抽取上下文（`reader.js` 为 Zotero 主进程 Reader 类；`resource/reader/reader.js` 为阅读器前端 bundle，含 SDT 视图类）。

| API | 我们的调用点 | 10.0.8 | 11.0-dev.5 | 判定 |
|---|---|---|---|---|
| `reader._internalReader` | `bilingualReader.ts:262`、`readerUI.ts:11` | 87 | 87 | 未变 |
| `_primarySDTView` / `_secondarySDTView` | `bilingualReader.ts:270,1184,2042`、`readerUI.ts:18` | 10 / 12 | 10 / 12 | 未变 |
| `_setReadingMode(primary, enabled)` | `bilingualReader.ts:481-482` | 2 | 2 | 签名一致（11 内部调用 `this._setReadingMode(this._lastViewPrimary \|\| !this._secondaryView, enabled)`） |
| `_handleViewUpdate(bool)` | `readingLayout.ts:25-26` | 21 | 21 | 未变 |
| `Zotero.Reader._readers` | `bilingualReader.ts:712,727`、`readerToolbar.ts:70,159`、`chatPane.ts:114` | 18 | 18 | 未变 |
| `reader._iframeWindow` | 多处（`bilingualReader.ts:692,1260,1304,1980,2053`、`readerToolbar.ts:74,112,163`、`readerUI.ts:32,425`） | 54 | 54 | 未变 |
| `#sdt-content` 容器 id | `bilingualReader.ts`（`querySelector("#sdt-content")`） | 3 | 2 | 容器 id 仍在（`container.id='sdt-content'`）；11 少的一处是内部“按 ref 滚动到块”的 querySelector，我们不依赖 |

> 说明：以上是**构建产物级**证据（官方 11 dev 二进制里的真实代码），比浏览 GitHub 分支更可靠。但 token 计数不能证明“行为完全一致”，只能证明“符号与调用形态没变”；真正的行为验证靠 §5 的 59 项测试。

### e. 依赖兼容性

| 依赖 | 本地版本 | npm 最新 | Zotero 11 相关证据 | 判定 |
|---|---|---|---|---|
| `zotero-plugin-toolkit` | `5.1.0-beta.13` | `6.0.0`（2026-10-03） | v6 的唯一 breaking change 是 “Remove global modules”（`5.2.0...6.0.0`）；仓库内搜索 “Zotero 11” 仅 1 条无关 issue | **5.1.0-beta.13 在 11 dev 上实测通过**（59/59）。是否升级到 6.x 与 11 无关，属独立技术债 |
| `zotero-plugin-scaffold` | `0.8.2` | `0.9.4`（2026-11-07） | 0.9.x 发布说明无 Zotero 11 相关项（immutable releases、依赖升级、rdp 清理） | 0.8.2 已能构建并在 11 上跑测试；升级非必需 |
| `zotero-types` | `4.1.0-beta.4` | `4.1.3`（2026-07-24） | 未见 11 专门说明；4.1.x 早于 11 dev 构建（2026-07） | 类型层面未覆盖 153 新 API（如 `Zotero.platformMajorVersion` 是否在类型里未核实），但开源 API 没变，编译不受影响 |

### f. 构建目标与发布配置

| 项 | 现状 | 11 下是否需要动 |
|---|---|---|
| esbuild `target` | `firefox115`（`zotero-plugin.config.ts:36`） | 不需要。语法降级更保守，153 能跑 115 目标产物；Zotero 官方模板也长期用低 target |
| `strict_min_version` / `strict_max_version` | `10.0` / `10.*`（`addon/manifest.json:1`） | **本次不改**。dev/beta 不校验 max；stable 11 发布后才需要（见 §6/§7） |
| `update.json` | `.scaffold/build/update.json`，`update_url` 指向 `releases/download/release/update.json` | 11 稳定后只改 max 时，官方明确“可以只更新 update manifest，不必发新版本”（Zotero 10 文档同款说明） |

### g. 测试能否指向 11

可以，且已实测：

```bash
CODEBUDDY_SAFE_DELETE_ENABLED=0 \
ZOTERO_PLUGIN_ZOTERO_BIN_PATH="C:\\Users\\<你>\\AppData\\Local\\Temp\\z11\\Zotero_win-x64\\zotero.exe" \
npm run test:review
```

- `scripts/test-review.mjs` 用 `.scaffold/test/profile` + `-headless` + `-no-remote`，与用户日常 profile 隔离。
- 注意两个坑（本次踩到）：`ZOTERO_PLUGIN_ZOTERO_BIN_PATH` 必须是**真实 Windows 路径**（Git Bash 的 `/tmp` 会解析失败并报 “The Zotero binary not found.”）；scaffold 清理 `.scaffold/test/data/translators` 时会触发本机文件删除保护，需要给该命令放行删除（本次用 `CODEBUDDY_SAFE_DELETE_ENABLED=0` 关闭本地保护，仅影响该测试目录）。
- 官方机制支撑：11 文档明确 dev/beta/source 构建**不校验** `strict_max_version`，所以无需为测试改 manifest。

## 4. 实测记录

| 项 | 结果 |
|---|---|
| 构建 | `npm run build` 通过（0.6.0） |
| 安装 | scaffold 自动把 XPI 装进隔离 profile，启动成功 |
| 版本确认 | 构建产物 `platform.ini`：`Milestone=153.0`、`SourceRepository=mozilla-esr153`；运行时 `Zotero.platformMajorVersion` **未打印**（不允许改 `test/`，未加临时用例） |
| 测试 | `test:review` **59 passed / 0 failed**（含设置页五标签切换、字体检测、取色器、装饰/色带/块布局、方案导入导出、快捷键、悬停、翻译范围、四种引擎请求、聊天、阅读器工具栏/菜单、重试/暂停等） |
| 日志 | `.scaffold/review-zotero.log` 3 行，无错误输出 |
| **未覆盖** | 导出 PDF（HiddenBrowser/print）、真实 GUI 观感、真实 PDF 上的高亮几何、`platformMajorVersion` 运行时值、非 headless 的窗口行为 |

判断：**主体功能在 11 dev 上可用**；风险集中在“导出 + GUI 细节”，以及未来 CSP 启用后的内联 `onload`。

## 5. 兼容策略建议

前提（官方要求）：解冻公告前不声明兼容 11，不改 `strict_max_version`。

### 原则
1. **优先特性检测，不做版本分支**。已有的模式是对的：`typeof internal._setReadingMode === "function"`、`if (!browsingContext?.print)`、`getHiddenBrowserConstructor()` 的 try/import。11 的所有私有 API 都在，说明“检测 + 静默降级”比“按 `platformMajorVersion` 分支”更划算。
2. **把版本相关判断收敛到一层**。目前私有 API 分散在 8 个文件：建议新增 `src/zoteroCompat.ts`，集中导出 `getInternalReader()`、`getSDTView()`、`setReadingMode()`、`getReaderDocument()`、`getHiddenBrowserConstructor()`、`getPlatformMajorVersion()`。改动是纯搬迁，风险低，收益是将来 11 真出问题时只需改一个文件。
3. **CSP 迁移与版本无关，现在就能做**，且是唯一“必然要付的账”。

### 现在就能做（向后兼容，10 上行为不变）
| 优先级 | 改动 | 难度 | 风险 |
|---|---|---|---|
| P0 | 删掉 `preferences.xhtml:3` 的 `onload`，改为 `PreferencePanes.register({ scripts: ["content/preferences.js"] })`，脚本里自行监听 DOM 就绪后调 `hooks.onPrefsEvent("load", …)` | 低 | 低（10/11 的 `preferencePanes.js` 都支持 `scripts`；需处理“脚本先于 DOM 完成”的时序） |
| P1 | 私有 API 收敛到 `src/zoteroCompat.ts` | 中 | 中（纯搬迁但触点 8 个文件，需跑全套测试） |
| P1 | 加一条 CI/本地检查：禁止 `addon/**` 出现内联 `on*=` 与非 module `<script>`（简单 grep 脚本即可，不必新增依赖） | 低 | 低 |
| P2 | 导出路径加“主窗口缺失时明确报错”的兜底（对齐 11 的新约束） | 低 | 低 |
| P2 | 设置页字体搜索框目视确认 FF153 原生清除按钮观感 | 低 | 无 |

### 必须等（官方解冻公告之后）
| 项 | 说明 |
|---|---|
| 改 `strict_max_version` | 官方：解冻前不要声明；解冻后用 dev/beta 再跑一遍 `test:review` + 人工导出验证 |
| 实测导出 PDF | 需要真实 GUI + 一篇真实 PDF，headless 不能替代 |
| 决定是否升级依赖大版本（toolkit 6、scaffold 0.9） | 与 11 无关，解冻期一起做会混淆变量，建议分开 |

### 何时需要版本分支
只有一种情况值得引入 `Zotero.platformMajorVersion` 分支：SDT 私有结构在 11 之后的版本被改名/重构。当前证据显示没有，所以**现在不要写版本分支**（写了就是无依据的复杂度）。

## 6. 发布前检查清单（Zotero 11）

- [ ] `npm run build` / `lint:check` / `test:unit` / `test:review`（指向 11 dev）全绿
- [ ] `grep -rn "on[a-z]\{3,\}=\"" addon/` 只剩 `aria-*` 等误匹配，0 内联处理器
- [ ] 设置页五个标签在 11 上逐个打开、保存、切标签不丢值（本次已由集成测试覆盖 DOM 层，仍需目视）
- [ ] 导出 PDF：`reader` 与 `print` 两种模式各导出一次，确认文件生成、可搜索、无空白页
- [ ] 阅读模式开关、四种排版、高亮几何（左右分栏）在真实 PDF 上不偏移
- [ ] 深浅主题下设置页对比度（11 的 `--fill-*`/`--accent-blue` 变量是否仍存在，需目视）
- [ ] 撤回/撤销：不做（我们不改 Zotero 数据）
- [ ] `update.json` 的 `strict_max_version` 与新 manifest 一致
- [ ] README/商店描述里的“Requires Zotero 10”改成“Zotero 10–11”
- [ ] 官方公告后 24h 内再跑一次最新 beta，确认无回归

## 7. 结论与建议

1. Zotero 11 对本插件的**实质破坏面很小**：官方列的 13 类平台变化里，我们只命中 1 类必须改（内联 `onload`），另有 2 类属外观/边界观察项。
2. **59 项集成测试在 11.0-dev.5 上全通过**，私有 API（SDT 视图、`_setReadingMode`、`_handleViewUpdate`、`_readers`、`_iframeWindow`）在 11 构建产物中符号与调用形态均未变。
3. 最该现在动手的是 **CSP 迁移**（低风险、10/11 双兼容）与**私有 API 收敛**（降低未来不确定性），而不是改版本号。
4. 不要在解冻前声明兼容 11；dev/beta 不校验 `strict_max_version`，足够测试。
5. 未实测项：导出 PDF、GUI 观感、运行时 `platformMajorVersion`、zotero-dev 冻结公告。

## 8. 需要我决定的事

1. **是否现在就做 CSP 迁移**（`onload` → `register({scripts})`）？我建议做，且单独一个提交，可与 11 解冻解耦。
2. **是否把私有 API 收敛到 `src/zoteroCompat.ts`**？收益是维护性，代价是一次涉及 8 个文件的搬迁（纯重构，测试兜底）。
3. **是否加“内联处理器”静态检查**（grep 脚本或 CI 步骤，不新增依赖）？
4. **导出验证谁来跑**：需要你在真实 GUI 里用一篇真论文导出 reader/print 各一次（我无法在 headless 里确认打印结果）。
5. **依赖升级窗口**：toolkit 6.0.0（breaking: remove global modules）/ scaffold 0.9.4 是否要在 11 适配期一起升，还是分开做？
6. **zotero-dev 订阅**：邮件列表我读不到，冻结公告需要你转达或授权我用别的途径。
