import { createMusicClient } from '@llm-music/api-client';
import { test as base, expect } from '@playwright/test';

function received<T>(result: { data?: T; response: Response }): T {
  if (!result.response.ok || result.data === undefined) throw new Error(`Owned fixture HTTP read failed: ${result.response.status}`);
  return result.data;
}
export const test = base.extend<{ settleOwnedJobs: void }>({
  settleOwnedJobs: [async ({ request, baseURL }, use, info) => {
    try { await use(); } finally {
      if (!baseURL) throw new Error('Missing owned fixture URL');
      const api = createMusicClient({ baseUrl: `${baseURL}/api` });
      const before = received(await api.GET('/runtime/diagnostics'));
      if (before.mode !== 'fake') throw new Error('Job fixture cleanup requires the owned CPU API');
      expect((await request.post('/api/__fixtures/readiness', { data: { state: 'ready' } })).ok()).toBe(true);
      const settled = [];
      for (const target of before.application_queue.jobs) {
        const path = { project_id: target.project_id, job_id: target.id };
        const job = received(await api.GET('/projects/{project_id}/jobs/{job_id}', { params: { path } }));
        if (job.status !== 'queued' && job.status !== 'running') continue;
        const identity = job.inputs.reference_asset_id ?? job.inputs.seed;
        if (typeof identity !== 'string' && typeof identity !== 'number') throw new Error('Active fixture Job has no observation identity');
        const url = `/api/__fixtures/observations/${encodeURIComponent(String(identity))}`;
        const observation = await request.get(url);
        expect(observation.ok()).toBe(true);
        const current: { state: string | null } = await observation.json();
        // Retain terminal native evidence and saving; a default short fixture
        // finishes naturally. Only a held active observation is confirmed cancelled.
        if (job.phase !== 'saving' && current.state && ['queued', 'running', 'unconfirmed'].includes(current.state)) {
          expect((await request.post(url, { data: { state: 'cancelled', code: 'cancelled' } })).ok()).toBe(true);
        }
        const result = received(await api.POST('/projects/{project_id}/jobs/{job_id}/cancel', { params: { path } }));
        settled.push({ id: result.id, project_id: result.project_id, status: result.status });
      }
      await expect.poll(async () => received(await api.GET('/runtime/diagnostics')).application_queue.jobs).toHaveLength(0);
      await info.attach('owned-fixture-cleanup', { body: JSON.stringify({ mode: before.mode, active_before: before.application_queue.jobs, scoped_cancellation_results: settled, active_after: [] }), contentType: 'application/json' });
    }
  }, { auto: true }],
});
