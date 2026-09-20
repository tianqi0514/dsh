import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareProjectTask, createProjectExpertSession } from '../dist/runtime/task-composition.js';

const actor={principalId:'alice',organizationId:'org',requestId:'test',resolvedBy:'test'};
const workspace={id:'workspace-pinned',title:'科研楼',path:'/work/research'};
const expert={kind:'expert',id:'writer',revision:'writer-v3',label:'可研主笔'};
const projects={get:async()=>({config:{id:'config-2',workspaceId:workspace.id,capabilities:[expert]}})};

test('operation IDs work without secure-context randomUUID',async()=>{
  const {projectOperationId}=await import('../dist/client/operation-id.js');
  const a=projectOperationId(),b=projectOperationId();
  assert.match(a,/^project-task-[0-9a-f]{32}$/);assert.notEqual(a,b);
  assert.match(projectOperationId('project-import'),/^project-import-[0-9a-f]{32}$/);
});

test('project task resolves fixed workspace, independent from registry ordering',async()=>{
  const plan=await prepareProjectTask(projects,actor,'project','config-2',[{id:'other',path:'/wrong'},workspace]);
  assert.deepEqual(plan.workspace,workspace);assert.equal(plan.expert,undefined);
});
test('project task refuses missing execution location and stale configuration',async()=>{
  await assert.rejects(prepareProjectTask(projects,actor,'project','config-2',[]),/workspace-required/);
  await assert.rejects(prepareProjectTask(projects,actor,'project','config-old',[workspace]),/revision-conflict/);
});
test('only a project selected pinned expert may run as main author',async()=>{
  await assert.rejects(prepareProjectTask(projects,actor,'project','config-2',[workspace],'stranger'),/expert-unavailable/);
  const plan=await prepareProjectTask(projects,actor,'project','config-2',[workspace],'writer');
  assert.deepEqual(plan.expert,expert);
});
test('selected expert uses existing public execution service with pinned revision',async()=>{
  const calls=[];const experts={prepareExecution:async(...args)=>{calls.push(args);return{executionPlanId:'native-plan',expertRevisionRef:{expertId:'writer',revisionId:'writer-v3'},missing:[]}},createExecution:async(...args)=>{calls.push(args);return{sessionId:'native-session'}}};
  const id=await createProjectExpertSession(experts,actor,{configRevisionId:'config-2',workspace,expert},'project-task-operation123');
  assert.equal(id,'native-session');assert.equal(calls[0][1],'writer');assert.equal(calls[0][2],'writer-v3');assert.equal(calls[0][3],'/work/research');assert.equal(calls[0][7],'workspace-pinned');assert.equal(calls[1][1],'native-plan');
});
test('missing dependency and implicit expert migration never fall back to generic agent',async()=>{
  let created=false;const experts={prepareExecution:async()=>({expertRevisionRef:{revisionId:'writer-v4'},missing:[]}),createExecution:async()=>{created=true}};
  await assert.rejects(createProjectExpertSession(experts,actor,{workspace,expert},'project-task-operation123'),/expert-revision-changed/);
  experts.prepareExecution=async()=>({expertRevisionRef:{revisionId:'writer-v3'},missing:[{message:'missing skill'}]});
  await assert.rejects(createProjectExpertSession(experts,actor,{workspace,expert},'project-task-operation123'),/expert-unavailable/);
  assert.equal(created,false);
});
