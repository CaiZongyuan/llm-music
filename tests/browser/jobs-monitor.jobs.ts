import { randomUUID } from 'node:crypto';
import { createMusicClient, type JobRead } from '@llm-music/api-client';
import { test, expect, type APIRequestContext, type WebSocketRoute } from '@playwright/test';

function received<T>(result: { data?: T; response: Response }): T {
  expect(result.response.ok).toBe(true);
  if (result.data === undefined) throw new Error('Missing public API data');
  return result.data;
}
async function control(request: APIRequestContext, seed: number, value: { state: string; phase?: string | null; progress?: number | null; code?: string }) {
  expect((await request.post(`/api/__fixtures/observations/${seed}`, { data: value })).ok()).toBe(true);
}
const labels = {
  'zh-CN': { queued: '等待创作资源', running: '正在创作', completed: '已完成', cancelled: '已取消', failed: '未完成', cancel: '请求取消', pending: '已提出取消，等待最终确认。', retry: '创建新的重试任务', unknown: '进度未知，当前只显示阶段', preparing: '准备创作', measured: '已测量进度', refresh: '重新读取任务', theme: '暗色模式' },
  en: { queued: 'Waiting for creative resources', running: 'Creating', completed: 'Completed', cancelled: 'Cancelled', failed: 'Failed', cancel: 'Request cancellation', pending: 'Cancellation requested; waiting for final confirmation.', retry: 'Create a new retry job', unknown: 'Progress is unknown; showing the current phase', preparing: 'Preparing', measured: 'Measured progress', refresh: 'Read jobs again', theme: 'Dark mode' },
};

for (const locale of ['zh-CN', 'en'] as const) for (const theme of ['light', 'dark'] as const) {
  test(`${locale}/${theme}: real persisted lifecycle, pending cancel, new retry identity and reload`, async ({ page, request, baseURL }, info) => {
    if (!baseURL) throw new Error('Missing owned Web URL');
    const api = createMusicClient({ baseUrl: `${baseURL}/api` });
    const seed = Math.floor(Math.random() * 1_000_000);
    await control(request, seed, { state: 'running', phase: 'preparing' });
    const project = received(await api.POST('/projects', { body: { name: `雨后的散步 ${randomUUID()}` } }));
    const original = received(await api.POST('/projects/{project_id}/jobs/generate', { params: { path: { project_id: project.id } }, body: { style: '保留中文输入 warm piano', lyrics: '[Verse]\nA walk after rain', seed } }));
    await page.goto(`/projects/${project.id}/jobs`);
    await page.getByRole('combobox').selectOption(locale);
    const t = labels[locale];
    if (theme === 'dark') await page.getByRole('button', { name: t.theme, exact: true }).click();
    const card = page.locator(`[data-job-id="${original.id}"]`);
    await expect(card.locator('.tag')).toHaveText(t.running);
    await expect(card.getByText(t.preparing, { exact: true })).toBeVisible();
    await expect(card.getByText(t.unknown, { exact: true })).toBeVisible();
    await expect(card.locator('progress')).toHaveCount(0);
    await control(request, seed, { state: 'running', phase: null });
    await expect(card.getByText(t.preparing, { exact: true })).toHaveCount(0);
    await control(request, seed, { state: 'running', phase: 'synthesizing', progress: 0.35 });
    await expect(card.getByRole('progressbar', { name: t.measured })).toHaveAttribute('value', '0.35');
    await expect(card.getByText('35%', { exact: true })).toBeVisible();
    await card.getByRole('button', { name: t.cancel, exact: true }).click();
    await expect(card.getByText(t.pending, { exact: true })).toBeVisible();
    await expect(card.locator('.tag')).toHaveText(t.running);
    await control(request, seed, { state: 'cancelled', code: 'cancelled' });
    await expect(card.locator('.tag')).toHaveText(t.cancelled);
    const cancelled = received(await api.GET('/projects/{project_id}/jobs/{job_id}', { params: { path: { project_id: project.id, job_id: original.id } } }));
    expect(cancelled).toMatchObject({ id: original.id, status: 'cancelled', cancel_requested: true, result: null });
    await control(request, seed, { state: 'failed', code: 'generation_failed' });
    await card.getByRole('button', { name: t.retry, exact: true }).click();
    await expect.poll(async () => received(await api.GET('/projects/{project_id}/jobs', { params: { path: { project_id: project.id } } })).length).toBe(2);
    const jobs = received(await api.GET('/projects/{project_id}/jobs', { params: { path: { project_id: project.id } } }));
    const next = jobs.find(job => job.provenance.retry_of_job_id === original.id);
    if (!next) throw new Error('Missing persisted new retry');
    expect(next.id).not.toBe(original.id); expect(next.inputs).toEqual(original.inputs);
    const retryCard = page.locator(`[data-job-id="${next.id}"]`);
    await expect(retryCard.locator('.tag')).toHaveText(t.failed);
    await expect(retryCard.getByRole('alert')).toContainText(locale === 'en' ? 'This attempt could not finish' : '这次创作未能完成');
    await page.reload();
    await expect(card.locator('.tag')).toHaveText(t.cancelled);
    await expect(retryCard.locator('.tag')).toHaveText(t.failed);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    expect(received(await api.GET('/projects/{project_id}/jobs', { params: { path: { project_id: project.id } } }))).toHaveLength(2);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`${locale}-${theme}-retry.png`), fullPage: true });
    await info.attach('persisted-jobs', { body: JSON.stringify({ original: cancelled, retry: next, scope: 'production FastAPI/SQLite with controlled CPU Runtime, no GPU inference' }, null, 2), contentType: 'application/json' });
  });
}

test('queued cancellation and completion racing running cancel preserve the actual server outcomes', async ({ page, request, baseURL }) => {
  if (!baseURL) throw new Error('Missing Web URL');
  const api = createMusicClient({ baseUrl: `${baseURL}/api` });
  const seed = 330001;
  await control(request, seed, { state: 'running', phase: 'synthesizing' });
  const project = received(await api.POST('/projects', { body: { name: 'Cancel isolation' } }));
  const submit = (seed: number) => api.POST('/projects/{project_id}/jobs/generate', { params: { path: { project_id: project.id } }, body: { style: 'piano', lyrics: 'Morning', seed } });
  const running = received(await submit(seed));
  await page.goto(`/projects/${project.id}/jobs`);
  const active = page.locator(`[data-job-id="${running.id}"]`);
  await expect(active.locator('.tag')).toHaveText(labels['zh-CN'].running);
  const queued = received(await submit(330002));
  await page.getByRole('button', { name: labels['zh-CN'].refresh, exact: true }).click();
  const waiting = page.locator(`[data-job-id="${queued.id}"]`);
  await expect(waiting.locator('.tag')).toHaveText(labels['zh-CN'].queued);
  await waiting.getByRole('button', { name: labels['zh-CN'].cancel, exact: true }).click();
  await expect(waiting.locator('.tag')).toHaveText(labels['zh-CN'].cancelled);
  await expect(active.locator('.tag')).toHaveText(labels['zh-CN'].running);
  await active.getByRole('button', { name: labels['zh-CN'].cancel, exact: true }).click();
  await expect(active.getByText(labels['zh-CN'].pending, { exact: true })).toBeVisible();
  await control(request, seed, { state: 'completed' });
  await expect(active.locator('.tag')).toHaveText(labels['zh-CN'].completed);
  const final = received(await api.GET('/projects/{project_id}/jobs/{job_id}', { params: { path: { project_id: project.id, job_id: running.id } } }));
  expect(final.status).toBe('completed'); expect(final.result?.candidate_id).toBeTruthy();
});

test('hostile socket snapshots, new connection sequences, HTTP fallback and refresh keep the original persisted Job', async ({ page, request, baseURL }, info) => {
  if (!baseURL) throw new Error('Missing Web URL');
  const api = createMusicClient({ baseUrl: `${baseURL}/api` });
  const seed = 330010;
  await control(request, seed, { state: 'running', phase: 'preparing' });
  const project = received(await api.POST('/projects', { body: { name: 'Socket recovery · 保留项目' } }));
  const otherProject = received(await api.POST('/projects', { body: { name: 'Foreign socket project' } }));
  const original = received(await api.POST('/projects/{project_id}/jobs/generate', { params: { path: { project_id: project.id } }, body: { style: 'piano', lyrics: 'Morning', seed } }));
  const sockets: WebSocketRoute[] = [];
  const requests: { method: string; url: string }[] = [];
  page.on('request', request => requests.push({ method: request.method(), url: request.url() }));
  await page.routeWebSocket(`**/projects/${project.id}/jobs/${original.id}/events`, socket => { sockets.push(socket); });
  await page.goto(`/projects/${project.id}/jobs?jobId=${original.id}`);
  const card = page.locator(`[data-job-id="${original.id}"]`);
  await expect(card.locator('.tag')).toHaveText(labels['zh-CN'].running);
  await expect.poll(() => sockets.length).toBeGreaterThan(0);
  const snapshot = received(await api.GET('/projects/{project_id}/jobs/{job_id}', { params: { path: { project_id: project.id, job_id: original.id } } }));
  const lastSocket = () => { const socket = sockets.at(-1); if (!socket) throw new Error('No owned browser socket'); return socket; };
  const event = (sequence: number, job: unknown = snapshot) => JSON.stringify({ type: 'job.updated', sequence, job });
  // These are network inputs. No monitor/cache/internal method is called by tests.
  lastSocket().send(event(900));
  lastSocket().send(event(900, { ...snapshot, status: 'failed', error: { code: 'generation_failed' } }));
  lastSocket().send(event(899, { ...snapshot, phase: 'decoding_audio', progress: 0.99 }));
  lastSocket().send(event(901, { ...snapshot, project_id: otherProject.id, status: 'completed' }));
  lastSocket().send(event(902, { ...snapshot, id: randomUUID(), status: 'completed' }));
  lastSocket().send(event(903, { ...snapshot, progress: 8 }));
  lastSocket().send(event(904, { ...snapshot, inputs: null }));
  lastSocket().send(event(905, { ...snapshot, status: ['failed'] }));
  lastSocket().send('{bad json');
  // Even a well-typed future terminal hint must be confirmed by HTTP.
  lastSocket().send(event(906, { ...snapshot, status: 'completed', updated_at: '2099-01-01T00:00:00Z', result: { candidate_id: randomUUID() } }));
  await card.getByRole('button', { name: labels['zh-CN'].refresh, exact: true }).click();
  await expect(card.locator('.tag')).toHaveText(labels['zh-CN'].running);
  await expect(card.getByText(labels['zh-CN'].unknown, { exact: true })).toBeVisible();
  await expect(card.getByText('99%', { exact: true })).toHaveCount(0);
  const beforeDisconnect = sockets.length;
  lastSocket().close({ code: 1012, reason: 'Owned test disconnect' });
  await expect(card.getByRole('status')).toContainText('实时更新暂时断开');
  await control(request, seed, { state: 'running', phase: 'planning_score' });
  await expect(card.getByText('规划乐谱', { exact: true })).toBeVisible();
  await expect.poll(() => sockets.length).toBeGreaterThan(beforeDisconnect);
  lastSocket().send(event(1, { ...snapshot, phase: 'planning_score' }));
  await control(request, seed, { state: 'completed' });
  lastSocket().send(event(2, { ...snapshot, status: 'completed' }));
  await expect(card.locator('.tag')).toHaveText(labels['zh-CN'].completed);
  const final = received(await api.GET('/projects/{project_id}/jobs/{job_id}', { params: { path: { project_id: project.id, job_id: original.id } } }));
  expect(final.result?.candidate_id).toBeTruthy();
  // A late old HTTP response cannot regress a confirmed terminal state either.
  await page.route(`**/api/projects/${project.id}/jobs/${original.id}`, route => route.fulfill({ json: { ...snapshot, updated_at: '2099-01-01T00:00:00Z' } }));
  await card.getByRole('button', { name: labels['zh-CN'].refresh, exact: true }).click();
  await expect(card.locator('.tag')).toHaveText(labels['zh-CN'].completed);
  await page.unrouteAll();
  await page.reload();
  await expect(card.locator('.tag')).toHaveText(labels['zh-CN'].completed);
  await expect(page).toHaveURL(new RegExp(`jobId=${original.id}`));
  expect(received(await api.GET('/projects/{project_id}/jobs', { params: { path: { project_id: project.id } } }))).toHaveLength(1);
  expect(received(await api.GET('/projects/{project_id}/jobs', { params: { path: { project_id: otherProject.id } } }))).toEqual([]);
  expect(requests.filter(request => request.method === 'POST')).toEqual([]);
  await info.attach('socket-recovery', { body: JSON.stringify({ project: project.id, foreign: otherProject.id, original: original.id, connection_count: sockets.length, final, requests, scope: 'real persisted HTTP target with hostile browser WS inputs; no GPU' }, null, 2), contentType: 'application/json' });
});

test('lost retry acknowledgement recovers the one existing attempt without sending another write', async ({ page, request, baseURL }) => {
  if (!baseURL) throw new Error('Missing Web URL');
  const api = createMusicClient({ baseUrl: `${baseURL}/api` });
  const seed = 330020;
  await control(request, seed, { state: 'failed', code: 'generation_failed' });
  const project = received(await api.POST('/projects', { body: { name: 'Retry acknowledgement' } }));
  const original = received(await api.POST('/projects/{project_id}/jobs/generate', { params: { path: { project_id: project.id } }, body: { style: 'piano', lyrics: 'Morning', seed } }));
  await page.goto(`/projects/${project.id}/jobs?jobId=${original.id}`);
  const card = page.locator(`[data-job-id="${original.id}"]`);
  await expect(card.locator('.tag')).toHaveText(labels['zh-CN'].failed);
  await control(request, seed, { state: 'completed' });
  let accepted: JobRead | undefined;
  await page.route(`**/api/projects/${project.id}/jobs/${original.id}/retry`, async route => {
    const response = await route.fetch(); expect(response.status()).toBe(202);
    accepted = await response.json(); await route.abort('connectionreset');
  });
  await card.getByRole('button', { name: labels['zh-CN'].retry, exact: true }).click();
  await expect(card.getByRole('link')).toBeVisible();
  await expect(card.getByText('重试是否创建尚未确认。先读取现有任务，检查新的重试记录，避免重复创作。')).toHaveCount(0);
  const jobs = received(await api.GET('/projects/{project_id}/jobs', { params: { path: { project_id: project.id } } }));
  expect(jobs).toHaveLength(2); expect(accepted?.id).toBeTruthy();
  const retry = jobs.find(job => job.provenance.retry_of_job_id === original.id);
  expect(retry?.id).toBe(accepted?.id); expect(retry?.inputs).toEqual(original.inputs);
  await card.getByRole('link').click();
  await expect(page).toHaveURL(new RegExp(`jobId=${accepted?.id}`));
  await control(request, seed, { state: 'completed' });
  await expect(page.locator(`[data-job-id="${accepted?.id}"] .tag`)).toHaveText(labels['zh-CN'].completed);
  expect(received(await api.GET('/projects/{project_id}/jobs', { params: { path: { project_id: project.id } } }))).toHaveLength(2);
});

test('empty, loading and failed reads are recoverable and the global view preserves Project identities', async ({ page, request, baseURL }) => {
  if (!baseURL) throw new Error('Missing Web URL');
  const api = createMusicClient({ baseUrl: `${baseURL}/api` });
  const project = received(await api.POST('/projects', { body: { name: `空项目 · ${randomUUID()}` } }));
  await page.goto(`/projects/${project.id}/jobs`);
  await expect(page.getByRole('heading', { name: '还没有创作任务', exact: true })).toBeVisible();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**/api/projects/${project.id}/jobs`, async route => { await gate; await route.abort('failed'); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('status').first()).toContainText('正在读取');
  release();
  await expect(page.getByRole('alert')).toContainText('暂时联系不到应用服务');
  await page.unrouteAll({ behavior: 'wait' });
  await page.getByRole('alert').getByRole('button', { name: '重新读取', exact: true }).click();
  await expect(page.getByRole('heading', { name: '还没有创作任务', exact: true })).toBeVisible();
  await page.goto('/jobs');
  await expect(page.getByRole('heading', { name: project.name, exact: true })).toBeVisible();
  const section = page.locator('section').filter({ has: page.getByRole('heading', { name: project.name, exact: true }) }).first();
  await section.getByRole('link', { name: '打开项目', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${project.id}/jobs`));
});

test('uncertain cancellation displays recovery and retries confirmation only on the same Job', async ({ page, request, baseURL }) => {
  if (!baseURL) throw new Error('Missing Web URL');
  const api = createMusicClient({ baseUrl: `${baseURL}/api` });
  const seed = 330030;
  await control(request, seed, { state: 'running', phase: 'synthesizing' });
  const project = received(await api.POST('/projects', { body: { name: 'Cancel recovery' } }));
  const original = received(await api.POST('/projects/{project_id}/jobs/generate', { params: { path: { project_id: project.id } }, body: { style: 'piano', lyrics: 'Morning', seed } }));
  await page.goto(`/projects/${project.id}/jobs?jobId=${original.id}`);
  const card = page.locator(`[data-job-id="${original.id}"]`);
  await expect(card.locator('.tag')).toHaveText(labels['zh-CN'].running);
  await control(request, seed, { state: 'unconfirmed', code: 'runtime_unavailable' });
  await card.getByRole('button', { name: labels['zh-CN'].cancel, exact: true }).click();
  await expect(card.getByText('正在确认原任务，请重新读取；不会重新提交。')).toBeVisible();
  await expect(card.locator('.tag')).toHaveText(labels['zh-CN'].running);
  const pending = received(await api.GET('/projects/{project_id}/jobs/{job_id}', { params: { path: { project_id: project.id, job_id: original.id } } }));
  expect(pending).toMatchObject({ id: original.id, cancel_requested: true, recovery_required: true, status: 'running' });
  await control(request, seed, { state: 'cancelled', code: 'cancelled' });
  await card.getByRole('button', { name: '再次确认取消', exact: true }).click();
  await expect(card.locator('.tag')).toHaveText(labels['zh-CN'].cancelled);
  expect(received(await api.GET('/projects/{project_id}/jobs', { params: { path: { project_id: project.id } } }))).toHaveLength(1);
});

test('a definite readiness rejection preserves the original error and allows an explicit retry after recovery', async ({ page, request, baseURL }) => {
  if (!baseURL) throw new Error('Missing Web URL');
  const api = createMusicClient({ baseUrl: `${baseURL}/api` });
  const seed = 330040;
  await control(request, seed, { state: 'failed', code: 'generation_failed' });
  const project = received(await api.POST('/projects', { body: { name: 'Retry readiness' } }));
  const original = received(await api.POST('/projects/{project_id}/jobs/generate', { params: { path: { project_id: project.id } }, body: { style: 'piano', lyrics: 'Morning', seed } }));
  await page.goto(`/projects/${project.id}/jobs?jobId=${original.id}`);
  const card = page.locator(`[data-job-id="${original.id}"]`);
  await expect(card.locator('.tag')).toHaveText(labels['zh-CN'].failed);
  expect((await request.post('/api/__fixtures/readiness', { data: { state: 'model_missing' } })).ok()).toBe(true);
  await card.getByRole('button', { name: labels['zh-CN'].retry, exact: true }).click();
  await expect(card.getByRole('alert').filter({ hasText: '所需音乐模型不可用' })).toBeVisible();
  expect(received(await api.GET('/projects/{project_id}/jobs', { params: { path: { project_id: project.id } } }))).toHaveLength(1);
  expect((await request.post('/api/__fixtures/readiness', { data: { state: 'ready' } })).ok()).toBe(true);
  await control(request, seed, { state: 'completed' });
  await card.getByRole('button', { name: labels['zh-CN'].retry, exact: true }).click();
  await expect.poll(async () => received(await api.GET('/projects/{project_id}/jobs', { params: { path: { project_id: project.id } } })).length).toBe(2);
  await expect(page).not.toHaveURL(new RegExp(`jobId=${original.id}`));
  const originalAfter = received(await api.GET('/projects/{project_id}/jobs/{job_id}', { params: { path: { project_id: project.id, job_id: original.id } } }));
  expect(originalAfter.status).toBe('failed'); expect(originalAfter.inputs).toEqual(original.inputs); expect(originalAfter.error?.code).toBe('generation_failed');
});

for (const observer of ['detail', 'list'] as const) {
  test(`${observer}: completing while only Jobs are open refreshes recently cached empty result lists`, async ({ page, request, baseURL }, info) => {
    if (!baseURL) throw new Error('Missing Web URL');
    const api = createMusicClient({ baseUrl: `${baseURL}/api` });
    const seed = observer === 'detail' ? 330050 : 330051;
    await control(request, seed, { state: 'running', phase: 'synthesizing' });
    const project = received(await api.POST('/projects', { body: { name: `Results returned from ${observer} Jobs` } }));
    const original = received(await api.POST('/projects/{project_id}/jobs/generate', { params: { path: { project_id: project.id } }, body: { style: 'piano', lyrics: 'Morning', seed } }));
    await page.goto(`/test/job-results.html?projectId=${project.id}&jobId=${original.id}&observer=${observer}`);
    for (const label of ['Asset count', 'Score count', 'Candidate count']) await expect(page.getByLabel(label, { exact: true })).toHaveText('0');
    const cachedAt = Date.now();
    await page.getByRole('button', { name: 'Observe only Jobs', exact: true }).click();
    await expect(page.locator('.tag')).toHaveText(labels['zh-CN'].running);
    await expect(page.getByRole('region', { name: 'Saved results', exact: true })).toHaveCount(0);
    await control(request, seed, { state: 'completed' });
    if (observer === 'list') await page.getByRole('button', { name: 'Read Job list', exact: true }).click();
    await expect(page.locator('.tag')).toHaveText(labels['zh-CN'].completed);
    const assets = received(await api.GET('/projects/{project_id}/assets', { params: { path: { project_id: project.id } } }));
    const scores = received(await api.GET('/projects/{project_id}/scores', { params: { path: { project_id: project.id } } }));
    const candidates = received(await api.GET('/projects/{project_id}/candidates', { params: { path: { project_id: project.id } } }));
    expect(assets).toHaveLength(2); expect(scores).toHaveLength(1); expect(candidates).toHaveLength(1);
    await page.getByRole('button', { name: 'Return to saved results', exact: true }).click();
    await expect(page.getByLabel('Asset count', { exact: true })).toHaveText('2', { timeout: 3_000 });
    await expect(page.getByLabel('Score count', { exact: true })).toHaveText('1', { timeout: 3_000 });
    await expect(page.getByLabel('Candidate count', { exact: true })).toHaveText('1', { timeout: 3_000 });
    for (const value of [...assets, ...scores, ...candidates]) await expect(page.getByText(value.id, { exact: true })).toBeVisible();
    expect(Date.now() - cachedAt).toBeLessThan(15_000);
    await info.attach('returned-result-identities', { body: JSON.stringify({ observer, project: project.id, job: original.id, assets, scores, candidates, elapsed_since_empty_cache_ms: Date.now() - cachedAt }, null, 2), contentType: 'application/json' });
  });
}
