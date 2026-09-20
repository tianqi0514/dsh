# 独立 Plate 写作插件

客户端使用官方 alpha.2 Resource 与会话右栏扩展。正文权威存储仍为智库 WritingDocumentVersion；通过受认证的 `/api/workdsh-chuanshen` 白名单文稿接口读取与 CAS 保存。独立于 Office，不认领 DOCX、不建立聊天框或 Agent Loop。

代码基于现有妙笔 Plate 53 开源插件 API，按需要逐步复用编辑能力。当前功能和真实验证边界以测试报告为准，不宣称完整 Plate 全部能力已验收。`dsh-resource://chuanshen-writing/<documentId>` 为本插件文稿地址。

通过 `dsh plugin add` 安装构建后的包。`dsh.bundle` 的 `cordis.patch.yml` 创建 Host Loader 行，根入口仅作为官方客户端模块发现的生命周期锚点；不另设 Agent 或后台业务服务。`dsh.client` 与 `./client` 提供浏览器实现。空 patch 无法产生可发现的 Loader 行。此规则来自官方 alpha.2 的 `user/develop/basic/publish` 和 `subsystems/client-modules`。
