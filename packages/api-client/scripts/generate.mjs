import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import openapiTS, { astToString } from 'openapi-typescript';
import ts from 'typescript';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const destination = new URL('../src/schema.ts', import.meta.url);
const temporaryRoot = resolve(tmpdir());
const temporary = await mkdtemp(resolve(temporaryRoot, 'llm-music-client-contract-'));
assert.equal(dirname(temporary), temporaryRoot, 'Temporary cleanup must stay in its owned directory');
const check = process.argv.includes('--check');

async function generate(name) {
  const output = resolve(temporary, `${name}.json`);
  const command = spawnSync('uv', [
    'run', '--project', resolve(root, 'services/api'), '--no-sync', 'python', '-m', 'music_api',
    'openapi', '--data-dir', resolve(temporary, `${name}-absent-data`), '--output', output,
  ], { cwd: root, encoding: 'utf8', timeout: 30_000, env: { ...process.env, MUSIC_API_RUNTIME_MODE: 'fake' } });
  assert.equal(command.status, 0, command.error?.message ?? command.stderr);
  const document = JSON.parse(await readFile(output, 'utf8'));
  const websockets = Object.entries(document['x-websockets']);
  assert.equal(websockets.length, 1, 'One registered Job event channel is required');
  const [path, payload] = websockets[0];
  assert.equal(payload.message.$ref, '#/components/schemas/JobEventRead');
  const multipartSchemas = Object.values(document.paths).flatMap(route => Object.values(route))
    .map(operation => operation.requestBody?.content?.['multipart/form-data']?.schema?.$ref)
    .filter(Boolean);
  let binaryInputs = 0;
  const ast = await openapiTS(document, {
    defaultNonNullable: false,
    transform(schema, metadata) {
      if (schema.format === 'binary' || schema.contentMediaType === 'application/octet-stream') {
        // HTTP downloads are read with parseAs; multipart input is a native Blob/File.
        if (multipartSchemas.some(ref => metadata.path.startsWith(ref))) {
          binaryInputs++;
          return ts.factory.createTypeReferenceNode('Blob');
        }
      }
    },
  });
  assert.ok(binaryInputs > 0, 'The registered multipart file input must map to Blob');
  return `// Generated from music-api openapi. Run pnpm client:generate; do not edit.\n${astToString(ast)}\n`
    + `export const jobEventsPath = ${JSON.stringify(path)} as const;\n`;
}

try {
  const generated = await generate('first');
  if (check) {
    assert.equal(await generate('second'), generated, 'Two isolated exports must generate identical types');
    assert.equal((await readFile(destination, 'utf8')).replaceAll('\r\n', '\n'), generated,
      'Client contract is stale. Run pnpm client:generate and review the change.');
    process.stdout.write('Two CPU exports and the checked-in client agree.\n');
  } else {
    await mkdir(new URL('../src/', import.meta.url), { recursive: true });
    await writeFile(destination, generated);
    process.stdout.write('Generated client schema from the CPU API.\n');
  }
  await rm(temporary, { recursive: true, force: true });
} catch (error) {
  process.stderr.write(`Contract generation evidence retained at ${temporary}\n`);
  throw error;
}
