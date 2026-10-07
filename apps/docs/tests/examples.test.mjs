import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const examples = fileURLToPath(new URL('../../../runtime/comfyui/examples/', import.meta.url));
const quote = value => `'${value.replaceAll("'", "''")}'`;
async function runExample(t, name, status) {
  const directory = await mkdtemp(join(tmpdir(), 'music-docs-example-'));
  const ownedDirectory = await realpath(directory);
  t.after(async () => { assert.equal(await realpath(directory), ownedDirectory); await rm(ownedDirectory, { recursive: true, force: true }); });
  await mkdir(join(directory, 'data'));
  await writeFile(join(directory, 'data/runtime-readiness.json'), 'ORIGINAL');
  const harness = join(directory, 'run.ps1');
  await writeFile(harness, `$ErrorActionPreference = 'Stop'\nSet-Location ${quote(directory)}\nfunction uv { $global:FakeArguments = $args; $global:LASTEXITCODE = ${status}; Write-Output '{"ready":true,"provider":"isolated-fake"}' }\n$caught = $false\ntry { & ${quote(join(examples, name))} } catch { $caught = $true }\n[pscustomobject]@{ caught = $caught; arguments = $global:FakeArguments } | ConvertTo-Json -Compress\n`);
  const output = execFileSync(process.platform === 'win32' ? 'powershell.exe' : 'pwsh', ['-NoProfile', '-NonInteractive', '-File', harness], { encoding: 'utf8', windowsHide: true });
  return { result: JSON.parse(output.trim().split(/\r?\n/).at(-1)), receipt: await readFile(join(directory, 'data/runtime-readiness.json'), 'utf8') };
}

test('readiness example preserves an earlier receipt on failure and saves only successful output', async t => {
  const rejected = await runExample(t, 'save-readiness.ps1', 1);
  assert.equal(rejected.result.caught, true);
  assert.equal(rejected.receipt, 'ORIGINAL');
  const accepted = await runExample(t, 'save-readiness.ps1', 0);
  assert.equal(accepted.result.caught, false);
  assert.equal(JSON.parse(accepted.receipt.replace(/^\uFEFF/, '')).provider, 'isolated-fake');
  assert.ok(accepted.result.arguments.includes('doctor'));
  assert.ok(accepted.result.arguments.includes('--json'));
});

test('all other complete examples propagate command failures without reporting success', async t => {
  for (const name of ['prepare.ps1', 'download-models.ps1', 'doctor.ps1', 'start.ps1', 'transcribe.ps1']) {
    const run = await runExample(t, name, 1);
    assert.equal(run.result.caught, true, name);
    assert.equal(run.receipt, 'ORIGINAL', name);
    assert.equal(run.result.arguments[0], 'run', name);
  }
});
