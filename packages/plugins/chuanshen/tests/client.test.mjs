import assert from 'node:assert/strict';
import { chmod, mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ChuanshenClient } from '../dist/client.js';

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'chuanshen-plugin-'));
  const uploads = join(root, 'uploads');
  await mkdir(uploads);
  const credentialFile = join(root, 'credentials.json');
  await writeFile(credentialFile, JSON.stringify({ username: 'service-user', password: 'secret-value' }), { mode: 0o600 });
  await chmod(credentialFile, 0o600);
  let loginCount = 0;
  const requests = [];
  const server = createServer(async (req, res) => {
    const parts = [];
    for await (const part of req) parts.push(part);
    const body = Buffer.concat(parts);
    requests.push({ url: req.url, method: req.method, authorization: req.headers.authorization, body });
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/api/v1/auth/login') {
      loginCount += 1;
      res.end(JSON.stringify({ access_token: `token-${loginCount}` }));
      return;
    }
    if (req.url === '/api/v1/spaces?limit=500') {
      if (req.headers.authorization === 'Bearer token-1') {
        res.statusCode = 401;
        res.end(JSON.stringify({ detail: 'expired' }));
      } else res.end(JSON.stringify([{ id: 'space-1', name: '空间一' }]));
      return;
    }
    if (req.url === '/api/v1/documents/upload') {
      res.end(JSON.stringify({ id: 'doc-1', accepted: body.length > 0 }));
      return;
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ detail: 'not found' }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const client = new ChuanshenClient({
    apiBaseUrl: `http://127.0.0.1:${address.port}/api/v1`, credentialFile,
    allowedUploadRoot: uploads, timeoutMs: 5000,
  });
  return { root, uploads, client, server, requests, loginCount: () => loginCount };
}

test('refreshes a rejected bearer without exposing credentials', async t => {
  const value = await fixture();
  t.after(() => value.server.close());
  const result = await value.client.get('/spaces?limit=500', new AbortController().signal);
  assert.deepEqual(result, [{ id: 'space-1', name: '空间一' }]);
  assert.equal(value.loginCount(), 2);
  assert.equal(value.requests.some(request => request.url !== '/api/v1/auth/login' && request.body.includes(Buffer.from('secret-value'))), false);
});

test('uploads only a real file below the configured root', async t => {
  const value = await fixture();
  t.after(() => value.server.close());
  const file = join(value.uploads, 'material.md');
  await writeFile(file, '# 材料\n可核验内容');
  const result = await value.client.uploadDocument({
    filePath: file, spaceId: 'space-1', targets: ['fulltext', 'writing_graph'], materialRole: 'task_data',
  }, new AbortController().signal);
  assert.equal(result.id, 'doc-1');
  await assert.rejects(
    value.client.uploadDocument({ filePath: value.client.options.credentialFile, spaceId: 'space-1', targets: ['fulltext'], materialRole: 'task_data' }, new AbortController().signal),
    /outside-allowed-root/,
  );
});

test('rejects a credential file readable by other users', async t => {
  const value = await fixture();
  t.after(() => value.server.close());
  await chmod(value.client.options.credentialFile, 0o644);
  await assert.rejects(value.client.get('/spaces?limit=500', new AbortController().signal), /permissions-too-open/);
});
