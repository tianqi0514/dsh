import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import { CHUANSHEN_CAPABILITY_GROUPS, CHUANSHEN_TOOL_PRESENTATIONS } from '../dist/capabilities.js';
import { buildChuanshenOverview, buildChuanshenSpaceOverview, listRows, overviewItems } from '../dist/overview.js';

test('maps every registered Chuanshen tool to one visible capability group', () => {
  const registered = [...readFileSync(new URL('../src/tools.ts',import.meta.url),'utf8').matchAll(/name:\s*'([^']+)'/g)].map(m=>m[1]);
  assert.equal(CHUANSHEN_TOOL_PRESENTATIONS.length, 50);
  assert.equal(new Set(CHUANSHEN_TOOL_PRESENTATIONS.map(tool => tool.name)).size, 50);
  assert.deepEqual(CHUANSHEN_TOOL_PRESENTATIONS.map(t=>t.name).sort(),registered.sort());
  const groupIds = new Set(CHUANSHEN_CAPABILITY_GROUPS.map(group => group.id));
  assert.equal(CHUANSHEN_TOOL_PRESENTATIONS.every(tool => groupIds.has(tool.group)), true);
  assert.equal(CHUANSHEN_CAPABILITY_GROUPS.every(group => CHUANSHEN_TOOL_PRESENTATIONS.some(tool => tool.group === group.id)), true);
});

test('normalizes supported platform list envelopes without exposing arbitrary fields', () => {
  assert.deepEqual(listRows({ items: [{ id: 'one' }] }, ['items']), [{ id: 'one' }]);
  assert.deepEqual(overviewItems({ projects: [{ id: 'p-1', name: '项目一', status: 'active', secret: 'must-not-leak' }] }, ['projects']), [
    { id: 'p-1', name: '项目一', status: 'active' },
  ]);
});

test('builds a real capability overview from Chuanshen API responses', async () => {
  const client = {
    async get(path) {
      if (path === '/spaces?limit=500') return { spaces: [{ id: 's-1', name: '上财科研楼' }] };
      if (path === '/writing/projects?limit=500') return { projects: [{ project_id: 'p-1', title: '可研写作' }] };
      if (path === '/analysis/tasks') return { tasks: [{ task_id: 'a-1', name: '规则推演', state: 'completed' }] };
      throw new Error(`unexpected ${path}`);
    },
  };
  const result = await buildChuanshenOverview(client, new AbortController().signal);
  assert.equal(result.status, 'connected');
  assert.equal(result.toolCount, 50);
  assert.equal(result.spaces[0].name, '上财科研楼');
  assert.equal(result.projects[0].name, '可研写作');
  assert.equal(result.analysisTasks[0].status, 'completed');
});

test('builds the visible space status and five writing-graph layers', async () => {
  const client = {
    async get(path) {
      if (path.startsWith('/documents?')) return { items: [{ id: 'd-1' }, { id: 'd-2' }] };
      if (path.startsWith('/jobs?')) return { jobs: [{ status: 'completed' }, { status: 'failed' }] };
      if (path.startsWith('/writing-graph/governance/summary?')) return { counts: {
        evidence_count: 9,
        entity: { total: 8, verified: 5, pending: 3 },
        claim: { total: 7, confirmed: 4, candidate: 3 },
        fact: { total: 6, verified: 5, candidate: 1 },
        relation: { total: 5, verified: 4, unverified: 1 },
      } };
      if (path.startsWith('/analysis/readiness?')) return { ready: false, blockers: [{ code: 'fact_missing' }] };
      throw new Error(`unexpected ${path}`);
    },
  };
  const result = await buildChuanshenSpaceOverview(client, 'space one', new AbortController().signal);
  assert.equal(result.status, 'connected');
  assert.equal(result.documentCount, 2);
  assert.deepEqual(result.jobCounts, { completed: 1, failed: 1 });
  assert.equal(result.writingGraph.find(layer => layer.id === 'evidence').total, 9);
  assert.equal(result.writingGraph.find(layer => layer.id === 'fact').verified, 5);
  assert.deepEqual(result.reasoning, { ready: false, blockerCount: 1 });
});

test('derives a non-zero writing-graph total from state counts when the platform omits total', async () => {
  const client = {
    async get(path) {
      if (path.startsWith('/documents?')) return { items: [] };
      if (path.startsWith('/jobs?')) return { jobs: [] };
      if (path.startsWith('/writing-graph/governance/summary?')) return { counts: {
        entity: { confirmed: 220, candidate: 3 },
        fact: { verified: 263, pending: 0 },
      } };
      if (path.startsWith('/analysis/readiness?')) return { ready: true };
      throw new Error(`unexpected ${path}`);
    },
  };
  const result = await buildChuanshenSpaceOverview(client, 'space-with-state-counts', new AbortController().signal);
  assert.equal(result.writingGraph.find(layer => layer.id === 'entity').total, 223);
  assert.equal(result.writingGraph.find(layer => layer.id === 'fact').total, 263);
});
