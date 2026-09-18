import type { Context } from '@deepseek-ai/cordis';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { ChuanshenClient, query, type JsonValue } from './client.js';

const jsonOutput = {
  schema: { type: 'json' } as const,
  render: (_args: unknown, value: JsonValue) => [{ type: 'text' as const, text: JSON.stringify(value) }],
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
    name: 'chuanshen_writing_reason',
    description: '对妙笔项目已确认事实执行 Semantica 规则推演。默认只预览，不由模型生成正式结论。',
    parameters: { project_id: { type: 'string', required: true }, mode: { type: 'string', enum: ['preview', 'publish'] }, user_confirmed: { type: 'boolean', required: true } },
    output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => false,
    execute: (args, exec) => {
      if ((args.mode ?? 'preview') === 'publish' && !args.user_confirmed) throw new Error('chuanshen/user-confirmation-required');
      return client.post(`/writing/projects/${encodeURIComponent(args.project_id)}/reason`, { mode: args.mode ?? 'preview' }, exec.signal);
    },
  }));

  ctx.tools.register(defineTool({
    name: 'chuanshen_writing_compute',
    description: '调用妙笔确定性公式计算资源缺口、车辆趟次、医疗压力或路线效用；正式数值必须来自本工具回执。',
    parameters: {
      project_id: { type: 'string', required: true },
      operation: { type: 'string', enum: ['resource_gap', 'shelter_gap', 'water_demand', 'vehicle_trips', 'ambulance_trips', 'medical_pressure', 'route_utility'], required: true },
      inputs: { type: 'json', required: true },
      input_fact_ids: { type: 'array', items: { type: 'string' } },
      output_fact_key: { type: 'string' }, output_label: { type: 'string' }, output_unit: { type: 'string' },
    },
    output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => false,
    execute: (args, exec) => client.post(`/writing/projects/${encodeURIComponent(args.project_id)}/compute`, {
      operation: args.operation, inputs: args.inputs, parameters: {}, rounding: {}, input_fact_ids: args.input_fact_ids ?? [], input_fact_map: {},
      ...(args.output_fact_key ? { output_fact_key: args.output_fact_key } : {}),
      ...(args.output_label ? { output_label: args.output_label } : {}),
      ...(args.output_unit ? { output_unit: args.output_unit } : {}),
    }, exec.signal),
  }));

  ctx.tools.register(defineTool({
    name: 'chuanshen_writing_generate',
    description: '启动妙笔真实分章节报告生成任务；返回运行 ID，必须继续查询运行状态，不能立即声称报告完成。',
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
    name: 'chuanshen_writing_generation_run',
    description: '读取真实报告生成运行的阶段、进度、错误和最终文稿引用。',
    parameters: { run_id: { type: 'string', required: true } },
    output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => true,
    execute: (args, exec) => client.get(`/writing/generation-runs/${encodeURIComponent(args.run_id)}`, exec.signal),
  }));

  ctx.tools.register(defineTool({
    name: 'chuanshen_writing_change_preview',
    description: '预览一个权威事实变更对计算结果和正文 Chunk 的直接/间接影响；不会修改正式事实或正文。',
    parameters: {
      project_id: { type: 'string', required: true }, document_id: { type: 'string', required: true },
      fact_key: { type: 'string', required: true }, new_value: { type: 'json', required: true }, reason: { type: 'string', required: true },
    },
    output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => false,
    execute: (args, exec) => client.post(`/writing/projects/${encodeURIComponent(args.project_id)}/input-changes/preview`, {
      document_id: args.document_id, changes: [{ fact_key: args.fact_key, new_value: args.new_value, reason: args.reason }],
    }, exec.signal),
  }));

  ctx.tools.register(defineTool({
    name: 'chuanshen_writing_change_apply',
    description: '按用户选择应用已生成的事实影响预览。只有明确接受后才能调用；未选择的块保持不变并应标记过期。',
    parameters: {
      project_id: { type: 'string', required: true }, preview_id: { type: 'string', required: true },
      accepted_block_ids: { type: 'array', items: { type: 'string' } }, user_confirmed: { type: 'boolean', required: true },
    },
    output: jsonOutput, timeoutMs: client.options.timeoutMs, isConcurrencySafe: () => false,
    execute: (args, exec) => {
      if (!args.user_confirmed) throw new Error('chuanshen/user-confirmation-required');
      return client.post(`/writing/projects/${encodeURIComponent(args.project_id)}/input-changes/apply`, {
        preview_id: args.preview_id, ...(args.accepted_block_ids ? { accepted_block_ids: args.accepted_block_ids } : {}),
      }, exec.signal);
    },
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
}
