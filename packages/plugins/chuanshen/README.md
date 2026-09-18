# 传神智库工具插件

本插件把传神智库已有的解析抽取、知识检索、写作图谱、Semantica 规则推演、确定性测算和妙笔写作能力注册为 NexusOne 原生工具。它不复制解析器、Datalog 引擎、SQL 执行器或写作数据库。

## 安全配置

运行时读取以下环境变量：

- `CHUANSHEN_API_BASE_URL`：默认 `http://127.0.0.1:9002/api/v1`。
- `CHUANSHEN_CREDENTIAL_FILE`：仓库外 JSON 文件，内容为平台专用账号的 `username` 和 `password`；文件不得向 group/other 开放。
- `CHUANSHEN_ALLOWED_UPLOAD_ROOT`：允许上传到智库的唯一宿主目录。
- `CHUANSHEN_TOOL_TIMEOUT_MS`：单次 API 调用上限，默认 120 秒。

凭据只在 Host 内用于换取短期访问令牌，不进入工具参数、模型上下文、Web 页面或工具结果。

## 使用边界

- 上传与加工是异步过程；只有任务返回完成后才能声明解析、索引或写作图谱抽取完成。
- `preview` 推演和变更预览不会发布或覆盖正文。
- 发布推演、应用事实变更、创建导出任务都要求工具参数中有明确的用户确认。
- 本 alpha 面向单用户内网验证。多用户上线前需要将专用平台账号替换为逐主体的 OAuth/连接器授权。
