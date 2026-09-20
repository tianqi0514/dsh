import test from 'node:test';
import assert from 'node:assert/strict';
import { connectorCallDenied, connectorToolOwner } from '../dist/selection-policy.js';
const registered = ['inventory', 'private', 'inventory-other'];
test('selected MCP tools allowed, unselected or late-discovered namespaces denied',()=>{
  assert.equal(connectorCallDenied('mcp__inventory__query',{},['inventory'],registered),undefined);
  assert.ok(connectorCallDenied('mcp__private__query',{},['inventory'],registered));
  assert.ok(connectorCallDenied('mcp__inventory-other__query',{},['inventory'],registered));
  assert.ok(connectorCallDenied('mcp__inventory__newly_discovered',{},[],registered));
  assert.equal(connectorCallDenied('skill',{name:'writer'},[],registered),undefined);
});
test('MCP resource reads and discovery require a selected explicit server',()=>{
  for(const name of ['list_mcp_resources','list_mcp_resource_templates','read_mcp_resource']){
    assert.equal(connectorCallDenied(name,{server:'inventory'},['inventory'],registered),undefined);
    assert.ok(connectorCallDenied(name,{server:'private'},['inventory'],registered));
    assert.ok(connectorCallDenied(name,{},['inventory'],registered));
    assert.ok(connectorCallDenied(name,{server:'unknown'},['unknown'],registered));
  }
});
test('new child Agent with no own selection is fail closed',()=>{
  assert.ok(connectorCallDenied('mcp__inventory__query',{},[],registered));
  assert.ok(connectorCallDenied('read_mcp_resource',{server:'inventory',uri:'private://data'},[],registered));
});
test('nested registered server names cannot borrow a selected prefix even when both are selected',()=>{
  const nested = ['inventory', 'inventory__private'];
  assert.equal(connectorToolOwner('mcp__inventory__query',nested),'inventory');
  assert.equal(connectorToolOwner('mcp__inventory__private__query',nested),undefined);
  for(const selected of [['inventory'],['inventory__private'],nested]){
    assert.ok(connectorCallDenied('mcp__inventory__private__query',{},selected,nested));
  }
  // Explicit MCP resource server arguments have no wire-name ambiguity.
  assert.equal(connectorCallDenied('read_mcp_resource',{server:'inventory__private'},['inventory__private'],nested),undefined);
  assert.ok(connectorCallDenied('read_mcp_resource',{server:'inventory__private'},['inventory'],nested));
});
test('unregistered and malformed namespaces fail closed without mutating existing double-underscore names',()=>{
  assert.ok(connectorCallDenied('mcp__rogue__query',{},['rogue'],registered));
  assert.ok(connectorCallDenied('mcp__inventory__',{},['inventory'],registered));
  assert.equal(connectorToolOwner('mcp__inventory__private__query',['inventory__private']),'inventory__private');
  assert.equal(connectorCallDenied('mcp__inventory__private__query',{},['inventory__private'],['inventory__private']),undefined);
  assert.ok(connectorCallDenied('mcp__inventory__private__query',{},['inventory__private'],['inventory','inventory__private']), 'a newly registered collision is denied at dispatch');
});
