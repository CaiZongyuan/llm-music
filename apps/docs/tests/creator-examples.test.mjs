import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const directory = join(root, 'services/api/examples/creator');
const recipe = JSON.parse(await readFile(join(directory, 'morning-song.json'), 'utf8'));

test('controlled baseline, lyrics and compressed listening copy describe the same verified sample', async () => {
  const provenance = JSON.parse(await readFile(join(root, 'apps/docs/public/examples/morning-song-provenance.json'), 'utf8'));
  assert.deepEqual(recipe, provenance.inputs);
  assert.equal((await readFile(join(directory, 'morning-song-lyrics.txt'), 'utf8')).replaceAll('\r\n', '\n').trimEnd(), recipe.lyrics);
  const media = await readFile(join(root, 'apps/docs/public/examples/morning-song.mp3'));
  assert.equal(media.length, provenance.size_bytes);
  assert.equal(createHash('sha256').update(media).digest('hex'), provenance.sha256);
  assert.equal(recipe.max_seconds, 35);
  assert.equal((await readFile(join(directory, 'morning-sunlight-lyrics.txt'), 'utf8')).replaceAll('\r\n', '\n').trimEnd(), recipe.lyrics.replace('Morning gathers on the window', 'Morning sunlight finds the window'));
});
