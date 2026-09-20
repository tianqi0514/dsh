# 传神智库工具插件 0.1 证据

## 官方能力复用记录

| 字段 | 内容 |
| --- | --- |
| 任务与范围 | 用户 2026-09-18 明确要求，将传神智库解析抽取、推演测算和妙笔写作封装为 NexusOne 插件，并在内网 WorkDSH 上使用指定 DeepSeek V4 Flash 模型验证。作为 D05 连接器/工具专项的用户授权切片实施，不改变 D04 主线验收状态。 |
| 官方能力 | `docs/dsh-v0.1.6-alpha.2/cookbook/adding-a-tool.md`、`subsystems/tools.md`、`client/slots.md`；锁定 `@deepseek-ai/dsh-tools@0.1.6-alpha.2`、`@deepseek-ai/dsh-system-prompt@0.1.6-alpha.2`、Cordis `4.0.2`。 |
| 复用选择 | Host 使用 `ctx.tools.register(defineTool(...))` 注册 46 个工具，使用 `ctx.systemPrompt.section()` 追加工作流约束；Client 通过官方 `sidebar.panellist`、`main` 和 `tool.call.toolview` Slot 展示能力。继续由官方 Agent Loop、模型路由、Session 日志、Conversation renderer 和 Profile Loader 运行。 |
| 自有边界 | 新增一个受控 HTTP 客户端和传神业务工具；解析器、全文/向量/图谱索引、Semantica、确定性计算、文章版本、影响预览和导出仍归传神智库。没有新增 Agent loop、模型路由、MCP 传输或第二套业务数据库。 |
| 凭据 | 平台专用账号写在仓库外 `0600` 文件；Host 换取短期 Bearer。上传只允许一个配置目录。工具参数、结果和模型上下文均不包含账号密码或 Bearer。 |
| 正例 | 列空间、上传真实文件、四路加工、检索、读取五层治理、规则推演、确定性测算、项目上下文、写作生成、影响预览/应用、文稿检查与导出回执。 |
| 失败/取消/隔离 | 401 只刷新一次；AbortSignal 传入每个请求；超时；越界文件拒绝；凭据文件权限过宽拒绝；发布/应用/导出要求显式 `user_confirmed`。 |
| 当前限制 | alpha 使用单个内网专用平台账号，不代表多用户权限完成；远端模型 ID 和真实 API 必须单独验证；异步任务创建不等于业务完成。 |

## 实现状态

- 源码：`packages/plugins/chuanshen`
- 版本：`0.1.0-alpha.2`
- 工具范围：材料接入与四路加工、后台任务跟踪、知识检索、写作图谱治理、规则推演、确定性测算、写作任务、事实变更和导出。
- 客户端新增 DSH 原生工作台和 46 个工具的业务化卡片；工作台数据从智库 API 实时聚合，不保存第二份业务数据。
- `check:plan` 被基线已有的专家资源和历史文档缺失阻断；缺失项不属于本插件新增引用，未伪装为通过。
- 模型调用、服务器部署、真实平台调用和浏览器测试在完成后追加，未执行项不得写成通过。
