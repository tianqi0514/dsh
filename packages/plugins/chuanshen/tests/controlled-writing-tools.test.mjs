import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { registerChuanshenTools } from '../dist/tools.js';

test('model boolean cannot authorize override, fact impact apply or rollback', async () => {
  const registered = new Map();
  let writes = 0;
  registerChuanshenTools({tools:{register:tool=>registered.set(tool.name,tool)}}, {
    options:{timeoutMs:1000}, get:async()=>[{id:'f',active:true,verification_status:'verified'}], post:()=>{writes++; throw new Error('unexpected write');},
  });
  for (const [name,args] of [
    ['chuanshen_writing_fact_confirm',{project_id:'p',fact_id:'f',reason:'修改',decision:'override',new_value:{number:400},user_confirmed:true}],
    ['chuanshen_writing_change_apply',{project_id:'p',preview_id:'v',user_confirmed:true,accepted_block_ids:['selected']}],
    ['chuanshen_writing_change_rollback',{project_id:'p',preview_id:'v',user_confirmed:true}],
    ['chuanshen_writing_fact_confirm',{project_id:'p',fact_id:'f',reason:'拒绝已采用事实',decision:'reject',user_confirmed:true}],
  ]) await assert.rejects(async()=>registered.get(name).execute(args,{signal:new AbortController().signal}), /trusted-ui-confirmation-required/);
  assert.equal(writes,0);
});


test('registers the complete controlled-writing tool surface exactly once', async () => {
  const source = await readFile(new URL('../src/tools.ts', import.meta.url), 'utf8');
  const names = [...source.matchAll(/name:\s*'([^']+)'/g)].map(match => match[1]);
  assert.equal(names.length, new Set(names).size);
  for (const name of [
    'chuanshen_corpus_create',
    'chuanshen_corpus_manifest',
    'chuanshen_corpus_artifacts',
    'chuanshen_inheritance_preview',
    'chuanshen_inheritance_todo',
    'chuanshen_inheritance_apply',
    'chuanshen_writing_chunk_get',
    'chuanshen_writing_chunk_evidence',
    'chuanshen_writing_changeset_create',
    'chuanshen_writing_changeset_classify',
    'chuanshen_writing_changeset_apply',
    'chuanshen_writing_change_preview',
    'chuanshen_writing_change_apply',
    'chuanshen_writing_change_rollback',
    'chuanshen_writing_version_compare',
    'chuanshen_writing_export_status',
  ]) assert.ok(names.includes(name), `${name} is not registered`);
  assert.ok(names.length >= 44, `expected at least 44 tools, got ${names.length}`);
});


test('plugin source does not import database or middleware clients', async () => {
  const source = await readFile(new URL('../src/tools.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /pg|postgres|sqlalchemy|falkor|qdrant|opensearch|minio|rabbitmq|redis/i);
  assert.match(source, /client\.(get|post)/);
});


test('document create always creates an independent empty report in the selected writing project', async () => {
  const registered = new Map();
  const writes = [];
  registerChuanshenTools({tools:{register:tool=>registered.set(tool.name,tool)}}, {
    options:{timeoutMs:1000},
    get:async()=>[],
    post:async(path, body)=>{
      writes.push({path, body});
      return {id:'new-document', project_id:body.project_id, current_version:{id:'version-1', version:1, content:[]}};
    },
  });
  const tool = registered.get('chuanshen_writing_document_create');
  const result = await tool.execute({
    project_id:'cbf39b9d-98db-445d-ab3f-c69a5e9918b1',
    title:'科研楼可行性研究报告（原生重写稿）',
    document_type:'feasibility_report',
    purpose:'形成有依据的业务讨论稿',
    audience:'项目决策人员',
    writing_requirements:'按章写作，精确数字必须绑定权威事实。',
  }, {signal:new AbortController().signal});
  assert.equal(result.id, 'new-document');
  assert.deepEqual(writes, [{
    path:'/writing/documents',
    body:{
      project_id:'cbf39b9d-98db-445d-ab3f-c69a5e9918b1',
      title:'科研楼可行性研究报告（原生重写稿）',
      document_type:'feasibility_report',
      purpose:'形成有依据的业务讨论稿',
      audience:'项目决策人员',
      applicability:{},
      writing_requirements:'按章写作，精确数字必须绑定权威事实。',
      content:[],
    },
  }]);
  assert.match(tool.description, /不能复用或覆盖旧 document_id/);
  assert.match(tool.description, /查找同名文稿/);
});

test('deterministic writing compute exposes the platform research-report formula surface', async () => {
  const source = await readFile(new URL('../src/tools.ts', import.meta.url), 'utf8');
  for (const operation of [
    'quantity_amount',
    'construction_installation_cost',
    'basic_reserve',
    'total_investment',
    'investment_ratio',
    'amount_difference',
  ]) assert.match(source, new RegExp(`['"]${operation}['"]`));
});
