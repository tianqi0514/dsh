# 连接器管理

## 项目任务选择边界（2026-09-20）

除了模型工具可见性过滤，使用 alpha.2 公开 tools.guard 在每次派发前校验当前 Session 的连接选择，覆盖迟到的工具发现以及 list/read MCP resources。停用或未选择的连接不能因预先存在工具名而继续调用。子 Agent 没有独立选择时拒绝访问，不从主 Session 猜测或继承账号。

工具名必须在全部已登记 serverName 中匹配唯一归属，再检查本会话是否选择。`inventory` 与 `inventory__private` 等嵌套命名导致工具归属歧义时拒绝派发，即使两者都已选择也不能猜测；未登记命名空间也拒绝。资源调用使用明确 server 参数匹配。已有配置保留不被重命名，需要用户在连接配置中处理冲突。

复用依据：docs/dsh-v0.1.6-alpha.2/subsystems/tools.md（ToolGuard）和 mcp.md（资源工具）；不新增 MCP transport。边界：本批未将全局 MCP client 改为每个 Agent 独立 scope，服务器名称/指令的 prompt 隔离和子专家授权继承仍须后续实测，不能将派发守卫宣称为完整多用户隔离。

## 单连接器调用超时（2026-09-20）

任务 P1-04 的 MCP 执行仍直接复用 `@deepseek-ai/dsh-mcp-client@0.1.6-alpha.2` 的 `toolCallTimeoutMs` 和原生 `ToolExecution.signal`，没有自建 transport、重试器或取消通道。官方客户端默认 60 秒，本插件先前固定缩短为 10 秒，导致首次需要索引/模型预热的语义检索在服务端成功前被客户端中断。现改为连接器级可配置：默认 30 秒，边界 1–120 秒；修改一个 MCP 不影响其他连接。

用户取消仍由原生 `AbortSignal` 立即中断，不会等待超时截止。超过有限截止时间依然以真实工具失败进入 DSH Session 事件，不返回假结果。隔离集成探针验证 1 秒超时失败、将同一服务调到 2.5 秒后调用成功，以及外部取消优先于 2.5 秒截止。

根因证据：服务器日志中 09:19:34.364 的首次 `CallToolRequest` 在 09:19:44.359 被客户端中断，而平台搜索在 09:19:47.745 真实返回 200；紧随的热查询仅约 0.44 秒。09:44 的另一组请求再次复现约 10 秒客户端中断、约 13.2 秒服务端成功和约 0.19 秒热查询。这修正了过早截断，不代替平台索引/模型预热和耗时观测。

状态：**0.1 alpha 可安装，已完成真实 MCP 连接、官方凭据存储与按对话选择**。

- 实现阶段：P1
- 主任务：P1-04，详见 [开发计划](../../../docs/PLAN.md)
- 已实现：多个 stdio/Streamable HTTP MCP 实例、官方工具/资源发现、实际健康检查、运行时启停、增删改配置、官方凭据引用、能力中心页面与按会话工具隔离。
- 已验证：腾讯文档令牌写入 DSH 官方凭据服务后建立真实连接，发现 224 个工具，并在仅选择该连接器的会话中完成账号文档查询。
- 后续职责：交互式 OAuth、多账号身份切换、公共授权、安装目录与完整审计。
- 边界：成员使用权限不允许读取密钥；禁止跨账号回退。

## 开发前阅读

[规则](../../../AGENTS.md)、[状态](../../../docs/STATUS.md)、[契约](../../../docs/CONTRACTS.md)、[团队设计](../../../docs/TEAM-DESIGN.md)。

所有业务操作遵守服务端主体和组织上下文；页面与 Agent 工具调用相同领域服务。可选功能接入通过公开契约与生命周期注入。

MCP client 是一种执行适配，复用官方 stdio/Streamable HTTP 生命周期、工具发现和重连。令牌只写入 DSH 官方凭据服务，连接器配置、列表和诊断接口仅返回凭据引用或“已配置”状态。stdio 仅传显式最小 env，HTTP `Authorization` 在服务端由凭据层解析；专用 API 与 Web provider 不强制转换成 MCP。

## 验收与下一步

随包示例通过 `@deepseek-ai/dsh-mcp-client@0.1.6-alpha.2` 连接本地子进程，模型可调用 `mcp__workdsh-example__connector_status` 与 `mcp__workdsh-example__search_catalog`；官方资源工具可列出并读取 `workdsh://connector/guide` 和 `workdsh://catalog/{id}`。远程连接器使用同一个官方 MCP Client。页面状态来自实际子插件与工具发现，不凭配置存在显示“已连接”。

新会话默认不选择连接器。用户在输入框的链形图标中选择后，名称显示在输入框旁，Host 在官方 `agent/created` 生命周期中只开放对应 `mcp__<server>__*` 工具命名空间。连接器的全局启用状态与当前会话选择互相独立。

完整 D05 仍须完成对应 PLAN 任务及 [验收矩阵](../../../docs/ACCEPTANCE.md) 的交互式 OAuth、多账号、公共授权、写操作确认和审计场景。本 alpha 不代表完整连接器产品已验收。

## 项目界面联动

按 [项目设计第 7 节](../../../docs/PROJECT-DESIGN.md) 实现本领域相关交互，验收 UI01—UI08 适用项。领域对象与项目关联分离，取消不提交选择，个人连接按当前主体解析。新增目录仍为 planned。

实现前必须阅读 [ADR-0007](../../../docs/adr/0007-execution-and-transfer-boundaries.md)，完成相应 B/Q 边界用例；不可只用提示词或 UI 达成权限保障。
