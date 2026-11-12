# 网络与代理调研（Zotero 10/11）

日期：2026-11-12。基线：`chore/screenshots` @ `d764f82`，本分支 `feat/network-hints`。

## Step 1：现状核实

### 1.1 请求路径与代理

- 插件全部 HTTP 请求都经 `Zotero.HTTP.request()`：`src/providers/{openai,claude,gemini,google,ollama,chat}.ts`（本分支另加了 `secureRequest.ts` 的 `followRedirects:false`）。
- `Zotero.HTTP.request` 内部是 **`new XMLHttpRequest({ mozAnon })`**（Zotero 11 dev 构建 `chrome/content/zotero/xpcom/http.js:283`；10.0.8 同文件同实现）→ 走 Gecko 网络栈，因此**遵守 `network.proxy.*` 偏好**，与 Zotero 自己的同步/元数据抓取完全一致。
- Zotero 只在默认偏好里显式设置了 `network.proxy.share_proxy_settings = false`（`defaults/preferences/zotero.js`，两个版本都有），其余 `network.proxy.*` 未覆盖 → 沿用 Gecko/Firefox 默认。
- **未实测**：隔离 profile 里 `network.proxy.type` 的实际默认值（预期为 `5` = 使用系统代理设置，但本次没有在运行时读取确认，标为不确定）。
- 结论（有依据的部分）：**插件没有独立的代理配置，也不可能绕过 Zotero 的代理设置**；系统代理是否生效取决于 Zotero/Gecko 的 `network.proxy.type` 与操作系统的代理开关。

### 1.2 实测

- 本机当前到 `translate.googleapis.com` 的连接不可用（`curl` 状态 `000`，10s 超时，2026-11-11/12 两次实测），因此**无法在本环境验证“系统代理开启后测试连接是否恢复”**。
- 需要你在隔离 profile 里做的一次实测（我未做，避免动你的系统代理）：
  1. 复制 `.scaffold/test/profile`，用 `zotero.exe -profile <dir> -no-remote` 启动；
  2. `about:config` 读 `network.proxy.type`（预期 5），再设 `network.proxy.type=1` + `network.proxy.http=127.0.0.1` + `network.proxy.http_port=<端口>` 验证 Zotero 是否走代理；
  3. 在插件设置页点 Google 的“测试连接”。
