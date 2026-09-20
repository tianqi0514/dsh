# WorkDSH 项目管理

## 原生写作组合优化（2026-09-20）

项目输入区显式选择并保存执行 Workspace，新任务不会跟随当前会话或任取首个目录。可从项目已关联的专家中选择本次主笔，也可使用普通 Agent；专家任务通过公开 ExpertsService.prepareExecution/createExecution 使用锁定修订与原生 Session，依赖缺失不回退成普通 Agent。

技能仍是推荐引用，实际加载必须以官方 skill 工具事件为证据，不标注为“已使用”。连接器在首条消息前同步，包括显式空列表；配置被并发修改时禁止将旧组合绑定成新配置。项目任务关联按 Session 幂等，不能把同一任务挂到两个项目。

官方能力复用：锁定 @deepseek-ai/dsh-workspace、dsh-api-session-controller 0.1.6-alpha.2 的 WorkspaceRegistry、原生 Session retention/conversation；跨插件仅使用 workdsh-contracts/experts 公开服务。参考 docs/dsh-v0.1.6-alpha.2/subsystems/workspace.md、docs/design/CHUANSHEN_NATIVE_WRITING_REVIEW.md。本批补业务选择与校验，不新增 Agent、Workspace 或技能加载器。真实模型及浏览器验收由整体写作回归记录，单元测试不代表实测已完成。

状态：**Alpha 实现中**。

项目工作台将指令、技能、专家、连接器、资料库资产、计划和原生 DSH 任务组织在同一项目中，但不复制各领域的权威数据。

首个 Alpha 提供与 WorkBuddy 对齐的项目中心，以及持续挂载配置侧栏和任务输入框的详情页。详情包含活动记录、计划、任务、资产四个页签；活动记录自动沉淀本机项目操作，不提供虚假的成员留言或通知。配置保存会生成不可变修订，新任务固定引用创建时的修订。项目归档需要确认，可在“已归档项目”中恢复且不会丢失历史。

- 实现阶段：P1
- 主任务：P1-11，详见 [开发计划](../../../docs/PLAN.md)
- 职责：项目说明、任务归属、资产引用及项目访问权限。
- 边界：项目不等于会话全集自动共享。

## 开发前阅读

[规则](../../../AGENTS.md)、[状态](../../../docs/STATUS.md)、[契约](../../../docs/CONTRACTS.md)、[团队设计](../../../docs/TEAM-DESIGN.md)。

所有业务操作遵守服务端主体和组织上下文；页面与 Agent 工具调用相同领域服务。可选功能接入通过公开契约与生命周期注入。

## 数据边界

项目资产只保存资料库 `assetId + revisionId`，正文仍由资料库管理。可选插件未安装或不可用时，界面显示诊断信息。

## 验收与下一步

完成对应 PLAN 任务及 [验收矩阵](../../../docs/ACCEPTANCE.md) 场景，记录真实测试证据后才更新状态。本插件已有原生项目配置、任务关联和能力选择实现；本次组合修复及实际测试见[原生写作组合证据](../../../docs/evidence/chuanshen-native-project-skills.md)，不能将组件测试等同于真实模型写作验收。

## 修订 6 的必做补充

详见 [项目设计](../../../docs/PROJECT-DESIGN.md) 和 [官方依据](../../../docs/research/workbuddy-core-domains.md)。新增目录仍为规划占位；各自实现 PLAN 的 P1 补充项并验证 J01—J10 适用项。

## 项目界面联动

按 [项目设计第 7 节](../../../docs/PROJECT-DESIGN.md) 实现本领域相关交互，验收 UI01—UI08 适用项。领域对象与项目关联分离，取消不提交选择，个人连接按当前主体解析。新增目录仍为 planned。

实现前必须阅读 [ADR-0007](../../../docs/adr/0007-execution-and-transfer-boundaries.md)，完成相应 B/Q 边界用例；不可只用提示词或 UI 达成权限保障。
