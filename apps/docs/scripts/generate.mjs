import { readFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { loadPages, sourceVersion } from './content.mjs';

const args = process.argv.slice(2);
const root = resolve(args.includes('--root') ? args[args.indexOf('--root') + 1] : fileURLToPath(new URL('../../../', import.meta.url)));
try {
  const manifest = JSON.parse(await readFile(resolve(root, 'docs/site.json'), 'utf8'));
  const renderHash = createHash('sha256');
  // Astro caches rendered Markdown by body digest; locale/config edits must change that digest too.
  for (const file of ['apps/docs/package.json', 'apps/docs/astro.config.mjs', 'apps/docs/scripts/heading-ids.mjs', ...Object.keys(manifest.locales).map(locale => `apps/docs/src/content/i18n/${locale}.json`)]) {
    renderHash.update(file); renderHash.update(await readFile(resolve(root, file)));
  }
  const result = await loadPages(root, manifest, { ...sourceVersion(root), renderInputsHash: renderHash.digest('hex') });
  const output = resolve(root, 'apps/docs/src/content/docs');
  await rm(output, { recursive: true, force: true });
  for (const page of result.pages) {
    const path = resolve(output, page.path);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, page.markdown);
  }
  const generated = resolve(root, 'apps/docs/.generated');
  await mkdir(generated, { recursive: true });
  await mkdir(resolve(root, 'apps/docs/public'), { recursive: true });
  await writeFile(resolve(generated, 'site.mjs'), `export default ${JSON.stringify({ ...manifest, sidebar: result.sidebar, version: result.version }, null, 2)};\n`);
  await writeFile(resolve(generated, 'sources.json'), JSON.stringify({ ...result.version, files: result.sourcePaths, pages: result.pages.map(({ id, locale, url, source, headings }) => ({ id, locale, url, source, headings })) }, null, 2) + '\n');
  await writeFile(resolve(root, 'apps/docs/public/search-index.json'), JSON.stringify(result.pages.map(page => page.search)) + '\n');
  process.stdout.write(`Generated ${result.pages.length} paired pages from ${result.sourcePaths.length} repository sources at ${result.version.revision.slice(0, 7)}${result.version.workingCopy ? ' (working copy)' : ''}.\n`);
} catch (error) {
  process.stderr.write(`Documentation generation failed: ${error.message}\n`);
  process.exitCode = 1;
}
