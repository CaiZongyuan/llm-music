import { randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMusicClient } from '@llm-music/api-client';
import { test, expect } from '@playwright/test';

const root = fileURLToPath(new URL('../../', import.meta.url));
const referencePath = resolve(root, 'docs/previews/web-mvp-v1/reference-16s.wav');
const referenceBytes = await readFile(referencePath);
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const labels = {
  'zh-CN': { name: '项目名称', note: '创作笔记', create: '创建并开始创作', file: '选择 WAV 音频', upload: '加入项目素材', details: '素材详情', download: '下载原文件', home: '我的项目', theme: '暗色模式', empty: '还没有参考音频' },
  en: { name: 'Project name', note: 'Creative notes', create: 'Create and start', file: 'Choose WAV audio', upload: 'Add to project assets', details: 'Asset details', download: 'Download original file', home: 'My projects', theme: 'Dark mode', empty: 'No reference audio yet' },
};
function received<T>(result: { data?: T; response: Response }): T {
  expect(result.response.ok).toBe(true);
  if (result.data === undefined) throw new Error('Missing public API response data');
  return result.data;
}

for (const locale of ['zh-CN', 'en'] as const) for (const theme of ['light', 'dark'] as const) {
  test(`${locale}/${theme}: creator project, original bytes and preferences survive navigation and reload`, async ({ page, baseURL }, info) => {
    if (!baseURL) throw new Error('Missing owned Web URL');
    const api = createMusicClient({ baseUrl: `${baseURL}/api` });
    const errors: string[] = [];
    const requests: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => requests.push(request.url()));
    const name = `雨后的散步 · ${locale}/${theme} · ${randomUUID().slice(0, 8)}`;
    const note = '保留这段参考旋律。Keep this melody.';
    const t = labels[locale];
    await page.goto('/');
    await page.getByRole('textbox', { name: labels['zh-CN'].name, exact: true }).fill(name);
    await page.getByRole('textbox', { name: labels['zh-CN'].note, exact: true }).fill(note);
    await page.getByRole('combobox').selectOption(locale);
    if (theme === 'dark') await page.getByRole('button', { name: t.theme, exact: true }).click();
    await expect(page.getByRole('textbox', { name: t.name, exact: true })).toHaveValue(name);
    await expect(page.getByRole('textbox', { name: t.note, exact: true })).toHaveValue(note);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await page.getByRole('button', { name: t.create }).click();
    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+\/?$/);
    const projectId = new URL(page.url()).pathname.split('/').filter(Boolean)[1];
    if (!projectId) throw new Error('No persisted Project id in route');
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: t.empty, exact: true })).toBeVisible();
    const project = received(await api.GET('/projects/{project_id}', { params: { path: { project_id: projectId } } }));
    expect(project).toMatchObject({ id: projectId, name, description: note });
    await page.getByLabel(t.file).setInputFiles(referencePath);
    // Switching both preferences keeps the selected native file and route identity.
    await page.getByRole('combobox').selectOption(locale === 'en' ? 'zh-CN' : 'en');
    await page.locator('.preferences button').click();
    await page.getByRole('combobox').selectOption(locale);
    await page.locator('.preferences button').click();
    await expect(page.getByLabel(t.file)).toHaveValue(/reference-16s\.wav$/);
    await expect(page).toHaveURL(new RegExp(projectId));
    await page.getByRole('button', { name: t.upload }).click();
    const detail = page.getByRole('region', { name: t.details, exact: true });
    await expect(detail.getByRole('heading', { name: 'reference-16s.wav', exact: true })).toBeVisible();
    const assets = received(await api.GET('/projects/{project_id}/assets', { params: { path: { project_id: projectId } } }));
    expect(assets).toHaveLength(1);
    const asset = assets[0];
    if (!asset) throw new Error('No saved Asset');
    expect(asset).toMatchObject({ project_id: projectId, sha256: hash(referenceBytes), size_bytes: referenceBytes.length, duration_seconds: 16, channels: 1, sample_rate: 24000 });
    await expect(detail.getByText(asset.id, { exact: true })).toBeVisible();
    await expect(detail.getByText(asset.sha256, { exact: true })).toBeVisible();
    for (const reload of [false, true]) {
      if (reload) await page.reload();
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: t.download }).click();
      const download = await downloadPromise;
      expect(await download.failure()).toBeNull();
      const downloaded = await download.path();
      if (!downloaded) throw new Error('Original file download did not finish');
      expect(hash(await readFile(downloaded))).toBe(asset.sha256);
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    }
    await page.locator('.breadcrumb').click();
    await page.getByRole('link').filter({ has: page.getByRole('heading', { name, exact: true }) }).click();
    await expect(page.getByRole('region', { name: t.details }).getByText(asset.id, { exact: true })).toBeVisible();
    await page.goto(`/projects/${projectId}`);
    expect(received(await api.GET('/projects/{project_id}', { params: { path: { project_id: projectId } } }))).toEqual(project);
    expect(received(await api.GET('/projects/{project_id}/assets', { params: { path: { project_id: projectId } } }))).toEqual(assets);
    expect(errors).toEqual([]);
    expect(requests.every(url => url.startsWith(baseURL) || url.startsWith('blob:'))).toBe(true);
    expect(requests.some(url => new URL(url).port === '8188' || new URL(url).pathname === '/prompt')).toBe(false);
    await page.screenshot({ path: info.outputPath(`${locale}-${theme}.png`), fullPage: true });
    await info.attach('restored-identities', { body: JSON.stringify({ scope: 'real Chromium + generated client + production FastAPI + CPU Fake Runtime', project, asset, original_sha256: hash(referenceBytes), locale, theme }, null, 2), contentType: 'application/json' });
  });
}

test('invalid audio, loading, failed reads, route recovery and narrow screen keep usable actions', async ({ page, baseURL }, info) => {
  if (!baseURL) throw new Error('Missing owned Web URL');
  const api = createMusicClient({ baseUrl: `${baseURL}/api` });
  const project = received(await api.POST('/projects', { body: { name: '失败恢复 · Recovery32' } }));
  await page.goto(`/projects/${project.id}`);
  await page.getByRole('combobox').selectOption('en');
  await page.getByLabel(labels.en.file).setInputFiles({ name: 'invalid.wav', mimeType: 'audio/wav', buffer: Buffer.from('This is not a WAV file') });
  const rejection = page.waitForResponse(response => response.url().endsWith(`/projects/${project.id}/assets`) && response.request().method() === 'POST');
  await page.getByRole('button', { name: labels.en.upload }).click();
  expect((await rejection).status()).toBe(422);
  await expect(page.getByRole('alert')).toContainText('Check your input or file format');
  await page.getByRole('combobox').selectOption('zh-CN');
  await expect(page.getByRole('alert')).toContainText('请检查输入或文件格式');
  expect(received(await api.GET('/projects/{project_id}/assets', { params: { path: { project_id: project.id } } }))).toEqual([]);
  await page.getByLabel(labels['zh-CN'].file).setInputFiles(referencePath);
  await page.getByRole('button', { name: labels['zh-CN'].upload }).click();
  await expect(page.getByRole('region', { name: '素材详情' })).toBeVisible();
  let failed = false;
  await page.route(`**/api/projects/${project.id}/assets`, route => {
    if (!failed && route.request().method() === 'GET') { failed = true; return route.abort('failed'); }
    return route.continue();
  });
  await page.getByRole('button', { name: '重新读取素材', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('暂时联系不到应用服务');
  await expect(page.getByLabel(labels['zh-CN'].file)).toHaveValue(/reference-16s\.wav$/);
  await page.getByRole('alert').getByRole('button', { name: '重新读取', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.unrouteAll();
  let release!: () => void;
  const gate = new Promise<void>(fulfill => { release = fulfill; });
  await page.route(`**/api/projects/${project.id}`, async route => { await gate; await route.continue(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('status').first()).toBeVisible();
  release(); await page.unrouteAll({ behavior: 'wait' });
  await expect(page.getByRole('heading', { name: project.name, exact: true })).toBeVisible();
  await page.goto(`/projects/${randomUUID()}`);
  await expect(page.getByRole('alert')).toContainText('这个项目或素材不存在');
  await page.getByRole('link', { name: '返回我的项目', exact: true }).click();
  await page.goto('/an-address-with-no-workspace');
  await expect(page.getByRole('heading', { name: '找不到这个页面', exact: true })).toBeVisible();
  await page.getByRole('link', { name: '返回我的项目', exact: true }).click();
  await page.goto(`/projects/${project.id}`);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '切换项目导航', exact: true }).click();
  await page.getByRole('link', { name: project.name, exact: false }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('narrow-recovery.png'), fullPage: true });
});

test('first shared Job consumer isolates Projects and defeats a GET captured before submission', async ({ page, baseURL }, info) => {
  if (!baseURL) throw new Error('Missing owned Web URL');
  const api = createMusicClient({ baseUrl: `${baseURL}/api` });
  const a = received(await api.POST('/projects', { body: { name: 'Job consumer A' } }));
  const b = received(await api.POST('/projects', { body: { name: 'Job consumer B' } }));
  await page.goto(`/test/consumer.html?a=${a.id}&b=${b.id}`);
  const regionA = page.getByRole('region', { name: 'Project A', exact: true });
  const regionB = page.getByRole('region', { name: 'Project B', exact: true });
  await expect(regionA.getByRole('heading', { name: '还没有创作任务' })).toBeVisible();
  await expect(regionB.getByRole('heading', { name: '还没有创作任务' })).toBeVisible();
  let release!: () => void;
  let captured!: () => void;
  const gate = new Promise<void>(fulfill => { release = fulfill; });
  const oldReadCaptured = new Promise<void>(fulfill => { captured = fulfill; });
  let holdingOldRead = true;
  await page.route(`**/api/projects/${a.id}/jobs`, async route => {
    if (!holdingOldRead) return route.continue();
    holdingOldRead = false;
    const stale = await route.fetch();
    expect(await stale.json()).toEqual([]);
    captured(); await gate;
    await route.fulfill({ response: stale });
  });
  await regionA.getByRole('button', { name: '重新读取任务', exact: true }).click();
  await oldReadCaptured;
  const submission = page.waitForResponse(response => response.url().endsWith(`/projects/${a.id}/jobs/generate`) && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Submit fixture job to A' }).click();
  expect((await submission).status()).toBe(202);
  const jobs = received(await api.GET('/projects/{project_id}/jobs', { params: { path: { project_id: a.id } } }));
  expect(jobs).toHaveLength(1);
  const job = jobs[0];
  if (!job) throw new Error('No persisted fixture Job');
  await expect(regionA.getByText(`任务标识: ${job.id}`, { exact: true })).toHaveCount(2);
  release(); await page.unrouteAll({ behavior: 'wait' });
  await expect(regionA.getByText(`任务标识: ${job.id}`, { exact: true })).toHaveCount(2);
  await expect(regionB.getByRole('heading', { name: '还没有创作任务' })).toBeVisible();
  expect(received(await api.GET('/projects/{project_id}/jobs', { params: { path: { project_id: b.id } } }))).toEqual([]);
  await page.reload();
  await expect(regionA.getByText(`任务标识: ${job.id}`, { exact: true })).toHaveCount(1);
  await expect(regionB.getByRole('heading', { name: '还没有创作任务' })).toBeVisible();
  const recovered = received(await api.GET('/projects/{project_id}/jobs/{job_id}', { params: { path: { project_id: a.id, job_id: job.id } } }));
  expect(recovered.id).toBe(job.id);
  expect(received(await api.GET('/projects/{project_id}/jobs', { params: { path: { project_id: a.id } } }))).toHaveLength(1);
  await info.attach('job-consumer-identities', { body: JSON.stringify({ a: a.id, b: b.id, job: recovered, old_get_result: [], scope: 'actual CPU FakeRuntime submission through shared Web hooks; no WS/reconnect claim' }, null, 2), contentType: 'application/json' });
});
