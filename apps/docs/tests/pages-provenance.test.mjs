import test from 'node:test';
import assert from 'node:assert/strict';
import { pagesProvenance } from '../scripts/pages-provenance.mjs';

test('Pages release requires the exact committed build source and preserves the project URL', () => {
  const commit = '0123456789abcdef0123456789abcdef01234567';
  const manifest = { site: 'https://example.github.io', base: '/llm-music/' };
  const sources = { revision: commit, workingCopy: false };
  assert.deepEqual(pagesProvenance(manifest, sources, commit), { source_commit: commit, expected_url: 'https://example.github.io/llm-music/' });
  assert.throws(() => pagesProvenance(manifest, sources, undefined), /full CI checkout commit/);
  assert.throws(() => pagesProvenance(manifest, sources, 'abcdef0'), /full CI checkout commit/);
  assert.throws(() => pagesProvenance(manifest, sources, 'f'.repeat(40)), /this CI checkout/);
  assert.throws(() => pagesProvenance(manifest, { ...sources, workingCopy: true }, commit), /working-copy artifact/);
});
