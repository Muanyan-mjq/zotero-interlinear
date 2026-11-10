# Interlinear 发布前检查清单

每次发布前从头执行一遍；任何一项未通过都不要打 tag。

## 1. 版本与元数据

- [ ] `package.json` 的 `version` 与 `addon/manifest.json` 的版本一致。
- [ ] `updates.json`（或 `update.json`）中的版本号、下载地址、`applications.zotero.strict_min_version` 与新版本一致。
- [ ] `README.md` 的功能、配置项、限制与当前实现一致。
- [ ] `CHANGELOG.md` 已为当前版本补齐条目。
- [ ] LICENSE 与上游 quillamio/bilingual-reader 的版权声明仍完整保留，许可证为 AGPL-3.0-or-later。

## 2. 代码与自动化检查

- [ ] `npm install` 无新增未知依赖。
- [ ] `npm run build` 通过，产物为 `.scaffold/build/interlinear.xpi`。
- [ ] `npm run lint:check` 通过。
- [ ] `npm run test:unit` 全部通过。
- [ ] `npm run test:review`（Zotero headless）全部通过；若本机无法运行，记录原因并至少在一台机器上跑过。
- [ ] CI 的构建任务（Ubuntu/macOS）为绿色。

## 3. 隐私与安全

- [ ] 设置页明确说明 API 密钥以明文保存在 Zotero 偏好设置中。
- [ ] 日志、错误提示、缓存键均不包含 API 密钥。
- [ ] 阅读助手与翻译的第三方内容发送行为在设置页/README 中有说明。
- [ ] 首次启动的偏好与缓存迁移只复制、不删除原版数据。

## 4. Zotero 手动验收

- [ ] 全新 Zotero 10 用户目录中安装 `.xpi`，插件管理器显示正确图标与版本。
- [ ] 打开英文 PDF，左键工具栏图标开启全文翻译；进度显示、取消均正常。
- [ ] 显示模式按钮可循环切换四种模式，原文节点不移动，Zotero 高亮坐标不偏移。
- [ ] 右键菜单中的重新翻译、取消、导出 PDF、阅读助手、翻译设置均可用。
- [ ] 悬停自动翻译与自定义快捷键可开关、可调延迟，单段请求不与全文重复。
- [ ] 选区翻译弹窗可翻译、关闭，Esc 生效。
- [ ] 制造一次后端失败：出现非阻塞提示而非弹窗；失败段落可点击重试；连续失败后暂停且可恢复。
- [ ] 翻译中滚动/翻页，优先翻译当前视口段落。
- [ ] 导入术语表后，Google 与 LLM 后端的译文都使用统一译法；清空术语表后缓存键变化符合预期。
- [ ] 阅读助手仅对 LLM 后端出现，选区/当前页/全文上下文与截断提示正常。
- [ ] 深色与浅色主题下译文样式、工具栏图标、错误提示均可读。
- [ ] 卸载插件后阅读器恢复原状，重新安装可继续使用既有缓存。

## 5. 发布

- [ ] 以 `step N:` 前缀提交，分支为 `dev`；未经确认不合并到 `main`、不强制推送。
- [ ] 打 tag 后上传 `.xpi` 到 Releases，并核对 `updates.json` 的下载地址可访问。
- [ ] 发布说明中写明升级注意事项（例如需先卸载原版 Bilingual Reader）。
