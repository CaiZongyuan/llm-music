import { createHash, randomUUID } from 'node:crypto';
import { readFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMusicClient } from '@llm-music/api-client';
import { expect, test } from '@playwright/test';

const root = fileURLToPath(new URL('../../', import.meta.url));
const referencePath = resolve(root, 'docs/previews/web-mvp-v1/reference-16s.wav');
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const labels = {
  'zh-CN': { file: '选择 WAV 音频', upload: '加入项目素材', reference: '选择参考音频', start: '开始转谱', inspect: '查看乐谱与下载 MIDI', staff: '乐谱预览', midi: '下载 MIDI', abc: '下载 ABC', readJob: '重新读取任务', source: '原参考音频' },
  en: { file: 'Choose WAV audio', upload: 'Add to project assets', reference: 'Choose reference audio', start: 'Start transcription', inspect: 'Inspect score and download MIDI', staff: 'Score preview', midi: 'Download MIDI', abc: 'Download ABC', readJob: 'Read jobs again', source: 'Original reference audio' },
};
function received<T>(result: { data?: T; response: Response }): T {
  expect(result.response.ok).toBe(true);
  if (result.data === undefined) throw new Error('No public API data');
  return result.data;
}
// Read the downloaded Standard MIDI File, including event timing, rather than trusting its extension.
function midiNotes(bytes: Buffer) {
  expect(bytes.toString('ascii', 0, 4)).toBe('MThd');
  expect(bytes.readUInt32BE(4)).toBe(6);
  const tracks = bytes.readUInt16BE(10);
  expect(tracks).toBeGreaterThan(0);
  expect(bytes.readUInt16BE(12)).toBeGreaterThan(0);
  let cursor = 14;
  const notes: { pitch: number; time: number }[] = [];
  for (let track = 0; track < tracks; track++) {
    expect(bytes.toString('ascii', cursor, cursor + 4)).toBe('MTrk');
    const end = cursor + 8 + bytes.readUInt32BE(cursor + 4);
    expect(end).toBeLessThanOrEqual(bytes.length);
    cursor += 8;
    let time = 0, running = 0, ended = false;
    function variable() {
      let value = 0;
      for (let count = 0; count < 4; count++) {
        const part = bytes[cursor++];
        if (part === undefined || cursor > end) throw new Error('Truncated MIDI event');
        value = (value << 7) | (part & 127);
        if (!(part & 128)) return value;
      }
      throw new Error('Invalid MIDI variable integer');
    }
    while (cursor < end) {
      time += variable();
      const next = bytes[cursor];
      if (next === undefined) throw new Error('No MIDI event');
      const status = next & 128 ? bytes[cursor++]! : running;
      if (status === 255) {
        const type = bytes[cursor++];
        const length = variable();
        cursor += length;
        if (type === 47) ended = true;
      } else if (status === 240 || status === 247) {
        cursor += variable();
      } else {
        expect(status).toBeGreaterThanOrEqual(128); expect(status).toBeLessThan(240);
        running = status;
        const pitch = bytes[cursor++]!;
        const velocity = (status & 240) === 192 || (status & 240) === 208 ? 0 : bytes[cursor++]!;
        if ((status & 240) === 144 && velocity > 0) notes.push({ pitch, time });
      }
      expect(cursor).toBeLessThanOrEqual(end);
    }
    expect(ended).toBe(true);
  }
  expect(cursor).toBe(bytes.length);
  return notes;
}

for (const locale of ['zh-CN', 'en'] as const) for (const theme of ['light', 'dark'] as const) {
  test(`transcription ${locale}/${theme}: real upload, notation, native downloads and refreshed identities`, async ({ page, baseURL }, info) => {
    if (!baseURL) throw new Error('No owned Web URL');
    const api = createMusicClient({ baseUrl: `${baseURL}/api` });
    const project = received(await api.POST('/projects', { body: { name: `转谱 · ${locale}/${theme} · ${randomUUID().slice(0, 8)}`, description: 'Keep the original melody. 保留旋律。' } }));
    const errors: string[] = [];
    const requests: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => requests.push(request.url()));
    await page.goto(`/projects/${project.id}/transcribe`);
    await page.getByRole('combobox', { name: '语言', exact: true }).selectOption(locale);
    if (theme === 'dark') await page.locator('.preferences button').click();
    const t = labels[locale];
    await page.getByLabel(t.file).setInputFiles(referencePath);
    // Both mounted native file selection and Project identity survive preference changes.
    await page.locator('.preferences select').selectOption(locale === 'en' ? 'zh-CN' : 'en');
    await page.locator('.preferences button').click();
    await page.locator('.preferences select').selectOption(locale);
    await page.locator('.preferences button').click();
    await expect(page.getByLabel(t.file)).toHaveValue(/reference-16s\.wav$/);
    await page.getByRole('button', { name: t.upload }).click();
    await expect(page.getByRole('combobox', { name: t.reference, exact: true }).locator('option')).toContainText('reference-16s.wav');
    const reference = received(await api.GET('/projects/{project_id}/assets', { params: { path: { project_id: project.id } } }))[0];
    if (!reference) throw new Error('No uploaded reference');
    await expect(page.getByRole('combobox', { name: t.reference, exact: true })).toHaveValue(reference.id);
    await page.getByRole('button', { name: t.start, exact: false }).click();
    await expect(page).toHaveURL(/jobId=/);
    const jobId = new URL(page.url()).searchParams.get('jobId');
    if (!jobId) throw new Error('No persistent Job route identity');
    // The foundation has an explicit HTTP refresh; the integrated Monitor updates this same cache.
    await page.getByRole('button', { name: t.readJob, exact: true }).last().click();
    const inspect = page.getByRole('link', { name: t.inspect, exact: false });
    await expect(inspect).toBeVisible();
    const job = received(await api.GET('/projects/{project_id}/jobs/{job_id}', { params: { path: { project_id: project.id, job_id: jobId } } }));
    expect(job).toMatchObject({ status: 'completed', inputs: { reference_asset_id: reference.id } });
    const scoreId = job.result?.score_id;
    if (!scoreId || !job.result?.midi_asset_id || !job.result.abc_asset_id) throw new Error('Incomplete imported result');
    const score = received(await api.GET('/projects/{project_id}/scores/{score_id}', { params: { path: { project_id: project.id, score_id: scoreId } } }));
    expect(score).toMatchObject({ job_id: jobId, source_reference_asset_id: reference.id, abc_asset_id: job.result.abc_asset_id });
    await inspect.click();
    await expect(page.getByRole('region', { name: t.staff, exact: true }).locator('svg')).toBeVisible();
    await expect(page.getByText(reference.id, { exact: true })).toBeVisible();
    await expect(page.getByText(t.source, { exact: true })).toBeVisible();
    const downloaded: Record<string, string> = {};
    for (const reload of [false, true]) {
      if (reload) await page.reload();
      await expect(page.getByRole('region', { name: t.staff, exact: true }).locator('svg')).toBeVisible();
      for (const kind of ['midi', 'abc'] as const) {
        const assetId = job.result[`${kind}_asset_id`];
        if (!assetId) throw new Error('No result file');
        const metadata = received(await api.GET('/projects/{project_id}/assets/{asset_id}', { params: { path: { project_id: project.id, asset_id: assetId } } }));
        const downloadPromise = page.waitForEvent('download');
        await page.getByRole('button', { name: t[kind], exact: false }).click();
        const download = await downloadPromise;
        expect(await download.failure()).toBeNull();
        expect(download.suggestedFilename()).toBe(metadata.original_name);
        const path = await download.path();
        if (!path) throw new Error('Native download did not finish');
        const bytes = await readFile(path);
        expect(hash(bytes)).toBe(metadata.sha256);
        if (kind === 'midi') expect(midiNotes(bytes)).toEqual([{ pitch: 60, time: 0 }, { pitch: 62, time: 480 }, { pitch: 64, time: 960 }, { pitch: 65, time: 1440 }]);
        else expect(bytes.toString('utf8')).toBe('X:1\nM:4/4\nL:1/4\nK:C\nC D E F |\n');
        downloaded[kind] = hash(bytes);
      }
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect(page.getByRole('heading', { name: project.name, exact: true })).toBeVisible();
    }
    await page.screenshot({ path: info.outputPath(`score-${locale}-${theme}.png`), fullPage: true });
    await page.goto(`/projects/${project.id}/transcribe?jobId=${jobId}&referenceAssetId=${reference.id}`);
    await expect(page.getByRole('combobox', { name: t.reference, exact: true })).toHaveValue(reference.id);
    await expect(page.getByRole('link', { name: t.inspect, exact: false })).toBeVisible();
    await page.reload();
    expect(received(await api.GET('/projects/{project_id}/scores/{score_id}', { params: { path: { project_id: project.id, score_id: scoreId } } }))).toEqual(score);
    expect(errors).toEqual([]);
    expect(requests.every(url => url.startsWith(baseURL) || url.startsWith('blob:'))).toBe(true);
    await page.screenshot({ path: info.outputPath(`transcription-${locale}-${theme}.png`), fullPage: true });
    await info.attach('transcription-public-results', { body: JSON.stringify({ scope: 'real Chromium + generated client + production FastAPI + valid CPU Fake Runtime output; no GPU/music accuracy claim', project, reference, job, score, downloaded }, null, 2), contentType: 'application/json' });
  });
}

test('transcription rejects invalid and unsupported audio, recovers real missing download bytes and unknown Score', async ({ page, baseURL }, info) => {
  if (!baseURL) throw new Error('No owned Web URL');
  const api = createMusicClient({ baseUrl: `${baseURL}/api` });
  const project = received(await api.POST('/projects', { body: { name: 'Transcription recovery34' } }));
  await page.goto(`/projects/${project.id}/transcribe`);
  await page.locator('.preferences select').selectOption('en');
  await page.getByLabel(labels.en.file).setInputFiles({ name: 'invalid.wav', mimeType: 'audio/wav', buffer: Buffer.from('not WAV') });
  await page.getByRole('button', { name: labels.en.upload }).click();
  await expect(page.getByRole('alert')).toContainText('Check your input or file format');
  const short = Buffer.from(await readFile(referencePath));
  short.writeUInt32LE(36 + 48_000, 4); short.writeUInt32LE(48_000, 40);
  await page.getByLabel(labels.en.file).setInputFiles({ name: 'short.wav', mimeType: 'audio/wav', buffer: short.subarray(0, 44 + 48_000) });
  await page.getByRole('button', { name: labels.en.upload }).click();
  await expect(page.getByRole('alert')).toContainText('does not match the verified profile');
  await expect(page.getByRole('button', { name: labels.en.start, exact: false })).toBeDisabled();
  await page.getByLabel(labels.en.file).setInputFiles(referencePath);
  await page.getByRole('button', { name: labels.en.upload }).click();
  await expect(page.getByRole('combobox', { name: labels.en.reference, exact: true }).locator('option')).toContainText(['short.wav', 'reference-16s.wav']);
  const assets = received(await api.GET('/projects/{project_id}/assets', { params: { path: { project_id: project.id } } }));
  const original = assets.find(asset => asset.original_name === 'reference-16s.wav');
  if (!original) throw new Error('No valid original');
  await page.getByRole('combobox', { name: labels.en.reference, exact: true }).selectOption(original.id);
  await page.getByRole('button', { name: labels.en.start, exact: false }).click();
  await expect(page).toHaveURL(/jobId=/);
  const jobId = new URL(page.url()).searchParams.get('jobId')!;
  await page.getByRole('button', { name: labels.en.readJob, exact: true }).last().click();
  await page.getByRole('link', { name: labels.en.inspect, exact: false }).click();
  const job = received(await api.GET('/projects/{project_id}/jobs/{job_id}', { params: { path: { project_id: project.id, job_id: jobId } } }));
  const midiId = job.result?.midi_asset_id;
  if (!midiId || !job.result?.score_id) throw new Error('No completed MIDI');
  const runDir = process.env.MUSIC_BROWSER_RUN_DIR;
  if (!runDir) throw new Error('No owned test directory');
  const owner = JSON.parse(await readFile(resolve(runDir, 'owner.json'), 'utf8')) as { data_dir: string; runtime_mode: string };
  expect(owner.runtime_mode).toBe('fake');
  expect(resolve(owner.data_dir)).toBe(resolve(runDir, 'application'));
  const path = resolve(owner.data_dir, 'assets', project.id, `${midiId}.mid`);
  const saved = await readFile(path);
  await expect(page.getByRole('button', { name: labels.en.midi, exact: false })).toBeEnabled();
  await rename(path, `${path}.temporarily-unavailable`);
  try {
    await page.getByRole('button', { name: labels.en.midi, exact: false }).click();
    await expect(page.getByRole('alert')).toContainText('Your saved score remains');
    await page.locator('.preferences select').selectOption('zh-CN');
    await expect(page.getByRole('alert')).toContainText('已保存的乐谱仍保留');
  } finally { await rename(`${path}.temporarily-unavailable`, path); }
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '再次下载', exact: true }).click();
  const recovered = await (await downloadPromise).path();
  if (!recovered) throw new Error('No recovered download');
  expect(await readFile(recovered)).toEqual(saved);
  await page.goto(`/projects/${project.id}/scores/${randomUUID()}`);
  await expect(page.getByRole('alert')).toContainText('score_not_found');
  await page.getByRole('link', { name: '返回项目乐谱', exact: false }).click();
  await page.getByRole('link', { name: '查看乐谱', exact: false }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('region', { name: '乐谱预览', exact: true }).locator('svg')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('score-download-recovery-narrow.png'), fullPage: true });
});

test('generated Score has its own ABC and does not borrow a transcription reference or MIDI', async ({ page, baseURL }) => {
  if (!baseURL) throw new Error('No owned Web URL');
  const api = createMusicClient({ baseUrl: `${baseURL}/api` });
  const project = received(await api.POST('/projects', { body: { name: 'Generated Score ownership34' } }));
  const generated = received(await api.POST('/projects/{project_id}/jobs/generate', { params: { path: { project_id: project.id } }, body: { style: 'Warm piano', lyrics: '[Verse]\nRain is gone', seed: 7 } }));
  const params = { path: { project_id: project.id, job_id: generated.id } };
  await expect.poll(async () => received(await api.GET('/projects/{project_id}/jobs/{job_id}', { params })).status).toBe('completed');
  const job = received(await api.GET('/projects/{project_id}/jobs/{job_id}', { params }));
  if (!job.result?.score_id) throw new Error('No generated Score');
  await page.goto(`/projects/${project.id}/scores/${job.result.score_id}`);
  await page.locator('.preferences select').selectOption('en');
  await expect(page.getByText('Music generation, no reference audio', { exact: true })).toBeVisible();
  await expect(page.getByText('This score has no registered MIDI. You can still inspect and download its ABC.', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: labels.en.staff, exact: true }).locator('svg')).toBeVisible();
  await expect(page.getByRole('button', { name: labels.en.midi, exact: false })).toHaveCount(0);
  await expect(page.getByRole('button', { name: labels.en.abc, exact: false })).toBeEnabled();
});
