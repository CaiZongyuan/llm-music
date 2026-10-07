import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const manifest = JSON.parse(await readFile(resolve(root, 'docs/site.json'), 'utf8'));
const amendment = JSON.parse(await readFile(new URL('./amendment.json', import.meta.url), 'utf8'));
manifest.chapters.push(...amendment.filter(chapter => !manifest.chapters.some(existing => existing.id === chapter.id)));
await mkdir(resolve(root, 'apps/docs/.generated'), { recursive: true });
await writeFile(resolve(root, 'apps/docs/.generated/preview-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
for (const [command, args] of [
  ['node', ['apps/docs/scripts/generate.mjs', '--manifest', 'apps/docs/.generated/preview-manifest.json']],
  ['pnpm', ['--filter', '@llm-music/docs', 'build']],
  ['node', ['apps/docs/scripts/check-build.mjs', '--manifest', 'apps/docs/.generated/preview-manifest.json']],
]) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', windowsHide: true, shell: process.platform === 'win32' && command === 'pnpm' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
