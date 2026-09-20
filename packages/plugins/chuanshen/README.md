# 传神智库工具插件

本插件把传神智库的解析抽取、知识检索、写作图谱、Semantica 规则推演、确定性测算和文稿服务注册为 NexusOne 原生工具，并提供两项按需加载的写作方法。当前 DSH 主笔负责组织文章，智库负责真实知识、计算、规则、绑定校验和版本存储。插件不复制解析器、Datalog 引擎、SQL 执行器或写作数据库。

## DSH 中的可见形式

- 左侧「传神智库」是 DSH 原生 `sidebar.panellist` 入口，主区域是原生 `main` Slot，不是 iframe。
- 工作台从智库实时 API 读取知识空间、写作项目、推演准备度和 Evidence/Entity/Claim/Fact/Relation 五层数量。
- 项目选择 Workspace、主笔、Skill 和 MCP 后继续使用原生 Conversation；选中方法不等于已经加载，实际加载和工具调用以 Session 事件为准。
- 工具在会话内使用中文业务卡片；输入和原始结果仅在用户展开时显示。工具名称以 `src/tools.ts` 为准，不以界面数量作为能力验收。
- `chuanshen_writing_open` 返回独立 Plate 资源地址；Plate 不占用 Office 的文件入口，不维护第二份正式正文。

## 可选写作技能

| 原生技能 | 用途 | Markdown 源 |
| --- | --- | --- |
| `chuanshen-material-extraction` | 材料用途、真实解析与按需 OCR、五层知识核验、冲突和来源定位 | [SKILL.md](resources/skills/chuanshen-material-extraction/SKILL.md) |
| `chuanshen-evidence-writing` | 证据论证、确定性计算与规则使用、DSH 主笔按章写作、精确位置绑定和影响预览 | [SKILL.md](resources/skills/chuanshen-evidence-writing/SKILL.md) |

方法通过官方技能目录发现、`/` 或原生 `skill` 加载；只注册目录和摘要，不在每个会话全量注入方法。references 随包交付，按具体任务读取。全局 `prompt.ts` 只保留技能路由与不可越界约束，SKILL.md 是方法的唯一可维护正文。

### 官方能力复用记录

任务 `native-controlled-writing / packaged-skills` 复用锁定 `0.1.6-alpha.2` 的 `@deepseek-ai/dsh-skill` 公共 `ctx.skills.registerProvider()` 和 `@deepseek-ai/dsh-skill-filesystem` 公共 `FileSystemSkillProvider`。契约依据是发布包 exports/types 与 [技能官方说明](../../../docs/dsh-v0.1.6-alpha.2/subsystems/skills.md)。Registry 拥有目录、按需加载、取消和 Cordis 清理；文件提供方拥有官方 frontmatter 解析和相对资源定位。插件仅提供业务 Markdown，不新增技能解析器或 Agent Loop。

提供方名为 `chuanshen-writing-methods`，只挂载本包 `resources/skills`，不重复扫描用户默认目录，关闭热监听。必需服务 `skills` 通过 inject 声明；卸载后目录贡献随 Fiber 移除。官方 Skill 注册不是业务授权，工具和后端仍承担权限及确认校验。

## 原生主笔章节路径

`chuanshen_writing_outline` 读取/保存本次目录 → `chuanshen_writing_section_context` 固定章节工作包 → 当前 DSH 主笔生成 Plate blocks 和 bindings/occurrences → `chuanshen_writing_section_submit` 校验保存 → `chuanshen_writing_open` 查看。

这一路不调用旧 `writing_generate/generation_step` 启动内层 Agent；旧工具保留兼容，不作为新方法默认执行路径。工作包和正文保存携带基线版本、checksum 和幂等请求标识。下一章在前一章成功后重新取包，冲突不会无提示覆盖已有版本。

绑定校验只证明来源身份、数字一致和受控范围，不保证每句引用语义充分支持；新章节仍为待审稿。Skill 要求主笔核对原文支持度、职责、时间、单位、跨章一致和待补项；正式业务批准不由模型代替。

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
- 事实修改由 Agent 生成影响预览，应用和回滚由用户在 Plate 受信界面确认。`chuanshen_writing_change_apply`、`chuanshen_writing_change_rollback` 对 Agent 拒绝代理确认，候选确认工具也拒绝 override/new_value 改值；一个模型填写的 `user_confirmed` 不能替代该操作。
- 发布推演、治理事实、应用继承与导出等其他操作仍遵守各自工具的真实确认契约，提示词不是权限控制；不能将上述 Plate 限制扩张宣称所有旧布尔确认都已升级。
- 本 alpha 面向单用户内网验证。多用户上线前需要将专用平台账号替换为逐主体的 OAuth/连接器授权。

## 已注册能力

当前工具分为以下业务组：

- 文档接入与加工：空间、文档、上传、加工运行、任务列表与任务状态。
- 知识消费：全文/向量/图谱混合检索，以及写作图谱五层治理概况和对象读取。
- 规则推演：分析准备度、分析任务和 Semantica 分析运行。
- 语料包与继承：借形不借值的 Skeleton、产物清单、L1/L2/L3 对齐、待办和确认应用。
- 妙笔项目：项目创建/上下文、独立文稿创建、确定性判据、Semantica 推演和基线测算。
- 原生分章节写作：目录、不可变工作包、DSH 主笔提交、绑定校验、版本保存与 Plate 打开；旧生成任务的状态和取消保留兼容。
- 编辑 Diff：ADD/DEL/MOD/MOVE 分类、Chunk 依据、变更集预览和选择性应用。
- 事实联动与交付：影响预览、Plate 中按选择应用、回滚、版本比较、文稿校验和导出任务。

受控数值修改先预览，禁止字符串全局替换和整篇重写。历史语料使用脱敏 Skeleton；当前缺值不继承历史值或自动补零。只有服务真实支持的公式才可作为正式计算，没有对应规则的可研项目不能套用地震判据。

## 验证范围

`corepack pnpm --filter workdsh-plugin-chuanshen test` 包含官方 registry/filesystem 真实发现与加载、提供方卸载和取消、技能工具名契约、原生写作边界，以及 npm tarball 解包到隔离临时目录后的官方解析与相对引用读取。该测试不使用自制 frontmatter 解析器，也不调用模型。

包资源读取通过不等于完整 Runtime 安装、模型采用方法或真实报告质量通过。三者分别由部署测试、Session 实际 Skill/工具事件和逐章业务审读验收；不得把下面历史的旧生成链测试作为原生主笔新链路的完成证据。

## 2026-09-18 服务器实测

在内网 DeepSeek Work 中使用实际可用的 `deepseek-v4-flash-0731` 完成了以下验证：

- 创建独立知识空间并上传 Markdown，后台加工任务 7/7 步成功。
- 写作图谱候选抽取：Evidence 6、Entity 17、Claim 14、Fact 35、Relation 9、指标 12；候选保持待治理状态，未冒充已发布知识。
- 全文检索能够召回建筑面积、投资额及其组成等真实片段。
- 确定性资源缺口计算返回 180、220、80、1800，并保留计算运行和输入依赖。
- 确定性判据与 Semantica Datalog 预览推演成功，推导“重大地震灾害（Ⅱ级）”，保留两条证明前提且未发布。
- 对锁定 WritingGraphRelease 的项目完成单章节写作：Agent SSE 100 个事件，运行终态 `completed`；文稿版本 2 含 10 个顶层块、4 个知识引用绑定和 4 个确定性测算绑定，章节质量门无错误。

联调同时发现并修复了两个平台兼容问题：治理事实数值同时兼容 `number`、`value`、`raw_value`；单章节生成质量门只校验本次确认生成的章节，完整报告仍执行完整章节质量门。

模型服务未提供用户口述的 `deepseek-v4-flash-073` 标识；服务端实际列出且验证可用的是 `deepseek-v4-flash-0731`。插件和测试没有伪造别名。

## 当前限制

- 插件仍复用平台的账号、权限、知识发布和妙笔质量门，不在 DeepSeek Work 内复制业务数据库或推理引擎。
- 文档上传和完整报告生成可能是长任务；必须根据任务/运行终态判断完成。
- 单章节草稿通过章节质量门后可落库，但对整篇文稿执行 `writing_validate` 时，未生成的其他章节仍会作为完整报告缺项列出；这是完整定稿检查，不等同于该章节生成失败。
