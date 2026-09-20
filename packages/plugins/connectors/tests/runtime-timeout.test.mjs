import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Context } from '@deepseek-ai/cordis';
import Agents from '@deepseek-ai/dsh-agent';
import Tools from '@deepseek-ai/dsh-tools';
import McpResources from '@deepseek-ai/dsh-mcp-resources';
import Storage from '@deepseek-ai/dsh-storage';
import * as StorageJson from '@deepseek-ai/dsh-storage-json';
import * as StorageDomain from '@deepseek-ai/dsh-storage-domain';
import CredentialProvider from '@deepseek-ai/dsh-credentials';
import * as Connectors from '../dist/index.js';

const waitFor = async (predicate, timeoutMs = 5_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await predicate();
    if (value) return value;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error('Timed out waiting for connector readiness.');
};
const errorText = value => value instanceof Error ? `${value.name}: ${value.message}` : JSON.stringify(value);

class MemoryCredentials extends CredentialProvider {
  values = new Map();
  async resolve(ref) { const value = this.values.get(String(ref)); return value ? { value, source: 'test' } : undefined; }
  async describe(ref) { return { configured: this.values.has(String(ref)), source: this.values.has(String(ref)) ? 'test' : undefined, writable: true }; }
  async set(ref, value) { this.values.set(String(ref), value); }
  async unset(ref) { this.values.delete(String(ref)); }
  async readRecord() { return undefined; }
  async describeRecord() { return { configured: false, writable: true }; }
  async listRecords() { return []; }
  async modifyRecord() { return undefined; }
  async deleteRecord() {}
}

test('connector-scoped MCP timeout remains bounded and caller cancellation wins', { timeout: 15_000 }, async () => {
  const ctx = new Context();
  const root = await mkdtemp(join(tmpdir(), 'workdsh-connector-timeout-'));
  ctx.provide('systemPrompt', { tools() {}, section() {}, getSectionOrder() { return 0; } });
  ctx.provide('connection', { fetch: { register() { return async () => {}; } } });
  try {
    await ctx.plugin(Tools);
    await ctx.plugin(Storage);
    await ctx.plugin({ ...StorageJson }, { root });
    await ctx.plugin({ ...StorageDomain }, { backend: 'json' });
    await ctx.plugin(MemoryCredentials);
    await ctx.plugin(McpResources);
    await ctx.plugin(Agents);
    await ctx.plugin(Connectors);

    const manager = ctx.workdshConnectors;
    await waitFor(async () => (await manager.list()).find(row => row.id === 'workdsh-example' && row.state === 'ready'));
    const slowServer = fileURLToPath(new URL('./slow-server.mjs', import.meta.url));
    const connector = await manager.create({
      title: 'Timeout probe', description: 'test only', serverName: 'timeout-probe', transport: 'stdio',
      command: process.execPath, args: [slowServer], toolCallTimeoutMs: 1_000,
    });
    assert.equal(connector.toolCallTimeoutMs, 1_000);

    const stableSignal = new AbortController().signal;
    const started = Date.now();
    const timed = await ctx.tools.execute({
      name: 'mcp__timeout-probe__wait', arguments: { delayMs: 1_400 }, callId: 'timeout-call',
      agent: { id: 'timeout-agent' }, signal: stableSignal,
    });
    const timeoutElapsedMs = Date.now() - started;
    assert.equal(timed.isError, true);
    assert.ok(timeoutElapsedMs >= 700 && timeoutElapsedMs <= 2_500, `timeout elapsed ${timeoutElapsedMs} ms`);
    assert.match(errorText(timed.error), /timeout|timed out/i);

    const extended = await manager.update(connector.id, {
      title: connector.title, description: connector.description, serverName: connector.serverName, transport: 'stdio',
      command: process.execPath, args: [slowServer], toolCallTimeoutMs: 2_500,
    });
    assert.equal(extended.toolCallTimeoutMs, 2_500);
    const successful = await ctx.tools.execute({
      name: 'mcp__timeout-probe__wait', arguments: { delayMs: 1_400 }, callId: 'extended-call',
      agent: { id: 'timeout-agent' }, signal: stableSignal,
    });
    assert.equal(successful.isError, false);
    assert.equal(successful.value.structuredContent.waitedMs, 1_400);

    const controller = new AbortController();
    const abortStarted = Date.now();
    const pending = ctx.tools.execute({
      name: 'mcp__timeout-probe__wait', arguments: { delayMs: 2_000 }, callId: 'aborted-call',
      agent: { id: 'timeout-agent' }, signal: controller.signal,
    });
    setTimeout(() => controller.abort(new Error('test-cancelled')), 50);
    const aborted = await pending;
    const abortElapsedMs = Date.now() - abortStarted;
    assert.equal(aborted.isError, true);
    assert.ok(abortElapsedMs < 1_000, `abort elapsed ${abortElapsedMs} ms`);
    assert.match(errorText(aborted.error), /abort|cancel|test-cancelled/i);
  } finally {
    await ctx.fiber.dispose();
    await rm(root, { recursive: true, force: true });
  }
});
