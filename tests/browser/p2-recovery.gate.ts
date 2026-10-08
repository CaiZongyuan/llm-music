import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMusicClient } from '@llm-music/api-client';
import { expect, test, type Page } from '@playwright/test';
import { completedCandidate, hash, inputs, mediaState, received, runDir } from './generation-fixtures.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
async function owner() {
  return JSON.parse(await readFile(resolve(runDir!, 'owner.json'), 'utf8')) as { pid: number; create_time: number; source: string; generation: number; data_dir: string; runtime_mode: string; torch_installed: boolean };
}
async function downloaded(page: Page, name: string) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name, exact: false }).click();
  const download = await pending;
  expect(await download.failure()).toBeNull();
  const path = await download.path();
  if (!path) throw new Error('Native download did not finish');
  return readFile(path);
}

test('both creator journeys recover all persisted identities and bytes after an actual API process restart', async ({ page, baseURL }, info) => {
  if (!baseURL || !runDir) throw new Error('Missing isolated P2 gate environment');
  const api = createMusicClient({ baseUrl: `${baseURL}/api` });
  const errors: string[] = [], requests: string[] = [], writes: string[] = [], validations: string[] = [];
  let validationPath = '';
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    requests.push(request.url());
    if (request.method() !== 'POST') return;
    // Only this Project's explicit CPU validation route is a non-mutating POST.
    if (new URL(request.url()).pathname === validationPath) validations.push(request.url());
    else writes.push(request.url());
  });
  const firstOwner = await owner();
  expect(firstOwner).toMatchObject({ generation: 0, runtime_mode: 'fake', torch_installed: false });
  const name = `雨后的散步 · P2 gate · ${randomUUID().slice(0, 8)}`;
  await page.goto('/');
  await page.getByRole('combobox').selectOption('en');
  await page.locator('.preferences button').click();
  await page.getByRole('textbox', { name: 'Project name', exact: true }).fill(name);
  await page.getByRole('textbox', { name: 'Creative notes', exact: true }).fill('保留旋律，再探索温暖钢琴。Keep the melody; explore warm piano.');
  await page.getByRole('button', { name: 'Create and start', exact: false }).click();
  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+\/?$/);
  const projectId = new URL(page.url()).pathname.split('/')[2];
  if (!projectId) throw new Error('No Project identity');
  validationPath = `/api/projects/${projectId}/scores/validate`;
  const path = { project_id: projectId };
  await page.locator('.tabs').getByRole('link', { name: 'Reference transcription', exact: true }).click();
  const referenceSelect = page.getByRole('combobox', { name: 'Choose reference audio', exact: true });
  await expect(referenceSelect).toBeVisible(); // Wait for the new route, rather than selecting the previous route's file input.
  await page.getByLabel('Choose WAV audio').setInputFiles(resolve(root, 'docs/previews/web-mvp-v1/reference-16s.wav'));
  await page.getByRole('button', { name: 'Add to project assets', exact: false }).click();
  await expect(referenceSelect.locator('option')).toContainText('reference-16s.wav');
  const referenceId = await referenceSelect.inputValue();
  await page.getByRole('button', { name: 'Start transcription', exact: false }).click();
  await expect(page).toHaveURL(/jobId=/);
  const transcriptionId = new URL(page.url()).searchParams.get('jobId');
  if (!transcriptionId) throw new Error('No Transcribe identity');
  await page.getByRole('link', { name: 'Inspect score and download MIDI', exact: false }).click();
  await expect(page.getByRole('region', { name: 'Score preview', exact: true }).locator('svg')).toBeVisible();
  const transcription = received(await api.GET('/projects/{project_id}/jobs/{job_id}', { params: { path: { ...path, job_id: transcriptionId } } }));
  const transcribedScoreId = transcription.result?.score_id, midiId = transcription.result?.midi_asset_id;
  if (!transcribedScoreId || !midiId) throw new Error('No imported Score/MIDI');
  const firstMidi = await downloaded(page, 'Download MIDI');
  expect(firstMidi.toString('ascii', 0, 4)).toBe('MThd');
  const midiAsset = received(await api.GET('/projects/{project_id}/assets/{asset_id}', { params: { path: { ...path, asset_id: midiId } } }));
  expect(hash(firstMidi)).toBe(midiAsset.sha256);
  await page.locator('.tabs').getByRole('link', { name: 'Generate music', exact: true }).click();
  await inputs(page, 'en');
  const candidateId = await completedCandidate(page, 'en');
  const candidate = received(await api.GET('/projects/{project_id}/candidates/{candidate_id}', { params: { path: { ...path, candidate_id: candidateId } } }));
  expect(received(await api.GET('/projects/{project_id}/versions', { params: { path } }))).toEqual([]);
  await page.getByRole('button', { name: 'Listen to this music', exact: false }).click();
  await page.locator('#persistent-player').getByRole('button', { name: 'Play', exact: true }).click();
  await expect.poll(async () => (await mediaState(page)).time).toBeGreaterThan(0.15);
  await expect(page.locator('audio')).toHaveCount(1);
  await page.locator('#persistent-player').getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('textbox', { name: 'Version name', exact: true }).fill('雨后的散步 · retained attempt');
  await page.getByRole('button', { name: 'Save as a version', exact: false }).click();
  await page.getByRole('link', { name: 'View saved version', exact: false }).click();
  const versionId = new URL(page.url()).pathname.split('/').at(-1);
  if (!versionId) throw new Error('No saved Version');
  const project = received(await api.GET('/projects/{project_id}', { params: { path } }));
  const versions = received(await api.GET('/projects/{project_id}/versions', { params: { path } }));
  const jobs = received(await api.GET('/projects/{project_id}/jobs', { params: { path } }));
  const assets = received(await api.GET('/projects/{project_id}/assets', { params: { path } }));
  const scores = received(await api.GET('/projects/{project_id}/scores', { params: { path } }));
  expect(jobs).toHaveLength(2); expect(jobs.every(job => job.status === 'completed')).toBe(true);
  expect(versions).toHaveLength(1); expect(versions[0]?.id).toBe(versionId);
  const priorWrites = [...writes];
  expect(priorWrites).toHaveLength(5); // Create Project, upload, Transcribe, Generate, save Version.
  expect(priorWrites).toEqual([
    `${baseURL}/api/projects`, `${baseURL}/api/projects/${projectId}/assets`,
    `${baseURL}/api/projects/${projectId}/transcriptions`, `${baseURL}/api/projects/${projectId}/jobs/generate`,
    `${baseURL}/api/projects/${projectId}/versions`,
  ]);
  expect(validations.length).toBeGreaterThan(0);
  await writeFile(resolve(runDir, 'restart'), 'Restart only the owned API child\n');
  await expect.poll(async () => readFile(resolve(runDir!, 'restart-stopped.json'), 'utf8').then(JSON.parse).catch(() => null)).toMatchObject({ pid: firstOwner.pid, graceful: true });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('alert')).toContainText('The application is unavailable');
  await writeFile(resolve(runDir, 'resume'), 'Reopen the same owned database and assets\n');
  await expect.poll(async () => (await owner()).generation).toBe(1);
  const nextOwner = await owner();
  expect(nextOwner.pid).not.toBe(firstOwner.pid); expect(nextOwner.create_time).toBeGreaterThan(firstOwner.create_time);
  expect(nextOwner.source).toBe(firstOwner.source); expect(nextOwner.data_dir).toBe(firstOwner.data_dir);
  await expect.poll(async () => (await api.GET('/projects/{project_id}', { params: { path } }).catch(() => null))?.response.ok).toBe(true);
  await page.getByRole('button', { name: 'Read again', exact: true }).click();
  await expect(page.locator(`[data-version-id="${versionId}"]`)).toBeVisible();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('audio')).toHaveCount(1);
  expect(await page.locator('audio').getAttribute('src')).toBeNull(); // Playback selection is session state.
  await page.getByRole('button', { name: 'Listen to version', exact: false }).click();
  await expect.poll(async () => (await mediaState(page)).duration).toBeCloseTo(35, 1);
  await page.locator('.tabs').getByRole('link', { name: 'Creative jobs', exact: true }).click();
  for (const job of jobs) await expect(page.locator(`[data-job-id="${job.id}"]`)).toBeVisible();
  await page.locator('.tabs').getByRole('link', { name: 'Scores', exact: true }).click();
  await page.locator(`a[href$="/scores/${transcribedScoreId}"]`).click();
  await expect(page.getByRole('region', { name: 'Score preview', exact: true }).locator('svg')).toBeVisible();
  expect(hash(await downloaded(page, 'Download MIDI'))).toBe(hash(firstMidi));
  await expect(page.getByText(referenceId, { exact: true })).toBeVisible();
  await page.locator('.tabs').getByRole('link', { name: 'Reference audio and assets', exact: true }).click();
  const reference = assets.find(asset => asset.id === referenceId);
  if (!reference) throw new Error('No persisted Reference Asset');
  await page.locator('.asset-list').getByRole('button').filter({ hasText: reference.original_name }).click();
  expect(hash(await downloaded(page, 'Download original file'))).toBe(reference.sha256);
  await page.locator('.asset-list').getByRole('button').filter({ hasText: 'generated.flac' }).click();
  const generated = assets.find(asset => asset.id === candidate.audio_asset_id);
  if (!generated) throw new Error('No generated Asset');
  expect(hash(await downloaded(page, 'Download original file'))).toBe(generated.sha256);
  await page.locator('.breadcrumb').click();
  await page.getByRole('link').filter({ has: page.getByRole('heading', { name, exact: true }) }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  expect(received(await api.GET('/projects/{project_id}', { params: { path } }))).toEqual(project);
  expect(received(await api.GET('/projects/{project_id}/versions', { params: { path } }))).toEqual(versions);
  expect(received(await api.GET('/projects/{project_id}/jobs', { params: { path } }))).toEqual(jobs);
  expect(received(await api.GET('/projects/{project_id}/assets', { params: { path } }))).toEqual(assets);
  expect(received(await api.GET('/projects/{project_id}/scores', { params: { path } }))).toEqual(scores);
  expect(errors).toEqual([]);
  expect(requests.every(url => url.startsWith(baseURL) || url.startsWith('blob:'))).toBe(true);
  expect(writes).toEqual(priorWrites);
  expect(validations.every(url => url === `${baseURL}${validationPath}`)).toBe(true);
  const receipt = { scope: 'Real Chromium and production FastAPI/SQLite, two distinct owned API PIDs, CPU Fake Runtime; no GPU/model quality claim', firstOwner, nextOwner, project, versions, jobs, assets, scores, midi_sha256: hash(firstMidi), writes, validations, no_resubmission: true };
  await writeFile(resolve(runDir, 'gate-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  await info.attach('p2-api-restart', { body: JSON.stringify(receipt, null, 2), contentType: 'application/json' });
});
