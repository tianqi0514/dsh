import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CONNECTOR_TOOL_CALL_TIMEOUT_MS,
  MAX_CONNECTOR_TOOL_CALL_TIMEOUT_MS,
  MIN_CONNECTOR_TOOL_CALL_TIMEOUT_MS,
} from '../dist/shared.js';
import { connectorDefinitionSchema } from '../dist/storage.js';

const base = {
  id: 'search',
  title: 'Search',
  description: '',
  serverName: 'search',
  transport: 'streamable-http',
  url: 'http://127.0.0.1:3000/mcp',
  enabled: true,
  createdAt: '2026-09-20T00:00:00.000Z',
  updatedAt: '2026-09-20T00:00:00.000Z',
};

test('legacy connector records receive the bounded cold-search default', () => {
  const parsed = connectorDefinitionSchema.parse(base);
  assert.equal(parsed.toolCallTimeoutMs, DEFAULT_CONNECTOR_TOOL_CALL_TIMEOUT_MS);
  assert.equal(parsed.toolCallTimeoutMs, 30_000);
});

test('per-connector timeout accepts a bounded explicit value', () => {
  assert.equal(connectorDefinitionSchema.parse({ ...base, toolCallTimeoutMs: 25_000 }).toolCallTimeoutMs, 25_000);
  assert.throws(() => connectorDefinitionSchema.parse({ ...base, toolCallTimeoutMs: MIN_CONNECTOR_TOOL_CALL_TIMEOUT_MS - 1 }));
  assert.throws(() => connectorDefinitionSchema.parse({ ...base, toolCallTimeoutMs: MAX_CONNECTOR_TOOL_CALL_TIMEOUT_MS + 1 }));
  assert.throws(() => connectorDefinitionSchema.parse({ ...base, toolCallTimeoutMs: 1_500.5 }));
});
