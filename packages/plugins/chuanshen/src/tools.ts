import type { Context } from '@deepseek-ai/cordis';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { ChuanshenClient, query, type JsonValue } from './client.js';

const jsonOutput = {
  schema: { type: 'json' } as const,
  render: (_args: unknown, value: JsonValue) => [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
};

function record(value: JsonValue | undefined): Record<string, JsonValue> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function rows(value: JsonValue | undefined): JsonValue[] {
  return Array.isArray(value) ? value : [];
}

function cell(value: JsonValue | undefined): string {
  if (value === undefined || value === null) return '';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.replaceAll('|', '\\|').replaceAll('\n', ' ').slice(0, 240);
}

const impactOutput = {
  schema: { type: 'json' } as const,
  render: (_args: unknown, value: JsonValue) => {
    const root = record(value);
    const impact = record(root.impact ?? root.propagation);
    const proposals = rows(impact.content_proposals ?? impact.impacts);
    const lines = [
      `### 影响预览`,
      `状态：${cell(root.status ?? 'preview')}  · 自动覆盖：否`,
      '',
      '| 位置 / 节点 | 修改前 | 修改后 / 动作 | 原因 | 类型 |',
      '|---|---|---|---|---|',
      ...proposals.slice(0, 100).map(raw => {
        const item = record(raw);
        return `| ${cell(item.section ?? item.node_id ?? item.block_id)} | ${cell(item.old_text ?? item.old_value)} | ${cell(item.new_text ?? item.new_value ?? item.action)} | ${cell(item.reason ?? item.relation)} | ${cell(item.impact_type ?? item.certainty)} |`;
      }),
    ];
    const suspected = rows(impact.suspected_impacts);
    if (suspected.length) lines.push('', `另有 ${suspected.length} 项疑似影响，仅提示人工核对，不会自动修改。`);
    lines.push('', '<details><summary>结构化原始结果</summary>', '', '```json', JSON.stringify(value, null, 2), '```', '</details>');
    return [{ type: 'text' as const, text: lines.join('\n') }];
  },
};

const inheritanceOutput = {
  schema: { type: 'json' } as const,
  render: (_args: unknown, value: JsonValue) => {
    const root = record(value);
    const alignments = rows(root.alignment ?? root.alignments);
    const lines = [
      '### 继承 Diff',
      '历史材料仅借结构，不继承历史项目值。',
      '',
      '| 节点 | 当前项目事实 | 判定 | 状态 | 单位 |',
      '|---|---|---|---|---|',
      ...alignments.slice(0, 200).map(raw => {
        const item = record(raw);
        return `| ${cell(item.label ?? item.node_key)} | ${cell(item.current_value)} | ${cell(item.decision)} | ${cell(item.status)} | ${cell(item.current_unit ?? item.expected_unit)} |`;
      }),
      '',
      '<details><summary>结构化原始结果</summary>', '', '```json', JSON.stringify(value, null, 2), '```', '</details>',
    ];
    return [{ type: 'text' as const, text: lines.join('\n') }];
  },
};

const targets = { type: 'array' as const, items: { type: 'string' as const, enum: ['fulltext', 'vector', 'graph', 'writing_graph'] } };

export function registerChuanshenTools(ctx: Context, client: ChuanshenClient): void {
  ctx.tools.register(defineTool({
    name: 'chuanshen_spaces_list',
    description: '列出当前专用平台账号有权访问的传神智库知识空间。',
    parameters: {}, output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => true,
    execute: (_args, exec) => client.get('/spaces?limit=500', exec.signal),
  }));

  ctx.tools.register(defineTool({
    name: 'chuanshen_documents_list',
    description: '列出指定知识空间中的文档、版本和当前处理状态。',
    parameters: { space_id: { type: 'string', required: true }, limit: { type: 'integer' } },
    output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => true,
    execute: (args, exec) => client.get(query('/documents', { space_id: args.space_id, limit: args.limit ?? 100 }), exec.signal),
  }));

  ctx.tools.register(defineTool({
    name: 'chuanshen_document_upload',
    description: '把允许目录内的真实文件上传到知识空间。平台通常会按 processing_targets 自动创建加工任务；若回执已有 job_id/parse_job_id，不要重复启动，只需查询任务终态。',
    parameters: {
      space_id: { type: 'string', required: true },
      file_path: { type: 'string', required: true },
      processing_targets: { ...targets, required: true },
      material_role: { type: 'string', enum: ['task_data', 'policy_basis', 'reference', 'sample_style', 'report_attachment'] },
      parser_policy_id: { type: 'string' },
    },
    output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => false,
    execute: (args, exec) => client.uploadDocument({
      filePath: args.file_path,
      spaceId: args.space_id,
      targets: args.processing_targets,
      materialRole: args.material_role ?? 'task_data',
      ...(args.parser_policy_id ? { parserPolicyId: args.parser_policy_id } : {}),
    }, exec.signal),
  }));

  ctx.tools.register(defineTool({
    name: 'chuanshen_document_process',
    description: '对已上传文档启动指定加工目标；同一文档解析结果会被各目标复用。',
    parameters: {
      document_id: { type: 'string', required: true },
      processing_targets: { ...targets, required: true },
      force: { type: 'boolean' },
    },
    output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => false,
    execute: (args, exec) => client.post(
      query(`/documents/${encodeURIComponent(args.document_id)}/process`, { force: args.force ?? false }),
      { mode: 'both', targets: args.processing_targets }, exec.signal,
    ),
  }));

  ctx.tools.register(defineTool({
    name: 'chuanshen_document_runs',
    description: '读取文档真实加工运行、阶段、进度、终态和失败原因。',
    parameters: { document_id: { type: 'string', required: true } },
    output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => true,
    execute: (args, exec) => client.get(`/documents/${encodeURIComponent(args.document_id)}/processing-runs`, exec.signal),
  }));

  ctx.tools.register(defineTool({
    name: 'chuanshen_jobs_list',
    description: '按知识空间和可选状态列出真实后台任务；用于上传回执未完整显示任务 ID 时定位加工任务。',
    parameters: { space_id: { type: 'string', required: true }, status: { type: 'string' } },
    output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => true,
    execute: (args, exec) => client.get(query('/jobs', { space_id: args.space_id, status: args.status }), exec.signal),
  }));

  ctx.tools.register(defineTool({
    name: 'chuanshen_job_status',
    description: '读取单个后台任务的真实阶段、百分比、终态和失败原因。任务创建、queued 或 processing 都不等于完成。',
    parameters: { job_id: { type: 'string', required: true } },
    output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => true,
    execute: (args, exec) => client.get(`/jobs/${encodeURIComponent(args.job_id)}`, exec.signal),
  }));

  ctx.tools.register(defineTool({
    name: 'chuanshen_knowledge_search',
    description: '执行传神智库真实全文、向量、图谱或混合检索，返回可核验片段和检索轨迹。',
    parameters: {
      query: { type: 'string', required: true },
      space_ids: { type: 'array', items: { type: 'string' }, required: true },
      top_k: { type: 'integer' },
      use_keyword: { type: 'boolean' }, use_vector: { type: 'boolean' }, use_graph: { type: 'boolean' }, use_reranker: { type: 'boolean' },
    },
    output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => true,
    execute: (args, exec) => client.post('/search', {
      query: args.query, space_ids: args.space_ids, top_k: args.top_k ?? 10,
      use_keyword: args.use_keyword ?? true, use_vector: args.use_vector ?? true,
      use_graph: args.use_graph ?? true, use_reranker: args.use_reranker ?? false, filters: {},
    }, exec.signal),
  }));

  ctx.tools.register(defineTool({
    name: 'chuanshen_writing_graph_summary',
    description: '读取指定空间 Evidence、Entity、Claim、Fact、Relation 的真实治理数量和状态。',
    parameters: { space_id: { type: 'string', required: true } },
    output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => true,
    execute: (args, exec) => client.get(query('/writing-graph/governance/summary', { space_id: args.space_id }), exec.signal),
  }));

  ctx.tools.register(defineTool({
    name: 'chuanshen_writing_graph_items',
    description: '分页读取写作图谱某一层的真实治理对象；candidate 不能当作已确认事实。',
    parameters: {
      space_id: { type: 'string', required: true },
      target_type: { type: 'string', enum: ['evidence', 'entity', 'claim', 'fact', 'relation'], required: true },
      status: { type: 'string' }, limit: { type: 'integer' },
    },
    output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => true,
    execute: (args, exec) => client.get(query('/writing-graph/governance/items', {
      space_id: args.space_id, target_type: args.target_type, status: args.status, limit: args.limit ?? 50,
    }), exec.signal),
  }));

  ctx.tools.register(defineTool({
    name: 'chuanshen_analysis_readiness',
    description: '检查指定空间实体、关系、证据覆盖、规则和阻塞项，判断是否具备规则推演条件。',
    parameters: { space_id: { type: 'string', required: true } },
    output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => true,
    execute: (args, exec) => client.get(query('/analysis/readiness', { space_id: args.space_id }), exec.signal),
  }));

  ctx.tools.register(defineTool({
    name: 'chuanshen_analysis_tasks',
    description: '列出已有规则分析任务及其真实运行状态。',
    parameters: {}, output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => true,
    execute: (_args, exec) => client.get('/analysis/tasks', exec.signal),
  }));

  ctx.tools.register(defineTool({
    name: 'chuanshen_analysis_run',
    description: '使用 Semantica 运行一个已有分析任务。默认 preview；publish 只有用户明确要求加入知识库时才允许。',
    parameters: {
      task_id: { type: 'string', required: true },
      mode: { type: 'string', enum: ['preview', 'publish'] },
      max_results: { type: 'integer' }, user_confirmed: { type: 'boolean', required: true },
    },
    output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => false,
    execute: (args, exec) => {
      if ((args.mode ?? 'preview') === 'publish' && !args.user_confirmed) throw new Error('chuanshen/user-confirmation-required');
      return client.post(`/analysis/tasks/${encodeURIComponent(args.task_id)}/run`, { mode: args.mode ?? 'preview', max_results: args.max_results ?? 1000 }, exec.signal);
    },
  }));

  ctx.tools.register(defineTool({
    name: 'chuanshen_writing_projects',
    description: '列出妙笔写作项目。',
    parameters: {}, output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => true,
    execute: (_args, exec) => client.get('/writing/projects?limit=500', exec.signal),
  }));

  ctx.tools.register(defineTool({
    name: 'chuanshen_writing_project_create',
    description: '创建一个真实妙笔写作项目。知识空间、写作图谱和场景均可按业务准备情况传入；不得以项目创建成功代替资料加工或报告生成完成。',
    parameters: {
      name: { type: 'string', required: true }, code: { type: 'string' },
      space_id: { type: 'string' }, scenario_package_version_id: { type: 'string' },
      writing_graph_release_id: { type: 'string' },
    },
    output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => false,
    execute: (args, exec) => client.post('/writing/projects', {
      name: args.name, ...(args.code ? { code: args.code } : {}),
      ...(args.space_id ? { space_id: args.space_id } : {}),
      ...(args.scenario_package_version_id ? { scenario_package_version_id: args.scenario_package_version_id } : {}),
      ...(args.writing_graph_release_id ? { writing_graph_release_id: args.writing_graph_release_id } : {}),
      config: {},
    }, exec.signal),
  }));

  ctx.tools.register(defineTool({
    name: 'chuanshen_writing_project_context',
    description: '读取妙笔项目、已确认事实和文稿清单，为写作建立真实上下文。',
    parameters: { project_id: { type: 'string', required: true } },
    output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => true,
    async execute(args, exec) {
      const id = encodeURIComponent(args.project_id);
      const [project, facts, documents] = await Promise.all([
        client.get(`/writing/projects/${id}`, exec.signal),
        client.get(`/writing/projects/${id}/facts`, exec.signal),
        client.get(`/writing/projects/${id}/documents`, exec.signal),
      ]);
      return { project, facts, documents };
    },
  }));

  ctx.tools.register(defineTool({
    name: 'chuanshen_corpus_create',
    description: '把项目内已锁定资料投影为版本化语料包。历史样稿只生成脱敏骨架，不向写作 Agent 提供历史项目数值。',
    parameters: {
      project_id: { type: 'string', required: true }, code: { type: 'string', required: true },
      name: { type: 'string', required: true },
      source_material_ids: { type: 'array', items: { type: 'string' }, required: true },
      writing_graph_release_id: { type: 'string' },
    },
    output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => false,
    execute: (args, exec) => client.post(`/writing/projects/${encodeURIComponent(args.project_id)}/corpus-packages`, {
      code: args.code, name: args.name, source_material_ids: args.source_material_ids,
      ...(args.writing_graph_release_id ? { writing_graph_release_id: args.writing_graph_release_id } : {}),
    }, exec.signal),
  }));

  ctx.tools.register(defineTool({
    name: 'chuanshen_corpus_manifest',
    description: '读取语料包版本、来源和产物清单，检查是否已经形成可用的脱敏骨架。',
    parameters: { package_id: { type: 'string', required: true } },
    output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => true,
    execute: (args, exec) => client.get(`/writing/corpus-packages/${encodeURIComponent(args.package_id)}`, exec.signal),
  }));

  ctx.tools.register(defineTool({
    name: 'chuanshen_corpus_artifacts',
    description: '读取语料包的规范产物映射、目录、脱敏骨架和文风信息；不得把 skeleton 槽位当作当前项目值。',
    parameters: { package_id: { type: 'string', required: true } },
    output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => true,
    execute: (args, exec) => client.get(`/writing/corpus-packages/${encodeURIComponent(args.package_id)}/artifacts`, exec.signal),
  }));

  ctx.tools.register(defineTool({
    name: 'chuanshen_writing_facts',
    description: '列出当前写作项目的权威事实版本、核验状态、单位和来源。只有 verified 且适用范围有效的 Fact 可进入正式数值和结论。',
    parameters: { project_id: { type: 'string', required: true } },
    output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => true,
    execute: (args, exec) => client.get(`/writing/projects/${encodeURIComponent(args.project_id)}/facts`, exec.signal),
  }));

  ctx.tools.register(defineTool({
    name: 'chuanshen_writing_fact_confirm',
    description: '按用户明确决策确认或拒绝待治理候选。已采用事实的改值不能走此工具，必须先生成影响预览并在 Plate 中确认。',
    parameters: {
      project_id: { type: 'string', required: true }, fact_id: { type: 'string', required: true },
      decision: { type: 'string', enum: ['confirm', 'reject', 'override'], required: true },
      reason: { type: 'string', required: true }, new_value: { type: 'json' },
      user_confirmed: { type: 'boolean', required: true },
    },
    output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => false,
    execute: async (args, exec) => {
      if (args.decision === 'override' || args.new_value !== undefined) throw new Error('chuanshen/trusted-ui-confirmation-required: 改值须先预览影响，再在 Plate 中确认。');
      if (!args.user_confirmed) throw new Error('chuanshen/user-confirmation-required');
      const result = await client.get(`/writing/projects/${encodeURIComponent(args.project_id)}/facts`, exec.signal);
      const candidates = Array.isArray(result) ? result : (result as {items?: unknown[]}).items ?? [];
      const fact = candidates.find((row: any) => row.id === args.fact_id) as {verification_status?: string; active?: boolean} | undefined;
      if (!fact || fact.active === false || !['candidate', 'unverified'].includes(fact.verification_status ?? '')) throw new Error('chuanshen/trusted-ui-confirmation-required: 仅允许治理待确认候选，已采用事实须通过影响预览处理。');
      return client.post(`/writing/projects/${encodeURIComponent(args.project_id)}/facts/${encodeURIComponent(args.fact_id)}/confirm`, {
        decision: args.decision, reason: args.reason,
      }, exec.signal);
    },
  }));

  ctx.tools.register(defineTool({
    name: 'chuanshen_writing_graph_release',
    description: '在用户明确确认后发布指定空间已治理的写作图谱，形成不可变 WritingGraphRelease。',
    parameters: { space_id: { type: 'string', required: true }, user_confirmed: { type: 'boolean', required: true } },
    output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => false,
    execute: (args, exec) => {
      if (!args.user_confirmed) throw new Error('chuanshen/user-confirmation-required');
      return client.post('/writing-graph/releases', { space_id: args.space_id }, exec.signal);
    },
  }));

  ctx.tools.register(defineTool({
    name: 'chuanshen_inheritance_preview',
    description: '对比历史语料结构与当前项目事实，输出可采用、需换算、可重算、缺失或不适用节点。历史数值永不继承。',
    parameters: { project_id: { type: 'string', required: true }, corpus_package_version_id: { type: 'string', required: true } },
    output: inheritanceOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => false,
    execute: (args, exec) => client.post(`/writing/projects/${encodeURIComponent(args.project_id)}/inheritance/preview`, {
      corpus_package_version_id: args.corpus_package_version_id,
    }, exec.signal),
  }));

  ctx.tools.register(defineTool({
    name: 'chuanshen_inheritance_todo',
    description: '读取一次继承对齐的缺失事实、单位冲突和阻断项。',
    parameters: { project_id: { type: 'string', required: true }, alignment_id: { type: 'string', required: true } },
    output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => true,
    execute: (args, exec) => client.get(`/writing/projects/${encodeURIComponent(args.project_id)}/inheritance/${encodeURIComponent(args.alignment_id)}`, exec.signal),
  }));

  ctx.tools.register(defineTool({
    name: 'chuanshen_inheritance_apply',
    description: '应用用户选择的继承决定，只采用当前项目值、重算结构或不适用剪枝，绝不写入历史样稿值。',
    parameters: {
      project_id: { type: 'string', required: true }, alignment_id: { type: 'string', required: true },
      accepted_node_keys: { type: 'array', items: { type: 'string' }, required: true },
      user_confirmed: { type: 'boolean', required: true },
    },
    output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => false,
    execute: (args, exec) => {
      if (!args.user_confirmed) throw new Error('chuanshen/user-confirmation-required');
      return client.post(`/writing/projects/${encodeURIComponent(args.project_id)}/inheritance/apply`, {
        alignment_id: args.alignment_id, accepted_node_keys: args.accepted_node_keys,
      }, exec.signal);
    },
  }));

  ctx.tools.register(defineTool({
    name: 'chuanshen_writing_document_create',
    description: '在妙笔项目中新建一份独立空白文稿并返回 document_id 和初始版本。项目已有文稿时必须调用本工具，不能复用或覆盖旧 document_id。标题在项目内唯一；调用结果不明确时先用 chuanshen_writing_project_context 查找同名文稿，禁止改名后盲目重复创建。',
    parameters: {
      project_id: { type: 'string', required: true },
      title: { type: 'string', required: true },
      document_type: { type: 'string' },
      purpose: { type: 'string' },
      audience: { type: 'string' },
      writing_requirements: { type: 'string' },
    },
    output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => false,
    execute: (args, exec) => client.post('/writing/documents', {
      project_id: args.project_id,
      title: args.title,
      document_type: args.document_type ?? 'response_plan',
      purpose: args.purpose ?? '',
      audience: args.audience ?? '',
      applicability: {},
      writing_requirements: args.writing_requirements ?? '',
      content: [],
    }, exec.signal),
  }));

  ctx.tools.register(defineTool({
    name: 'chuanshen_writing_reason',
    description: '对妙笔项目已确认事实执行 Semantica 规则推演。默认只预览，不由模型生成正式结论。地震场景若提示缺少确定性判据，应先调用 chuanshen_writing_evaluate_criteria。',
    parameters: { project_id: { type: 'string', required: true }, mode: { type: 'string', enum: ['preview', 'publish'] }, user_confirmed: { type: 'boolean', required: true } },
    output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => false,
    execute: (args, exec) => {
      if ((args.mode ?? 'preview') === 'publish' && !args.user_confirmed) throw new Error('chuanshen/user-confirmation-required');
      return client.post(`/writing/projects/${encodeURIComponent(args.project_id)}/reason`, { mode: args.mode ?? 'preview' }, exec.signal);
    },
  }));

  ctx.tools.register(defineTool({
    name: 'chuanshen_writing_evaluate_criteria',
    description: '根据项目已核验事实执行地震等级等确定性判据，生成可供 Semantica 推演使用的已核验判据事实；这不是语言模型判断。',
    parameters: { project_id: { type: 'string', required: true } },
    output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => false,
    execute: (args, exec) => client.post(
      `/writing/projects/${encodeURIComponent(args.project_id)}/criteria/evaluate`, {}, exec.signal,
    ),
  }));

  ctx.tools.register(defineTool({
    name: 'chuanshen_writing_compute_baseline',
    description: '使用项目中已核验的原子事实执行场景基线公式并生成有依赖绑定的权威测算事实。地震资源缺口优先使用本工具，不要把自由输入值冒充已核验事实。',
    parameters: { project_id: { type: 'string', required: true } },
    output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => false,
    execute: (args, exec) => client.post(
      `/writing/projects/${encodeURIComponent(args.project_id)}/computations/run-baseline`, {}, exec.signal,
    ),
  }));

  ctx.tools.register(defineTool({
    name: 'chuanshen_writing_compute',
    description: '调用妙笔确定性公式计算资源缺口、工程量金额、投资比例、金额差异、车辆趟次、医疗压力或路线效用。只做临时测算时不要传 output_fact_key；生成权威结果事实时，必须同时传 input_fact_ids 和 input_fact_map（公式变量名到已核验 Fact ID），且 inputs 数值须与这些 Fact 一致。地震基线缺口优先调用 chuanshen_writing_compute_baseline。',
    parameters: {
      project_id: { type: 'string', required: true },
      operation: { type: 'string', enum: [
        'resource_gap', 'shelter_gap', 'water_demand', 'vehicle_trips', 'ambulance_trips',
        'medical_pressure', 'route_utility', 'quantity_amount', 'construction_installation_cost',
        'basic_reserve', 'total_investment', 'investment_ratio', 'amount_difference',
      ], required: true },
      inputs: { type: 'json', required: true },
      input_fact_ids: { type: 'array', items: { type: 'string' } },
      input_fact_map: { type: 'json' },
      output_fact_key: { type: 'string' }, output_label: { type: 'string' }, output_unit: { type: 'string' },
    },
    output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => false,
    execute: (args, exec) => client.post(`/writing/projects/${encodeURIComponent(args.project_id)}/compute`, {
      operation: args.operation, inputs: args.inputs, parameters: {}, rounding: {}, input_fact_ids: args.input_fact_ids ?? [], input_fact_map: args.input_fact_map ?? {},
      ...(args.output_fact_key ? { output_fact_key: args.output_fact_key } : {}),
      ...(args.output_label ? { output_label: args.output_label } : {}),
      ...(args.output_unit ? { output_unit: args.output_unit } : {}),
    }, exec.signal),
  }));

  ctx.tools.register(defineTool({
    name: 'chuanshen_writing_generate',
    description: '启动妙笔真实分章节报告生成任务；返回运行 ID，必须继续查询运行状态，不能立即声称报告完成。为保护已有正文，用户要求新文章时先调用 chuanshen_writing_document_create，再传入其 document_id。',
    parameters: {
      project_id: { type: 'string', required: true }, document_id: { type: 'string' }, title: { type: 'string' },
      section_keys: { type: 'array', items: { type: 'string' } }, allow_partial: { type: 'boolean' },
    },
    output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => false,
    execute: (args, exec) => client.post(`/writing/projects/${encodeURIComponent(args.project_id)}/generate-report`, {
      ...(args.document_id ? { document_id: args.document_id } : {}), ...(args.title ? { title: args.title } : {}),
      section_keys: args.section_keys ?? [], allow_partial: args.allow_partial ?? true,
    }, exec.signal),
  }));

  ctx.tools.register(defineTool({
    name: 'chuanshen_writing_outline',
    description: '读取当前文章目录，或保存当前 DSH 主笔建议的目录。保存需 base_version_id 和 request_id，sections 遵循工作包目录契约。不会生成正文。',
    parameters: {document_id:{type:'string',required:true},base_version_id:{type:'string'},request_id:{type:'string'},sections:{type:'json'}},
    output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => false,
    execute: (args, exec) => args.sections === undefined
      ? client.get(`/writing/documents/${encodeURIComponent(args.document_id)}/native-outline`, exec.signal)
      : client.put(`/writing/documents/${encodeURIComponent(args.document_id)}/native-outline`, {base_version_id:args.base_version_id ?? null, request_id:args.request_id ?? null, sections:args.sections}, exec.signal),
  }));
  ctx.tools.register(defineTool({
    name: 'chuanshen_writing_section_context',
    description: '为当前 DSH 主笔获取不可变章节工作包。使用返回的事实、依据和计算写作，不启动智库内部 Agent。接着调用 section_submit，逐章完成。',
    parameters: { document_id: {type: 'string', required: true}, section_key: {type: 'string', required: true}, request_id: {type: 'string', required: true},fact_keys:{type:'array',items:{type:'string'}},source_chunk_ids:{type:'array',items:{type:'string'}} },
    output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => false,
    execute: (args, exec) => client.post(`/writing/documents/${encodeURIComponent(args.document_id)}/native-chapters/work-package`, {section_key: args.section_key, request_id: args.request_id,...(args.fact_keys?{fact_keys:args.fact_keys}:{}),...(args.source_chunk_ids?{source_chunk_ids:args.source_chunk_ids}:{})}, exec.signal),
  }));
  ctx.tools.register(defineTool({
    name: 'chuanshen_writing_section_submit',
    description: '提交当前 DSH Agent 写出的章节 Plate 块与精确来源绑定。必须按章节工作包 output_schema，正文由服务校验后保存；无效来源、无依据数字和旧版本将被拒绝。不代写正文。',
    parameters: { document_id: {type: 'string', required: true}, work_package_id: {type: 'string', required: true}, checksum: {type: 'string', required: true}, request_id: {type: 'string', required: true}, draft_blocks: {type:'json',required:true}, bindings:{type:'json',required:true} },
    output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => false,
    execute: (args, exec) => client.post(`/writing/documents/${encodeURIComponent(args.document_id)}/native-chapters/${encodeURIComponent(args.work_package_id)}/submit`, {checksum: args.checksum, request_id: args.request_id, draft_blocks: args.draft_blocks, bindings: args.bindings}, exec.signal),
  }));
  ctx.tools.register(defineTool({
    name: 'chuanshen_writing_open',
    description: '读取真实文稿并返回独立 Plate 资源地址；不会创建另一份正文或启动 Office。',
    parameters: { document_id: {type: 'string', required: true} },
    output: {schema: {type:'json'}, render: (_args, value) => [{type:'text',text:`[在 Plate 中打开文稿](${record(value).resource_address})\n\n${JSON.stringify(value, null, 2)}`}]}, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => true,
    async execute(args, exec) {
      const document = await client.get(`/writing/documents/${encodeURIComponent(args.document_id)}`, exec.signal);
      return {document, resource_address: `dsh-resource://chuanshen-writing/${encodeURIComponent(args.document_id)}`, editor: 'Plate'};
    },
  }));
  ctx.tools.register(defineTool({
    name: 'chuanshen_writing_generation_run',
    description: '读取真实报告生成运行的阶段、进度、错误和最终文稿引用。',
    parameters: { run_id: { type: 'string', required: true } },
    output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => true,
    execute: (args, exec) => client.get(`/writing/generation-runs/${encodeURIComponent(args.run_id)}`, exec.signal),
  }));

  ctx.tools.register(defineTool({
    name: 'chuanshen_writing_generation_step',
    description: '仅兼容已有智库写作运行：执行平台内部 Agent 下一章。DSH 原生主笔写新报告应使用 section_context 和 section_submit，不要新建本链路。',
    parameters: { run_id: { type: 'string', required: true } },
    output: jsonOutput, timeoutMs: Math.max(client.options.timeoutMs, 310_000), isConcurrencySafe: () => false,
    async execute(args, exec) {
      const runId = encodeURIComponent(args.run_id);
      const stream = await client.postEventStream(
        `/writing/generation-runs/${runId}/agent`, {}, exec.signal, 300_000,
      );
      const run = await client.post(`/writing/generation-runs/${runId}/finalize`, {}, exec.signal);
      return { stream, run };
    },
  }));

  ctx.tools.register(defineTool({
    name: 'chuanshen_writing_generation_cancel',
    description: '取消一个仍在 queued/running/awaiting_agent/agent_running 的报告生成任务。仅在用户明确要求取消或联调清理时调用。',
    parameters: { run_id: { type: 'string', required: true }, user_confirmed: { type: 'boolean', required: true } },
    output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => false,
    execute: (args, exec) => {
      if (!args.user_confirmed) throw new Error('chuanshen/user-confirmation-required');
      return client.post(`/writing/generation-runs/${encodeURIComponent(args.run_id)}/cancel`, {}, exec.signal);
    },
  }));

  ctx.tools.register(defineTool({
    name: 'chuanshen_writing_chunk_get',
    description: '读取当前或指定文稿版本的正式 Chunk 及其稳定依赖绑定。',
    parameters: { document_id: { type: 'string', required: true }, version_id: { type: 'string' } },
    output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => true,
    execute: (args, exec) => client.get(query(`/writing/documents/${encodeURIComponent(args.document_id)}/chunks`, {
      version_id: args.version_id,
    }), exec.signal),
  }));

  ctx.tools.register(defineTool({
    name: 'chuanshen_writing_chunk_evidence',
    description: '读取文稿每个 Chunk 对应的 Fact、Evidence、Relation、ComputationRun 和公开标准引用。',
    parameters: { document_id: { type: 'string', required: true } },
    output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => true,
    execute: (args, exec) => client.get(`/writing/documents/${encodeURIComponent(args.document_id)}/paragraph-evidence`, exec.signal),
  }));

  ctx.tools.register(defineTool({
    name: 'chuanshen_writing_changeset_create',
    description: '为 Plate 编辑事件创建三层 Diff 预览，返回 ADD/DEL/MOD/MOVE、语义判定和传播路径；不会修改正文。',
    parameters: {
      document_id: { type: 'string', required: true },
      operations: { type: 'json', required: true },
    },
    output: impactOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => false,
    execute: (args, exec) => client.post(`/writing/documents/${encodeURIComponent(args.document_id)}/changesets/preview`, {
      operations: args.operations,
    }, exec.signal),
  }));

  ctx.tools.register(defineTool({
    name: 'chuanshen_writing_changeset_classify',
    description: '读取编辑 Diff 的确定性语义分类和传播闭包。模型辅助项仍需人工确认，不能据此自动扩大影响范围。',
    parameters: { document_id: { type: 'string', required: true }, changeset_id: { type: 'string', required: true } },
    output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => true,
    execute: (args, exec) => client.get(`/writing/documents/${encodeURIComponent(args.document_id)}/changesets/${encodeURIComponent(args.changeset_id)}`, exec.signal),
  }));

  ctx.tools.register(defineTool({
    name: 'chuanshen_writing_changeset_apply',
    description: '应用用户选择的普通措辞或结构编辑。受控数字会被拒绝并要求转入事实变更影响预览。',
    parameters: {
      document_id: { type: 'string', required: true }, changeset_id: { type: 'string', required: true },
      accepted_operation_indexes: { type: 'array', items: { type: 'integer' }, required: true },
      user_confirmed: { type: 'boolean', required: true },
    },
    output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => false,
    execute: (args, exec) => {
      if (!args.user_confirmed) throw new Error('chuanshen/user-confirmation-required');
      return client.post(`/writing/documents/${encodeURIComponent(args.document_id)}/changesets/${encodeURIComponent(args.changeset_id)}/apply`, {
        accepted_operation_indexes: args.accepted_operation_indexes,
      }, exec.signal);
    },
  }));

  ctx.tools.register(defineTool({
    name: 'chuanshen_writing_change_preview',
    description: '预览一个权威事实变更对计算结果和正文 Chunk 的直接/间接影响；不会修改正式事实或正文。',
    parameters: {
      project_id: { type: 'string', required: true }, document_id: { type: 'string', required: true },
      fact_key: { type: 'string', required: true }, new_value: { type: 'json', required: true }, reason: { type: 'string', required: true },
    },
    output: impactOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => false,
    execute: (args, exec) => client.post(`/writing/projects/${encodeURIComponent(args.project_id)}/input-changes/preview`, {
      document_id: args.document_id, changes: [{ fact_key: args.fact_key, new_value: args.new_value, reason: args.reason }],
    }, exec.signal),
  }));

  ctx.tools.register(defineTool({
    name: 'chuanshen_writing_change_apply',
    description: '确认事实联动的入口说明。实际应用只能在独立 Plate 影响弹窗中由用户勾选确认；模型传入 user_confirmed 不构成用户回执。',
    parameters: {
      project_id: { type: 'string', required: true }, preview_id: { type: 'string', required: true },
      accepted_block_ids: { type: 'array', items: { type: 'string' } }, user_confirmed: { type: 'boolean', required: true },
    },
    output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => false,
    execute: (args, exec) => {
      throw new Error('chuanshen/trusted-ui-confirmation-required: 请在 Plate 的影响预览中勾选并应用；Agent 不能代替用户确认。');
    },
  }));

  ctx.tools.register(defineTool({
    name: 'chuanshen_writing_change_rollback',
    description: '撤销联动请在 Plate 由用户操作。模型提供的 user_confirmed 布尔值不能作为回滚授权。',
    parameters: {
      project_id: { type: 'string', required: true }, preview_id: { type: 'string', required: true },
      user_confirmed: { type: 'boolean', required: true },
    },
    output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => false,
    execute: (args, exec) => {
      throw new Error('chuanshen/trusted-ui-confirmation-required: 请在 Plate 点击撤销上次联动。');
    },
  }));

  ctx.tools.register(defineTool({
    name: 'chuanshen_writing_version_compare',
    description: '列出文稿不可变版本，供用户核对事实变更或回滚前后的版本。',
    parameters: { document_id: { type: 'string', required: true } },
    output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => true,
    execute: (args, exec) => client.get(`/writing/documents/${encodeURIComponent(args.document_id)}/versions`, exec.signal),
  }));

  ctx.tools.register(defineTool({
    name: 'chuanshen_writing_validate',
    description: '检查文稿关键事实、来源、计算、过期块和发布阻塞项。',
    parameters: { document_id: { type: 'string', required: true }, for_publish: { type: 'boolean' } },
    output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => true,
    execute: (args, exec) => client.post(`/writing/documents/${encodeURIComponent(args.document_id)}/validate`, { for_publish: args.for_publish ?? false }, exec.signal),
  }));

  ctx.tools.register(defineTool({
    name: 'chuanshen_writing_export',
    description: '在用户明确确认后创建真实 DOCX/PDF/JSON/XLSX/GeoJSON 导出任务；返回任务回执，不把任务创建冒充文件已生成。',
    parameters: {
      document_id: { type: 'string', required: true },
      output_format: { type: 'string', enum: ['docx', 'evidence_docx', 'pdf', 'json', 'xlsx', 'geojson'], required: true },
      user_confirmed: { type: 'boolean', required: true },
    },
    output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => false,
    execute: (args, exec) => {
      if (!args.user_confirmed) throw new Error('chuanshen/user-confirmation-required');
      return client.post(`/writing/documents/${encodeURIComponent(args.document_id)}/exports`, { output_format: args.output_format }, exec.signal);
    },
  }));

  ctx.tools.register(defineTool({
    name: 'chuanshen_writing_export_status',
    description: '读取文稿真实导出任务及其状态、校验和和下载对象。创建任务不等于导出成功。',
    parameters: { document_id: { type: 'string', required: true } },
    output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => true,
    execute: (args, exec) => client.get(`/writing/documents/${encodeURIComponent(args.document_id)}/exports`, exec.signal),
  }));
}
