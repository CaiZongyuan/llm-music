import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadPages, validateManifest } from '../scripts/content.mjs';

const version = { revision: '1234567890abcdef1234567890abcdef12345678', workingCopy: false };
async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'music-docs-content-'));
  const ownedDirectory = await realpath(directory);
  const root = join(directory, 'repo');
  await mkdir(join(root, 'docs/learn'), { recursive: true });
  await mkdir(join(root, 'examples'));
  await writeFile(join(root, 'examples/first.py'), 'print("a complete controlled example")\n');
  const manifest = {
    schemaVersion: 1, site: 'https://example.github.io', base: '/llm-music/', repository: 'https://github.com/example/music', defaultLocale: 'zh-cn', title: { 'zh-cn': '音乐', en: 'Music' },
    locales: { 'zh-cn': { label: '中文', lang: 'zh-CN' }, en: { label: 'English', lang: 'en' } }, groups: [{ id: 'start', titles: { 'zh-cn': '开始', en: 'Start' } }],
    chapters: ['overview', 'result'].map(id => ({ id, type: 'tutorial', group: 'start', path: id, titles: { 'zh-cn': id, en: id }, labels: { 'zh-cn': id, en: id }, sources: { 'zh-cn': `docs/learn/${id}.md`, en: `docs/learn/${id}.en.md` } })),
  };
  for (const id of ['overview', 'result']) for (const suffix of ['', '.en']) await writeFile(join(root, `docs/learn/${id}${suffix}.md`), `A result a reader can verify.\n\n## Read the result {#result}\n\n[Continue](./result.md#result)\n\n<<< ../../examples/first.py\n`);
  t.after(async () => { assert.equal(await realpath(directory), ownedDirectory); await rm(ownedDirectory, { recursive: true, force: true }); });
  return { directory, root, manifest };
}

test('registered pages include complete source, resolve same-language links, and disable implicit chapter chaining', async t => {
  const { root, manifest } = await fixture(t);
  await writeFile(join(root, 'docs/learn/unregistered.md'), 'Not a public chapter.');
  const result = await loadPages(root, manifest, version);
  assert.equal(result.pages.length, 4);
  const english = result.pages.find(page => page.id === 'overview' && page.locale === 'en');
  assert.match(english.markdown, /\/llm-music\/en\/result\/#result/);
  assert.match(english.markdown, /print\("a complete controlled example"\)/);
  assert.match(english.markdown, /"prev": false/);
  assert.match(english.markdown, /"next": false/);
  assert.ok(!result.pages.some(page => page.source.endsWith('unregistered.md')));
  assert.equal(english.search.url, '/llm-music/en/overview/');
});

test('missing language, duplicate publish path, invalid chain, and a cycle are rejected', async t => {
  const { manifest } = await fixture(t);
  const missing = structuredClone(manifest); delete missing.chapters[0].sources.en;
  assert.throws(() => validateManifest(missing), /Language pair/);
  const duplicate = structuredClone(manifest); duplicate.chapters[1].path = 'overview';
  assert.throws(() => validateManifest(duplicate), /publish path/);
  const chain = structuredClone(manifest); chain.chapters[0].next = 'result';
  assert.throws(() => validateManifest(chain), /reciprocal/);
  const cycle = structuredClone(manifest);
  Object.assign(cycle.chapters[0], { next: 'result', previous: 'result' });
  Object.assign(cycle.chapters[1], { next: 'overview', previous: 'overview' });
  assert.throws(() => validateManifest(cycle), /cycle/);
});

test('a repository directory alias preserves internal routes and repository-relative source links', async t => {
  const { directory, root, manifest } = await fixture(t);
  const alias = join(directory, 'checkout-alias');
  await symlink(root, alias, process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal(await realpath(alias), await realpath(root));
  const result = await loadPages(alias, manifest, version);
  const english = result.pages.find(page => page.id === 'overview' && page.locale === 'en');
  assert.match(english.markdown, /\[Continue\]\(\/llm-music\/en\/result\/#result\)/);
  assert.match(english.markdown, /blob\/1234567890abcdef1234567890abcdef12345678\/examples\/first\.py/);
  assert.ok(result.sourcePaths.every(path => !path.startsWith('..')));
});

test('source include cannot cross a filesystem link outside the repository', async t => {
  const { directory, root, manifest } = await fixture(t);
  const outside = join(directory, 'external');
  await mkdir(outside); await writeFile(join(outside, 'first.py'), 'outside = True\n');
  await symlink(outside, join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  await writeFile(join(root, 'docs/learn/overview.md'), 'Intro.\n\n## Result {#result}\n\n<<< ../../linked/first.py\n');
  await assert.rejects(loadPages(root, manifest, version), /escapes repository/);
});

test('link references are checked while code examples remain literal, and paired sections cannot drift', async t => {
  const { root, manifest } = await fixture(t);
  await writeFile(join(root, 'docs/learn/overview.md'), 'Intro.\n\n## Result {#result}\n\n```markdown\n[example](missing.md)\n```\n\n[Continue][next]\n\n[next]: ./result.md#result\n');
  const result = await loadPages(root, manifest, version);
  assert.match(result.pages[0].markdown, /\[example\]\(missing.md\)/);
  assert.match(result.pages[0].markdown, /\[next\]: \/llm-music\/zh-cn\/result\/#result/);
  await writeFile(join(root, 'docs/learn/overview.en.md'), 'Intro.\n\n## Different section {#different}\n');
  await assert.rejects(loadPages(root, manifest, version), /section ids differ/);
});
