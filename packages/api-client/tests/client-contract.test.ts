import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { jobEventsUrl, type GenerateCreate, type GenerateFromScoreCreate, type JobRead } from '../src/index.js';
import { dataOf, events, referenceWav, sha256, startApi, terminal, waitFor, type OwnedApi } from './support.js';

const generation: GenerateCreate = {
  style: 'gentle folk pop, warm acoustic guitar', lyrics: '[verse]\nMorning gathers on the window',
  seed: 2026271001, max_seconds: 35,
};

async function inspectAsset(api: OwnedApi, projectId: string, assetId: string) {
  const params = { path: { project_id: projectId, asset_id: assetId } };
  const asset = dataOf(await api.client.GET('/projects/{project_id}/assets/{asset_id}', { params }));
  const download = await api.client.GET('/projects/{project_id}/assets/{asset_id}/content', { params, parseAs: 'arrayBuffer' });
  const bytes = dataOf(download);
  assert.equal(bytes.byteLength, asset.size_bytes);
  assert.equal(sha256(bytes), asset.sha256);
  assert.equal(download.response.headers.get('content-type')?.split(';')[0], asset.media_type);
  return { asset, sha256: asset.sha256, bytes };
}

function resultId(job: JobRead, role: string): string {
  const id = job.result?.[role];
  assert.ok(id, `Completed Job lacks ${role}`);
  return id;
}

test('generated client submits selected native ABC and retains its source parent on explicit save', async () => {
  const api = await startApi();
  try {
    const project = dataOf(await api.client.POST('/projects', { body: { name: 'Selected morning melody' } }), 201);
    const projectPath = { project_id: project.id };
    const first = dataOf(await api.client.POST('/projects/{project_id}/jobs/generate', {
      params: { path: projectPath }, body: { ...generation, seed: 2026411001 },
    }), 202);
    const planned = await terminal(api, project.id, first.id);
    assert.equal(planned.status, 'completed');
    const parent = dataOf(await api.client.POST('/projects/{project_id}/versions', {
      params: { path: projectPath }, body: { candidate_id: resultId(planned, 'candidate_id'), name: 'Original melody' },
    }), 201);
    const original = await inspectAsset(api, project.id, resultId(planned, 'abc_asset_id'));
    const abc = Buffer.from(original.bytes).toString().replace('D4', 'F4');
    const selected: GenerateFromScoreCreate = {
      ...generation, seed: 2026411002, abc, source_score_id: parent.score_id, parent_version_id: parent.id,
    };
    const response = dataOf(await api.client.POST('/projects/{project_id}/jobs/generate-from-score', {
      params: { path: projectPath }, body: selected,
    }), 202);
    const subscription = await events(api, project.id, response.id);
    const job = await terminal(api, project.id, response.id);
    assert.equal(job.status, 'completed');
    assert.equal(job.operation, 'GenerateFromScore');
    assert.deepEqual(job.inputs, selected);
    await waitFor(() => subscription.messages, values => values.some(value => value.job.status === 'completed'), 'selected Score completion event');
    subscription.socket.close(); await subscription.closed;
    const candidate = dataOf(await api.client.GET('/projects/{project_id}/candidates/{candidate_id}', {
      params: { path: { ...projectPath, candidate_id: resultId(job, 'candidate_id') } },
    }));
    assert.deepEqual(candidate.inputs, selected);
    assert.equal(Buffer.from((await inspectAsset(api, project.id, resultId(job, 'abc_asset_id'))).bytes).toString(), abc.trim());
    assert.deepEqual(dataOf(await api.client.GET('/projects/{project_id}/versions', { params: { path: projectPath } })), [parent]);
    const saved = dataOf(await api.client.POST('/projects/{project_id}/versions', {
      params: { path: projectPath }, body: { candidate_id: candidate.id, name: 'Selected melody' },
    }), 201);
    assert.equal(saved.parent_version_id, parent.id);
    assert.deepEqual(saved.inputs, selected);
    assert.equal((await inspectAsset(api, project.id, original.asset.id)).sha256, original.sha256);
  } finally { await api.stop(); }
});

test('native Node multipart, HTTP and WebSocket complete both loops and reopen selected data', async () => {
  const api = await startApi();
  let reopen: OwnedApi | undefined;
  try {
    const project = dataOf(await api.client.POST('/projects', { body: { name: 'Client morning song' } }), 201);
    const projectPath = { project_id: project.id };
    const original = referenceWav();
    const reference = dataOf(await api.client.POST('/projects/{project_id}/assets', {
      params: { path: projectPath }, body: { file: new File([original], 'reference.wav', { type: 'audio/wav' }) },
      bodySerializer: body => { const form = new FormData(); form.append('file', body.file); return form; },
    }), 201);
    assert.equal(reference.sha256, sha256(original));
    assert.equal(reference.duration_seconds, 16);
    assert.equal(reference.sample_rate, 24_000);
    assert.equal(reference.channels, 1);
    const submitted = dataOf(await api.client.POST('/projects/{project_id}/jobs/generate', {
      params: { path: projectPath }, body: generation,
    }), 202);
    const live = await events(api, project.id, submitted.id);
    await waitFor(() => live.messages, values => values.some(value => value.job.status === 'running'), 'running Generate event');
    const transcription = dataOf(await api.client.POST('/projects/{project_id}/transcriptions', {
      params: { path: projectPath }, body: { reference_asset_id: reference.id },
    }), 202);
    const diagnostics = dataOf(await api.client.GET('/runtime/diagnostics'));
    assert.equal(diagnostics.application_queue.running, 1);
    assert.equal(diagnostics.application_queue.queued, 1);
    assert.equal(diagnostics.application_queue.recorded_running_job.value, submitted.id);
    assert.deepEqual(new Set(diagnostics.application_queue.jobs.map(job => job.id)), new Set([submitted.id, transcription.id]));
    assert.ok(diagnostics.application_queue.jobs.every(job => job.project_id === project.id));
    assert.equal(diagnostics.native_queue_occupancy.availability, 'unavailable');
    for (const message of live.messages) {
      assert.equal(message.type, 'job.updated');
      assert.ok(Number.isInteger(message.sequence) && message.sequence >= 0);
      assert.equal(message.job.id, submitted.id);
      assert.equal(message.job.progress, null);
      assert.equal(message.job.project_id, project.id);
      assert.ok(!/prompt_id|node_id|runtime_handle/.test(JSON.stringify(message)));
    }
    live.socket.close(); await live.closed;
    await api.release('release-generate');
    const generated = await terminal(api, project.id, submitted.id);
    assert.equal(generated.status, 'completed');
    const resumed = await events(api, project.id, generated.id);
    await resumed.closed;
    assert.deepEqual(resumed.messages[0]?.job, generated);
    const candidate = dataOf(await api.client.GET('/projects/{project_id}/candidates/{candidate_id}', {
      params: { path: { ...projectPath, candidate_id: resultId(generated, 'candidate_id') } },
    }));
    assert.equal(candidate.job_id, generated.id);
    assert.deepEqual(candidate.inputs, generation);
    assert.deepEqual(dataOf(await api.client.GET('/projects/{project_id}/versions', { params: { path: projectPath } })), []);
    const song = await inspectAsset(api, project.id, candidate.audio_asset_id);
    assert.equal(song.asset.kind, 'generated_audio');
    assert.equal(song.asset.format, 'flac');
    assert.equal(Buffer.from(song.bytes).subarray(0, 4).toString(), 'fLaC');
    assert.ok(song.asset.duration_seconds !== null && song.asset.duration_seconds !== undefined && Math.abs(song.asset.duration_seconds - 35) < 0.01);
    const generatedScore = dataOf(await api.client.GET('/projects/{project_id}/scores/{score_id}', {
      params: { path: { ...projectPath, score_id: candidate.score_id } },
    }));
    assert.equal(generatedScore.job_id, generated.id);
    const planned = await inspectAsset(api, project.id, generatedScore.abc_asset_id);
    assert.equal(planned.asset.format, 'abc');
    assert.match(Buffer.from(planned.bytes).toString(), /K:C/);
    const save = { candidate_id: candidate.id, name: 'Selected morning' };
    const version = dataOf(await api.client.POST('/projects/{project_id}/versions', { params: { path: projectPath }, body: save }), 201);
    assert.deepEqual(dataOf(await api.client.POST('/projects/{project_id}/versions', { params: { path: projectPath }, body: save })), version);
    assert.equal(version.candidate_id, candidate.id);

    const transcribing = await events(api, project.id, transcription.id);
    await waitFor(() => transcribing.messages, values => values.some(value => value.job.status === 'running'), 'running Transcribe event');
    transcribing.socket.close(); await transcribing.closed;
    await api.release('release-transcribe');
    const transcribed = await terminal(api, project.id, transcription.id);
    assert.equal(transcribed.status, 'completed');
    const transcribedEvents = await events(api, project.id, transcription.id);
    await transcribedEvents.closed;
    assert.deepEqual(transcribedEvents.messages[0]?.job, transcribed);
    const score = dataOf(await api.client.GET('/projects/{project_id}/scores/{score_id}', {
      params: { path: { ...projectPath, score_id: resultId(transcribed, 'score_id') } },
    }));
    assert.equal(score.source_reference_asset_id, reference.id);
    assert.equal(score.job_id, transcribed.id);
    assert.equal(score.abc_asset_id, resultId(transcribed, 'abc_asset_id'));
    const abc = await inspectAsset(api, project.id, score.abc_asset_id);
    const midi = await inspectAsset(api, project.id, resultId(transcribed, 'midi_asset_id'));
    assert.equal(abc.asset.media_type, 'text/vnd.abc');
    assert.match(Buffer.from(abc.bytes).toString(), /C4 D4 E4 F4/);
    assert.equal(midi.asset.media_type, 'audio/midi');
    assert.equal(Buffer.from(midi.bytes).subarray(0, 4).toString(), 'MThd');
    const assets = dataOf(await api.client.GET('/projects/{project_id}/assets', { params: { path: projectPath } }));
    const jobs = dataOf(await api.client.GET('/projects/{project_id}/jobs', { params: { path: projectPath } }));
    assert.equal(assets.length, 5);
    assert.equal(jobs.length, 2);
    assert.equal(dataOf(await api.client.GET('/projects/{project_id}/scores', { params: { path: projectPath } })).length, 2);
    await writeFile(resolve(api.dir, 'consumer.json'), JSON.stringify({ scope: 'Node + production API + CPU Fake Runtime; no music inference',
      project, reference, generated, transcribed, candidate, version, assets }, null, 2));
    await api.stop();
    reopen = await startApi({ dataDir: api.dataDir });
    assert.deepEqual(dataOf(await reopen.client.GET('/projects/{project_id}', { params: { path: projectPath } })), project);
    assert.deepEqual(dataOf(await reopen.client.GET('/projects/{project_id}/jobs', { params: { path: projectPath } })), jobs);
    assert.deepEqual(dataOf(await reopen.client.GET('/projects/{project_id}/versions', { params: { path: projectPath } })), [version]);
    assert.deepEqual(dataOf(await reopen.client.GET('/projects/{project_id}/assets', { params: { path: projectPath } })), assets);
    for (const asset of assets) assert.equal((await inspectAsset(reopen, project.id, asset.id)).sha256, asset.sha256);
    assert.equal((await inspectAsset(reopen, project.id, reference.id)).sha256, sha256(original));
  } finally {
    await api.stop();
    await reopen?.stop();
  }
});

test('bodyless cancel and explicit retry retain original Jobs and expose errors', async () => {
  const api = await startApi();
  try {
    const project = dataOf(await api.client.POST('/projects', { body: { name: 'Cancellation morning' } }), 201);
    const projectPath = { project_id: project.id };
    const foreign = dataOf(await api.client.POST('/projects', { body: { name: 'Other song' } }), 201);
    const submitted = dataOf(await api.client.POST('/projects/{project_id}/jobs/generate', {
      params: { path: projectPath }, body: { ...generation, seed: 2026271002 },
    }), 202);
    const jobPath = { ...projectPath, job_id: submitted.id };
    await waitFor(async () => dataOf(await api.client.GET('/projects/{project_id}/jobs/{job_id}', { params: { path: jobPath } })),
      job => job.status === 'running', 'owned active cancellation target');
    const queued = dataOf(await api.client.POST('/projects/{project_id}/jobs/generate', {
      params: { path: projectPath }, body: { ...generation, seed: 2026271004 },
    }), 202);
    assert.equal(queued.status, 'queued');
    const queuedPath = { ...projectPath, job_id: queued.id };
    const queuedCancelled = dataOf(await api.client.POST('/projects/{project_id}/jobs/{job_id}/cancel', { params: { path: queuedPath } }));
    assert.equal(queuedCancelled.status, 'cancelled');
    const foreignCancel = await api.client.POST('/projects/{project_id}/jobs/{job_id}/cancel', {
      params: { path: { project_id: foreign.id, job_id: submitted.id } },
    });
    assert.equal(foreignCancel.response.status, 404);
    assert.equal(foreignCancel.error?.error.code, 'job_not_found');
    assert.equal(dataOf(await api.client.GET('/projects/{project_id}/jobs/{job_id}', { params: { path: jobPath } })).cancel_requested, false);
    const intent = dataOf(await api.client.POST('/projects/{project_id}/jobs/{job_id}/cancel', { params: { path: jobPath } }), 202);
    assert.equal(intent.cancel_requested, true);
    assert.equal(intent.status, 'running');
    await api.release('confirm-cancel');
    const cancelled = await terminal(api, project.id, submitted.id);
    assert.equal(cancelled.status, 'cancelled');
    assert.equal(cancelled.result, null);
    await api.release('release-cancel');
    const retry = dataOf(await api.client.POST('/projects/{project_id}/jobs/{job_id}/retry', { params: { path: jobPath } }), 202);
    assert.notEqual(retry.id, cancelled.id);
    assert.deepEqual(retry.inputs, cancelled.inputs);
    assert.equal(retry.provenance.retry_of_job_id, cancelled.id);
    const retried = await terminal(api, project.id, retry.id);
    assert.equal(retried.status, 'completed');
    assert.deepEqual(dataOf(await api.client.GET('/projects/{project_id}/jobs/{job_id}', { params: { path: jobPath } })), cancelled);
    const forbiddenRetry = await api.client.POST('/projects/{project_id}/jobs/{job_id}/retry', {
      params: { path: { ...projectPath, job_id: retry.id } },
    });
    assert.equal(forbiddenRetry.response.status, 409);
    assert.equal(forbiddenRetry.error?.error.code, 'job_not_retryable');
    const failing = dataOf(await api.client.POST('/projects/{project_id}/jobs/generate', {
      params: { path: projectPath }, body: { ...generation, seed: 2026271003 },
    }), 202);
    const failed = await terminal(api, project.id, failing.id);
    assert.equal(failed.status, 'failed');
    assert.equal(failed.error?.code, 'generation_failed');
    assert.ok(!JSON.stringify(failed).includes('Private CPU'));
    const failedPath = { ...projectPath, job_id: failed.id };
    const recover = dataOf(await api.client.POST('/projects/{project_id}/jobs/{job_id}/retry', { params: { path: failedPath } }), 202);
    assert.equal((await terminal(api, project.id, recover.id)).status, 'completed');
    assert.deepEqual(dataOf(await api.client.GET('/projects/{project_id}/jobs/{job_id}', { params: { path: failedPath } })), failed);
    assert.deepEqual(dataOf(await api.client.GET('/projects/{project_id}/versions', { params: { path: projectPath } })), []);
    assert.ok(api.requests.length >= 6);
    for (const request of api.requests) {
      assert.equal(request.bytes, 0, request.path);
      assert.equal(request.contentType, null, request.path);
    }
    await writeFile(resolve(api.dir, 'consumer.json'), JSON.stringify({ scope: 'CPU cancellation/failure fixtures',
      project, queuedCancelled, cancelled, retry: retried, failed, recovered: recover, bodylessRequests: api.requests }, null, 2));
  } finally { await api.stop(); }
});

test('CPU leaf cleanup refuses a changed identity and stops only the verified owned process', async t => {
  const api = await startApi();
  t.after(() => api.stop());
  const ownerPath = resolve(api.dir, 'owner.json');
  const original = await readFile(ownerPath, 'utf8');
  const owner = JSON.parse(original);
  try {
    await writeFile(ownerPath, JSON.stringify({ ...owner, process_created_at: owner.process_created_at + 1 }));
    const refused = api.stopOwnerProbe();
    assert.notEqual(refused.status, 0);
    assert.match(refused.stderr, /process identity differs/);
    assert.equal(dataOf(await api.client.GET('/health')).backend.status, 'ready');
  } finally { await writeFile(ownerPath, original); }
  const stopped = api.stopOwnerProbe();
  assert.equal(stopped.status, 0, stopped.stderr);
  const receipt = JSON.parse(await readFile(resolve(api.dir, 'forced-stop.json'), 'utf8'));
  assert.equal(receipt.identity_verified, true);
  assert.equal(receipt.pid, owner.pid);
  assert.equal(receipt.process_created_at, owner.process_created_at);
  await assert.rejects(api.stop(), /Owned API exit failure/);
});

test('diagnostics, multipart validation and binary failures remain typed JSON', async () => {
  const api = await startApi({ unavailable: true });
  try {
    const project = dataOf(await api.client.POST('/projects', { body: { name: 'Unavailable morning' } }), 201);
    const projectPath = { project_id: project.id };
    const health = dataOf(await api.client.GET('/health'));
    assert.equal(health.backend.status, 'ready');
    assert.equal(health.runtime.mode, 'fake');
    assert.equal(health.runtime.ready, false);
    assert.equal(health.runtime.status, 'unavailable');
    assert.ok(health.runtime.reasons.some(reason => reason.code === 'runtime_unavailable'));
    const models = dataOf(await api.client.GET('/runtime/models'));
    assert.deepEqual(new Set(models.models.map(model => model.id)), new Set(['yue2-bf16', 'sheetsage2-bf16']));
    assert.ok(models.models.every(model => model.state === 'unavailable' && model.observation.freshness === 'unavailable'));
    const capabilities = dataOf(await api.client.GET('/runtime/capabilities'));
    assert.ok(capabilities.capabilities.every(capability => !capability.ready));
    const metadata = dataOf(await api.client.GET('/settings/metadata'));
    assert.equal(metadata.source, 'music_api.config.Settings.model_json_schema');
    const invalid = await api.client.POST('/projects/{project_id}/jobs/generate', {
      params: { path: projectPath }, body: { ...generation, seed: -1 },
    });
    assert.equal(invalid.response.status, 422);
    assert.equal(invalid.error?.error.code, 'invalid_request');
    const unavailable = await api.client.POST('/projects/{project_id}/jobs/generate', {
      params: { path: projectPath }, body: { ...generation, seed: Number.MAX_SAFE_INTEGER },
    });
    assert.equal(unavailable.response.status, 503);
    assert.equal(unavailable.error?.error.code, 'runtime_unavailable');
    const rejectedUpload = await api.client.POST('/projects/{project_id}/assets', {
      params: { path: projectPath }, body: { file: new File(['invalid WAV'], 'invalid.wav', { type: 'audio/wav' }) },
      bodySerializer: body => { const form = new FormData(); form.append('file', body.file); return form; },
    });
    assert.equal(rejectedUpload.response.status, 422);
    assert.ok(rejectedUpload.error?.error.recovery);
    const contentFailure = await api.client.GET('/projects/{project_id}/assets/{asset_id}/content', {
      params: { path: { ...projectPath, asset_id: '00000000-0000-4000-8000-000000000001' } }, parseAs: 'arrayBuffer',
    });
    assert.equal(contentFailure.response.status, 404);
    assert.equal(contentFailure.error?.error.code, 'asset_not_found');
    assert.ok(contentFailure.error?.error.recovery);
    assert.equal(contentFailure.data, undefined);
    assert.match(contentFailure.response.headers.get('content-type') ?? '', /application\/json/);
    assert.deepEqual(dataOf(await api.client.GET('/projects/{project_id}/jobs', { params: { path: projectPath } })), []);
    assert.deepEqual(dataOf(await api.client.GET('/projects/{project_id}/assets', { params: { path: projectPath } })), []);
    await writeFile(resolve(api.dir, 'consumer.json'), JSON.stringify({ scope: 'CPU unavailable fixture; real business responses',
      health, models, capabilities, invalid: invalid.error, unavailable: unavailable.error,
      binaryError: contentFailure.error, uploadError: rejectedUpload.error }, null, 2));
  } finally { await api.stop(); }
});

test('Job event URL preserves deployment prefixes and rejects a foreign Job upgrade', async () => {
  assert.equal(jobEventsUrl('https://example.test/music-api/', 'project', 'job').href,
    'wss://example.test/music-api/projects/project/jobs/job/events');
  assert.throws(() => jobEventsUrl('file:///tmp/api', 'project', 'job'), TypeError);
  const api = await startApi();
  try {
    const project = dataOf(await api.client.POST('/projects', { body: { name: 'Socket ownership' } }), 201);
    const foreign = dataOf(await api.client.POST('/projects', { body: { name: 'Foreign socket' } }), 201);
    const job = dataOf(await api.client.POST('/projects/{project_id}/jobs/generate', {
      params: { path: { project_id: project.id } }, body: { ...generation, seed: 2026271010 },
    }), 202);
    const wrongOwner = await api.client.GET('/projects/{project_id}/jobs/{job_id}', {
      params: { path: { project_id: foreign.id, job_id: job.id } },
    });
    assert.equal(wrongOwner.response.status, 404);
    assert.equal(wrongOwner.error?.error.code, 'job_not_found');
    const socket = new WebSocket(jobEventsUrl(api.baseUrl, foreign.id, job.id));
    let errors = 0, opened = false;
    socket.addEventListener('open', () => { opened = true; });
    socket.addEventListener('error', () => { errors++; });
    const result = await waitFor(() => ({ errors, opened }), value => value.errors > 0 || value.opened,
      'foreign Job WebSocket upgrade outcome');
    assert.equal(result.opened, false);
    assert.ok(result.errors > 0);
    assert.match(await readFile(resolve(api.dir, 'api.log'), 'utf8'), /403/);
    const exampleOutput = resolve(api.dir, 'example');
    const example = execFileSync(process.execPath, [fileURLToPath(new URL('../examples/generate-save.js', import.meta.url)),
      '--base-url', api.baseUrl, '--expect-mode', 'fake', '--output-dir', exampleOutput], {
      encoding: 'utf8', timeout: 30_000, windowsHide: true,
    });
    const receipt = JSON.parse(await readFile(resolve(exampleOutput, 'receipt.json'), 'utf8'));
    const summary = JSON.parse(example);
    assert.equal(summary.scope, 'CPU test tone; no model inference or music quality claim');
    assert.equal(summary.versionId, receipt.version.id);
    assert.equal(sha256(await readFile(resolve(exampleOutput, 'song.flac'))),
      (await inspectAsset(api, summary.projectId, receipt.candidate.audio_asset_id)).sha256);
    const versions = dataOf(await api.client.GET('/projects/{project_id}/versions', {
      params: { path: { project_id: summary.projectId } },
    }));
    assert.deepEqual(versions, [receipt.version]);
  } finally { await api.stop(); }
});
