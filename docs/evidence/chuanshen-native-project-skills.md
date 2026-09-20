# 原生写作组合：项目、技能与连接器验证

日期：2026-09-20。范围：已批准的 `native-controlled-writing`。本文同时记录工程集成和本轮真实项目组合结果；完整报告、影响联动和导出证据见 [NATIVE_WRITING_LIVE_VALIDATION](NATIVE_WRITING_LIVE_VALIDATION.md)。

## 官方能力复用

| 功能 | 官方或现有公共入口 | 本次业务差异 |
| --- | --- | --- |
| 项目执行 | DSH 0.1.6-alpha.2 的 Workspace/Session Controller、`sessions.retain`、`conversation.send` | 项目显式绑定执行工作空间；选择一位主笔或普通 Agent；固定项目与专家修订 |
| 主笔专家 | `workdsh-contracts/experts` 的既有 prepare/createExecution 服务 | 不复制 Agent Loop/专家运行器，不在依赖失败时静默降为普通 Agent |
| 技能发现与加载 | `ctx.skills.list/get/registerProvider`、官方 `FileSystemSkillProvider`，精确 0.1.6-alpha.2 | 两份方法随 Chuanshen 插件交付，目录按需加载；管理器读取原包只读正文和资源摘要 |
| 技能修订 | `workdsh-contracts/skills` 的 resolve/retain/checkRevision | 使用既有不可变依赖快照，为 bundled Skill 提供真实修订；不新建可编辑副本 |
| 连接器执行 | 官方 MCP Client、工具注册表与单调 Tool Guard | 会话选择对实际工具调用生效；缺少选择、歧义或未知所有者拒绝 |

契约依据：[官方开发规范](../HARNESS-OFFICIAL-DEVELOPMENT.md)、[Skills](../dsh-v0.1.6-alpha.2/subsystems/skills.zh.md)、[批准设计](../design/CHUANSHEN_NATIVE_WRITING_REVIEW.md)。没有跨插件内部实现导入。

## 实际修复

1. 项目不再从当前会话或列表第一项猜 Workspace。所选工作空间写入项目配置修订；新任务再次验证存在性和修订。
2. 本次主笔通过现有专家公开执行服务运行；未发布、停用、依赖缺失或修订漂移均拒绝，不隐式升级专家。普通 Agent 仍是可选路径。
3. 创建任务后、发送首条消息前同步项目的连接器选择，包括空选择。任务关联幂等，配置漂移和跨项目重复关联拒绝。
4. 推荐技能不显示为“已加载”。`chuanshen-material-extraction` 和 `chuanshen-evidence-writing` 的内容由官方 provider 从随包 Markdown 读取，实际加载以原生 Skill 调用为准。
5. 只读技能原先能被官方 Registry 列出，但管理详情没有正文、目录和修订，专家固定修订报 `skill/revision-source-missing`。现在通过 winning definition 的 `path/resourceBase` 读取原包；虚拟或扁平技能不伪造目录包修订。
6. 修订摘要不再复用 UI 资源列表的截断规则；覆盖完整资源树，超过 400 文件、50 MiB 或 6 层明确拒绝。拒绝符号链接、越界来源与资源；复制快照后再次校验摘要。
7. 连接器 `inventory` 与 `inventory__private` 存在前缀歧义时，不能仅凭 `startsWith` 放行。现在与全部已登记服务器命名空间比对，仅唯一归属且被本会话选中的工具可调用。即使两个歧义服务器都被选中，也拒绝歧义工具名；不静默修改已有配置。
8. 生产包导入出现 `Invalid hook call`，定位为 `startingTask` 状态 Hook 落在组件外部。已移入 `ProjectsPanel`，并加入使用真实 React 执行完整 client factory 的测试；类型检查不能替代该验证。

## 安全边界

- 插件只读方法正文不赋予对原包的修改、停用、卸载权限；原包更新仍经正常插件版本部署。
- Revision 是内容与资源的不可变快照，不承诺冻结当前来源的启用状态。卸载来源后，既有快照保留但 checkRevision 报 source-uninstalled。
- MCP Tool Guard 限制实际工具调用；不能据此宣称已经实现全量 MCP 指令可见性隔离、跨账号企业授权或自动 Team 连接器继承。没有独立选择的子 Agent 不继承其他 Session 的连接器。
- Skills 教授解析、五层证据、确定性计算/真实规则推演和写作方法，不拥有确认或发布权。候选不能被模型自动当作 verified Fact；存在合法引用 ID 不等于语义完全支持。
- 主笔 Agent 使用 section_context 后自行写 Plate blocks、bindings 和数值 occurrence，再经 section_submit 的后台闸门；不调用旧内层写作 Agent 冒充原生主笔。
- 事实影响的应用与回滚由 Plate 的真实人工交互授权；方法文本不能替代服务端校验。模型自报 `confirm=true` 不构成人工授权。
- 专家二次激活的现有上游兼容风险仍需服务器真实流程验收；不能因为单次公开 API 或模拟模型测试通过就宣称已排除。

## 本地验证

| 命令/范围 | 结果 | 证据性质 |
| --- | --- | --- |
| `pnpm --filter workdsh-plugin-skills build`、`typecheck` | 通过 | TypeScript、官方正文生成及客户端构建 |
| `node --test tests/integration/skill-bundled-revisions.test.mjs tests/integration/skill-manager.test.mjs` | 12/12 | 真实官方 Registry/Filesystem Provider、本地文件、只读修订、边界反例 |
| skill-loading、skill-plugin-lifecycle、skill-persistence、skill-creator-host | 6/6 | 官方提供方按需读取、scope 隔离、进程冷恢复与卸载 |
| `node --test tests/integration/expert-manager.test.mjs` | 19/19 | 专家发布、技能修订、权限、原生执行契约；不等于线上真实模型 |
| `pnpm --filter workdsh-plugin-projects build`、`typecheck` | 通过 | 前后端构建 |
| `node --test packages/plugins/projects/tests/*.test.mjs` | 19/19 | 服务/契约、配置漂移、客户端真实导入与 CSS 浏览器布局 |
| Chuanshen skills 与 connectors selection-policy 测试 | 10/10 | 官方包 discover/load/pack、连接器边界纯函数反例 |
| `git diff --check` | 通过 | 文本差异检查 |

项目 import failure 已在服务器实际安装包以真实 React factory 复现，同一本地修复包重新导入成功。生产 Profile 一度安装位置与服务实际 `DSH_HOME` 不一致，是另一项部署根因，不能靠修改技能发现器绕过。

## 真实项目组合结果

- 浏览器中的科研楼写作项目选择了受控资料连接器、证据约束写作 Skill 和可研主笔，并在服务重启后恢复相同项目与会话。
- 实际模型为 `deepseek-v4-flash-0731`；原生 Agent 按 10 个章节读取工作包并提交正文，智库完成结构、事实、来源和数值校验。
- 当前回滚后的 v14 保存 43 项已确认事实、25 次确定性计算和 37 条正文绑定，发布校验为阻断 0、stale 0、待确认 0。
- 土建单价变更的选择性应用真实产生 2 个 stale 并被发布闸门拒绝；回滚后重新通过。该结果证明项目组合进入实际写作链路，但不能由此推导每一轮都自动调用全部推荐 Skill 或 MCP 工具，真实调用仍以 Session 工具事件为准。
- Plate 实际打开指定文稿并生成 DOCX/PDF；两种格式都经过对象存储与验收副本摘要核对和逐页渲染。导出列表曾因客户端只识别 `completed`、服务端返回 `succeeded` 而缺少下载按钮，现已修复并加入 18/18 Plate 回归；部署后两个下载按钮均显示，真实点击后的代理响应为 200，并返回对应 PDF/DOCX MIME 类型和附件文件名。

## 分层测试结果

| 范围 | 结果 | 证据边界 |
| --- | --- | --- |
| 平台原生写作 | 76/76 | 章节、绑定、版本、传播保护和质量门 |
| 平台公式/API | 86/86 | 确定性计算、影响、应用、回滚、抽取和 API 契约 |
| DSH 传神插件 | 26/26 | 工具、Skill 和安全错误契约 |
| 连接器策略与超时 | 8/8 | MCP 选择、超时及取消边界，不代表生产数据源业务验收 |
| DSH Projects | 19/19 | 项目组合、固定修订、任务绑定和响应式布局 |
| Skill 固定修订 | 3/3 | 官方包读取、资源边界和深层资源摘要 |
| Plate | 18/18 | 模型、导出成功状态、下载就绪及 UI 逻辑 |

服务器候选已完成浏览器写作、重启恢复与导出主线；多账号、多组织委托授权、生产外部 MCP、多用户同时编辑和完整客户签发模板仍未验收，不能据本文件宣布生产完成。

## 项目/技能子任务原始提交范围（历史记录）

根目录依赖/锁文件、模块台账、STATUS、发布脚本和服务器部署由主任务管理；本子任务不提交、不推送。以下列表仅列本子任务改动；Chuanshen README/CHANGELOG 如有主任务重叠编辑，应一起保留。

```text
packages/contracts/src/projects.ts
packages/plugins/projects/README.md
packages/plugins/projects/CHANGELOG.md
packages/plugins/projects/package.json
packages/plugins/projects/src/client.tsx
packages/plugins/projects/src/client/ProjectsPanel.tsx
packages/plugins/projects/src/client/TaskComposition.tsx
packages/plugins/projects/src/client/operation-id.ts
packages/plugins/projects/src/client/management.ts
packages/plugins/projects/src/client/styles.ts
packages/plugins/projects/src/remote/connection-api.ts
packages/plugins/projects/src/runtime/context-injection.ts
packages/plugins/projects/src/runtime/task-composition.ts
packages/plugins/projects/src/services/project-manager.ts
packages/plugins/projects/tests/client-bundle.test.mjs
packages/plugins/projects/tests/projects.test.mjs
packages/plugins/projects/tests/responsive.test.mjs
packages/plugins/projects/tests/task-composition.test.mjs
packages/plugins/connectors/README.md
packages/plugins/connectors/CHANGELOG.md
packages/plugins/connectors/src/connection-api.ts
packages/plugins/connectors/src/manager.ts
packages/plugins/connectors/src/selection-policy.ts
packages/plugins/connectors/tests/selection-policy.test.mjs
packages/plugins/skills/README.md
packages/plugins/skills/CHANGELOG.md
packages/plugins/skills/src/services/manager.ts
tests/integration/skill-bundled-revisions.test.mjs
packages/plugins/chuanshen/README.md
packages/plugins/chuanshen/CHANGELOG.md
packages/plugins/chuanshen/src/index.ts
packages/plugins/chuanshen/src/prompt.ts
packages/plugins/chuanshen/tests/skills.test.mjs
packages/plugins/chuanshen/resources/skills/chuanshen-evidence-writing/SKILL.md
packages/plugins/chuanshen/resources/skills/chuanshen-evidence-writing/references/chapter-contract.md
packages/plugins/chuanshen/resources/skills/chuanshen-evidence-writing/references/computation-and-reasoning.md
packages/plugins/chuanshen/resources/skills/chuanshen-evidence-writing/references/evidence-method.md
packages/plugins/chuanshen/resources/skills/chuanshen-evidence-writing/references/updates-and-delivery.md
packages/plugins/chuanshen/resources/skills/chuanshen-material-extraction/SKILL.md
packages/plugins/chuanshen/resources/skills/chuanshen-material-extraction/references/five-layer-review.md
packages/plugins/chuanshen/resources/skills/chuanshen-material-extraction/references/materials-and-parsing.md
docs/evidence/chuanshen-native-project-skills.md
```
