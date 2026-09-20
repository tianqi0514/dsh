import assert from 'node:assert/strict';
import test from 'node:test';
import {writingOperation} from '../dist/writing-connection.js';

const signal = new AbortController().signal;
function protocolRecorder() {
  const calls=[];
  return {calls, get:async(path)=>{calls.push({method:'GET',path});return{};},post:async(path,body)=>{calls.push({method:'POST',path,body});return{};}};
}
test('browser save carries version CAS and idempotency; arbitrary path rejected',async()=>{
  const client=protocolRecorder();
  await writingOperation(client,'writing-save',{document_id:'doc-1',base_version_id:'v-1',request_id:'req-1',content:[]},signal);
  assert.equal(client.calls[0].body.base_version_id,'v-1');
  assert.equal(client.calls[0].body.request_id,'req-1');
  await assert.rejects(writingOperation(client,'writing-document',{document_id:'../../auth/login'},signal),/invalid-id/);
  await assert.rejects(writingOperation(client,'writing-proxy',{path:'/auth/login'},signal),/invalid-operation/);
});
test('impact preview does not submit and apply preserves explicit selection',async()=>{
  const client=protocolRecorder();
  await writingOperation(client,'writing-preview',{project_id:'p1',document_id:'d1',fact_key:'available',new_value:400,reason:'台账更新'},signal);
  assert.equal(client.calls[0].path,'/writing/projects/p1/input-changes/preview');
  await writingOperation(client,'writing-apply',{project_id:'p1',preview_id:'preview1',accepted_block_ids:['block1']},signal);
  assert.deepEqual(client.calls[1].body.accepted_block_ids,['block1']);
  await assert.rejects(writingOperation(client,'writing-apply',{project_id:'p1',preview_id:'preview1',accepted_block_ids:[]},signal),/invalid-selection/);
  await assert.rejects(writingOperation(client,'writing-apply',{project_id:'p1',preview_id:'preview1',accepted_block_ids:['b','b']},signal),/invalid-selection/);
});
test('rejects nonfinite candidate values, missing reasons and unsupported export formats',async()=>{
  const client=protocolRecorder();
  for(const new_value of [NaN,Infinity,'400']) await assert.rejects(writingOperation(client,'writing-preview',{project_id:'p1',document_id:'d1',fact_key:'a',new_value,reason:'修正'},signal),/invalid-change/);
  await assert.rejects(writingOperation(client,'writing-preview',{project_id:'p1',document_id:'d1',fact_key:'a',new_value:400,reason:''},signal),/invalid-change/);
  await assert.rejects(writingOperation(client,'writing-export',{document_id:'d1',output_format:'html'},signal),/invalid-format/);
});
