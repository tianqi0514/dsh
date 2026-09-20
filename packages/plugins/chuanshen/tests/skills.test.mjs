import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';
import { Context } from '@deepseek-ai/cordis';
import SkillRegistry, { renderSkillContent } from '@deepseek-ai/dsh-skill';
import { FileSystemSkillProvider } from '@deepseek-ai/dsh-skill-filesystem';
import { registerChuanshenSkills, CHUANSHEN_WORKFLOW_PROMPT } from '../dist/index.js';

const exec = promisify(execFile);
const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const resourcesRoot = join(packageRoot, 'resources', 'skills');
const names = ['chuanshen-evidence-writing', 'chuanshen-material-extraction'];

async function boot() {
  const ctx = new Context();
  await ctx.plugin(SkillRegistry);
  return ctx;
}

async function markdownFiles(root) {
  const files = [];
  for (const item of await readdir(root, { withFileTypes: true })) {
    const path = join(root, item.name);
    if (item.isDirectory()) files.push(...await markdownFiles(path));
    else if (item.name.endsWith('.md')) files.push(path);
  }
  return files;
}

async function checkLoadedResources(skill) {
  assert.equal(skill.resourceBase.kind, 'directory');
  const entry = await readFile(skill.path, 'utf8');
  assert.ok(entry.endsWith(skill.content.trimEnd() + '\n'), 'loaded body comes from the packaged Markdown source');
  const links = [...skill.content.matchAll(/\]\((references\/[^)]+\.md)\)/g)].map(match => match[1]);
  assert.ok(links.length >= 2, 'the method has on-demand implementation resources');
  for (const link of links) {
    const content = await readFile(join(skill.resourceBase.path, link), 'utf8');
    assert.ok(content.startsWith('# '), `${link} is readable from the official resource base`);
  }
  assert.equal(skill.invocation.modelInvocable, true);
  assert.equal(skill.invocation.userInvocable, true);
  assert.match(renderSkillContent(skill), /<skill_content/);
}

test('official registry and filesystem parser discover and load both native writing methods on demand', async () => {
  const ctx = await boot();
  try {
    const dispose = registerChuanshenSkills(ctx);
    const catalog = await ctx.skills.list();
    assert.deepEqual(catalog.map(item => item.name), names);
    assert.equal(catalog.every(item => item.source === 'bundled' && item.provider === 'chuanshen-writing-methods'), true);
    assert.equal(catalog.every(item => !('content' in item)), true, 'listing does not inject every method into context');
    for (const name of names) await checkLoadedResources(await ctx.skills.get(name));
    dispose();
    assert.deepEqual(await ctx.skills.list(), []);
    assert.equal(await ctx.skills.get(names[0]), undefined);
  } finally { await ctx.fiber.dispose(); }
});

test('provider is removed with its owning plugin and can be registered again without stale catalog entries', async () => {
  const ctx = await boot();
  try {
    const plugin = await ctx.plugin({ name: 'chuanshen-skills-lifecycle-probe', inject: ['skills'], apply: owned => { registerChuanshenSkills(owned); } });
    assert.equal((await ctx.skills.list()).length, 2);
    await plugin.dispose();
    assert.deepEqual(await ctx.skills.list(), []);
    registerChuanshenSkills(ctx);
    assert.equal((await ctx.skills.list()).length, 2);
    const abort = new AbortController();
    abort.abort(new Error('cancel skill load'));
    await assert.rejects(ctx.skills.get(names[0], { signal: abort.signal }), /cancel skill load/);
  } finally { await ctx.fiber.dispose(); }
});

test('every method tool reference resolves to an implemented plugin tool and no developer paths leak', async () => {
  const toolsSource = await readFile(join(packageRoot, 'src', 'tools.ts'), 'utf8');
  const registered = new Set([...toolsSource.matchAll(/name:\s*'([^']+)'/g)].map(match => match[1]));
  const files = await markdownFiles(resourcesRoot);
  assert.equal(files.length, 8);
  for (const path of files) {
    const content = await readFile(path, 'utf8');
    for (const match of content.matchAll(/\bchuanshen_[a-z_]+\b/g)) {
      assert.ok(registered.has(match[0]), `${path}: unknown tool ${match[0]}`);
    }
    assert.doesNotMatch(content, /\/Users\/|\/home\/tianqi|\.test-runtime|127\.0\.0\.1|Bearer\s+[A-Za-z0-9]/);
  }
});

test('native authoring contract separates methods, Agent execution, verified data and trusted UI confirmation', async () => {
  const writing = await readFile(join(resourcesRoot, names[0], 'SKILL.md'), 'utf8');
  const contract = await readFile(join(resourcesRoot, names[0], 'references', 'chapter-contract.md'), 'utf8');
  const updates = await readFile(join(resourcesRoot, names[0], 'references', 'updates-and-delivery.md'), 'utf8');
  assert.match(writing, /chuanshen_writing_outline/);
  assert.match(writing, /chuanshen_writing_section_context/);
  assert.match(writing, /chuanshen_writing_section_submit/);
  assert.match(writing, /不要调用旧.*chuanshen_writing_generate.*chuanshen_writing_generation_step/);
  assert.match(contract, /leaf_path/);
  assert.match(contract, /零基、左闭右开/);
  assert.match(contract, /整个章节保持待审/);
  assert.match(updates, /Agent 不能调用.*chuanshen_writing_change_apply/);
  assert.match(updates, /stale/);
  assert.match(updates, /历史版本不改/);
  assert.ok(CHUANSHEN_WORKFLOW_PROMPT.length < 900, 'global prompt routes rather than duplicates method bodies');
  assert.doesNotMatch(CHUANSHEN_WORKFLOW_PROMPT, /generation_step|request_id|leaf_path|inheritance_apply/);
  assert.ok(CHUANSHEN_WORKFLOW_PROMPT.includes(names[0]) && CHUANSHEN_WORKFLOW_PROMPT.includes(names[1]));
});

test('packed artifact contains both skills and all references readable by the official provider outside the source tree', async () => {
  const root = await mkdtemp(join(tmpdir(), 'chuanshen-packaged-skills-'));
  const ctx = await boot();
  try {
    const result = await exec('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', root], {
      cwd: packageRoot, maxBuffer: 4 * 1024 * 1024,
    });
    const [receipt] = JSON.parse(result.stdout);
    const expectedFiles = (await markdownFiles(resourcesRoot)).map(path => path.slice(packageRoot.length));
    for (const path of expectedFiles) assert.ok(receipt.files.some(file => file.path === path), `${path} absent from tarball`);
    await exec('tar', ['-xzf', join(root, receipt.filename), '-C', root]);
    const isolatedResources = await realpath(join(root, 'package', 'resources', 'skills'));
    ctx.skills.registerProvider(control => new FileSystemSkillProvider(ctx, control, {
      providerName: 'chuanshen-writing-methods', includeDefaultRoots: false,
      bundledSkillDir: isolatedResources, watch: false,
    }));
    assert.deepEqual((await ctx.skills.list()).map(item => item.name), names);
    for (const name of names) {
      const loaded = await ctx.skills.get(name);
      assert.ok(loaded.path.startsWith(isolatedResources));
      await checkLoadedResources(loaded);
      assert.equal(await readFile(loaded.path, 'utf8'), await readFile(join(resourcesRoot, name, 'SKILL.md'), 'utf8'));
      assert.equal(dirname(loaded.path), loaded.resourceBase.path);
    }
  } finally {
    await ctx.fiber.dispose();
    await rm(root, { recursive: true, force: true });
  }
});
