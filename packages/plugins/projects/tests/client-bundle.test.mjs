import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';

test('packaged client factory imports with real React before mounting a component', async () => {
  const require = createRequire(new URL('../package.json', import.meta.url));
  const source = await readFile(new URL('../dist/client.browser.js', import.meta.url), 'utf8');
  let registered;
  vm.runInNewContext(source, { window: { __ModuleLoader__: {
    load: ({ id, factory }) => { registered = { id, exports: factory(require) }; },
  } } });
  assert.equal(registered.id, 'workdsh-plugin-projects');
  assert.equal(registered.exports.name, 'workdsh-projects-client');
  assert.equal(typeof registered.exports.apply, 'function');
  assert.ok(registered.exports.inject.includes('sessions'));
});
