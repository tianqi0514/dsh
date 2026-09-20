---
name: chuanshen-evidence-writing
description: 当前 DSH 主笔按章撰写有事实、证据、确定性计算和规则依据的专业报告，提交 Plate 正文与位置绑定，并预览事实变化。适用于可研、方案、专题报告和局部修订；不是只做审校，也不把写作再委托给智库内部 Agent。
---

# 证据约束的专业写作

## 输入与成果

输入是任务、读者、用途、资料版本和当前项目事实。报告类型决定章节职责，材料决定能说什么，读者决定解释深度。缺少非关键偏好可采用简洁正式文风；缺少事实就标待补，只影响依赖它的章节。不要用字数、图谱节点数量或引用数量代替文章质量。

成果是智库中保存的可编辑文稿及其 Plate 入口、逐块依据、待核验项和用户要求的真实导出。DSH 原生项目与智库写作项目分别由各自服务管理，不互换 ID；主笔可以是当前普通 Agent 或选定专家。多专家只使用当前可用的原生 Team，每个成员仍受资料和工具范围约束，不能假设主笔权限自动继承。

## 工作方法

1. 用 `chuanshen_writing_project_context` 核实任务、现有文稿和事实；新任务可经 `chuanshen_writing_projects` 查询或 `chuanshen_writing_project_create` 创建，不能任取其他项目。材料尚未解析或关键口径待确认时先加载 `chuanshen-material-extraction`。新文章使用 `chuanshen_writing_document_create`，传入真实类型、读者、目的和写作要求；不复用第一篇文章覆盖已有正文。
2. 按 [证据与论证](references/evidence-method.md) 将内容分成已确认事实、已执行计算、已执行规则结论、标准引用和分析性叙述。历史样稿只借目录、论证顺序和脱敏 skeleton；需要继承时用 corpus / inheritance 工具读取真实回执，当前缺值不能由历史值填补。
3. 用 `chuanshen_writing_outline` 读取当前目录及 `base_version_id`，依据任务与资料提出各章目标。需要调整时用相同工具保存 `sections`：每项包含稳定 `key`、`title`、具体 `instruction`，按需要设置 `citation_required`、`required_inputs` 和 `toolbox_outputs`。引用要求不能为了通过验证而关闭；required_inputs 只填真实事实键，不编造。保存携带当前 `base_version_id` 与独立 `request_id`；版本冲突先重读，不强制覆盖。目录保存不会生成正文。
4. 只有章节实际需要才使用确定性计算或 Semantica，方法见 [计算与推演](references/computation-and-reasoning.md)。不要为了展示能力给普通文章硬加计算，也不要拿地震判据判断可研项目。计算、推演的完成及来源以工具回执为准。
5. 逐章调用 `chuanshen_writing_section_context`，提供 `document_id`、真实 `section_key` 和操作唯一的 `request_id`，获取不可变工作包。资料或事实超出单包上限时，用可选 `fact_keys` 和 `source_chunk_ids` 选择本章真正需要且已读取的对象，不编造 ID，不将截断结果当完整来源。当前 DSH 主笔亲自阅读工作包、组织论证并撰写本章；不要调用旧 `chuanshen_writing_generate` 或 `chuanshen_writing_generation_step` 再启动智库内部写作 Agent。返回缺项或权限错误时先处理相应问题，不靠删掉来源限制绕过。
6. 第一次提交前读取 [Plate 章节提交契约](references/chapter-contract.md)。按工作包 `output_schema` 生成正常标题以下的段落、列表式段落或表格，不生成彩色卡片、工具日志或执行说明。每个元素有稳定 ID，关键段落绑定本工作包中的 Fact、Evidence、Relation 和计算记录；每次权威数字出现都提供精确 `occurrences`。已有相同数字不能通过全局替换绑定。
7. 用 `chuanshen_writing_section_submit` 提交 `work_package_id`、原 `checksum`、独立 `request_id`、`draft_blocks` 和 `bindings`。成功后才说“已保存”；服务只校验并归档，不替你写正文。校验失败按具体字段或句子修正，最多两次有界修复，继续失败就保留错误和未保存草稿并说明原因。旧版本/过期工作包先重读；同一写入结果不明时使用原请求 ID 查询或幂等重试，不能盲目重复创建。顺序提交本章后再取下一章工作包，防止基线过期。
8. 用 `chuanshen_writing_chunk_get`、`chuanshen_writing_chunk_evidence` 和 `chuanshen_writing_validate` 回读正文、绑定和审校结果。另做语义审读：原文是否支持结论、职责有无越权、时间/单位/口径是否一致、内容是否具体、章节有无重复。ID 和数字校验通过不等于语义已充分支持或业务批准。待审稿保持待审状态。
9. 用 `chuanshen_writing_open` 打开独立 Plate，不把 Office 当作 Plate。事实改动、普通文字修订及交付采用 [局部更新与交付](references/updates-and-delivery.md)。提交给用户的摘要说明完成章节、仍待确认项、真实文稿入口，不把内部 UUID 和提示词写进报告正文。

## 完成条件

文章回答本次任务，核心表述可回到所采用版本的真实依据，数字有 Fact 或 ComputationRun 及位置绑定，规则结论有真实证明。资料不足时可以完成有标记的讨论稿，但不能宣称正式批准或承诺绝对零幻觉。最终交付按真实保存、审校与导出回执报告状态，未运行的检查明确说明。
