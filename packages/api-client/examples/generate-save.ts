import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { createMusicClient, type GenerateCreate } from '../src/index.js';

const { values } = parseArgs({ options: {
  'base-url': { type: 'string', default: 'http://127.0.0.1:8000' },
  'output-dir': { type: 'string' },
  'expect-mode': { type: 'string', default: 'fake' },
} });
if (!values['output-dir'] || !['fake', 'comfyui'].includes(values['expect-mode'])) {
  throw new Error('Pass a new --output-dir and --expect-mode fake|comfyui');
}
const output = resolve(values['output-dir']);
await mkdir(dirname(output), { recursive: true });
await mkdir(output); // Retain previous attempts; never overwrite or automatically resubmit.
const client = createMusicClient({ baseUrl: values['base-url'], fetch: request => fetch(request, {
  signal: AbortSignal.any([request.signal, AbortSignal.timeout(15_000)]),
}) });
function read<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (!result.response.ok || result.data === undefined) {
    throw new Error(`HTTP ${result.response.status}: ${JSON.stringify(result.error)}`);
  }
  return result.data;
}
const input: GenerateCreate = {
  style: 'gentle folk pop, warm acoustic guitar, soft female vocal, relaxed tempo',
  lyrics: '[verse]\nMorning gathers on the window\nI follow sunlight down the street',
  seed: 2026192201, max_seconds: 35,
};
if (!Number.isSafeInteger(input.seed)) throw new Error('Choose a nonnegative safe integer seed');
const journal: Record<string, unknown> = { baseUrl: values['base-url'], input, expectedMode: values['expect-mode'] };
const record = () => writeFile(resolve(output, 'receipt.json'), `${JSON.stringify(journal, null, 2)}\n`);
await record();
try {
  const health = read(await client.GET('/health'));
  if (health.runtime.mode !== values['expect-mode'] || !health.runtime.ready) {
    throw new Error(`Runtime mode/readiness differs: ${JSON.stringify(health.runtime)}`);
  }
  journal.scope = health.runtime.mode === 'fake' ? 'CPU test tone; no model inference or music quality claim' : 'Application API to owned real Runtime';
  const project = read(await client.POST('/projects', { body: { name: 'Morning song client example' } }));
  journal.project = project; await record();
  const params = { path: { project_id: project.id } };
  const submitted = read(await client.POST('/projects/{project_id}/jobs/generate', { params, body: input }));
  journal.submitted = submitted; await record();
  const deadline = Date.now() + 1_800_000;
  let job = submitted;
  while (job.status === 'queued' || job.status === 'running') {
    if (Date.now() >= deadline) throw new Error(`Wait expired. Read the existing Job ${job.id} before a new attempt`);
    await delay(200);
    job = read(await client.GET('/projects/{project_id}/jobs/{job_id}', {
      params: { path: { project_id: project.id, job_id: submitted.id } },
    }));
  }
  journal.job = job; await record();
  const candidateId = job.result?.candidate_id;
  if (job.status !== 'completed' || !candidateId) throw new Error(`Job failed: ${JSON.stringify(job.error)}`);
  const candidate = read(await client.GET('/projects/{project_id}/candidates/{candidate_id}', {
    params: { path: { project_id: project.id, candidate_id: candidateId } },
  }));
  const score = read(await client.GET('/projects/{project_id}/scores/{score_id}', {
    params: { path: { project_id: project.id, score_id: candidate.score_id } },
  }));
  for (const [role, id] of [['song', candidate.audio_asset_id], ['score', score.abc_asset_id]]) {
    if (!id) throw new Error(`Missing ${role} Asset`);
    const params = { path: { project_id: project.id, asset_id: id } };
    const asset = read(await client.GET('/projects/{project_id}/assets/{asset_id}', { params }));
    const bytes = read(await client.GET('/projects/{project_id}/assets/{asset_id}/content', { params, parseAs: 'arrayBuffer' }));
    const hash = createHash('sha256').update(new Uint8Array(bytes)).digest('hex');
    if (hash !== asset.sha256 || bytes.byteLength !== asset.size_bytes) throw new Error(`Asset bytes differ: ${id}`);
    await writeFile(resolve(output, `${role}.${asset.format}`), new Uint8Array(bytes), { flag: 'wx' });
  }
  // This executable example explicitly chooses and saves its inspected Candidate.
  const version = read(await client.POST('/projects/{project_id}/versions', {
    params, body: { candidate_id: candidate.id, name: 'Selected morning client example' },
  }));
  journal.candidate = candidate; journal.version = version; await record();
  process.stdout.write(`${JSON.stringify({ projectId: project.id, jobId: job.id, candidateId, versionId: version.id, output, scope: journal.scope })}\n`);
} catch (error) {
  journal.failure = String(error); await record();
  throw error;
}
