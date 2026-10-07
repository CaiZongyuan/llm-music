import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { createMusicClient, jobEventsUrl, type JobEventRead, type JobRead } from '../src/index.js';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const artifactRoot = resolve(process.env.MUSIC_CLIENT_ARTIFACTS ?? resolve(root, 'packages/api-client/.artifacts'));

export function dataOf<T>(result: { data?: T; error?: unknown; response: Response }, status = 200): T {
  assert.equal(result.response.status, status, JSON.stringify(result.error));
  if (result.data === undefined) throw new Error(`Response has no data: ${JSON.stringify(result.error)}`);
  return result.data;
}

export async function waitFor<T>(read: () => Promise<T> | T, ready: (value: T) => boolean, description: string): Promise<T> {
  const deadline = Date.now() + 15_000;
  while (true) {
    const value = await read();
    if (ready(value)) return value;
    assert.ok(Date.now() < deadline, `Timed out: ${description}; last value ${JSON.stringify(value)}`);
    await delay(20);
  }
}

export async function startApi(options: { dataDir?: string; unavailable?: boolean } = {}) {
  await mkdir(artifactRoot, { recursive: true });
  const dir = await mkdtemp(resolve(artifactRoot, 'client-run-'));
  const dataDir = options.dataDir ?? resolve(dir, 'application');
  const interpreter = spawnSync('uv', ['run', '--project', resolve(root, 'services/api'), '--no-sync', 'python',
    '-c', 'import sys; print(sys.executable)'], { cwd: root, encoding: 'utf8', timeout: 30_000 });
  assert.equal(interpreter.status, 0, interpreter.error?.message ?? interpreter.stderr);
  const output = createWriteStream(resolve(dir, 'process.log'));
  const child = spawn(interpreter.stdout.trim(), [resolve(root, 'packages/api-client/tests/run_api.py'),
    '--run-dir', dir, '--data-dir', dataDir, ...(options.unavailable ? ['--unavailable'] : [])], {
    cwd: root, env: { ...process.env, MUSIC_CLIENT_ARTIFACTS: artifactRoot }, stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  child.stdout.pipe(output, { end: false });
  child.stderr.pipe(output, { end: false });
  const exited = new Promise<number | null>((fulfill, reject) => {
    child.once('exit', fulfill);
    child.once('error', reject);
  });
  let stopped = false;
  async function stop() {
    if (stopped) return;
    stopped = true;
    await writeFile(resolve(dir, 'stop'), 'owned client stop\n');
    const graceful = await Promise.race([exited.then(code => ({ code })), delay(12_000, null, { ref: false })]);
    if (graceful === null) {
      // Windows venv python.exe can redirect to a distinct leaf. Verify the leaf receipt.
      const cleanup = spawnSync(interpreter.stdout.trim(), [resolve(root, 'packages/api-client/tests/run_api.py'), '--stop-owner', dir], {
        cwd: root, env: { ...process.env, MUSIC_CLIENT_ARTIFACTS: artifactRoot }, encoding: 'utf8', timeout: 15_000, windowsHide: true,
      });
      assert.equal(cleanup.status, 0, `Owned leaf cleanup refused: ${cleanup.stderr}; evidence: ${dir}`);
      await exited;
      output.end();
      throw new Error(`Owned API needed forced termination; evidence: ${dir}`);
    }
    output.end();
    assert.equal(graceful.code, 0, `Owned API exit failure; evidence: ${dir}`);
    const receipt = JSON.parse(await readFile(resolve(dir, 'stopped.json'), 'utf8'));
    assert.ok(receipt.pid === child.pid || receipt.parent_pid === child.pid, 'Stop receipt must identify the owned launcher or leaf');
    assert.equal(receipt.graceful, true, `Missing graceful API stop; evidence: ${dir}`);
  }
  try {
    const owner = await waitFor(async () => {
      assert.equal(child.exitCode, null, `API exited before readiness; evidence: ${dir}`);
      try { return JSON.parse(await readFile(resolve(dir, 'ready.json'), 'utf8')); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
    }, value => value !== null, 'owned CPU API readiness');
    assert.ok(owner.pid === child.pid || owner.parent_pid === child.pid, 'Ready receipt must identify the owned launcher or leaf');
    assert.equal(owner.runtime_mode, 'fake');
    assert.equal(owner.torch_installed, false);
    assert.notEqual(owner.port, 8188);
    const baseUrl = `http://127.0.0.1:${owner.port}`;
    const requests: { path: string; bytes: number; contentType: string | null }[] = [];
    const client = createMusicClient({ baseUrl, fetch: async request => {
      if (/\/(cancel|retry)$/.test(new URL(request.url).pathname)) {
        requests.push({ path: new URL(request.url).pathname, bytes: (await request.clone().arrayBuffer()).byteLength,
          contentType: request.headers.get('content-type') });
        await writeFile(resolve(dir, 'bodyless-requests.json'), `${JSON.stringify(requests, null, 2)}\n`);
      }
      return fetch(request, { signal: AbortSignal.any([request.signal, AbortSignal.timeout(15_000)]) });
    } });
    return { client, baseUrl, dir, dataDir, requests, stop,
      stopOwnerProbe: () => spawnSync(interpreter.stdout.trim(), [resolve(root, 'packages/api-client/tests/run_api.py'), '--stop-owner', dir], {
        cwd: root, env: { ...process.env, MUSIC_CLIENT_ARTIFACTS: artifactRoot }, encoding: 'utf8', timeout: 15_000, windowsHide: true,
      }),
      release: (gate: string) => writeFile(resolve(dir, gate), 'fixture gate\n') };
  } catch (error) {
    try { await stop(); } catch (stopError) { process.stderr.write(`${String(stopError)}\n`); }
    throw error;
  }
}

export type OwnedApi = Awaited<ReturnType<typeof startApi>>;

export function sha256(bytes: ArrayBuffer | Uint8Array): string {
  return createHash('sha256').update(bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes).digest('hex');
}

export function referenceWav(): Uint8Array<ArrayBuffer> {
  const frames = 24_000 * 16;
  const buffer = Buffer.alloc(44 + frames * 2);
  buffer.write('RIFF', 0); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(24_000, 24); buffer.writeUInt32LE(48_000, 28); buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34); buffer.write('data', 36); buffer.writeUInt32LE(frames * 2, 40);
  for (let index = 0; index < frames; index++) buffer.writeInt16LE(Math.round(4096 * Math.sin(2 * Math.PI * 440 * index / 24_000)), 44 + index * 2);
  return buffer;
}

export async function terminal(api: OwnedApi, projectId: string, jobId: string): Promise<JobRead> {
  return waitFor(async () => dataOf(await api.client.GET('/projects/{project_id}/jobs/{job_id}', {
    params: { path: { project_id: projectId, job_id: jobId } },
  })), job => ['completed', 'failed', 'cancelled'].includes(job.status), `terminal Job ${jobId}`);
}

export async function events(api: OwnedApi, projectId: string, jobId: string) {
  const messages: JobEventRead[] = [];
  const socket = new WebSocket(jobEventsUrl(api.baseUrl, projectId, jobId));
  const closed = new Promise<void>(fulfill => socket.addEventListener('close', () => fulfill(), { once: true }));
  let failed = false;
  socket.addEventListener('error', () => { failed = true; });
  socket.addEventListener('message', message => {
    // Tests compare these actual server messages with the complete typed HTTP snapshot.
    messages.push(JSON.parse(String(message.data)) as JobEventRead);
  });
  await waitFor(() => { assert.equal(failed, false, 'WebSocket upgrade failed'); return messages; },
    values => values.length > 0, 'initial persisted Job snapshot');
  return { socket, messages, closed };
}
