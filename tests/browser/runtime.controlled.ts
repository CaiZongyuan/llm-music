import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMusicClient } from '@llm-music/api-client';
import { test, expect, type APIRequestContext } from '@playwright/test';

async function scenario(request: APIRequestContext, value: string) {
  const response = await request.post('/api/__runtime_fixture', { data: { scenario: value } });
  expect(response.ok()).toBe(true);
}

test('model files expose missing/downloading/ready/invalid with actual registration and source facts', async ({ page, request, baseURL }, info) => {
  if (!baseURL) throw new Error('Missing owned Web URL');
  const api = createMusicClient({ baseUrl: `${baseURL}/api` });
  for (const [state, label] of [['missing', '缺失'], ['downloading', '下载中'], ['ready', '已就绪'], ['invalid', '校验失败']] as const) {
    await scenario(request, state);
    await page.goto('/runtime');
    await page.getByRole('combobox').selectOption('zh-CN');
    const result = await api.GET('/runtime/models');
    expect(result.response.ok).toBe(true);
    if (!result.data) throw new Error('No public model response');
    expect(result.data.models.length).toBeGreaterThan(0);
    for (const model of result.data.models) {
      expect(model.state).toBe(state);
      const card = page.getByRole('article', { name: model.name, exact: true });
      await expect(card.locator('strong').first()).toHaveText(label);
      await card.getByText('版本与校验来源', { exact: true }).click();
      await expect(card).toContainText(model.repository); await expect(card).toContainText(model.revision);
      await expect(card).toContainText(model.expected_sha256); await expect(card).toContainText(model.weights_license);
    }
    await page.getByRole('combobox').selectOption('en');
    await expect(page.getByRole('region', { name: 'Music models', exact: true })).toBeVisible();
  }
  await page.screenshot({ path: info.outputPath('invalid-models.png'), fullPage: true });
});

test('current, missing, expired and disconnected observations preserve scopes without inventing telemetry', async ({ page, request }, info) => {
  await scenario(request, 'ready'); await page.goto('/runtime');
  await page.getByRole('combobox').selectOption('en');
  const devices = page.getByRole('region', { name: 'Device observations', exact: true });
  await expect(devices).toContainText('Synthetic CPU display GPU');
  await expect(page.getByLabel('GPU device memory free', { exact: true }).locator('strong')).toHaveText('5.00 GiB (5,368,709,120 bytes)');
  await expect(page.getByLabel('Runtime Torch active memory', { exact: true }).locator('strong')).toHaveText('1.00 GiB (1,073,741,824 bytes)');
  await expect(page.getByLabel('Runtime process GPU resident memory', { exact: true }).locator('strong')).toHaveText('Unknown');
  await expect(devices).toContainText('Verified files do not establish loaded state');
  for (const state of ['unknown', 'stale', 'future', 'unavailable'] as const) {
    await scenario(request, state); await page.getByRole('button', { name: 'Check again', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Check again', exact: true })).toBeEnabled();
    await expect(page.getByLabel('GPU device memory total', { exact: true }).locator('strong')).toHaveText(state === 'stale' ? 'Observation expired' : 'Unknown');
    if (state === 'unavailable') await expect(page.getByRole('region', { name: 'Services and creation readiness', exact: true })).toContainText('Disconnected');
  }
  await scenario(request, 'expire'); await page.getByRole('button', { name: 'Check again', exact: true }).click();
  await expect(page.getByLabel('GPU device memory total', { exact: true }).locator('strong')).toHaveText('8.00 GiB (8,589,934,592 bytes)');
  await expect(page.getByLabel('GPU device memory total', { exact: true }).locator('strong')).toHaveText('Observation expired', { timeout: 7000 });
  await expect(devices).toContainText('Previous record; does not establish current state');
  await expect(page.getByRole('region', { name: 'Services and creation readiness', exact: true })).toContainText('Not ready');
  await page.screenshot({ path: info.outputPath('expired-observation.png'), fullPage: true });
});

test('empty/loading/API outage recover through HTTP; language/theme and narrow layout remain usable', async ({ page, request }, info) => {
  await scenario(request, 'empty'); await page.goto('/runtime');
  await expect(page.getByRole('region', { name: '音乐模型', exact: true })).toContainText('没有登记的模型');
  await scenario(request, 'loading'); await page.reload();
  await expect(page.getByRole('status').first()).toBeVisible();
  await expect(page.getByRole('button', { name: '重新检查', exact: true })).toBeEnabled();
  await scenario(request, 'api-error'); await page.getByRole('button', { name: '重新检查', exact: true }).click();
  await expect(page.getByRole('alert').first()).toBeVisible();
  await expect(page.getByRole('region', { name: '服务与创作准备', exact: true })).not.toContainText('已就绪');
  await page.getByRole('combobox').selectOption('en');
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
  await expect(page.getByRole('alert').first()).toContainText('Current state could not be read');
  await scenario(request, 'ready'); await page.getByRole('button', { name: 'Check again', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Device observations', exact: true })).toContainText('Synthetic CPU display GPU');
  await page.locator('main').getByRole('link', { name: 'Settings', exact: true }).click();
  await scenario(request, 'api-error'); await page.getByRole('button', { name: 'Read configuration reference again', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await scenario(request, 'ready'); await page.getByRole('button', { name: 'Read configuration reference again', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('lang', 'en'); await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({ path: info.outputPath('narrow-settings.png'), fullPage: true });
});

test('application queue preserves Job identity, unknown native occupancy and reload recovery', async ({ page, request, baseURL }, info) => {
  if (!baseURL) throw new Error('Missing owned Web URL');
  await scenario(request, 'queue');
  const api = createMusicClient({ baseUrl: `${baseURL}/api` });
  const projectResult = await api.POST('/projects', { body: { name: 'Runtime queue source evidence' } });
  const project = projectResult.data; if (!project) throw new Error('No Project');
  const reference = fileURLToPath(new URL('../../docs/previews/web-mvp-v1/reference-16s.wav', import.meta.url));
  const assetResponse = await request.post(`/api/projects/${project.id}/assets`, { multipart: { file: { name: 'reference.wav', mimeType: 'audio/wav', buffer: await (await import('node:fs/promises')).readFile(resolve(reference)) } } });
  expect(assetResponse.status()).toBe(201);
  const asset: unknown = await assetResponse.json();
  if (typeof asset !== 'object' || asset === null || !('id' in asset) || typeof asset.id !== 'string') throw new Error('No Asset');
  const submitted = await api.POST('/projects/{project_id}/transcriptions', { params: { path: { project_id: project.id } }, body: { reference_asset_id: asset.id } });
  const job = submitted.data; if (!job) throw new Error('No Job');
  await page.goto('/runtime'); await page.getByRole('combobox').selectOption('en');
  for (const reload of [false, true]) {
    if (reload) await page.reload();
    const queue = page.getByRole('region', { name: 'Application Job queue', exact: true });
    await expect(queue.getByRole('article', { name: job.id, exact: true })).toContainText('Running');
    await expect(queue).toContainText('rather than all GPU occupancy');
    await expect(queue).toContainText('Unknown');
    await expect(queue.getByRole('link', { name: job.id, exact: true })).toHaveAttribute('href', `/projects/${project.id}`);
  }
  const diagnostics = await api.GET('/runtime/diagnostics');
  expect(diagnostics.data?.application_queue.jobs.some(value => value.id === job.id)).toBe(true);
  expect(diagnostics.data?.native_queue_occupancy.value).toBeNull();
  await info.attach('queue-identity', { body: JSON.stringify({ projectId: project.id, assetId: asset.id, jobId: job.id, diagnostics: diagnostics.data }, null, 2), contentType: 'application/json' });
  await scenario(request, 'ready');
});
