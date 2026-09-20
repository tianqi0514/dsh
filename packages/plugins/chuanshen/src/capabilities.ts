export type ChuanshenCapabilityGroupId = 'ingestion' | 'knowledge' | 'reasoning' | 'writing' | 'change' | 'delivery';

export interface ChuanshenToolPresentation {
  readonly name: string;
  readonly label: string;
  readonly group: ChuanshenCapabilityGroupId;
  readonly summary: string;
}

export const CHUANSHEN_CAPABILITY_GROUPS = [
  { id: 'ingestion', label: '资料接入', description: '上传材料、四路加工并跟踪真实任务。', accent: '#60a5fa' },
  { id: 'knowledge', label: '知识与图谱', description: '全文、向量、知识图谱和写作图谱统一检索。', accent: '#a78bfa' },
  { id: 'reasoning', label: '推演与测算', description: 'Semantica 规则推演与确定性公式计算。', accent: '#f59e0b' },
  { id: 'writing', label: '推演写作', description: '按章生成，并把正文块绑定到事实和依据。', accent: '#34d399' },
  { id: 'change', label: '事实联动', description: '先预览影响，再选择应用并保留历史版本。', accent: '#fb7185' },
  { id: 'delivery', label: '检查与交付', description: '校验引用、版本并生成真实导出任务。', accent: '#22d3ee' },
] as const;

export const CHUANSHEN_TOOL_PRESENTATIONS = [
  { name: 'chuanshen_spaces_list', label: '读取知识空间', group: 'ingestion', summary: '列出当前可用知识空间' },
  { name: 'chuanshen_documents_list', label: '读取空间文档', group: 'ingestion', summary: '查看文档、版本和处理状态' },
  { name: 'chuanshen_document_upload', label: '上传业务材料', group: 'ingestion', summary: '将允许目录中的真实文件上传到智库' },
  { name: 'chuanshen_document_process', label: '启动知识加工', group: 'ingestion', summary: '执行全文、向量、图谱或写作图谱加工' },
  { name: 'chuanshen_document_runs', label: '查看文档加工', group: 'ingestion', summary: '核对文档加工阶段和失败原因' },
  { name: 'chuanshen_jobs_list', label: '读取后台任务', group: 'ingestion', summary: '查看知识空间中的真实任务' },
  { name: 'chuanshen_job_status', label: '跟踪任务进度', group: 'ingestion', summary: '读取单个任务的真实进度和终态' },
  { name: 'chuanshen_knowledge_search', label: '检索知识', group: 'knowledge', summary: '执行全文、向量、图谱或混合检索' },
  { name: 'chuanshen_writing_graph_summary', label: '查看写作图谱', group: 'knowledge', summary: '汇总五层写作知识及治理状态' },
  { name: 'chuanshen_writing_graph_items', label: '读取写作知识', group: 'knowledge', summary: '读取 Evidence、Entity、Claim、Fact 和 Relation' },
  { name: 'chuanshen_analysis_readiness', label: '检查推演条件', group: 'reasoning', summary: '检查事实、关系、规则与阻断项' },
  { name: 'chuanshen_analysis_tasks', label: '读取推演任务', group: 'reasoning', summary: '列出现有规则分析任务' },
  { name: 'chuanshen_analysis_run', label: '执行规则推演', group: 'reasoning', summary: '使用 Semantica 预览或发布推演结果' },
  { name: 'chuanshen_writing_projects', label: '读取写作项目', group: 'writing', summary: '列出妙笔写作项目' },
  { name: 'chuanshen_writing_project_create', label: '创建写作项目', group: 'writing', summary: '创建真实妙笔项目' },
  { name: 'chuanshen_writing_project_context', label: '读取项目上下文', group: 'writing', summary: '读取项目、事实和文稿清单' },
  { name: 'chuanshen_corpus_create', label: '生成写作语料包', group: 'knowledge', summary: '创建借形不借值的版本化语料包' },
  { name: 'chuanshen_corpus_manifest', label: '读取语料包清单', group: 'knowledge', summary: '核对来源、版本与产物' },
  { name: 'chuanshen_corpus_artifacts', label: '读取语料包产物', group: 'knowledge', summary: '读取目录、脱敏骨架和文风信息' },
  { name: 'chuanshen_writing_facts', label: '读取权威事实', group: 'knowledge', summary: '查看事实版本、核验状态和来源' },
  { name: 'chuanshen_writing_fact_confirm', label: '确认写作事实', group: 'knowledge', summary: '接受、拒绝或人工修正候选事实' },
  { name: 'chuanshen_writing_graph_release', label: '发布写作图谱', group: 'knowledge', summary: '发布经过治理的不可变图谱版本' },
  { name: 'chuanshen_inheritance_preview', label: '预览结构继承', group: 'writing', summary: '比较历史结构与当前项目事实' },
  { name: 'chuanshen_inheritance_todo', label: '读取继承待办', group: 'writing', summary: '查看缺失、冲突和阻断项' },
  { name: 'chuanshen_inheritance_apply', label: '应用结构继承', group: 'writing', summary: '采用当前值、重算结构或剪枝' },
  { name: 'chuanshen_writing_document_create', label: '创建独立文稿', group: 'writing', summary: '新建不会覆盖已有正文的空白文稿' },
  { name: 'chuanshen_writing_reason', label: '执行写作推演', group: 'reasoning', summary: '对项目已确认事实运行 Semantica' },
  { name: 'chuanshen_writing_evaluate_criteria', label: '计算确定性判据', group: 'reasoning', summary: '形成可供规则推演使用的判据事实' },
  { name: 'chuanshen_writing_compute_baseline', label: '运行基线测算', group: 'reasoning', summary: '根据已核验事实运行场景公式' },
  { name: 'chuanshen_writing_compute', label: '计算业务指标', group: 'reasoning', summary: '执行资源、医疗、交通等确定性公式' },
  { name: 'chuanshen_writing_generate', label: '启动报告生成', group: 'writing', summary: '创建真实分章节写作运行' },
  { name: 'chuanshen_writing_generation_run', label: '查看生成进度', group: 'writing', summary: '读取章节阶段、错误和最终文稿' },
  { name: 'chuanshen_writing_generation_step', label: '生成下一章节', group: 'writing', summary: '消费 Agent 流并归档一个章节' },
  { name: 'chuanshen_writing_generation_cancel', label: '取消报告生成', group: 'writing', summary: '取消仍在执行的写作任务' },
  { name: 'chuanshen_writing_chunk_get', label: '读取正文绑定', group: 'writing', summary: '查看稳定正文块及其依赖' },
  { name: 'chuanshen_writing_chunk_evidence', label: '查看段落依据', group: 'writing', summary: '读取正文块的事实、证据和计算依据' },
  { name: 'chuanshen_writing_changeset_create', label: '预览正文编辑', group: 'change', summary: '生成 ADD、DEL、MOD、MOVE 编辑 Diff' },
  { name: 'chuanshen_writing_changeset_classify', label: '分析编辑影响', group: 'change', summary: '读取语义分类和传播闭包' },
  { name: 'chuanshen_writing_changeset_apply', label: '应用正文编辑', group: 'change', summary: '按选择应用普通措辞或结构编辑' },
  { name: 'chuanshen_writing_change_preview', label: '预览事实联动', group: 'change', summary: '计算权威事实变化的直接和间接影响' },
  { name: 'chuanshen_writing_change_apply', label: '应用事实联动', group: 'change', summary: '仅应用用户接受的影响项' },
  { name: 'chuanshen_writing_change_rollback', label: '撤销事实变更', group: 'change', summary: '创建回滚版本并保留完整历史' },
  { name: 'chuanshen_writing_version_compare', label: '比较文稿版本', group: 'change', summary: '核对变更前后的不可变版本' },
  { name: 'chuanshen_writing_validate', label: '检查文稿质量', group: 'delivery', summary: '检查事实、引用、计算和过期块' },
  { name: 'chuanshen_writing_export', label: '创建文稿导出', group: 'delivery', summary: '创建 DOCX、PDF 等真实导出任务' },
  { name: 'chuanshen_writing_export_status', label: '查看导出结果', group: 'delivery', summary: '核对导出终态、校验和和下载对象' },
] as const satisfies readonly ChuanshenToolPresentation[];

export const CHUANSHEN_TOOL_BY_NAME = new Map(CHUANSHEN_TOOL_PRESENTATIONS.map(tool => [tool.name, tool]));
