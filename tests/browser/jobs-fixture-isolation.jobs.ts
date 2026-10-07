import { randomUUID } from 'node:crypto';
import { createMusicClient } from '@llm-music/api-client';
import { expect } from '@playwright/test';
import { test } from './jobs-fixture.js';

function received<T>(result: { data?: T; response: Response }): T {
  expect(result.response.ok).toBe(true);
  if (result.data === undefined) throw new Error('Missing public API response');
  return result.data;
}
test('interrupted navigation after accepted setup leaves its held Job for fixture cleanup', async ({ page, request, baseURL }, info) => {
  if (!baseURL) throw new Error('Missing owned Web URL');
  const api = createMusicClient({ baseUrl: `${baseURL}/api` });
  expect((await request.post('/api/__fixtures/observations/330070', { data: { state: 'running', phase: 'preparing' } })).ok()).toBe(true);
  const project = received(await api.POST('/projects', { body: { name: `Interrupted navigation ${randomUUID()}` } }));
  const job = received(await api.POST('/projects/{project_id}/jobs/generate', { params: { path: { project_id: project.id } }, body: { style: 'piano', lyrics: 'Morning', seed: 330070 } }));
  await expect.poll(async () => received(await api.GET('/projects/{project_id}/jobs/{job_id}', { params: { path: { project_id: project.id, job_id: job.id } } })).status).toBe('running');
  await page.route(`**/projects/${project.id}/jobs`, route => route.abort('failed'));
  await expect(page.goto(`/projects/${project.id}/jobs`)).rejects.toThrow('net::ERR_FAILED');
  await info.attach('interrupted-setup', { body: JSON.stringify({ project: project.id, job: job.id, outcome: 'accepted held CPU Job followed by a deliberately interrupted browser navigation', scope: 'reproduces leftover setup state; does not reproduce the CI host buffer exhaustion' }), contentType: 'application/json' });
});
test('the following browser case starts its own Job after the interrupted setup', async ({ page, request, baseURL }) => {
  if (!baseURL) throw new Error('Missing owned Web URL');
  const api = createMusicClient({ baseUrl: `${baseURL}/api` });
  expect((await request.post('/api/__fixtures/observations/330071', { data: { state: 'running', phase: 'preparing' } })).ok()).toBe(true);
  const project = received(await api.POST('/projects', { body: { name: 'Following independent browser case' } }));
  const job = received(await api.POST('/projects/{project_id}/jobs/generate', { params: { path: { project_id: project.id } }, body: { style: 'piano', lyrics: 'Morning', seed: 330071 } }));
  await page.goto(`/projects/${project.id}/jobs?jobId=${job.id}`);
  await expect(page.locator(`[data-job-id="${job.id}"] .tag`)).toHaveText('正在创作');
});
