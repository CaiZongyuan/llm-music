import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const examples = fileURLToPath(new URL('../../../runtime/comfyui/examples/', import.meta.url));
const quote = value => `'${value.replaceAll("'", "''")}'`;
async function runExample(t, name, status, port) {
  const directory = await mkdtemp(join(tmpdir(), 'music-docs-example-'));
  const ownedDirectory = await realpath(directory);
  t.after(async () => { assert.equal(await realpath(directory), ownedDirectory); await rm(ownedDirectory, { recursive: true, force: true }); });
  await mkdir(join(directory, 'data'));
  await writeFile(join(directory, 'data/runtime-readiness.json'), 'ORIGINAL');
  const harness = join(directory, 'run.ps1');
  const invocations = (Array.isArray(name) ? name : [name]).map(file => `& ${quote(join(examples, file))}${port === undefined ? '' : ` -Port ${port}`}`).join('\n');
  await writeFile(harness, `$ErrorActionPreference = 'Stop'
Set-Location ${quote(directory)}
$global:FakeCalls = @()
function uv {
  $global:FakeArguments = $args
  $global:LASTEXITCODE = ${status}
  $portIndex = [Array]::IndexOf($args, '--port')
  $selectedPort = if ($portIndex -ge 0) { [int]$args[$portIndex + 1] } else { 8188 }
  $readinessIndex = [Array]::IndexOf($args, '--readiness-report')
  $readiness = if ($readinessIndex -ge 0) { (Get-Content -Raw -LiteralPath $args[$readinessIndex + 1]).ToString() } else { $null }
  $global:FakeCalls += [pscustomobject]@{ arguments = @($args); readiness = $readiness }
  [pscustomobject]@{ ready = $true; provider = 'isolated-fake'; port = $selectedPort } | ConvertTo-Json -Compress
}
$caught = $false
try {
${invocations}
} catch { $caught = $true }
[pscustomobject]@{ caught = $caught; arguments = $global:FakeArguments; calls = @($global:FakeCalls) } | ConvertTo-Json -Compress -Depth 6
`);
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

test('complete examples carry the selected port through checks, the saved receipt, launch, and transcription', async t => {
  for (const port of [undefined, 8189]) {
    const expectedPort = port ?? 8188;
    const names = ['doctor.ps1', 'save-readiness.ps1', 'start.ps1', 'transcribe.ps1'];
    const run = await runExample(t, names, 0, port);
    assert.equal(run.result.caught, false, `complete chain port ${expectedPort}`);
    assert.equal(run.result.calls.length, names.length);
    for (const [callIndex, name] of names.entries()) {
      const argumentsList = run.result.calls[callIndex].arguments;
      const option = name === 'transcribe.ps1' ? '--base-url' : '--port';
      const index = argumentsList.indexOf(option);
      assert.ok(index >= 0, `${name} must provide ${option}`);
      assert.equal(String(argumentsList[index + 1]), name === 'transcribe.ps1' ? `http://127.0.0.1:${expectedPort}` : String(expectedPort));
      if (name === 'save-readiness.ps1') assert.equal(JSON.parse(run.receipt.replace(/^\uFEFF/, '')).port, expectedPort);
    }
    assert.equal(JSON.parse(run.result.calls[3].readiness.replace(/^\uFEFF/, '')).port, expectedPort);
  }
});

test('invalid selected ports are rejected before invoking any Runtime command or replacing a receipt', async t => {
  for (const port of [0, 65536]) for (const name of ['doctor.ps1', 'save-readiness.ps1', 'start.ps1', 'transcribe.ps1']) {
    const run = await runExample(t, name, 0, port);
    assert.equal(run.result.caught, true, `${name} port ${port}`);
    assert.equal(run.result.arguments, null, `${name} must not invoke uv`);
    assert.equal(run.receipt, 'ORIGINAL', name);
  }
});
