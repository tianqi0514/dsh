import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Context } from '@deepseek-ai/cordis';
import SkillRegistry from '@deepseek-ai/dsh-skill';
import { FileSystemSkillProvider } from '@deepseek-ai/dsh-skill-filesystem';
import { SkillManager } from '../../packages/plugins/skills/dist/index.js';

async function withManager(run) {
  const root = await mkdtemp(join(tmpdir(), 'workdsh-bundled-revisions-'));
  const previous = { DSH_HOME: process.env.DSH_HOME, DSH_AGENTS_HOME: process.env.DSH_AGENTS_HOME };
  const ctx = new Context();
  try {
    process.env.DSH_HOME = join(root, 'dsh'); process.env.DSH_AGENTS_HOME = join(root, 'agents');
    await ctx.plugin(SkillRegistry);
    const manager = new SkillManager(ctx);
    await run({ ctx, manager, root });
  } finally {
    await ctx.fiber.dispose();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    await rm(root, { recursive: true, force: true });
  }
}

function registerBundle(ctx, root) {
  return ctx.skills.registerProvider(control => new FileSystemSkillProvider(ctx, control, {
    providerName: 'readonly-bundled-test', includeDefaultRoots: false, bundledSkillDir: root, watch: false,
  }));
}

test('packaged writing skills remain native, visible, readable and revision-selectable without becoming editable', async () => {
  await withManager(async ({ ctx, manager }) => {
    const source = fileURLToPath(new URL('../../packages/plugins/chuanshen/resources/skills/', import.meta.url));
    const dispose = registerBundle(ctx, source);
    const names = ['chuanshen-evidence-writing', 'chuanshen-material-extraction'];
    assert.deepEqual((await manager.list()).map(row => [row.name, row.state, row.manageable]), names.map(name => [name, 'readonly', false]));
    for (const name of names) {
      const detail = await manager.detail(name);
      assert.equal(detail.document, await readFile(join(source, name, 'SKILL.md'), 'utf8'));
      assert.ok(detail.resources.length >= 2);
      assert.equal((await manager.readResource(name, detail.resources[0])).document, await readFile(join(source, name, detail.resources[0]), 'utf8'));
      const ref = await manager.resolveRevision(name, detail.revision);
      assert.equal(ref.contentDigest, detail.revision);
      const retained = await manager.retainRevision(ref, { domain: 'expert', id: 'writer-test' });
      assert.equal(retained.files.length, detail.resources.length + 1);
      assert.equal((await manager.checkRevision(ref, {})).status, 'intact');
      assert.equal(await readFile(join(retained.snapshotDir, name, 'SKILL.md'), 'utf8'), detail.document);
      await assert.rejects(manager.update({ name, expectedRevision: detail.revision, document: `${detail.document}\nModified body.\n` }), /skill\/not-manageable/);
      await assert.rejects(manager.setEnabled(name, false), /skill\/not-manageable/);
      await assert.rejects(manager.dependencyImpact(name), /skill\/not-manageable/);
      await assert.rejects(manager.uninstall(name, 'readonly-cannot-be-uninstalled'), /skill\/not-manageable/);
      await assert.rejects(manager.writeResource({ name, path: detail.resources[0], document: 'modified' }), /skill\/not-manageable/);
      await assert.rejects(manager.readResource(name, '../other/SKILL.md'), /skill\/invalid-resource-path/);
      assert.equal(await readFile(join(source, name, 'SKILL.md'), 'utf8'), detail.document);
    }
    const ref = await manager.resolveRevision(names[0]);
    dispose();
    assert.equal((await manager.checkRevision(ref, {})).status, 'source-uninstalled');
    assert.deepEqual(await manager.list(), []);
  });
});

test('readonly revision hashes every resource, including deep paths and entries beyond the UI page limit', async () => {
  await withManager(async ({ ctx, manager, root }) => {
    const bundles = join(root, 'bundles'), directory = join(bundles, 'large-method');
    const deep = join(directory, 'references/a/b/c/d/e');
    await mkdir(deep, { recursive: true });
    await writeFile(join(directory, 'SKILL.md'), '---\nname: large-method\ndescription: Complete revision\n---\nRead resources.\n');
    await Promise.all(Array.from({ length: 205 }, (_, i) => writeFile(join(directory, `reference-${i}.md`), `Resource ${i}`)));
    await writeFile(join(deep, 'guide.md'), 'first');
    registerBundle(ctx, bundles);
    const detail = await manager.detail('large-method');
    assert.equal(detail.resources.length, 206);
    const original = await manager.resolveRevision('large-method', detail.revision);
    const retained = await manager.retainRevision(original, { domain: 'expert', id: 'test' });
    assert.equal(retained.files.length, 207);
    await writeFile(join(deep, 'guide.md'), 'second');
    const changed = await manager.resolveRevision('large-method');
    assert.notEqual(changed.contentDigest, original.contentDigest);
    await assert.rejects(manager.resolveRevision('large-method', original.contentDigest), /skill\/revision-drift/);
    assert.equal(await readFile(join(retained.snapshotDir, 'large-method/references/a/b/c/d/e/guide.md'), 'utf8'), 'first');
  });
});

test('readonly bundles reject escaped resources and mismatched provider instruction paths', async () => {
  await withManager(async ({ ctx, manager, root }) => {
    const bundles = join(root, 'bundles'), directory = join(bundles, 'bounded-method');
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'SKILL.md'), '---\nname: bounded-method\ndescription: Boundary\n---\nUse only bundled resources.\n');
    const outside = join(root, 'outside.md'); await writeFile(outside, 'not a skill resource');
    await symlink(outside, join(directory, 'escaped.md'));
    registerBundle(ctx, bundles);
    await assert.rejects(manager.resolveRevision('bounded-method'), /skill\/path-symlink/);
    const outsideEntry = join(root, 'other/SKILL.md'); await mkdir(join(root, 'other')); await writeFile(outsideEntry, 'wrong source');
    ctx.skills.register({ name: 'wrong-path', description: 'Wrong instruction root', source: 'bundled', content: 'body',
      path: outsideEntry, resourceBase: { kind: 'directory', path: directory } });
    await assert.rejects(manager.detail('wrong-path'), /skill\/revision-source-mismatch/);
    ctx.skills.register({ name: 'virtual-method', description: 'No filesystem root', source: 'bundled', content: 'Virtual public body' });
    assert.equal((await manager.detail('virtual-method')).document, 'Virtual public body');
    await assert.rejects(manager.resolveRevision('virtual-method'), /skill\/revision-source-missing/);
  });
});
