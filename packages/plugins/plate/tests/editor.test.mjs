import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlateEditor} from 'platejs/react';
import {TablePlugin} from '@platejs/table/react';
import {editorPlugins} from '../dist/Editor.js';
import {newId} from '../dist/model.js';

function editor(value){return createPlateEditor({plugins:editorPlugins,nodeId:{idCreator:newId,initialValueIds:'always'},value});}
function walk(nodes){return nodes.flatMap(n=>[n,...(n.children?walk(n.children):[])]);}

test('official NodeId keeps original block ids across consecutive keystrokes',()=>{
 const instance=editor([{id:'original',type:'p',children:[{text:'正文'}]}]);
 instance.tf.select({path:[0,0],offset:2});instance.tf.insertText('A');instance.tf.insertText('B');
 assert.equal(instance.children[0].id,'original');assert.equal(instance.children[0].children[0].text,'正文AB');
});
test('official table insertion gives stable unique element ids',()=>{
 const instance=editor([{id:'original',type:'p',children:[{text:''}]}]);
 instance.tf.select({path:[0,0],offset:0});instance.getTransforms(TablePlugin).insert.table({rowCount:2,colCount:2},{select:true});
 const elements=walk(instance.children).filter(n=>n.children);const ids=elements.map(n=>n.id);
 assert.ok(elements.some(n=>n.type==='table'));assert.ok(ids.every(Boolean));assert.equal(new Set(ids).size,ids.length);
 const id=instance.children[0].id;instance.tf.insertText('数据');assert.equal(instance.children[0].id,id);
});
test('slash invokes official trigger plugin and creates actual input element',()=>{
 const instance=editor([{id:'p',type:'p',children:[{text:''}]}]);
 instance.tf.select({path:[0,0],offset:0});instance.tf.insertText('/');
 assert.ok(walk(instance.children).some(n=>n.type==='slash_input'));
});
