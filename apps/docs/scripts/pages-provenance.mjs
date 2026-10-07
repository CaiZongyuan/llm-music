import assert from 'node:assert/strict';
import { readFile, appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function pagesProvenance(manifest, sources, expectedCommit) {
  assert.match(expectedCommit ?? '', /^[a-f0-9]{40}$/, 'Expected a full CI checkout commit');
  assert.equal(sources.revision, expectedCommit, 'Checked artifact must describe this CI checkout');
  assert.equal(sources.workingCopy, false, 'A working-copy artifact cannot be released');
  return { source_commit: sources.revision, expected_url: new URL(manifest.base, manifest.site).href };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  try {
    const manifest = JSON.parse(await readFile(resolve(root, 'docs/site.json'), 'utf8'));
    const sources = JSON.parse(await readFile(resolve(root, 'apps/docs/.generated/sources.json'), 'utf8'));
    const provenance = pagesProvenance(manifest, sources, process.env.DOCS_EXPECTED_COMMIT);
    if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, Object.entries(provenance).map(([key, value]) => `${key}=${value}\n`).join(''));
    process.stdout.write(`Verified Pages provenance: ${JSON.stringify(provenance)}\n`);
  } catch (error) {
    process.stderr.write(`Pages provenance failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
