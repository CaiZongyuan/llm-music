import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { exportReferences, renderAPI, renderSettings } from '../scripts/references.mjs';
import { loadPages } from '../scripts/content.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const version = { revision: '1234567890abcdef1234567890abcdef12345678', workingCopy: true };
const jsonBlocks = body => [...body.matchAll(/```json\n([\s\S]*?)\n```/g)].map(match => JSON.parse(match[1]));

test('CPU references preserve the public contracts, and an upstream change reaches both languages', async () => {
  const { openapi, settings } = await exportReferences(root);
  for (const locale of ['zh-cn', 'en']) {
    const api = renderAPI(openapi, locale);
    const blocks = jsonBlocks(api);
    for (const route of Object.values(openapi.paths)) for (const operation of Object.values(route)) {
      if (!operation.operationId) continue;
      assert.ok(blocks.some(block => JSON.stringify(block) === JSON.stringify(operation.responses)), `${operation.operationId}: responses`);
      for (const key of ['parameters', 'requestBody']) if (operation[key]) assert.ok(blocks.some(block => JSON.stringify(block) === JSON.stringify(operation[key])), `${operation.operationId}: ${key}`);
    }
    for (const schema of Object.values(openapi.components.schemas)) assert.ok(blocks.some(block => JSON.stringify(block) === JSON.stringify(schema)));
    assert.ok(blocks.some(block => JSON.stringify(block) === JSON.stringify(openapi['x-websockets'])));
    assert.ok(jsonBlocks(renderSettings(settings, locale)).every((block, index) => JSON.stringify(block) === JSON.stringify(Object.values(settings.settings_schema.properties)[index])));
    assert.equal(settings.settings_schema.properties.data_dir.default, '${REPOSITORY}/data');
    const modified = structuredClone(settings);
    modified.environment_variables.max_upload_bytes = 'CHANGED_UPLOAD_BUDGET';
    modified.settings_schema.properties.max_upload_bytes.default = 123;
    modified.settings_schema.properties.max_upload_bytes.exclusiveMinimum = 100;
    const result = renderSettings(modified, locale);
    assert.match(result, /CHANGED_UPLOAD_BUDGET/);
    assert.ok(jsonBlocks(result).some(block => block.default === 123 && block.exclusiveMinimum === 100));
  }
});

test('registered reference and guide amendment resolves same-language tasks, pinned source, and safe complete includes', async () => {
  const manifest = JSON.parse(await readFile(new URL('../../../docs/site.json', import.meta.url), 'utf8'));
  const amendment = JSON.parse(await readFile(new URL('../../../docs/previews/documentation-reference-v1/amendment.json', import.meta.url), 'utf8'));
  manifest.chapters.push(...amendment.filter(chapter => !manifest.chapters.some(existing => existing.id === chapter.id)));
  const references = await exportReferences(root);
  const result = await loadPages(root, manifest, version, references);
  const english = result.pages.find(page => page.id === 'api-reference' && page.locale === 'en');
  assert.match(english.markdown, /\/llm-music\/en\/api-client\//);
  assert.match(english.markdown, /blob\/1234567890abcdef1234567890abcdef12345678\/services\/api\/src\/music_api\/contracts.py/);
  const client = result.pages.find(page => page.id === 'api-client-guide' && page.locale === 'en');
  assert.match(client.markdown, /Complete example: packages\/api-client\/examples\/generate-save.ts/);
  assert.match(client.markdown, /\/llm-music\/en\/job-recovery\//);
  for (const chapter of amendment) {
    const pages = result.pages.filter(page => page.id === chapter.id);
    assert.equal(pages.length, 2);
    assert.deepEqual(pages[0].headings, pages[1].headings);
    assert.equal(new Set(pages[0].headings).size, pages[0].headings.length);
    assert.match(pages[0].markdown, /"prev": false/);
    assert.match(pages[0].markdown, /"next": false/);
  }
  const stale = structuredClone(manifest);
  stale.chapters.find(chapter => chapter.id === 'api-client-guide').sectionIds.push('missing-new-section');
  await assert.rejects(loadPages(root, stale, version, references), /Guide sections differ from registry/);
});
