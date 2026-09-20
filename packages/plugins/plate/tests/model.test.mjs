import test from 'node:test';
import assert from 'node:assert/strict';
import {controlledEditIssue,displayValue,documentId,evidenceCards,exportReady,newId,plain,resourceAddress,rows,selectedImpactIds,stableNodes} from '../dist/model.js';

const leaf=()=>({text:'320',writing_binding:{occurrence_id:'occ-1',fact_id:'fact-1',fact_version:1,fact_key:'rescue_available',value:320,unit:'人'}});
const document=()=>[{id:'p-1',type:'p',children:[{text:'人数'},leaf(),{text:'；另一数字320'}]}];

test('Plate resource addresses are independent of Office and canonical',()=>{
 assert.equal(resourceAddress('doc-1'),'dsh-resource://chuanshen-writing/doc-1');
 assert.equal(documentId(resourceAddress('doc-1')),'doc-1');
 for(const bad of ['https://other/doc-1','dsh-resource://file/doc-1','dsh-resource://chuanshen-writing/../secret','dsh-resource://chuanshen-writing/doc-1?token=abc','dsh-resource://chuanshen-writing/doc%2F1'])assert.equal(documentId(bad),undefined);
 assert.throws(()=>resourceAddress('../secret'));
});
test('fallback UUID creation is secure and works without randomUUID',()=>{
 const ids=new Set(Array.from({length:100},newId));
 assert.equal(ids.size,100);for(const id of ids)assert.match(id,/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
});
test('initial ID normalization preserves already assigned IDs and source is immutable',()=>{
 const source=[{id:'a',type:'p',children:[{text:'a'}]},{id:'a',type:'p',children:[{text:'b'}]},{type:'p',children:[{text:'c'}]}];
 const result=stableNodes(source);assert.equal(result[0].id,'a');assert.equal(new Set(result.map(n=>n.id)).size,3);
 assert.deepEqual(stableNodes(result),result);assert.equal(source[1].id,'a');assert.equal(source[2].id,undefined);
});
test('ordinary prose and marks are editable while controlled values stay fixed',()=>{
 const previous=document(),next=structuredClone(previous);next[0].children[0].text='可用人数';next[0].children[1].bold=true;
 assert.equal(controlledEditIssue(previous,next),undefined);
 assert.equal(plain(next[0]),'可用人数320；另一数字320');
});
test('controlled literal change triggers fact adjustment even when metadata unchanged',()=>{
 const previous=document(),next=structuredClone(previous);next[0].children[1].text='400';
 assert.equal(controlledEditIssue(previous,next).factKey,'rescue_available');
});
test('forging text and metadata together is rejected',()=>{
 const previous=document(),next=structuredClone(previous);next[0].children[1].text='400';next[0].children[1].writing_binding.value=400;
 assert.ok(controlledEditIssue(previous,next));
});
test('changing an unbound equal number does not change controlled positions',()=>{
 const previous=document(),next=structuredClone(previous);next[0].children[2].text='；另一数字500';
 assert.equal(controlledEditIssue(previous,next),undefined);
});
test('deleting controlled leaf inside surviving paragraph is blocked; deleting paragraph is permitted',()=>{
 const previous=document(),next=structuredClone(previous);next[0].children.splice(1,1);
 assert.ok(controlledEditIssue(previous,next));assert.equal(controlledEditIssue(previous,[]),undefined);
});
test('duplicated pasted binding is rejected across paragraphs',()=>{
 const previous=document(),next=[...structuredClone(previous),{id:'p-2',type:'p',children:[leaf()]}];
 assert.match(controlledEditIssue(previous,next).message,/重复/);
});
test('selection applies only server-selectable items exactly once',()=>{
 const proposals=[{block_id:'a',selectable:true},{block_id:'b',selectable:false},{block_id:'c',selectable:true}];
 assert.deepEqual(selectedImpactIds(proposals,['c','b','a','a','injected']),['c','a']);
 assert.deepEqual(selectedImpactIds(proposals,[]),[]);
});
test('paragraph evidence envelope is displayed instead of silently empty',()=>{
 const paragraph={block_id:'p1',section:'资源现状',text:'当前人数',status:'current',dependencies:[{type:'source_chunk',version:'version-id',verification:'verified',freshness:'current',snapshot:{document_title:'资源台账',text:'可用人员320人',document_version:2,page_number:3,structural_path:'人员 / 搜救'}}]};
 assert.deepEqual(rows({paragraphs:[paragraph]}),[paragraph]);
 assert.deepEqual(evidenceCards(paragraph),[{title:'资源台账',kind:'来源片段',excerpt:'可用人员320人',version:'V2',location:'第 3 页 · 人员 / 搜救',verification:'已确认',freshness:'当前有效'}]);
});
test('evidence without source snapshot is explicit and never invents a title or verification',()=>{
 const [card]=evidenceCards({dependencies:[{type:'source_chunk',id:'opaque',version:'uuid'}],status:'stale'});
 assert.equal(card.title,'来源片段');assert.equal(card.version,'已锁定来源版本');assert.equal(card.verification,'待核验');assert.equal(card.freshness,'需更新');assert.match(card.excerpt,/尚未返回/);
});
test('business values retain zero and explicit missing values without raw JSON',()=>{
 assert.equal(displayValue({number:0}),'0');assert.equal(displayValue({number:null}),'未提供');assert.equal(displayValue(Infinity),'无效数值');assert.equal(displayValue({opaque:'data'}),'查看详情');
});
test('successful platform export jobs expose download and incomplete jobs do not',()=>{
 assert.equal(exportReady({id:'job-1',status:'succeeded'}),true);
 assert.equal(exportReady({id:'job-2',status:'completed'}),true);
 for(const status of ['running','failed','cancelled',''])assert.equal(exportReady({id:'job-3',status}),false);
 assert.equal(exportReady({id:'../invalid',status:'succeeded'}),false);
 assert.equal(exportReady({status:'succeeded'}),false);
});
