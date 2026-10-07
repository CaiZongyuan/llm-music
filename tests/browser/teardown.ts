import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';

export default async function teardown(): Promise<void> {
  const runDir = process.env.MUSIC_BROWSER_RUN_DIR;
  if (!runDir) throw new Error('Missing owned browser API run directory');
  await writeFile(join(runDir, 'stop'), 'Playwright tests finished\n');
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const stopped: unknown = JSON.parse(await readFile(join(runDir, 'stopped.json'), 'utf8'));
      if (typeof stopped !== 'object' || stopped === null || !('graceful' in stopped) || stopped.graceful !== true) {
        throw new Error('Owned API did not acknowledge graceful application shutdown');
      }
      return;
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
    await setTimeout(100);
  }
  throw new Error(`Owned API shutdown acknowledgement missing; inspect ${runDir}`);
}
