import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { execute, expect, object, openDocs, operation, stringField, test } from './swagger.js';

test('Swagger validates inputs and saves a generated Candidate as one stable Version', async ({ page }) => {
  await openDocs(page);
  const list = await operation(page, 'GET', '/projects');
  const existingProjects = await execute(page, list, 'GET', '/projects', 200);
  if (!Array.isArray(existingProjects)) throw new Error('Swagger Project list did not render an array');

  const create = await operation(page, 'POST', '/projects');
  await create.locator('textarea').fill(JSON.stringify({ name: 'Browser morning', description: 'Real Swagger CPU integration' }));
  const project = await execute(page, create, 'POST', '/projects', 201);
  const projectId = stringField(project, 'id');
  expect(project).toMatchObject({ name: 'Browser morning', description: 'Real Swagger CPU integration' });

  const read = await operation(page, 'GET', '/projects/{project_id}');
  await read.getByPlaceholder('project_id').fill(projectId);
  expect(await execute(page, read, 'GET', '/projects/' + projectId, 200)).toEqual(project);

  await create.locator('textarea').fill(JSON.stringify({ name: '  ' }));
  const rejected = await execute(page, create, 'POST', '/projects', 422);
  expect(rejected).toMatchObject({ error: { code: 'invalid_request' } });
  await expect(create.locator('.responses-inner')).toContainText('recovery');
  expect(await execute(page, list, 'GET', '/projects', 200)).toEqual([...existingProjects, project]);

  const base = '/projects/' + projectId;
  const inputs = { style: 'gentle folk pop', lyrics: '[Verse]\nMorning gathers on the window', seed: 2026192201 };
  const generate = await operation(page, 'POST', '/projects/{project_id}/jobs/generate');
  await generate.getByPlaceholder('project_id').fill(projectId);
  await generate.locator('textarea').fill(JSON.stringify({ ...inputs, style: '  ' }));
  expect(await execute(page, generate, 'POST', base + '/jobs/generate', 422)).toMatchObject({ error: { code: 'invalid_request' } });
  await generate.locator('textarea').fill(JSON.stringify(inputs));
  const submitted = await execute(page, generate, 'POST', base + '/jobs/generate', 202);
  const jobId = stringField(submitted, 'id');

  const getJob = await operation(page, 'GET', '/projects/{project_id}/jobs/{job_id}');
  await getJob.getByPlaceholder('project_id').fill(projectId);
  await getJob.getByPlaceholder('job_id').fill(jobId);
  let job: unknown;
  await expect.poll(async () => {
    job = await execute(page, getJob, 'GET', base + '/jobs/' + jobId, 200);
    return stringField(job, 'status');
  }).toBe('completed');
  expect(job).toMatchObject({ project_id: projectId, operation: 'Generate', error: null });
  const candidateId = stringField(object(job).result, 'candidate_id');

  const getCandidate = await operation(page, 'GET', '/projects/{project_id}/candidates/{candidate_id}');
  await getCandidate.getByPlaceholder('project_id').fill(projectId);
  await getCandidate.getByPlaceholder('candidate_id').fill(candidateId);
  const candidate = await execute(page, getCandidate, 'GET', base + '/candidates/' + candidateId, 200);
  expect(candidate).toMatchObject({ id: candidateId, project_id: projectId, job_id: jobId, inputs: { ...inputs, max_seconds: 35 }, provenance: { runtime_kind: 'fake' } });

  const getScore = await operation(page, 'GET', '/projects/{project_id}/scores/{score_id}');
  await getScore.getByPlaceholder('project_id').fill(projectId);
  const scoreId = stringField(candidate, 'score_id');
  await getScore.getByPlaceholder('score_id').fill(scoreId);
  expect(await execute(page, getScore, 'GET', base + '/scores/' + scoreId, 200))
    .toMatchObject({ id: scoreId, project_id: projectId, job_id: jobId });

  const audioId = stringField(candidate, 'audio_asset_id');
  const getAsset = await operation(page, 'GET', '/projects/{project_id}/assets/{asset_id}');
  await getAsset.getByPlaceholder('project_id').fill(projectId);
  await getAsset.getByPlaceholder('asset_id').fill(audioId);
  const audio = await execute(page, getAsset, 'GET', base + '/assets/' + audioId, 200);
  expect(audio).toMatchObject({ kind: 'generated_audio', format: 'flac', media_type: 'audio/flac', sample_rate: 48000, channels: 2 });
  const downloadAudio = await operation(page, 'GET', '/projects/{project_id}/assets/{asset_id}/content');
  await downloadAudio.getByPlaceholder('project_id').fill(projectId);
  await downloadAudio.getByPlaceholder('asset_id').fill(audioId);
  const contentResponse = page.waitForResponse(response => new URL(response.url()).pathname === base + '/assets/' + audioId + '/content');
  await downloadAudio.getByRole('button', { name: 'Execute', exact: true }).click();
  expect((await contentResponse).status()).toBe(200);
  const downloadPromise = page.waitForEvent('download');
  await downloadAudio.getByRole('link', { name: 'Download file', exact: true }).click();
  const download = await downloadPromise;
  const downloadedPath = await download.path();
  if (!downloadedPath) throw new Error('Swagger audio download did not complete');
  const bytes = await readFile(downloadedPath);
  expect(bytes.subarray(0, 4).toString('ascii')).toBe('fLaC');
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(stringField(audio, 'sha256'));
  expect(bytes.length).toBe(object(audio).size_bytes);

  const versions = await operation(page, 'GET', '/projects/{project_id}/versions');
  await versions.getByPlaceholder('project_id').fill(projectId);
  expect(await execute(page, versions, 'GET', base + '/versions', 200)).toEqual([]);
  const save = await operation(page, 'POST', '/projects/{project_id}/versions');
  await save.getByPlaceholder('project_id').fill(projectId);
  await save.locator('textarea').fill(JSON.stringify({ candidate_id: candidateId, name: 'Browser first morning' }));
  const version = await execute(page, save, 'POST', base + '/versions', 201);
  expect(version).toMatchObject({ candidate_id: candidateId, project_id: projectId, audio_asset_id: audioId, score_id: scoreId, name: 'Browser first morning', parent_version_id: null });
  expect(await execute(page, save, 'POST', base + '/versions', 200)).toEqual(version);
  expect(await execute(page, versions, 'GET', base + '/versions', 200)).toEqual([version]);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Music Application API' })).toBeVisible();
  const getVersion = await operation(page, 'GET', '/projects/{project_id}/versions/{version_id}');
  await getVersion.getByPlaceholder('project_id').fill(projectId);
  const versionId = stringField(version, 'id');
  await getVersion.getByPlaceholder('version_id').fill(versionId);
  expect(await execute(page, getVersion, 'GET', base + '/versions/' + versionId, 200)).toEqual(version);
});
