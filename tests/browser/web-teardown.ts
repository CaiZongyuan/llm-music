import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import apiTeardown from './teardown.js';

export default async function teardown() {
  await apiTeardown();
  const runDir = process.env.MUSIC_BROWSER_RUN_DIR;
  if (!runDir) throw new Error('Missing owned Web run directory');
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const receipt: unknown = JSON.parse(await readFile(resolve(runDir, 'web-stopped.json'), 'utf8'));
      if (typeof receipt !== 'object' || receipt === null || !('graceful' in receipt) || receipt.graceful !== true) throw new Error('Web shutdown was not acknowledged');
      return;
    } catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; }
    await setTimeout(100);
  }
  throw new Error(`Owned Web shutdown acknowledgement missing: ${runDir}`);
}
