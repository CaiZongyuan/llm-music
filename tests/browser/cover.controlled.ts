import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import type { CoverCreate, JobRead, components } from '@llm-music/api-client';
import { hash, mediaState, runDir } from './generation-fixtures.js';
import { downloadMidi, expectMusic, inspectAudition, received } from './score-fixtures.js';
import { withParent } from './score-generation-fixtures.js';
import {
  EDITED_FULL, EDITED_MELODY, FULL_ABC, LYRICS, MELODY_ABC, NEXT_FULL, SEED, STYLE,
  abcBytes, assetBytes, completedJob, control, coverUrl, derivedSeed, expectedInput, expectReferenceWav,
  fillCover, generateCover, holdMountedOrigin, inspectAndSelect, labels, openCover, projectOnly,
  referencePath, selectCurrentMelody, selectMelody, transcribe, uploadedSeed, uploadReference, type Api,
} from './cover-fixtures.js';

test.beforeEach(async () => { await control({}); });

async function expectOutput(api: Api, projectId: string, jobId: string, candidateId: string, inputs: CoverCreate) {
  const path = { project_id: projectId };
  const job = received(await api.GET('/projects/{project_id}/jobs/{job_id}', { params: { path: { ...path, job_id: jobId } } }));
  const candidate = received(await api.GET('/projects/{project_id}/candidates/{candidate_id}', { params: { path: { ...path, candidate_id: candidateId } } }));
  expect(job).toMatchObject({ operation: 'Cover', status: 'completed', inputs });
  expect(candidate).toMatchObject({ job_id: jobId, inputs });
  expect(job.provenance).toMatchObject({
    selected_score: { source_score_id: inputs.source_score_id, parent_version_id: inputs.parent_version_id,
      mode: 'melody', effective_abc: EDITED_MELODY, effective_abc_sha256: hash(Buffer.from(EDITED_MELODY)),
      abc_sha256: hash(Buffer.from(EDITED_FULL)), mode_transform_version: '1.0.0' },
    cover_source: { reference_asset_id: inputs.reference_asset_id },
  });
  expect(candidate.provenance).toEqual(job.provenance);
  const score = received(await api.GET('/projects/{project_id}/scores/{score_id}', { params: { path: { ...path, score_id: candidate.score_id } } }));
  expect(score).toMatchObject({ source_reference_asset_id: inputs.reference_asset_id, source_score_id: inputs.source_score_id, parent_version_id: inputs.parent_version_id });
  expect(await abcBytes(api, projectId, score)).toBe(EDITED_MELODY);
  return { job, candidate, score };
}

async function recoverJob(page: Page, accepted: JobRead) {
  const recovery = page.locator('.submission-recovery');
  await recovery.getByRole('button', { name: 'Read project jobs', exact: true }).click();
  await recovery.getByRole('button').filter({ hasText: accepted.id }).click();
  await expect(page.locator('.cover-generation .job-monitor')).toHaveAttribute('data-job-id', accepted.id);
  await expect(page.locator('.cover-generation .candidate-detail .record-details code').filter({ hasText: accepted.id })).toHaveCount(1);
  return recovery;
}

// C01: create the Reference through the actual UI. Decode identity of source
// PCM is independently covered by API acceptance; here inspect the durable
// public origin, WAVE span and complete creator flow without a second decoder.
test('Version audio becomes a real first16s Reference and an explicitly saved melody child without changing V1', async ({ page, baseURL }, info) => {
  const { api, project, original, score: originalScore } = await withParent(baseURL);
  const path = { project_id: project.id };
  const oldAudio = await assetBytes(api, project.id, original.audio_asset_id);
  const oldABC = await abcBytes(api, project.id, originalScore);
  const frames: string[] = [], readback: string[] = [], errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.request().method() === 'GET' && /\/jobs\/[\da-f-]+$/.test(response.url())) readback.push(response.url()); });
  page.on('websocket', socket => { socket.on('framereceived', frame => frames.push(String(frame.payload))); });
  await page.goto(coverUrl(project.id));
  await page.locator('.preferences select').selectOption('en');
  await page.getByRole('combobox', { name: 'Choose source Version', exact: true }).selectOption(original.id);
  const derived = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/reference-audio/from-version'));
  await page.getByRole('button', { name: 'Use the first 16 seconds as reference', exact: true }).click();
  const reference: Awaited<ReturnType<typeof uploadReference>> = await (await derived).json();
  await expect(page.locator('.cover-reference-origin')).toHaveAttribute('data-source-version-id', original.id);
  const origin = received(await api.GET('/projects/{project_id}/assets/{asset_id}/reference-origin', { params: { path: { ...path, asset_id: reference.id } } }));
  expect(origin).toEqual({ reference_asset_id: reference.id, source_version_id: original.id, source_asset_id: original.audio_asset_id,
    source_sha256: hash(oldAudio), start_frame: 0, frame_count: 768000, sample_rate: 48000, derivation_version: '1.0.0' });
  const wavFacts = expectReferenceWav(await assetBytes(api, project.id, reference.id));
  expect(reference).toMatchObject({ kind: 'reference_audio', duration_seconds: 16, channels: 2, sample_rate: 48000, sample_width_bits: 16, sha256: wavFacts.sha256 });
  const transcribed = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/transcriptions'));
  await page.getByRole('button', { name: 'Transcribe selected reference', exact: true }).click();
  const transcribedJob = await completedJob(api, project.id, await (await transcribed).json());
  if (!transcribedJob.result?.score_id) throw new Error('No actual Transcribe Score after UI request');
  const score = received(await api.GET('/projects/{project_id}/scores/{score_id}', { params: { path: { ...path, score_id: transcribedJob.result.score_id } } }));
  expect(score).toMatchObject({ source_reference_asset_id: reference.id, parent_version_id: original.id });
  await expect(page.getByRole('textbox', { name: labels.en.abc, exact: true })).toHaveValue(FULL_ABC);
  const selected = await selectCurrentMelody(page, reference.id, score.id);
  await control({ scenario: 'source_metadata' });
  const { job, candidateId } = await generateCover(page);
  await control({});
  const expected = expectedInput(reference.id, selected, original.id);
  const actual = await expectOutput(api, project.id, job.id, candidateId, expected);
  expect(actual.job.provenance).toMatchObject({ cover_source: { reference_origin: origin, transcribe_job_id: transcribedJob.id, transcribed_score_id: score.id } });
  expect(received(await api.GET('/projects/{project_id}/versions', { params: { path } }))).toEqual([original]);
  expect(frames.some(value => value.includes('Cover'))).toBe(true);
  expect(readback.some(url => url.endsWith(`/jobs/${job.id}`))).toBe(true);
  await page.getByRole('button', { name: labels.en.listen, exact: true }).click();
  const player = page.locator('#persistent-player');
  const native = await player.locator('audio').elementHandle();
  if (!native) throw new Error('No native persistent Player');
  await expect(player.getByRole('button', { name: labels.en.play, exact: true })).toBeEnabled();
  await player.getByRole('button', { name: labels.en.play, exact: true }).click();
  await expect.poll(async () => (await mediaState(page)).time).toBeGreaterThan(.1);
  const before = (await mediaState(page)).time, source = await player.locator('audio').getAttribute('src');
  await page.getByRole('link', { name: 'Lyrics and inputs', exact: true }).click();
  await page.getByRole('link', { name: 'Versions', exact: true }).click();
  await expect.poll(async () => (await mediaState(page)).time).toBeGreaterThan(before);
  expect(await native.evaluate(element => element === document.querySelector('#persistent-player audio'))).toBe(true);
  await expect(page.locator('audio')).toHaveCount(1);
  await expect(player.locator('audio')).toHaveAttribute('src', source!);
  await page.getByRole('link', { name: 'Cover', exact: true }).click();
  await expect(page.locator('.cover-generation .candidate-detail')).toHaveAttribute('data-candidate-id', candidateId);
  await page.getByRole('textbox', { name: labels.en.name, exact: true }).fill('Morning melody child');
  await page.getByRole('button', { name: labels.en.save, exact: true }).click();
  await page.getByRole('link', { name: labels.en.saved, exact: true }).click();
  await page.reload();
  const versions = received(await api.GET('/projects/{project_id}/versions', { params: { path } }));
  expect(versions).toHaveLength(2);
  expect(versions.find(version => version.id !== original.id)).toMatchObject({ name: 'Morning melody child', parent_version_id: original.id, candidate_id: candidateId, inputs: expected });
  expect(received(await api.GET('/projects/{project_id}/versions/{version_id}', { params: { path: { ...path, version_id: original.id } } }))).toEqual(original);
  expect(await abcBytes(api, project.id, originalScore)).toBe(oldABC);
  expect(hash(await assetBytes(api, project.id, original.audio_asset_id))).toBe(hash(oldAudio));
  expect(errors).toEqual([]);
  await info.attach('version-reference-cover-loop', { body: JSON.stringify({ scope: 'Production browser + public FastAPI + controlled CPU fixtures; no GPU/music fidelity claim', original, reference, origin, wavFacts, transcribedJob, selected, expected, ...actual, versions, frames, readback }, null, 2), contentType: 'application/json' });
});

// C02: the fake tone is an application/transport fixture, never evidence that
// a model sang Ins notes or reproduced the Reference's recorded melody.
test('uploaded reference with rest-only Vocal keeps both voices, has no parent, and saves only explicitly', async ({ page, baseURL }, info) => {
  const { api, project, reference, score, transcribedJob } = await uploadedSeed(baseURL);
  const path = { project_id: project.id };
  expect(received(await api.GET('/projects/{project_id}/assets/{asset_id}/reference-origin', { params: { path: { ...path, asset_id: reference.id } } }))).toBeNull();
  const original = await assetBytes(api, project.id, reference.id);
  const selected = await selectMelody(page, project.id, reference.id, score);
  const saved = received(await api.GET('/projects/{project_id}/scores/{score_id}', { params: { path: { ...path, score_id: selected } } }));
  expect(saved).toMatchObject({ job_id: null, source_score_id: score.id, source_reference_asset_id: reference.id, parent_version_id: null });
  expect(await abcBytes(api, project.id, saved)).toBe(EDITED_FULL);
  const midi = await downloadMidi(page, labels.en.midi);
  const musical = expectMusic(midi, true);
  expect(musical.notes).toHaveLength(22);
  await page.getByRole('button', { name: labels.en.audition, exact: true }).click();
  const audition = await inspectAudition(page);
  expect(audition.frequency).toBeCloseTo(391.995, 1);
  const { job, candidateId } = await generateCover(page);
  const expected = expectedInput(reference.id, selected, null);
  const actual = await expectOutput(api, project.id, job.id, candidateId, expected);
  expect(actual.job.provenance).toMatchObject({ cover_source: { transcribe_job_id: transcribedJob.id, transcribed_score_id: score.id, reference_origin: null } });
  expect(received(await api.GET('/projects/{project_id}/versions', { params: { path } }))).toEqual([]);
  await page.getByRole('textbox', { name: labels.en.name, exact: true }).fill('Uploaded melody Cover');
  await page.getByRole('button', { name: labels.en.save, exact: true }).click();
  await page.getByRole('link', { name: labels.en.saved, exact: true }).click();
  await page.reload();
  const versions = received(await api.GET('/projects/{project_id}/versions', { params: { path } }));
  expect(versions).toHaveLength(1);
  expect(versions[0]).toMatchObject({ name: 'Uploaded melody Cover', candidate_id: candidateId, parent_version_id: null, inputs: expected });
  await page.getByText(labels.en.snapshot, { exact: true }).click();
  await expect(page.locator('[data-submitted-abc]')).toHaveText(EDITED_FULL);
  await expect(page.locator(`.input-snapshot a[href="/projects/${project.id}/scores/${selected}"]`)).toHaveText(labels.en.source);
  await expect(page.locator(`.input-snapshot a[href="/projects/${project.id}/scores/${score.id}"]`)).toHaveText(labels.en.source);
  expect(await abcBytes(api, project.id, score)).toBe(FULL_ABC);
  expect(hash(await assetBytes(api, project.id, reference.id))).toBe(hash(original));
  await info.attach('uploaded-rest-vocal-cover', { body: JSON.stringify({ scope: 'Production browser + HTTP/WS + CPU fixtures; no model fidelity claim', reference, transcribedJob, saved, expected, ...actual, versions, midiNotes: musical.notes, audition: { frequency: audition.frequency, duration: audition.duration } }, null, 2), contentType: 'application/json' });
});

// C10: three unusable ACK forms exercise one immutable intent boundary.
for (const acknowledgement of ['network loss', 'empty body', 'missing Job identity'] as const) {
  test(`a committed Cover with ${acknowledgement} retains original melody/source intent through reload and explicit readback`, async ({ page, baseURL }, info) => {
    const { api, project, reference, score, original } = await derivedSeed(baseURL);
    const selected = await selectMelody(page, project.id, reference.id, score);
    await fillCover(page);
    const writes: unknown[] = [];
    let accepted!: JobRead;
    await page.route(`**/api/projects/${project.id}/jobs/cover`, async route => {
      writes.push(route.request().postDataJSON());
      const response = await route.fetch();
      expect(response.status()).toBe(202);
      accepted = await response.json();
      if (acknowledgement === 'network loss') return route.abort('failed');
      const body = acknowledgement === 'empty body' ? '' : '{}';
      await route.fulfill({ status: 202, headers: { ...response.headers(), 'content-type': 'application/json', 'content-length': String(body.length) }, body });
    });
    await page.getByRole('button', { name: labels.en.generate, exact: true }).click();
    const recovery = page.locator('.submission-recovery');
    await expect(recovery).toContainText('Submission is unconfirmed');
    const expected = expectedInput(reference.id, selected, original.id);
    expect(accepted.inputs).toEqual(expected);
    await page.getByRole('textbox', { name: labels.en.abc, exact: true }).fill(NEXT_FULL);
    await page.locator('.cover-generation').getByRole('textbox', { name: labels.en.style, exact: true }).fill('later style must remain unsubmitted');
    await page.reload();
    await expect(recovery).toContainText('Submission is unconfirmed');
    await expect(recovery.locator('.input-snapshot [data-effective-abc]')).toHaveText(EDITED_MELODY);
    await expect(page.getByRole('button', { name: labels.en.generate, exact: true })).toBeDisabled();
    await expect(recovery.getByRole('button', { name: 'Start another explicit attempt after checking', exact: true })).toHaveCount(0);
    await recovery.getByText(labels.en.snapshot, { exact: true }).click();
    await expect(recovery.locator('[data-submitted-abc]')).toHaveText(EDITED_FULL);
    await expect(recovery.getByText(STYLE, { exact: true })).toBeVisible();
    await expect(recovery.getByRole('link', { name: labels.en.source, exact: true })).toHaveAttribute('href', `/projects/${project.id}/scores/${selected}`);
    await recoverJob(page, accepted);
    await page.reload();
    await expect(page.locator('.cover-generation .job-monitor')).toHaveAttribute('data-job-id', accepted.id);
    expect(writes).toEqual([expected]);
    const jobs = received(await api.GET('/projects/{project_id}/jobs', { params: { path: { project_id: project.id } } }));
    expect(jobs.filter(job => job.operation === 'Cover')).toHaveLength(1);
    expect(jobs.find(job => job.id === accepted.id)).toMatchObject({ inputs: expected });
    expect(received(await api.GET('/projects/{project_id}/versions', { params: { path: { project_id: project.id } } }))).toEqual([original]);
    await info.attach('cover-unusable-ack-readback', { body: JSON.stringify({ acknowledgement, writes, expected, accepted, jobs, original }, null, 2), contentType: 'application/json' });
  });
}

// C11: no implicit retry when the first write never reached the application.
test('an uncommitted Cover requires public Jobs readback and a new explicit user attempt', async ({ page, baseURL }) => {
  const { api, project, reference, score } = await uploadedSeed(baseURL);
  await selectMelody(page, project.id, reference.id, score);
  await fillCover(page);
  const endpoint = `**/api/projects/${project.id}/jobs/cover`;
  let posts = 0;
  page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/jobs/cover')) posts++; });
  await page.route(endpoint, route => route.abort('failed'));
  await page.getByRole('button', { name: labels.en.generate, exact: true }).click();
  const recovery = page.locator('.submission-recovery');
  await expect(recovery).toContainText('Submission is unconfirmed');
  await page.reload();
  await expect(recovery).toContainText('Submission is unconfirmed');
  await expect(recovery.locator('.input-snapshot [data-effective-abc]')).toHaveText(EDITED_MELODY);
  await expect(page.getByRole('button', { name: labels.en.generate, exact: true })).toBeDisabled();
  expect(received(await api.GET('/projects/{project_id}/jobs', { params: { path: { project_id: project.id } } }))).toHaveLength(1);
  await recovery.getByRole('button', { name: 'Read project jobs', exact: true }).click();
  await expect(recovery).toContainText('No Cover job was read.');
  await recovery.getByRole('button', { name: 'Start another explicit attempt after checking', exact: true }).click();
  await expect(recovery).toHaveCount(0);
  expect(posts).toBe(1);
  expect(received(await api.GET('/projects/{project_id}/jobs', { params: { path: { project_id: project.id } } }))).toHaveLength(1);
  await page.unroute(endpoint);
  // A cold reload needs fresh explicit musical selection as well as the new
  // submit. The captured uncertain intent itself never sends a write again.
  await selectMelody(page, project.id, reference.id, score);
  await generateCover(page);
  expect(posts).toBe(2);
  const jobs = received(await api.GET('/projects/{project_id}/jobs', { params: { path: { project_id: project.id } } }));
  expect(jobs.filter(job => job.operation === 'Cover')).toHaveLength(1);
});

// C07: remove the observed enum choice, retaining the same nodes and STRING
// input. UI and authoritative submit both refuse; old full GFS still works.
test('missing observed melody choice blocks Cover without a full fallback and preserves old GFS', async ({ page, baseURL }, info) => {
  const { api, project, reference, score, original } = await derivedSeed(baseURL);
  const selected = await selectMelody(page, project.id, reference.id, score);
  await fillCover(page);
  await control({ capability: 'remove_melody_enum' });
  await page.locator('.cover-generation').getByRole('button', { name: 'Check readiness again', exact: true }).click();
  await expect(page.getByRole('button', { name: labels.en.generate, exact: true })).toBeDisabled();
  const capabilities = received(await api.GET('/runtime/capabilities'));
  expect(capabilities.capabilities.find(value => value.operation === 'Cover')).toMatchObject({ ready: false, supported_modes: [] });
  expect(capabilities.capabilities.find(value => value.operation === 'GenerateFromScore')).toMatchObject({ ready: true });
  const expected = expectedInput(reference.id, selected, original.id);
  const blocked = await api.POST('/projects/{project_id}/jobs/cover', { params: { path: { project_id: project.id } }, body: expected });
  expect(blocked.response.status).toBe(503);
  expect(received(await api.GET('/projects/{project_id}/jobs', { params: { path: { project_id: project.id } } })).filter(value => value.operation === 'Cover')).toEqual([]);
  const gfs = received(await api.POST('/projects/{project_id}/jobs/generate-from-score', { params: { path: { project_id: project.id } },
    body: { abc: EDITED_FULL, source_score_id: selected, parent_version_id: original.id, style: STYLE, lyrics: LYRICS, seed: SEED + 1, max_seconds: 35 } }));
  const oldConsumer = await completedJob(api, project.id, gfs);
  expect(oldConsumer.operation).toBe('GenerateFromScore');
  await control({});
  await page.locator('.cover-generation').getByRole('button', { name: 'Check readiness again', exact: true }).click();
  await expect(page.getByRole('button', { name: labels.en.generate, exact: true })).toBeEnabled();
  await expect(page.locator('.cover-selection')).toHaveAttribute('data-selected-score-id', selected);
  await info.attach('observed-melody-enum-boundary', { body: JSON.stringify({ capabilities, blockedStatus: blocked.response.status, oldConsumer, expected }, null, 2), contentType: 'application/json' });
});

// C08: failed/cancelled generation is separate from completed Transcribe.
test('cancelling Cover preserves its intermediate and explicit retry uses the original snapshot without retranscribing', async ({ page, baseURL }, info) => {
  const { api, project, reference, score, transcribedJob } = await uploadedSeed(baseURL);
  const selected = await selectMelody(page, project.id, reference.id, score);
  await fillCover(page);
  await control({ scenario: 'hold' });
  const posted = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/jobs/cover'));
  await page.getByRole('button', { name: labels.en.generate, exact: true }).click();
  const job: JobRead = await (await posted).json();
  const monitor = page.locator('.cover-generation .job-monitor');
  await expect(monitor).toHaveAttribute('data-job-id', job.id);
  await expect(monitor).toContainText('Progress is unknown; showing the current phase');
  await expect(monitor.getByRole('progressbar')).toHaveCount(0);
  await expect(page.getByRole('button', { name: labels.en.generate, exact: true })).toBeDisabled();
  await page.getByRole('textbox', { name: labels.en.abc, exact: true }).fill(NEXT_FULL);
  await monitor.getByRole('button', { name: 'Request cancellation', exact: true }).click();
  await expect(monitor.locator('.tag.cancelled')).toBeVisible();
  const path = { project_id: project.id };
  const cancelled = received(await api.GET('/projects/{project_id}/jobs/{job_id}', { params: { path: { ...path, job_id: job.id } } }));
  expect(cancelled).toMatchObject({ status: 'cancelled', result: null, inputs: expectedInput(reference.id, selected, null) });
  expect(await abcBytes(api, project.id, score)).toBe(FULL_ABC);
  const intermediate = received(await api.GET('/projects/{project_id}/scores/{score_id}', { params: { path: { ...path, score_id: selected } } }));
  expect(await abcBytes(api, project.id, intermediate)).toBe(EDITED_FULL);
  expect(received(await api.GET('/projects/{project_id}/candidates', { params: { path } }))).toEqual([]);
  expect(received(await api.GET('/projects/{project_id}/versions', { params: { path } }))).toEqual([]);
  await control({});
  const retryResponse = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/retry'));
  await monitor.getByRole('button', { name: 'Create a new retry job', exact: true }).click();
  const retried: JobRead = await (await retryResponse).json();
  expect(retried.id).not.toBe(job.id);
  expect(retried.inputs).toEqual(cancelled.inputs);
  expect(retried.provenance).toMatchObject({ retry_of_job_id: job.id });
  await expect(page.locator('.cover-generation .candidate-detail .record-details code').filter({ hasText: retried.id })).toHaveCount(1);
  const jobs = received(await api.GET('/projects/{project_id}/jobs', { params: { path } }));
  expect(jobs.filter(value => value.operation === 'Transcribe')).toEqual([transcribedJob]);
  expect(jobs.filter(value => value.operation === 'Cover')).toHaveLength(2);
  await expect(page.getByRole('textbox', { name: labels.en.abc, exact: true })).toHaveValue(NEXT_FULL);
  await info.attach('cover-cancel-explicit-retry', { body: JSON.stringify({ cancelled, retried, jobs, intermediate }, null, 2), contentType: 'application/json' });
});

// C09: an older Candidate must not become the result of a new failed attempt.
for (const [scenario, code] of [['runtime_out_of_memory', 'runtime_out_of_memory'], ['wrong_score', 'score_result_mismatch'], ['import_failure', 'result_persistence_failed']] as const) {
  test(`${scenario} preserves Reference/intermediate/V1 and prior Candidate while refusing a new result`, async ({ page, baseURL }, info) => {
    const { api, project, reference, score, original, transcribedJob } = await derivedSeed(baseURL);
    const selected = await selectMelody(page, project.id, reference.id, score);
    const previous = await generateCover(page);
    const path = { project_id: project.id };
    const originalAssets = received(await api.GET('/projects/{project_id}/assets', { params: { path } }));
    const originalCandidates = received(await api.GET('/projects/{project_id}/candidates', { params: { path } }));
    const hashes = await Promise.all(originalAssets.map(async asset => ({ id: asset.id, sha256: hash(await assetBytes(api, project.id, asset.id)) })));
    await control({ scenario });
    const posted = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/jobs/cover'));
    await page.getByRole('button', { name: labels.en.generate, exact: true }).click();
    const job: JobRead = await (await posted).json();
    await expect(page.locator('.cover-generation .job-monitor .tag.failed')).toBeVisible();
    const failed = received(await api.GET('/projects/{project_id}/jobs/{job_id}', { params: { path: { ...path, job_id: job.id } } }));
    expect(failed).toMatchObject({ status: 'failed', result: null, error: { code }, inputs: expectedInput(reference.id, selected, original.id) });
    await expect(page.locator('.cover-generation .candidate-detail')).toHaveAttribute('data-candidate-id', previous.candidateId);
    await expect(page.getByText('Previously completed Cover Candidate', { exact: true })).toBeVisible();
    expect(received(await api.GET('/projects/{project_id}/candidates', { params: { path } }))).toEqual(originalCandidates);
    expect(received(await api.GET('/projects/{project_id}/assets', { params: { path } }))).toEqual(originalAssets);
    expect(received(await api.GET('/projects/{project_id}/versions', { params: { path } }))).toEqual([original]);
    for (const value of hashes) expect(hash(await assetBytes(api, project.id, value.id))).toBe(value.sha256);
    expect(await abcBytes(api, project.id, score)).toBe(FULL_ABC);
    await control({});
    const postedRetry = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/retry'));
    await page.locator('.cover-generation .job-monitor').getByRole('button', { name: 'Create a new retry job', exact: true }).click();
    const retried: JobRead = await (await postedRetry).json();
    expect(retried.inputs).toEqual(failed.inputs);
    await expect(page.locator('.cover-generation .candidate-detail .record-details code').filter({ hasText: retried.id })).toHaveCount(1);
    const jobs = received(await api.GET('/projects/{project_id}/jobs', { params: { path } }));
    expect(jobs.filter(value => value.operation === 'Transcribe')).toEqual([transcribedJob]);
    expect(received(await api.GET('/projects/{project_id}/versions', { params: { path } }))).toEqual([original]);
    await info.attach('cover-failure-preserves-intermediate', { body: JSON.stringify({ scenario, failed, retried, previous, hashes, jobs }, null, 2), contentType: 'application/json' });
  });
}

// C03: exact same music is insufficient to preserve a different origin.
test('a different Reference producing identical ABC invalidates old melody selection and replaces its parent only after selection', async ({ page, baseURL }, info) => {
  const { api, project, reference, score, original } = await derivedSeed(baseURL);
  const selected = await selectMelody(page, project.id, reference.id, score, 'en', false);
  await fillCover(page);
  await page.locator('.cover-upload summary').click();
  const upload = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith(`/projects/${project.id}/assets`));
  await page.getByLabel('Choose WAV audio').setInputFiles({ name: 'different-reference-same-music.wav', mimeType: 'audio/wav', buffer: await readFile(referencePath) });
  await page.getByRole('button', { name: 'Add to project assets', exact: false }).click();
  const uploaded: Awaited<ReturnType<typeof uploadReference>> = await (await upload).json();
  await page.getByRole('combobox', { name: 'Choose Cover reference audio', exact: true }).selectOption(uploaded.id);
  await expect(page.getByRole('button', { name: labels.en.generate, exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: labels.en.audition, exact: true })).toBeDisabled();
  await expect(page.locator('.cover-selection')).toHaveAttribute('data-selected-score-id', selected);
  const posted = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/transcriptions'));
  await page.getByRole('button', { name: 'Transcribe selected reference', exact: true }).click();
  const transcribed = await completedJob(api, project.id, await (await posted).json());
  if (!transcribed.result?.score_id) throw new Error('No new Transcribe Score');
  expect(transcribed.result.score_id).not.toBe(score.id);
  await expect(page.getByRole('textbox', { name: labels.en.abc, exact: true })).toHaveValue(FULL_ABC);
  await expect(page.getByRole('button', { name: labels.en.generate, exact: true })).toBeDisabled();
  await expect(page.locator('.cover-selection')).toHaveAttribute('data-reference-id', reference.id);
  const replacement = await selectCurrentMelody(page, uploaded.id, transcribed.result.score_id, 'en', false);
  const { job } = await generateCover(page);
  expect(job.inputs).toEqual(expectedInput(uploaded.id, replacement, null, FULL_ABC, MELODY_ABC));
  const saved = received(await api.GET('/projects/{project_id}/scores/{score_id}', { params: { path: { project_id: project.id, score_id: replacement } } }));
  expect(saved).toMatchObject({ source_reference_asset_id: uploaded.id, parent_version_id: null });
  expect(await abcBytes(api, project.id, score)).toBe(FULL_ABC);
  expect(received(await api.GET('/projects/{project_id}/versions', { params: { path: { project_id: project.id } } }))).toEqual([original]);
  await info.attach('same-ABC-different-reference-identity', { body: JSON.stringify({ oldReference: reference, oldSelection: selected, uploaded, transcribed, replacement, job }, null, 2), contentType: 'application/json' });
});

// C04: same Reference is also insufficient after a new transcription identity.
test('new same-Reference transcription invalidates old selection and a late old Score-save ACK cannot take over the new editor', async ({ page, baseURL }, info) => {
  const { api, project, reference, score } = await uploadedSeed(baseURL);
  const first = await selectMelody(page, project.id, reference.id, score, 'en', false);
  let release!: () => void, committed!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const savedOnServer = new Promise<void>(resolve => { committed = resolve; });
  await page.route(`**/api/projects/${project.id}/scores`, async route => {
    if (route.request().method() !== 'POST') return route.continue();
    const response = await route.fetch();
    committed();
    await held;
    return route.fulfill({ response });
  });
  try {
    await page.getByRole('textbox', { name: labels.en.abc, exact: true }).fill(EDITED_FULL);
    await expect(page.getByText(labels.en.current, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: labels.en.saveScore, exact: true }).click();
    await savedOnServer;
    const posted = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/transcriptions'));
    await page.getByRole('button', { name: 'Transcribe selected reference', exact: true }).click();
    const completed = await completedJob(api, project.id, await (await posted).json());
    if (!completed.result?.score_id) throw new Error('No replacement Transcribe Score');
    const nextScore = received(await api.GET('/projects/{project_id}/scores/{score_id}', { params: { path: { project_id: project.id, score_id: completed.result.score_id } } }));
    const replacement = { transcribedJob: completed, score: nextScore };
    expect(replacement.score.id).not.toBe(score.id);
    await expect(page.locator('.cover-inspection')).toHaveAttribute('data-source-score-id', replacement.score.id);
    await expect(page.getByRole('textbox', { name: labels.en.abc, exact: true })).toHaveValue(FULL_ABC);
    await expect(page.getByRole('button', { name: labels.en.generate, exact: true })).toBeDisabled();
    await expect(page.locator('.cover-selection')).toHaveAttribute('data-selected-score-id', first);
    const selected = await selectCurrentMelody(page, reference.id, replacement.score.id, 'en', false);
    const released = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith(`/projects/${project.id}/scores`));
    release();
    await (await released).finished();
    await expect(page.locator('.selected-score')).toHaveAttribute('data-selected-score-id', selected);
    await expect(page.locator('.cover-selection')).toHaveAttribute('data-selected-score-id', selected);
    await expect(page.getByRole('textbox', { name: labels.en.abc, exact: true })).toHaveValue(FULL_ABC);
    const { job } = await generateCover(page);
    expect(job.inputs).toEqual(expectedInput(reference.id, selected, null, FULL_ABC, MELODY_ABC));
    await info.attach('same-reference-new-score-late-save-ownership', { body: JSON.stringify({ first, replacement, selected, job }, null, 2), contentType: 'application/json' });
  } finally { release(); }
});

// C05: transport timing must never make later edits part of the earlier write.
test('a held real Cover acknowledgement cannot change its captured original/effective ABC, mode, source or settings', async ({ page, baseURL }, info) => {
  const { api, project, reference, score, original } = await derivedSeed(baseURL);
  const selected = await selectMelody(page, project.id, reference.id, score);
  await fillCover(page);
  let release!: () => void, committed!: (job: JobRead) => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const accepted = new Promise<JobRead>(resolve => { committed = resolve; });
  await page.route(`**/api/projects/${project.id}/jobs/cover`, async route => {
    const response = await route.fetch();
    committed(await response.json());
    await held;
    return route.fulfill({ response });
  });
  try {
    await page.getByRole('button', { name: labels.en.generate, exact: true }).click();
    const job = await accepted;
    const expected = expectedInput(reference.id, selected, original.id);
    expect(job.inputs).toEqual(expected);
    await expect(page.getByText('Waiting for the application to acknowledge this Cover.', { exact: true })).toBeVisible();
    await page.getByRole('textbox', { name: labels.en.abc, exact: true }).fill(NEXT_FULL);
    await page.locator('.cover-generation').getByRole('textbox', { name: labels.en.style, exact: true }).fill('later drums and different words');
    await page.locator('.cover-generation').getByRole('textbox', { name: labels.en.lyrics, exact: true }).fill('[Verse]\nThese later lyrics were never submitted.');
    release();
    await expect(page.locator('.cover-generation .job-monitor')).toHaveAttribute('data-job-id', job.id);
    const region = page.locator('.cover-generation .candidate-detail');
    await expect(region.locator('.record-details code').filter({ hasText: job.id })).toHaveCount(1);
    const candidateId = await region.getAttribute('data-candidate-id');
    if (!candidateId) throw new Error('No Candidate from captured Cover');
    const actual = await expectOutput(api, project.id, job.id, candidateId, expected);
    await expect(page.getByRole('textbox', { name: labels.en.abc, exact: true })).toHaveValue(NEXT_FULL);
    await expect(page.getByRole('button', { name: labels.en.generate, exact: true })).toBeDisabled();
    expect(received(await api.GET('/projects/{project_id}/versions', { params: { path: { project_id: project.id } } }))).toEqual([original]);
    await info.attach('held-Cover-ack-frozen-input', { body: JSON.stringify({ expected, ...actual }, null, 2), contentType: 'application/json' });
  } finally { release(); }
});

// C06 also covers C05's late validation half, with a real fetched CPU response.
test('empty/invalid/unselected inputs and late effective validation cannot submit; retry preserves the draft', async ({ page, baseURL }) => {
  const { api, project } = await projectOnly(baseURL);
  await page.goto(coverUrl(project.id));
  await page.locator('.preferences select').selectOption('en');
  await expect(page.getByText('No intermediate Score yet', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: labels.en.generate, exact: true })).toBeDisabled();
  const full = page.locator('.cover-mode input[value="full"]');
  await expect(full).toBeDisabled();
  const reference = await uploadReference(api, project.id);
  const { score } = await transcribe(api, project.id, reference);
  await openCover(page, project.id, reference.id, score);
  await expect(page.getByRole('button', { name: labels.en.inspect, exact: true })).toBeDisabled();
  await page.getByRole('textbox', { name: labels.en.abc, exact: true }).fill('X:1\nK:C\nThis is not native music');
  await expect(page.locator('.score-editor .error-box')).toBeVisible();
  await expect(page.getByRole('textbox', { name: labels.en.abc, exact: true })).toHaveValue('X:1\nK:C\nThis is not native music');
  await expect(page.getByRole('button', { name: labels.en.generate, exact: true })).toBeDisabled();
  await page.getByRole('textbox', { name: labels.en.abc, exact: true }).fill(EDITED_FULL);
  await expect(page.getByText(labels.en.current, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: labels.en.saveScore, exact: true }).click();
  await expect(page.getByText(labels.en.ready, { exact: true })).toBeVisible();
  let release!: () => void, fetched!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const validated = new Promise<void>(resolve => { fetched = resolve; });
  const endpoint = `**/api/projects/${project.id}/cover-inputs/validate`;
  await page.route(endpoint, async route => {
    const response = await route.fetch();
    fetched();
    await held;
    return route.fulfill({ response });
  });
  try {
    await page.getByRole('button', { name: labels.en.inspect, exact: true }).click();
    await validated;
    await page.getByRole('textbox', { name: labels.en.abc, exact: true }).fill(NEXT_FULL);
    release();
    await expect(page.locator('.cover-effective [data-effective-abc]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: labels.en.generate, exact: true })).toBeDisabled();
    await expect(page.getByRole('textbox', { name: labels.en.abc, exact: true })).toHaveValue(NEXT_FULL);
  } finally { release(); await page.unroute(endpoint); }
  // Reset to the checked saved edit, then exercise recoverable validation I/O.
  await page.getByRole('textbox', { name: labels.en.abc, exact: true }).fill(EDITED_FULL);
  await expect(page.getByText(labels.en.current, { exact: true })).toBeVisible();
  await page.route(endpoint, route => route.abort('failed'));
  await page.getByRole('button', { name: labels.en.inspect, exact: true }).click();
  await expect(page.locator('.cover-effective .error-box')).toBeVisible();
  await expect(page.getByRole('textbox', { name: labels.en.abc, exact: true })).toHaveValue(EDITED_FULL);
  await page.unroute(endpoint);
  const selected = await page.locator('.selected-score').getAttribute('data-selected-score-id');
  if (!selected) throw new Error('No saved edit after effective-validation recovery');
  await inspectAndSelect(page, reference.id, selected);
  await fillCover(page);
  await page.locator('.cover-generation').getByRole('textbox', { name: labels.en.seed, exact: true }).fill('-1');
  await page.getByRole('button', { name: labels.en.generate, exact: true }).click();
  await expect(page.locator('.cover-generation')).toContainText('Enter an integer seed');
  await page.locator('.cover-generation').getByRole('textbox', { name: labels.en.seed, exact: true }).fill(String(SEED));
  await page.locator('.cover-generation').getByRole('textbox', { name: labels.en.style, exact: true }).fill(' ');
  await page.getByRole('button', { name: labels.en.generate, exact: true }).click();
  await expect(page.locator('.cover-generation')).toContainText('Enter music style and lyrics.');
  const unsupported = await page.request.post(`/api/projects/${project.id}/cover-inputs/validate`, { data: { abc: EDITED_FULL, mode: 'full' } });
  expect(unsupported.status()).toBe(422);
  expect(received(await api.GET('/projects/{project_id}/jobs', { params: { path: { project_id: project.id } } })).filter(value => value.operation === 'Cover')).toEqual([]);
});

// C12: replay addresses the same first Reference intent, irrespective of a
// later visible Version choice. The public conflicting replay cannot overwrite.
test('lost Reference creation ACK locks the first source choice and recovers one immutable reference by readback', async ({ page, baseURL }, info) => {
  const { api, project, original, score } = await withParent(baseURL);
  const path = { project_id: project.id };
  const laterJob = await completedJob(api, project.id, received(await api.POST('/projects/{project_id}/jobs/generate-from-score', { params: { path },
    body: { abc: MELODY_ABC, source_score_id: score.id, parent_version_id: original.id, style: 'another original direction', lyrics: LYRICS, seed: SEED + 3, max_seconds: 35 } })));
  if (!laterJob.result?.candidate_id) throw new Error('No later public Candidate for competing Reference intent');
  const later = received(await api.POST('/projects/{project_id}/versions', { params: { path }, body: { candidate_id: laterJob.result.candidate_id, name: 'Later Version choice' } }));
  let first = true;
  const writes: components['schemas']['VersionReferenceCreate'][] = [];
  await page.route(`**/api/projects/${project.id}/reference-audio/from-version`, async route => {
    writes.push(route.request().postDataJSON());
    const response = await route.fetch();
    if (first) { first = false; return route.abort('failed'); }
    return route.fulfill({ response });
  });
  await page.goto(coverUrl(project.id));
  await page.locator('.preferences select').selectOption('en');
  const choice = page.getByRole('combobox', { name: 'Choose source Version', exact: true });
  await choice.selectOption(original.id);
  await page.getByRole('button', { name: 'Use the first 16 seconds as reference', exact: true }).click();
  await expect(page.locator('.cover-reference')).toContainText('Reference creation is unconfirmed');
  const intent = writes[0];
  if (!intent?.save_id) throw new Error('No captured Reference save identity');
  await expect(choice).toBeDisabled();
  const gate = await holdMountedOrigin(page, project.id, intent.save_id, original.id, original.audio_asset_id);
  try {
    await page.reload();
    await expect.poll(gate.ready).toBe(true);
    await expect(page.locator('.cover-reference')).toContainText('Reference creation is unconfirmed');
    await page.getByRole('button', { name: 'Recover this reference', exact: true }).click();
    await expect.poll(() => gate.reads.length).toBe(2);
    await expect(page.locator('.reference-recovery')).toHaveCount(0);
    gate.release();
    await expect(page.locator('.cover-reference-origin')).toHaveAttribute('data-source-version-id', original.id);
    expect(gate.failures).toEqual([]);
    const reference = received(await api.GET('/projects/{project_id}/assets/{asset_id}', { params: { path: { ...path, asset_id: intent.save_id } } }));
    const bytes = await assetBytes(api, project.id, reference.id);
    expectReferenceWav(bytes);
    const origin = received(await api.GET('/projects/{project_id}/assets/{asset_id}/reference-origin', { params: { path: { ...path, asset_id: reference.id } } }));
    expect(origin).toMatchObject({ source_version_id: original.id, source_asset_id: original.audio_asset_id });
    expect(writes).toEqual([intent]);
    const conflict = await api.POST('/projects/{project_id}/reference-audio/from-version', { params: { path }, body: { ...intent, source_version_id: later.id } });
    expect(conflict.response.status).toBe(409);
    expect(received(await api.GET('/projects/{project_id}/assets', { params: { path } })).filter(value => value.kind === 'reference_audio')).toEqual([reference]);
    expect(hash(await assetBytes(api, project.id, reference.id))).toBe(hash(bytes));
    expect(received(await api.GET('/projects/{project_id}/assets/{asset_id}/reference-origin', { params: { path: { ...path, asset_id: reference.id } } }))).toEqual(origin);
    expect(received(await api.GET('/projects/{project_id}/jobs', { params: { path } }))).toHaveLength(2);
    await info.attach('reference-first-intent-recovery', { body: JSON.stringify({ intent, writes, reference, origin, original, later }, null, 2), contentType: 'application/json' });
  } finally {
    gate.release();
    await info.attach('reference-recovery-origin-schedule', { body: JSON.stringify({ referenceId: intent.save_id, reads: gate.reads, failures: gate.failures }, null, 2), contentType: 'application/json' });
  }
});

test('uploading another Reference preserves the selected derived Reference and its pending origin read', async ({ page, baseURL }, info) => {
  const { api, project, original } = await withParent(baseURL);
  const path = { project_id: project.id };
  const reference = received(await api.POST('/projects/{project_id}/reference-audio/from-version', { params: { path }, body: { source_version_id: original.id } }));
  const oldReference = await assetBytes(api, project.id, reference.id);
  const oldAudio = await assetBytes(api, project.id, original.audio_asset_id);
  const originalOrigin = received(await api.GET('/projects/{project_id}/assets/{asset_id}/reference-origin', { params: { path: { ...path, asset_id: reference.id } } }));
  const gate = await holdMountedOrigin(page, project.id, reference.id, original.id, original.audio_asset_id);
  try {
    await page.goto(coverUrl(project.id, reference.id));
    await page.locator('.preferences select').selectOption('en');
    await expect.poll(gate.ready).toBe(true);
    await expect(page.getByRole('combobox', { name: 'Choose Cover reference audio', exact: true })).toHaveValue(reference.id);
    await page.locator('.cover-upload summary').click();
    const posted = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith(`/projects/${project.id}/assets`));
    await page.getByLabel('Choose WAV audio').setInputFiles({ name: 'another-local-reference-16s.wav', mimeType: 'audio/wav', buffer: await readFile(referencePath) });
    await page.getByRole('button', { name: 'Add to project assets', exact: false }).click();
    const response = await posted;
    expect(response.status()).toBe(201);
    const uploaded: Awaited<ReturnType<typeof uploadReference>> = await response.json();
    expect(uploaded.id).not.toBe(reference.id);
    await expect(page.locator('.cover-upload .asset-list').getByRole('button').filter({ hasText: uploaded.original_name })).toBeVisible();
    gate.release();
    await expect(page.locator('.cover-reference-origin')).toHaveAttribute('data-source-version-id', original.id);
    expect(gate.failures).toEqual([]);
    await expect(page.getByRole('combobox', { name: 'Choose Cover reference audio', exact: true })).toHaveValue(reference.id);
    expect(received(await api.GET('/projects/{project_id}/assets/{asset_id}/reference-origin', { params: { path: { ...path, asset_id: reference.id } } }))).toEqual(originalOrigin);
    expect(received(await api.GET('/projects/{project_id}/assets/{asset_id}/reference-origin', { params: { path: { ...path, asset_id: uploaded.id } } }))).toBeNull();
    expect(hash(await assetBytes(api, project.id, reference.id))).toBe(hash(oldReference));
    expect(hash(await assetBytes(api, project.id, original.audio_asset_id))).toBe(hash(oldAudio));
    expect(received(await api.GET('/projects/{project_id}/versions/{version_id}', { params: { path: { ...path, version_id: original.id } } }))).toEqual(original);
    expect(received(await api.GET('/projects/{project_id}/jobs', { params: { path } }))).toHaveLength(1);
    await info.attach('upload-preserves-existing-origin', { body: JSON.stringify({ reference, originalOrigin, uploaded, original }, null, 2), contentType: 'application/json' });
  } finally {
    gate.release();
    await info.attach('upload-origin-schedule', { body: JSON.stringify({ referenceId: reference.id, reads: gate.reads, failures: gate.failures }, null, 2), contentType: 'application/json' });
  }
});

// C14: two bounded cold entries cover both languages/themes, not a four-way
// cross product of an unchanged preferences subsystem.
for (const [locale, theme] of [['zh-CN', 'light'], ['en', 'dark']] as const) {
  test(`${locale}/${theme} cold390 Cover has usable controls and the sole Player survives workspace navigation`, async ({ page, baseURL }, info) => {
    const { api, project, reference, score, original } = await derivedSeed(baseURL);
    const errors: string[] = [], requests: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => requests.push(request.url()));
    await page.setViewportSize({ width: 390, height: 960 });
    const selected = await selectMelody(page, project.id, reference.id, score, locale);
    if (await page.locator('html').getAttribute('data-theme') !== theme) await page.locator('.preferences button').click();
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page.locator('.cover-selection')).toHaveAttribute('data-selected-score-id', selected);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    expect(await page.locator('#persistent-player').evaluate(element => element.getBoundingClientRect().width)).toBe(390);
    await page.getByRole('button', { name: labels[locale].audition, exact: true }).click();
    const native = await page.locator('#persistent-player audio').elementHandle();
    if (!native) throw new Error('No sole native Player');
    await expect.poll(async () => (await mediaState(page)).time).toBeGreaterThan(.1);
    const generated = await generateCover(page, locale);
    await page.getByRole('button', { name: labels[locale].listen, exact: true }).click();
    const play = page.locator('#persistent-player').getByRole('button', { name: labels[locale].play, exact: true });
    await expect(play).toBeEnabled();
    await play.click();
    await expect.poll(async () => (await mediaState(page)).time).toBeGreaterThan(.1);
    expect((await mediaState(page)).duration).toBeCloseTo(34.9986667, 4);
    const before = (await mediaState(page)).time, source = await page.locator('audio').getAttribute('src');
    await page.getByRole('link', { name: locale === 'en' ? 'Lyrics and inputs' : '歌词与输入', exact: true }).click();
    await page.getByRole('link', { name: locale === 'en' ? 'Versions' : '版本', exact: true }).click();
    await expect.poll(async () => (await mediaState(page)).time).toBeGreaterThan(before);
    await expect(page.locator('audio')).toHaveCount(1);
    await expect(page.locator('audio')).toHaveAttribute('src', source!);
    expect(await native.evaluate(element => element === document.querySelector('#persistent-player audio'))).toBe(true);
    await page.locator(`a[href="/projects/${project.id}/versions/${original.id}"]`).click();
    await page.getByText(labels[locale].snapshot, { exact: true }).click();
    await expect(page.locator('[data-submitted-abc]')).toHaveText(MELODY_ABC);
    await expect(page.getByRole('link', { name: labels[locale].source, exact: true })).toBeVisible();
    const player = page.locator('#persistent-player');
    await player.getByRole('button', { name: labels[locale].pause, exact: true }).click();
    const seek = player.getByRole('slider', { name: locale === 'en' ? 'Playback position (seconds)' : '播放位置（秒）', exact: true });
    await seek.focus();
    await seek.press('Home');
    for (let step = 0; step < 15; step++) await seek.press('ArrowRight');
    await expect.poll(async () => (await mediaState(page)).time).toBeCloseTo(1.5, 1);
    expect((await mediaState(page)).paused).toBe(true);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    expect(errors).toEqual([]);
    expect(requests.every(url => url.startsWith(baseURL!) || url.startsWith('blob:'))).toBe(true);
    expect(received(await api.GET('/projects/{project_id}/versions/{version_id}', { params: { path: { project_id: project.id, version_id: original.id } } }))).toEqual(original);
    await info.attach('cold390-cover-player-preferences', { body: JSON.stringify({ locale, theme, selected, generated, requests, errors, original }, null, 2), contentType: 'application/json' });
  });
}

// C13: shared Candidate save must retain the first name and truthful parent.
for (const fault of ['lost durable acknowledgement', 'before-commit persistence failure'] as const) {
  test(`Cover Version ${fault} retries the first Candidate/name/parent after later name edits`, async ({ page, baseURL }, info) => {
    const { api, project, reference, score, original } = await derivedSeed(baseURL);
    const selected = await selectMelody(page, project.id, reference.id, score);
    const { candidateId } = await generateCover(page);
    const path = { project_id: project.id }, writes: unknown[] = [];
    let drop = fault === 'lost durable acknowledgement';
    await page.route(`**/api/projects/${project.id}/versions`, async route => {
      if (route.request().method() !== 'POST') return route.continue();
      writes.push(route.request().postDataJSON());
      const response = await route.fetch();
      if (drop) { drop = false; return route.abort('failed'); }
      return route.fulfill({ response });
    });
    const firstName = `First Cover save · ${fault}`;
    await page.getByRole('textbox', { name: labels.en.name, exact: true }).fill(firstName);
    if (fault === 'before-commit persistence failure') await writeFile(resolve(runDir!, 'fail-version-save'), 'owned CPU test fault');
    await page.getByRole('button', { name: labels.en.save, exact: true }).click();
    await expect(page.locator('.save-candidate .error-box')).toBeVisible();
    const firstRead = received(await api.GET('/projects/{project_id}/versions', { params: { path } }));
    expect(firstRead).toHaveLength(fault === 'lost durable acknowledgement' ? 2 : 1);
    await page.getByRole('textbox', { name: labels.en.name, exact: true }).fill('Later name is a different unsent intent');
    await page.getByRole('button', { name: 'Save the same version again', exact: true }).click();
    await expect(page.getByRole('link', { name: labels.en.saved, exact: true })).toBeVisible();
    const versions = received(await api.GET('/projects/{project_id}/versions', { params: { path } }));
    expect(versions).toHaveLength(2);
    expect(versions.find(version => version.id !== original.id)).toMatchObject({ name: firstName, candidate_id: candidateId, parent_version_id: original.id, inputs: expectedInput(reference.id, selected, original.id) });
    expect(writes).toEqual([{ candidate_id: candidateId, name: firstName }, { candidate_id: candidateId, name: firstName }]);
    expect(received(await api.GET('/projects/{project_id}/versions/{version_id}', { params: { path: { ...path, version_id: original.id } } }))).toEqual(original);
    await info.attach('cover-frozen-version-intent', { body: JSON.stringify({ fault, writes, firstRead, versions, original }, null, 2), contentType: 'application/json' });
  });
}
