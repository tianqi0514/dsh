import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';


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
