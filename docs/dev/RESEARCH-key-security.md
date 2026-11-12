# 调研：API 密钥安全（只调研，未改源码）

- 日期：2026-11-11
- 分支：`research/zotero11-and-key-security`
- 核实环境：Zotero 10.0.8（本机安装，FF 140.17.0）+ Zotero 11.0-dev.5（esr153 构建，见 `RESEARCH-zotero11.md`）
- 重要：本文所有示例密钥均为假值（`sk-test-000…`），未使用、未记录任何真实密钥。

## 0. 结论速览

| 结论 | 内容 |
|---|---|
| 现状 | 三个 provider 的密钥以**明文**写入 Zotero 偏好（`prefs.js`），无加密、无掩码、无清除按钮；但不进 URL、不进缓存键、不进日志、不进导出文件（已逐条核实） |
| 安全等级 | 等价于“明文存一个 txt”。同账户下的任何程序、任何其它 Zotero 插件都能读。这是 Zotero 插件生态普遍现状，不是本插件独有缺陷 |
| **关键发现** | Zotero 自带 `Zotero.OSKeyStore`（`chrome/content/zotero/xpcom/osKeyStore.js`），是对 Mozilla `resource://gre/modules/OSKeyStore.sys.mjs` 的薄封装，**底层就是 macOS Keychain / Windows DPAPI / Linux libsecret**。Zotero 10 与 11 **都有**，且都在 `zotero.mjs` 的导出清单里（`'osKeyStore'`），插件可直接调用 |
| 推荐方案 | **prefs 存 `oskv1:` 前缀密文 + 内存缓存解密值**。不引入 logins 的 host/realm 语义，不把整条 provider 调用链改成 async，迁移面最小 |
| 被否定的方案 | 自研轻量加密/混淆（假安全）；直接调 `nsIOSKeyStore`（多一层无收益且要原生组件思路）；把 key 存进外观/术语表 JSON（扩大暴露面） |
| 改动范围（预估） | 新增 `src/secrets.ts`；改 `src/settings.ts`（读写 + 缓存 + 迁移）、`src/modules/preferenceScript.ts`（掩码/清除/状态提示）、`src/providers/*`（HTTPS/重定向校验）、`src/utils/`（脱敏） |
| 对现有用户 | 首次读取时自动迁移；迁移失败不阻塞、不静默降级；换机器/换系统用户后需重新输入（不可解密，属预期） |

## 1. 现状盘点（文件:行号）

### 1.1 偏好键与读写

| 位置 | 做什么 | 风险 |
|---|---|---|
| `src/settings.ts:125` `extensions.zotero.interlinear.openai.apiKey` | 键定义 | 明文落盘 |
| `src/settings.ts:130` `…claude.apiKey` | 同上 | 同上 |
| `src/settings.ts:135` `…gemini.apiKey` | 同上 | 同上 |
| `src/settings.ts:304-306` `getOpenAIApiKey()` | 同步读 + `trim()` | 同步 API 是把密钥迁到 async 解密存储的最大障碍（见 §4） |
| `src/settings.ts:308-310` `setOpenAIApiKey()` | 同步写 + `trim()`（已自动去首尾空白） | 明文写盘 |
| `src/settings.ts:362-368` Claude 读写 | 同上 | 同上 |
| `src/settings.ts:428-434` Gemini 读写 | 同上 | 同上 |

### 1.2 界面

| 位置 | 做什么 | 风险 |
|---|---|---|
| `addon/content/preferences.xhtml:260` / `374` / `488` | `type="password"` 输入框（三家各一个） | 肩窥/录屏时默认遮蔽 ✅；但旁边有“显示”按钮（`:265`/`379`/`493`），点开即明文 |
| `src/modules/preferenceScript.ts:3586` / `3595` / `3602` | 保存时把输入值写入偏好 | 明文 |
| `src/modules/preferenceScript.ts:3789-3801`（OpenAI 测试连接）、`3826-3838`（Claude）、`3863-3875`（Gemini） | 直接把输入框里的值传给 `testXxxConnection()` | 只在内存中；但“测试连接”会向用户填写的**任意 endpoint** 发一次带密钥的请求（见 §2.5） |

### 1.3 请求构造与传递

| 位置 | 做什么 | 风险 |
|---|---|---|
| `src/providers/index.ts:60,79,99,170,188,207` | 把 `getXxxApiKey()` 塞进 provider config | 明文在内存中常驻于调用栈/闭包；无日志 |
| `src/providers/openai.ts:53-56` | `Authorization: Bearer <key>` | 头部传输，不进 URL ✅ |
| `src/providers/claude.ts:42-56` | `x-api-key: <key>` | 同上 |
| `src/providers/gemini.ts:41-56` | `x-goog-api-key: <key>`，源码注释明确“header 让 key 不进 URL/日志/缓存标签” | 同上 |
| `src/providers/chat.ts:133-134,159-166,191-198` | 聊天复用同一套头部 | 同上 |

### 1.4 不涉及密钥的位置（已核实，均为 0 命中）

| 位置 | 结论 |
|---|---|
| `src/translationCache.ts` / `translationCacheKey.ts` | 不含 `apiKey` |
| `src/settings.ts:907-933` `getCacheEngineTag()` | 注释明确“API key intentionally absent… cache keys must never carry secrets”；标签只含端点/模型/提示词与温度的哈希/语言对/术语哈希 |
| `src/appearanceFiles.ts`（外观方案导入导出） | 不含 `apiKey`；集成测试断言导出 JSON 无 provider 字段 |
| `src/settings.ts:967,1014,1020`、`src/chatPane.ts:474,484` | 只有 `Zotero.logError(error)`，不打印配置对象 |
| `test/startup.test.ts:2165,2245,2325` | 已有三个“without leaking the key”用例：断言请求头带密钥、但响应/缓存/日志中没有 |

### 1.5 Zotero 自身是否会把偏好写进诊断输出

- `chrome/content/zotero/xpcom/debug.js:194` `get()` 只返回 `_output` 日志数组；`debug.js` 内没有任何“dump prefs”的逻辑（grep `pref|Prefs` 仅命中调试开关本身）。
- 结论：**“Submit Debug Output”不包含偏好值**；因此密钥不会通过官方调试输出外泄，除非插件自己把密钥写进日志（我们没有）。
- 不确定：崩溃/错误报告（`chrome/content/zotero/errorReport.xhtml`）提交内容未逐行核实，但按其设计只含错误与堆栈；如需 100% 确认需实际提交一份报告观察。

## 2. 威胁模型

| # | 威胁 | 可能性 | 影响 | 依据 / 说明 |
|---|---|---|---|---|
| 1 | 同机其他用户或恶意软件读 `prefs.js` | 中 | 高（付费 key 被盗刷） | `prefs.js` 是普通文件，仅受账户级 ACL 保护；无加密 |
| 2 | 用户备份/云同步/拷贝 profile 目录 | 中 | 中高 | 整目录复制会把 `prefs.js` 一起带走；`.scaffold`、备份工具、迁移助手都常见 |
| 3 | 用户分享调试输出或错误报告 | 低 | 中 | 官方调试输出只含日志（§1.5）；但用户常直接粘贴 `prefs.js` 片段到论坛求助 |
| 4 | 截图/录屏 | 中 | 中 | 默认 `type=password` 遮蔽；一旦点“显示”或截图时输入框聚焦未遮蔽则暴露 |
| 5 | **把密钥发到错误的主机** | 中 | 高 | 三种现实路径：①用户把自定义 endpoint 填成 `http://` 明文；②endpoint 被 302 重定向到第三方；③OpenAI 兼容/Ollama 的 baseURL 填错。**Zotero.HTTP.request 默认跟随重定向**（`http.js` 的 `followRedirects`，`:346` 提供 `false` 选项时用 `asyncOnChannelRedirect` 取消），未发现任何“跨主机剥离请求头”的逻辑；Gecko 特权 XHR 跟随重定向会重发同一批头 —— 但**跨主机重定向是否真的带 `x-api-key` 未实测**（见 §7 未做项） |
| 6 | 日志/错误信息泄漏 | 低 | 中 | 已核实：错误只带状态码 + 响应体片段（`providers/*.ts` 的 `httpError()`），不带请求头；仍建议统一脱敏（§5.7） |
| 7 | 导入的外观/术语表文件夹带内容 | 低 | 低 | 导入只解析 JSON/CSV 并经 `normalizeAppearance` 白名单夹取，不执行内容、不读偏好 |
| 8 | **其它插件读我们的偏好** | 高（能力上必然） | 取决于对方 | 所有插件同处 chrome 权限、无沙箱；Zotero 团队 2026-09 在论坛明确承认“插件能读你 OS 用户能读的任何东西”。任何插件都能 `Zotero.Prefs.get("extensions.zotero.interlinear.openai.apiKey", true)` |
| 9 | 开发/CI 环境泄漏（`.env`、误提交） | 低 | 高 | `.gitignore` 已含 `.env`、`.scaffold`；`.env.example` 只有占位符；但**没有**任何 secret 扫描（`.github/workflows/*` 无 gitleaks 等） |
| 10 | 内存中的保留方式 | 低 | 低 | 密钥只作为字符串存在于 provider config 与请求头构造处，用完即弃；无常驻全局缓存（引入加密存储后会新增“解密缓存”，需显式设计失效） |
| 11 | 崩溃转储（minidump） | 低 | 中 | 崩溃时进程内存可能落盘；无法从插件侧控制，属平台事实，仅记录 |

## 3. 存储方案对比

> 判定“Zotero 10 可用 / 11 可用”均基于两个版本的**构建产物源码**（`app/omni.ja`），不是凭印象。

### a. 现状：`Zotero.Prefs` 明文
- 可用性：10 ✅ / 11 ✅
- 依据：`src/settings.ts:304-310` 等。
- 优点：同步读、零改动、跨平台一致。
- 缺点：明文落盘；任何插件/同账户程序可读。

### b. Gecko 登录管理器（`Services.logins`）
- 可用性：10 ✅（同步 API 齐全）；11 ✅（**API 已异步化**）
- 11 的破坏性变化（官方 11 文档原文）：`findLogins()` 抛错、`searchLogins()` 移除，改用 `await searchLoginsAsync({…})`；`addLogin/modifyLogin/removeLogin` 移除，改用 `*Async`。
- 加密机制（重要，避免误解）：Zotero 自己并不依赖 logins 的“密码库加密”，而是**把密文放进 login 的 password 字段**：
  - `chrome/content/zotero/xpcom/sync/syncLocal.js:186` `var storedValue = await Zotero.OSKeyStore.encrypt(apiKey);` → 写入 `loginInfo`（`:200-204` `addLoginAsync` / `modifyLoginAsync`）。
  - 读取：`syncLocal.js:91` `return Zotero.OSKeyStore.decrypt(login.password);`，并对旧明文条目做“镜像迁移 + 失败提示”（`:76-90`）。
  - WebDAV 密码同款：`xpcom/storage/webdav.js`（同样 `searchLoginsAsync` + `OSKeyStore`）。
- 结论：logins 只是“带 host/realm 语义的容器”，**真正的加密来自 `Zotero.OSKeyStore`**。直接用它反而更简单。

### c. **`Zotero.OSKeyStore`（推荐）**
- 可用性：10 ✅ / 11 ✅
- 依据：
  - `chrome/content/zotero/xpcom/osKeyStore.js`（10.0.8 233 行 / 11 dev 116 行）定义 `Zotero.OSKeyStore`。
  - `chrome/content/zotero/zotero.mjs:117` 导出清单含 `'osKeyStore'`（10 与 11 都有）→ 插件可直接 `Zotero.OSKeyStore`。
  - 文件头注释（两版一致）：“Wrapper around Mozilla's OSKeyStore, which derives an encryption key from platform-native key storage (**Keychain on macOS, DPAPI on Windows, libsecret on Linux**)”。
- API（两版**共同子集**，只应使用这些）：
  - `available`（getter，同步，模块能否加载）
  - `isEncrypted(value)`（判断 `oskv1:` 前缀）
  - `encrypt(plaintext) → Promise<string>`（返回带 `oskv1:` 前缀的密文；不可用时**抛错**，不会静默返回明文）
  - `decrypt(value) → Promise<string>`（非前缀值原样返回，即兼容旧明文；前缀值解密失败会抛 `Zotero.Error`，区分“存储不可用”与“换机器/换用户导致不可恢复”）
  - `alertSaveFailed()` / `alertMigrateFailed()`（两版都有）
- **两版差异（必须避开）**：11 版删掉了 `confirmUnencryptedFallback()`、`_usable()`、`_error()`（10 版有）。所以降级确认弹窗必须**自己实现**，不能调用 10 专有方法，否则在 11 上 `undefined is not a function`。
- 限制：
  - Linux 依赖 Secret Service（libsecret）。Zotero 自己的注释：keystore 可能“most often on Linux, where the platform requires a Secret Service that some managed systems don't run” → 必须有明确的“不可用”分支（Zotero 会弹窗问是否改为不加密保存，我们不能照抄它的 10 专有方法）。
  - 密文与 **OS 用户 + 机器** 绑定：拷贝 profile 到另一台机器/另一个系统账户后无法解密（Zotero 的错误文案就是这么区分的）。必须处理“解密失败 → 提示重新输入”，而不是静默清空。
  - 加密/解密是 async（macOS 上可能弹钥匙串授权框）。
  - 没有“删除密钥”的原子操作——删 pref 即可，但**旧值可能仍在 `prefs.js` 的历史/备份里**（Zotero 写盘是整体重写，不做 vacuous 清理）。

### d. 直接访问 OS 钥匙串（`nsIOSKeyStore`）
- 可用性：技术上存在（`Cc["@mozilla.org/security/oskeystore;1"].getService(Ci.nsIOSKeyStore)`，Zotero 自己在 `_error()` 里用它探测状态）。
- 判定：**不建议**。`Zotero.OSKeyStore` 已经是它的正确封装（含前缀、错误翻译、迁移提示），直接用底层只会重复实现易错逻辑；也不需要任何原生组件。

### e. 运行时环境变量（`Services.env`）
- 可用性：10 ✅ / 11 ✅（Zotero 自己的 `xpcom/utilities_internal.js` 在用 `Services.env.`）
- 用法：让用户填“环境变量名”，运行时 `Services.env.get(name)` 取真值。
- 优点：key 完全不落盘；适合高级用户/CI。
- 缺点：普通用户（尤其 Windows 桌面用户）不会设环境变量；GUI 启动方式（快捷方式/开始菜单）继承的环境不一定含用户新设变量；跨平台文档成本高。
- 判定：作为**可选高级模式**（“从环境变量读取”），不做默认。

### f. 外部文件路径引用
- 可行性：可以（`Zotero.File.getContentsAsync` + 路径校验），10/11 均可用。
- 优点：key 不进 prefs；便于 1Password/`pass` 之类工具生成。
- 缺点：文件本身仍是明文；路径校验、权限、跨平台路径、文件被移动等问题都由用户承担；导入导出/备份仍可能带走。
- 判定：可选高级模式，优先级低于 e。

### g. 仅内存、每次会话输入
- 优点：最强（不落盘）。
- 缺点：每次启动都要输入；自动翻译/后台请求需要 key，用户几乎必然要求“记住”。
- 判定：作为“不保存密钥”的开关（与 c 组合：可选“本次会话记住”）。

### h. 轻量混淆 / 自研本地加密
- 判定：**不做**。没有独立密钥来源的“加密”只是把明文换个编码；密钥若也放在同一 profile 里，攻击者一样能解。它的唯一效果是让用户误以为安全（降低警觉），并增加迁移/排障成本。
- 唯一例外：如果将来要跨设备同步密钥，那必须以“用户口令派生密钥（PBKDF2/Argon2）+ 明确的口令丢失即数据丢失”为前提，属独立产品决策。

## 4. 关键设计约束：同步读取

现状 `getOpenAIApiKey()` 是**同步**函数，被 `providers/index.ts` 在构造 config 时同步调用；而 `OSKeyStore.decrypt()` 是 **async**。

三条路：
1. **（推荐）内存缓存 + 启动预热**：新增 `src/secrets.ts`，`initSecrets()` 在插件启动时把所有已加密值解密到内存 `Map`，`getXxxApiKey()` 保持同步（先读缓存，未命中且值是明文则返回明文）。写入时同步更新缓存再异步落盘。这样 **provider 调用链一行不用改**。
2. 全链路 async 化（`getXxxApiKey → Promise`，改 `providers/index.ts` + 所有调用点 + 测试）：改动大、回归面广，收益仅是省一个缓存。**不建议**。
3. 用 logins 的同步 API（仅 10 可用）：11 已移除，**不可行**。

## 5. 配套安全改进（评估，不实现）

| # | 改进 | 建议 | 说明 |
|---|---|---|---|
| 5.1 | 密钥显示/隐藏 | 已有 ✅ | `type=password` + 显示按钮；建议显示 8 秒后自动回到遮蔽态 |
| 5.2 | 仅显示末 4 位掩码 | 建议做 | 保存后输入框显示 `••••••••abcd`，聚焦时才清空等待新输入；避免“打开设置页就暴露全文” |
| 5.3 | “清除密钥”按钮 | 建议做 | 现在只能手动全选删除；清除后需同步清缓存 + 重置连接测试状态 |
| 5.4 | 粘贴自动 trim | 已具备 ✅ | `setOpenAIApiKey()` 等已 `.trim()`（`settings.ts:309/367/433`）；建议也在 `input` 事件里做，避免“看起来有空格但被静默修正”的困惑 |
| 5.5 | 迁移（明文 → 密文） | 必须做，且要幂等 | 顺序：`encrypt()` 成功 → 写入密文 → **再次确认偏好里是密文** → 才认为迁移完成。失败则保留明文并弹一次提示（不阻塞翻译）。幂等：读到的值若已是 `oskv1:` 前缀则跳过。回滚：保留“能读明文”的代码路径至少一个大版本 |
| 5.6 | 存储不可用时降级 | 必须显式提示 | 三态：`可用` / `不可用（Linux 无 Secret Service）` / `解密失败（换机器）`。**禁止静默回落明文**：默认不保存，让用户明确选择“仍然不加密保存（不推荐）”或“本次会话有效” |
| 5.7 | 强制 HTTPS（非本机） | 建议做 | 规则：`http://` 仅允许 `localhost`/`127.0.0.1`/`::1`/私有网段；其它 `http://` 保存时警告 + 二次确认；`https://` 放行。（Ollama 默认 `127.0.0.1:11434`，不能被误伤） |
| 5.8 | 重定向 | 建议做 | 带密钥的请求传 `followRedirects: false`（`http.js:346` 支持），把 3xx 当作错误提示“端点发生了重定向，请直接填写最终地址”。这从根上消除“跨主机重发请求头”的不确定性 |
| 5.9 | 目标主机与所选服务一致 | 建议做 | 每个 provider 只允许各自的 `apiKey` 字段；自定义 baseURL 时在 UI 明确“密钥将发送到该地址”。现状已天然隔离（三个独立 pref），但**自定义端点的提示**缺失 |
| 5.10 | 统一脱敏函数 | 建议做 | `redactSecrets(text, knownSecrets[])`：①替换 `knownSecrets` 中任意出现的值；②正则遮蔽 `sk-[A-Za-z0-9_-]{8,}`、`AIza[0-9A-Za-z_-]{10,}`、`Bearer\s+\S+`、`x-api-key:\s*\S+`、`x-goog-api-key:\s*\S+`。用在所有错误提示与 `Zotero.logError` 包装处。单测：假 key 经 `httpError()` / 连接测试失败路径后，输出不含原文与任何 8 位以上片段 |
| 5.11 | 多密钥/多 provider | 现状够用 | 三个独立 pref + 独立 endpoint；不建议做“一键切换配置集”（会扩大内存驻留与误发风险） |
| 5.12 | 导入导出不含密钥 | 已有 ✅ | `appearanceFiles` + 现有集成测试；建议把断言扩展到“将来任何新导出格式都必须先过 `redactSecrets` 式检查” |
| 5.13 | 仓库层扫描 | 建议做 | 优先用 GitHub 原生 **Secret scanning + Push protection**（零依赖）；若要本地/CI 兜底，`gitleaks`（需新增开发依赖或 CI action，由你决定）。另建议在 `.gitignore` 之外加 `.env*` 排除与 pre-commit 检查 |

## 6. 推荐方案

### 主方案：`Zotero.OSKeyStore` 加密后仍存 prefs
- **存储位置不变**（仍 `extensions.zotero.interlinear.*.apiKey`），**值的形态改变**：明文 → `oskv1:<ciphertext>`。
- 读写路径：
  - `src/secrets.ts`（新增）：`initSecrets()`（启动预热）、`getSecret(prefKey)`（同步，读缓存）、`setSecret(prefKey, value)`（更新缓存 + 异步加密落盘）、`migratePlaintextSecrets()`（幂等）、`isEncryptionAvailable()`。
  - `src/settings.ts`：`getXxxApiKey()` 改为走 `getSecret()`；`setXxxApiKey()` 改为 `setSecret()`。
  - `src/modules/preferenceScript.ts`：保存后显示“已加密”状态；新增“清除密钥”；掩码显示。
- 为什么不用 logins：不需要 host/realm；logins 在 11 上强制异步，且要自己处理 `repairLoginManager` 这类边缘情况；prefs + 前缀密文的迁移面最小（1 个值变形 vs 1 个新容器）。
- 为什么能同时兼容 10/11：只调用两版**共同**的 `available/isEncrypted/encrypt/decrypt`（§3c），不碰 10 专有的 `confirmUnencryptedFallback`。

### 备选方案：logins 记录（与 Zotero 自身一致）
- 优点：与 Zotero 同步密钥同构，可复用“login manager 修复”思路；profile 里不再有明文（password 字段是密文）。
- 代价：需引入 host/realm 常量、全异步读写、迁移逻辑更复杂；`Services.logins` 在 11 上被重置/修复时可能丢条目（Zotero 自己为此写了 `login-manager-reset` 提示）。

### 明确不做
- 自研加密/混淆（假安全）。
- 直接 `nsIOSKeyStore`（重复造轮子）。
- 把密钥搬进 `appearance.v2` 或任何会被导出的 JSON。

### 分阶段实施（按“收益/风险”排序）

| 阶段 | 内容 | 涉及文件 | 风险 | 收益 |
|---|---|---|---|---|
| P0 | 统一脱敏函数 + 全部错误路径接入 + 单测 | `src/utils/*`、`providers/*`、`preferenceScript.ts`、`test/*.node.test.mjs` | 低 | 立刻降低“用户贴报错就泄漏”的概率 |
| P0 | 强制 HTTPS/loopback 判定 + 保存时二次确认 | `src/settings.ts`、`preferenceScript.ts` | 低 | 挡住最现实的“发错主机” |
| P1 | `src/secrets.ts` + OSKeyStore 迁移 + 内存缓存 | 新增 + `settings.ts` | **中**（迁移/降级分支） | 核心收益：落盘不再是明文 |
| P1 | 掩码显示 + 清除密钥 + 加密状态提示 | `preferences.xhtml`、`preferenceScript.ts`、i18n（en/zh 键数必须一致） | 低 | 可见的安全感与可操作性 |
| P2 | `followRedirects:false` + 重定向错误文案 | `providers/*` | 低 | 消除跨主机重发请求头的不确定性 |
| P2 | GitHub Secret scanning / push protection（+ 可选 gitleaks） | 仓库设置 / CI | 低 | 防误提交 |
| P3 | 环境变量/外部文件引用（高级模式） | `settings.ts`、UI | 中 | 小众人群，可延后 |

### 测试清单
1. 迁移：明文 → 加密（幂等：连续两次启动不重复加密）；迁移后 `prefs.js` 无明文残留（测试里读 `Zotero.Prefs.get(prefKey, true)` 断言以 `oskv1:` 开头）。
2. 降级：模拟 `OSKeyStore` 不可用（stub `Zotero.OSKeyStore.available=false` / `encrypt` 抛错）→ 断言：不写密文、不静默写明文、UI 出现明确提示。
3. 解密失败：写入“前缀 + 垃圾密文”→ 断言：抛可读错误、不清空用户设置、提示重新输入。
4. 同步读取语义：`getXxxApiKey()` 在 `initSecrets()` 之后无需 await 即可返回正确值。
5. 脱敏：`sk-test-000…` 出现在错误消息/日志/连接测试结果中时被替换。
6. HTTPS：`http://example.com` 保存触发警告；`http://127.0.0.1:11434` 不警告。
7. 重定向：mock 302 → 断言不跟随、报“请填写最终地址”。
8. 导出：外观方案 JSON、诊断信息均不含密钥（扩展现有断言）。
9. 三引擎回归：现有 59 项集成测试全绿（10 与 11 各跑一次）。

## 7. 未读到 / 未实测

| 项 | 状态 |
|---|---|
| `Zotero.HTTP.request` 跨主机重定向是否真的重发 `x-api-key` | **未实测**。需要本地起一个返回 302 的 HTTP 服务 + 一段真实调用才能确认；本报告只确认“Zotero 不剥离请求头、默认跟随重定向、提供 `followRedirects:false`” |
| 崩溃/错误报告的具体字段 | 未逐行核实（`errorReport.xhtml` 未读） |
| Linux 无 Secret Service 时的真实表现 | 未实测（本机 Windows）。Zotero 源码注释与 KB 链接（`https://www.zotero.org/support/kb/linux_keyring`）是间接依据 |
| macOS 钥匙串授权弹窗时序 | 未实测 |
| GitHub Secret scanning 是否已对该仓库默认开启 | 未查（需仓库设置权限/网页确认） |
| 现有用户中实际填写自定义 endpoint 的比例 | 无数据（不做遥测，属隐私红线） |

## 8. 结论与建议

1. 现状**不是“有明显漏洞”**，而是“本地明文”这一档：不进 URL、不进缓存、不进日志、不进导出，这部分做得比多数同类插件干净；真正的短板是**落盘明文**与**没有 HTTPS/重定向约束**。
2. 最划算的一步不是换存储，而是 **P0 的两项**（脱敏 + HTTPS/loopback 校验）：改动小、立刻降低“用户一贴报错就泄漏/一发请求就发错主机”的概率。
3. 存储升级用 **`Zotero.OSKeyStore` + prefs 前缀密文 + 内存缓存**，可以在**不要求 Zotero 11**、不改 provider 调用链的前提下完成，是本仓库当前架构下的最优解。
4. 明确**不要**做自研加密；也不要现在把密钥搬进 logins（11 的异步化会把改动面放大一倍，收益与 OSKeyStore 方案相同）。
5. `RESEARCH-zotero11.md` 的结论与此联动：11 把 logins 改成异步，恰好说明“别把密钥塞进 logins”的决定是对的。

## 9. 需要我决定的事

1. **是否采纳主方案**（`Zotero.OSKeyStore` + prefs 密文 + 内存缓存）？还是先只做 P0（脱敏 + HTTPS）？
2. **降级策略**：keystore 不可用时，允许“仍然不加密保存（不推荐）”的显式选项，还是强制“不保存/仅本次会话”？
3. **迁移的兼容窗口**：能读明文的能力保留多久（我建议至少一个大版本，且 README 写明）？
4. **是否做环境变量/外部文件这两种高级模式**（我建议延后到有人真的提需求）？
5. **CI 扫描选型**：只用 GitHub 原生 Secret scanning + push protection，还是额外引入 gitleaks（会新增开发依赖/CI 步骤）？
6. **UI 文案与 i18n**：掩码显示、清除按钮、加密状态、降级警告共约 6–8 条新文案，需要中英各一份（en/zh 键数必须一致，已有测试会卡）——是否接受这次一并加？
7. **是否要我继续把 P0 实现出来**（脱敏 + HTTPS + 重定向），还是保持在“只调研”范围内等你拍板？
