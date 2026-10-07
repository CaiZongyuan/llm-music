import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMusicClient } from '@llm-music/api-client';
import { expect, test } from '@playwright/test';

const root = fileURLToPath(new URL('../../', import.meta.url));
const referencePath = resolve(root, 'docs/previews/web-mvp-v1/reference-16s.wav');
function received<T>(result: { data?: T; response: Response }): T {
  expect(result.response.ok).toBe(true);
  if (result.data === undefined) throw new Error('Missing public response');
  return result.data;
}

test('transcription: real readiness errors, held phase, cancel confirmation and explicit retry preserve original inputs', async ({ page, baseURL, request }, info) => {
  if (!baseURL) throw new Error('No owned Web URL');
  const api = createMusicClient({ baseUrl: `${baseURL}/api` });
  const project = received(await api.POST('/projects', { body: { name: `Transcription recovery · ${randomUUID().slice(0, 8)}` } }));
  await page.goto(`/projects/${project.id}/transcribe`);
  await page.locator('.preferences select').selectOption('en');
  await page.getByLabel('Choose WAV audio').setInputFiles(referencePath);
  await page.getByRole('button', { name: 'Add to project assets', exact: false }).click();
  await expect(page.getByRole('combobox', { name: 'Choose reference audio', exact: true }).locator('option')).toContainText('reference-16s.wav');
  const reference = received(await api.GET('/projects/{project_id}/assets', { params: { path: { project_id: project.id } } }))[0];
  if (!reference) throw new Error('No persisted reference');
  const referenceId = reference.id;
  const choose = page.getByRole('combobox', { name: 'Choose reference audio', exact: true });
  const start = page.getByRole('button', { name: 'Start transcription', exact: false });
  async function readiness(state: string) {
    expect((await request.post('/api/__fixtures/readiness', { data: { state } })).ok()).toBe(true);
    await page.getByRole('button', { name: 'Check readiness again', exact: true }).click();
  }
  async function observation(state: string, code?: string) {
    expect((await request.post(`/api/__fixtures/observations/${referenceId}`, { data: { state, phase: state === 'running' ? 'transcribing' : null, progress: null, code } })).ok()).toBe(true);
  }
  for (const [state, text] of [['model_missing', 'Required models or capabilities'], ['runtime_unavailable', 'The inference service is unavailable'], ['stale', 'Runtime observations have expired']]) {
    await readiness(state!);
    await expect(page.getByRole('region', { name: 'Transcription readiness', exact: true })).toContainText(text!);
    await expect(start).toBeDisabled();
    await expect(choose).toHaveValue(reference.id);
  }
  await readiness('ready');
  await expect(start).toBeEnabled();
  await observation('running');
  await start.click();
  await expect(page).toHaveURL(/jobId=/);
  const firstId = new URL(page.url()).searchParams.get('jobId')!;
  await expect(page.getByText('Transcribing', { exact: true })).toBeVisible();
  await expect(page.getByText('Progress is unknown; showing the current phase', { exact: true })).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await page.getByRole('button', { name: 'Request cancellation', exact: true }).click();
  await expect(page.getByText('Cancellation requested; waiting for final confirmation.', { exact: true }).first()).toBeVisible();
  await observation('cancelled', 'cancelled');
  await expect(page.locator('.tag.cancelled')).toBeVisible();
  await page.reload();
  await expect(choose).toHaveValue(reference.id);
  await expect(page.getByRole('button', { name: 'Create a new retry job', exact: true })).toBeVisible();
  const original = received(await api.GET('/projects/{project_id}/jobs/{job_id}', { params: { path: { project_id: project.id, job_id: firstId } } }));
  expect(original).toMatchObject({ status: 'cancelled', inputs: { reference_asset_id: reference.id }, result: null });
  await observation('failed', 'transcription_failed');
  await page.getByRole('button', { name: 'Create a new retry job', exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('jobId')).not.toBe(firstId);
  const failedId = new URL(page.url()).searchParams.get('jobId')!;
  await expect(page.getByRole('alert')).toContainText('This attempt could not finish');
  await expect(choose).toHaveValue(reference.id);
  await page.locator('.preferences select').selectOption('zh-CN');
  await expect(page.getByRole('alert')).toContainText('这次创作未能完成');
  await page.locator('.preferences select').selectOption('en');
  await page.reload();
  const failed = received(await api.GET('/projects/{project_id}/jobs/{job_id}', { params: { path: { project_id: project.id, job_id: failedId } } }));
  expect(failed.inputs).toEqual(original.inputs);
  expect(failed.provenance.retry_of_job_id).toBe(firstId);
  await observation('completed');
  await page.getByRole('button', { name: 'Create a new retry job', exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('jobId')).not.toBe(failedId);
  const completedId = new URL(page.url()).searchParams.get('jobId')!;
  await expect(page.getByRole('link', { name: 'Inspect score and download MIDI', exact: false })).toBeVisible();
  const completed = received(await api.GET('/projects/{project_id}/jobs/{job_id}', { params: { path: { project_id: project.id, job_id: completedId } } }));
  expect(completed).toMatchObject({ status: 'completed', inputs: original.inputs, provenance: { retry_of_job_id: failedId } });
  await page.getByRole('link', { name: 'Inspect score and download MIDI', exact: false }).click();
  await expect(page.getByRole('region', { name: 'Score preview', exact: true }).locator('svg')).toBeVisible();
  await info.attach('transcription-recovery-identities', { body: JSON.stringify({ scope: 'production FastAPI + SQLite + controlled CPU FakeRuntime; no mocked business HTTP response or model inference', reference, original, failed, completed }, null, 2), contentType: 'application/json' });
});
