import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import * as host from '../dist/index.js';

test('installable Plate bundle provides a live host discovery anchor and independent browser entry',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
 assert.equal(manifest.dsh.bundle.patch,'./cordis.patch.yml');
 assert.ok(manifest.files.includes('cordis.patch.yml'));
 const patch=await readFile(new URL('../cordis.patch.yml',import.meta.url),'utf8');
 assert.match(patch,/id: workdsh-plate\n\s+name: workdsh-plugin-plate/);
 assert.equal(manifest.exports['.'].default,'./dist/index.js');
 assert.equal(manifest.exports['./client'].default,'./dist/client.browser.js');
 assert.equal(manifest.dsh.client.platform,'web');
 assert.equal(host.name,'workdsh-plate');assert.equal(host.apply(),undefined);
 assert.ok((await stat(new URL('../dist/client.browser.js',import.meta.url))).size>0);
});
