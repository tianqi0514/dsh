import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { injectFileUploadTransport } from '../../packages/bundle/dist/file-upload-transport.js';

const extractScript = html => html.match(/<script data-workdsh-file-upload-transport="fetch-v1">([\s\S]*?)<\/script>/)?.[1];

test('file upload transport is injected once before the page boots', () => {
  const input = '<!doctype html><html><head><title>WorkDSH</title></head><body></body></html>';
  const output = injectFileUploadTransport(input);
  assert.match(output, /data-workdsh-file-upload-transport="fetch-v1"/);
  assert.ok(output.indexOf('data-workdsh-file-upload-transport') < output.indexOf('</head>'));
  assert.equal(injectFileUploadTransport(output), output);
});

test('page-owned upload carrier forwards the request and includes browser credentials', async () => {
  const html = injectFileUploadTransport('<html><head></head></html>');
  const source = extractScript(html);
  assert.ok(source);
  const calls = [];
  const response = { status: 200, text: async () => 'ok' };
  const sandbox = {
    fetch: async (input, init) => { calls.push({ input, init }); return response; },
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox);
  const body = new Blob(['test']);
  const result = await sandbox.__DSH_FILE_UPLOAD__.fetch('/api/session/uploadFileBinary', {
    method: 'POST', body, headers: { 'content-type': 'application/octet-stream' },
  });
  assert.equal(result, response);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].input, '/api/session/uploadFileBinary');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.body, body);
  assert.equal(calls[0].init.credentials, 'include');
});

test('an existing host-provided upload carrier is preserved', () => {
  const html = injectFileUploadTransport('<html><head></head></html>');
  const source = extractScript(html);
  assert.ok(source);
  const existing = { fetch: async () => new Response() };
  const sandbox = { __DSH_FILE_UPLOAD__: existing, fetch: () => { throw new Error('must not run'); } };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox);
  assert.equal(sandbox.__DSH_FILE_UPLOAD__, existing);
});
