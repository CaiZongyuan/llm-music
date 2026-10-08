import { expect, test, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { assetBytes } from './cover-fixtures.js';
import { completedCandidate, control, hash, inputs, labels as playerLabels, runDir } from './generation-fixtures.js';
import { projectOnly, received } from './score-fixtures.js';
import { choosePair, generatedVersion, labels, nativeHash, nativeState, ready, region, savedPair, seek, setSeekInput, usePair } from './version-compare-fixtures.js';

const pageErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  await control({});
});
test.afterEach(async ({ page }, info) => {
  const errors = pageErrors.get(page) ?? [];
  await info.attach('uncaught-browser-errors', { body: JSON.stringify(errors), contentType: 'application/json' });
  expect(errors).toEqual([]);
});

test('saved 35s and actual 31s FLAC pair preserves absolute time and clamps at the native short end', async ({ page, baseURL }, info) => {
  const fixture = await savedPair(baseURL);
  const { project, a, b } = fixture;
  await usePair(page, project.id, a.version, b.version);
  const player = page.locator('#persistent-player');
  const native = await player.locator('audio').elementHandle();
  if (!native) throw new Error('No sole persistent native audio');
  expect(await nativeHash(page)).toBe(a.asset.sha256);
  await seek(page, 12);
  const pausedA = await nativeState(page);
  expect(pausedA.time).toBeCloseTo(12, 2);
  expect(pausedA.paused).toBe(true);
  await player.getByRole('button', { name: labels.en.switchB, exact: true }).click();
  await ready(page, b.version, 31);
  expect(await nativeHash(page)).toBe(b.asset.sha256);
  const pausedB = await nativeState(page);
  await info.attach('first-public-absolute-clock', { body: JSON.stringify({ a, b, pausedA, pausedB }, null, 2), contentType: 'application/json' });
  expect(pausedB.time).toBeCloseTo(12, 2);
  expect(pausedB.paused).toBe(true);
  await player.getByRole('button', { name: labels.en.switchA, exact: true }).click();
  await ready(page, a.version, 1679936 / 48000);
  await seek(page, 12);
  await player.getByRole('button', { name: playerLabels.en.play, exact: true }).click();
  await expect.poll(async () => (await nativeState(page)).time).toBeGreaterThan(12.1);
  const playingA = await nativeState(page);
  await player.getByRole('button', { name: labels.en.switchB, exact: true }).click();
  await expect.poll(async () => (await nativeState(page)).duration).toBeCloseTo(31, 4);
  await expect(player.locator('.wave-container')).toBeVisible();
  await expect(player.getByRole('button', { name: playerLabels.en.pause, exact: true })).toBeEnabled();
  const playingB = await nativeState(page);
  expect(playingB.time).toBeGreaterThanOrEqual(playingA.time - .1);
  expect(playingB.time).toBeLessThan(16);
  expect(playingB.paused).toBe(false);
  await player.getByRole('button', { name: playerLabels.en.pause, exact: true }).click();
  await player.getByRole('button', { name: labels.en.switchA, exact: true }).click();
  await ready(page, a.version, 1679936 / 48000);
  await seek(page, 33);
  await player.getByRole('button', { name: labels.en.switchB, exact: true }).click();
  await ready(page, b.version, 31);
  await expect.poll(async () => { const media = await nativeState(page); return { time: media.time, paused: media.paused, ended: media.ended }; }).toEqual({ time: 31, paused: true, ended: true });
  const shortEnd = await nativeState(page);
  await player.getByRole('button', { name: labels.en.switchA, exact: true }).click();
  await ready(page, a.version, 1679936 / 48000);
  expect((await nativeState(page)).time).toBeCloseTo(31, 2);
  expect((await nativeState(page)).paused).toBe(true);
  expect(await nativeHash(page)).toBe(a.asset.sha256);
  await player.getByRole('button', { name: labels.en.switchA, exact: true }).click();
  expect((await nativeState(page)).time).toBeCloseTo(31, 2);
  expect((await nativeState(page)).paused).toBe(true);
  expect(await native.evaluate(element => element === document.querySelector('#persistent-player audio'))).toBe(true);
  await info.attach('actual-native-short-end-and-media-identity', { body: JSON.stringify({ scope: 'Unchanged FastAPI public Generate/Candidate/explicit Version save with CPU tones; no GPU or preview crop', project: project.id, playingA, playingB, shortEnd, final: await nativeState(page), versions: fixture.versions }, null, 2), contentType: 'application/json' });
});

test('public pause and seek while B content loads override the earlier playing continuation intent', async ({ page, baseURL }, info) => {
  const { project, a, b } = await savedPair(baseURL);
  let release: (() => void) | undefined;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**/api/projects/${project.id}/assets/${b.asset.id}/content`, async route => {
    const response = await route.fetch();
    await held;
    await route.fulfill({ response });
  });
  try {
    await usePair(page, project.id, a.version, b.version);
    const player = page.locator('#persistent-player');
    await seek(page, 12);
    await player.getByRole('button', { name: playerLabels.en.play, exact: true }).click();
    await expect.poll(async () => (await nativeState(page)).time).toBeGreaterThan(12.1);
    const request = page.waitForRequest(value => value.url().endsWith(`/assets/${b.asset.id}/content`));
    await player.getByRole('button', { name: labels.en.switchB, exact: true }).click();
    await request;
    await expect(player.getByRole('status').filter({ hasText: 'Reading audio' })).toBeVisible();
    expect((await nativeState(page)).paused).toBe(true);
    await expect(player.getByRole('button', { name: playerLabels.en.pause, exact: true })).toBeEnabled();
    await player.getByRole('button', { name: playerLabels.en.pause, exact: true }).click();
    await setSeekInput(page, 7);
    await expect(player.getByRole('slider', { name: playerLabels.en.seek, exact: true })).toHaveValue('7');
    release?.();
    await ready(page, b.version, 31);
    expect((await nativeState(page)).time).toBeCloseTo(7, 2);
    expect((await nativeState(page)).paused).toBe(true);
    expect(await nativeHash(page)).toBe(b.asset.sha256);
    await expect(player.getByRole('alert')).toHaveCount(0);
    await info.attach('public-intent-during-load', { body: JSON.stringify({ a: a.version.id, b: b.version.id, final: await nativeState(page) }, null, 2), contentType: 'application/json' });
  } finally { release?.(); }
});

for (const locale of ['en', 'zh-CN'] as const) test(`${locale}: comparison survives workspace, Score and settings navigation; narrow keyboard, region drag and MIDI keep one owner`, async ({ page, baseURL }, info) => {
  const { project, a, b } = await savedPair(baseURL);
  await usePair(page, project.id, a.version, b.version, locale);
  await page.setViewportSize({ width: 1440, height: 960 });
  const player = page.locator('#persistent-player');
  const native = await player.locator('audio').elementHandle();
  if (!native) throw new Error('Missing sole native audio');
  const t = playerLabels[locale];
  const opposite = locale === 'en' ? 'zh-CN' : 'en';
  await seek(page, 12, locale);
  await player.getByRole('button', { name: t.play, exact: true }).click();
  await expect.poll(async () => (await nativeState(page)).time).toBeGreaterThan(12.1);
  const original = await nativeState(page);
  await page.locator('.tabs').getByRole('link', { name: locale === 'en' ? 'Scores' : '乐谱', exact: true }).click();
  await expect(page.locator(`.score-list a[href="/projects/${project.id}/scores/${a.version.score_id}"]`)).toBeVisible();
  await page.locator(`.score-list a[href="/projects/${project.id}/scores/${a.version.score_id}"]`).click();
  await expect(page.getByText(locale === 'en' ? 'Notation and MIDI match the current draft.' : '谱面和 MIDI 对应当前草稿。', { exact: true })).toBeVisible();
  await expect(page.locator('.score-notation .highlight')).toHaveCount(0);
  await page.locator('.preferences select').selectOption(opposite);
  await page.locator('.preferences button').click();
  await expect(page.locator('html')).toHaveAttribute('lang', opposite);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(player.getByRole('button', { name: playerLabels[opposite].pause, exact: true })).toBeVisible();
  await page.locator('.preferences select').selectOption(locale);
  await page.locator('.preferences button').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.locator('.tabs').getByRole('link', { name: t.lyricsTab, exact: true }).click();
  await expect(page.getByRole('heading', { name: locale === 'en' ? 'Lyrics for this attempt' : '这一次创作的歌词', exact: true })).toBeVisible();
  await page.locator('.sidebar').getByRole('link', { name: locale === 'en' ? 'Settings' : '使用设置', exact: true }).click();
  await expect(page.getByRole('heading', { name: locale === 'en' ? 'Focus on music; inspect the rest when needed' : '专注音乐，其他按需查看', exact: true })).toBeVisible();
  await expect.poll(async () => (await nativeState(page)).time).toBeGreaterThan(original.time);
  expect((await nativeState(page)).source).toBe(original.source);
  expect((await nativeState(page)).paused).toBe(false);
  expect(await native.evaluate(element => element === document.querySelector('#persistent-player audio'))).toBe(true);
  await page.goBack();
  await expect(page.getByRole('heading', { name: locale === 'en' ? 'Lyrics for this attempt' : '这一次创作的歌词', exact: true })).toBeVisible();
  await player.getByRole('button', { name: t.pause, exact: true }).click();
  await player.getByRole('button', { name: labels[locale].switchB, exact: true }).click();
  await ready(page, b.version, 31, locale);
  await page.setViewportSize({ width: 390, height: 844 });
  const slider = player.getByRole('slider', { name: t.seek, exact: true });
  await slider.focus(); await slider.press('End');
  await expect.poll(async () => (await nativeState(page)).time).toBe(31);
  await slider.press('Home');
  await expect.poll(async () => (await nativeState(page)).time).toBe(0);
  await region(page, '5', '15', locale);
  const visualRegion = player.locator('.wave-container [part~="region"]');
  await expect(visualRegion).toHaveCount(1);
  const handle = visualRegion.locator('[part~="region-handle-right"]');
  const handleBox = await handle.boundingBox();
  if (!handleBox) throw new Error('No public resize handle geometry');
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + handleBox.width / 2 + 12, handleBox.y + handleBox.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => Number(await player.getByLabel(t.end, { exact: true }).inputValue())).toBeGreaterThan(15);
  const resized = { start: Number(await player.getByLabel(t.start, { exact: true }).inputValue()), end: Number(await player.getByLabel(t.end, { exact: true }).inputValue()) };
  const regionBox = await visualRegion.boundingBox();
  if (!regionBox) throw new Error('No public region geometry');
  const hit = await visualRegion.evaluate(element => {
    const box = element.getBoundingClientRect(), root = element.getRootNode();
    const point = root instanceof ShadowRoot ? root.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2) : document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return point === element || Boolean(point && element.contains(point));
  });
  expect(hit).toBe(true);
  await page.mouse.move(regionBox.x + regionBox.width / 2, regionBox.y + regionBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(regionBox.x + regionBox.width / 2 + 12, regionBox.y + regionBox.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => Number(await player.getByLabel(t.start, { exact: true }).inputValue())).toBeGreaterThan(resized.start);
  const dragged = { start: Number(await player.getByLabel(t.start, { exact: true }).inputValue()), end: Number(await player.getByLabel(t.end, { exact: true }).inputValue()) };
  expect(dragged.end).toBeLessThanOrEqual(31);
  expect(dragged.end - dragged.start).toBeCloseTo(resized.end - resized.start, 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.locator('.tabs').getByRole('link', { name: locale === 'en' ? 'Scores' : '乐谱', exact: true }).click();
  await expect(page.locator(`.score-list a[href="/projects/${project.id}/scores/${a.version.score_id}"]`)).toBeVisible();
  await page.locator(`.score-list a[href="/projects/${project.id}/scores/${a.version.score_id}"]`).click();
  const audition = page.getByRole('button', { name: locale === 'en' ? 'Audition draft MIDI' : '试听草稿 MIDI', exact: true });
  await expect(audition).toBeEnabled();
  await audition.click();
  await expect.poll(async () => (await nativeState(page)).time).toBeGreaterThan(.1);
  await expect(player).toContainText(locale === 'en' ? 'Simple draft MIDI tone' : '草稿 MIDI 简单音色');
  const mediaType = await player.locator('audio').evaluate(async (audio: HTMLAudioElement) => new TextDecoder().decode((await (await fetch(audio.currentSrc)).arrayBuffer()).slice(0, 4)));
  expect(mediaType).toBe('RIFF');
  await expect.poll(() => page.locator('.score-notation .highlight').count()).toBeGreaterThan(0);
  await player.getByRole('button', { name: labels[locale].return, exact: true }).click();
  await ready(page, b.version, 31, locale);
  expect((await nativeState(page)).time).toBe(0);
  expect((await nativeState(page)).paused).toBe(true);
  await expect(page.locator('.score-notation .highlight')).toHaveCount(0);
  await expect(page.locator('audio')).toHaveCount(1);
  expect(await native.evaluate(element => element === document.querySelector('#persistent-player audio'))).toBe(true);
  await info.attach('public-navigation-narrow-region-and-MIDI', { body: JSON.stringify({ original, resized, dragged, hit, mediaType, returned: await nativeState(page) }, null, 2), contentType: 'application/json' });
  await page.screenshot({ path: info.outputPath(`${locale}-compare-narrow.png`), fullPage: true });
});

test('empty and one-Version history stay usable; an anomalous HTTP row without audio cannot become a successful comparison', async ({ page, baseURL }, info) => {
  const { api, project } = await projectOnly(baseURL);
  await page.goto(`/projects/${project.id}/versions`);
  await page.locator('.preferences select').selectOption('en');
  await expect(page.getByRole('heading', { name: 'No saved versions yet', exact: true })).toBeVisible();
  const player = page.locator('#persistent-player');
  await expect(player.getByRole('button', { name: playerLabels.en.play, exact: true })).toBeDisabled();
  const a = await generatedVersion(api, project.id, 'long', 'A long 35s saved tone');
  await page.locator('.section-heading').getByRole('button', { name: 'Reread versions', exact: true }).click();
  await expect(page.getByRole('heading', { name: a.version.name, exact: true })).toBeVisible();
  await choosePair(page, a.version.id, null);
  await ready(page, a.version, 1679936 / 48000);
  await expect(player.getByRole('button', { name: labels.en.switchB, exact: true })).toBeDisabled();
  await player.getByRole('button', { name: playerLabels.en.play, exact: true }).click();
  await expect.poll(async () => (await nativeState(page)).time).toBeGreaterThan(.1);
  const b = await generatedVersion(api, project.id, 'short', 'B short 31s saved tone');
  const rows = received(await api.GET('/projects/{project_id}/versions', { params: { path: { project_id: project.id } } }));
  const malformed = rows.map(row => row.id === b.version.id ? { ...row, audio_asset_id: null } : row);
  await page.route(`**/api/projects/${project.id}/versions`, async route => {
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    await route.fulfill({ response, json: malformed });
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: a.version.name, exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: b.version.name, exact: true })).toBeVisible();
  const bOption = page.locator('.compare-selection').getByRole('combobox', { name: labels.en.b, exact: true }).locator(`option[value="${b.version.id}"]`);
  if (await bOption.count() && !await bOption.isDisabled()) {
    await choosePair(page, a.version.id, b.version.id);
    await expect(page.locator('.compare-selection').getByRole('alert')).toContainText('with audio');
  } else { expect(await bOption.count() === 0 || await bOption.isDisabled()).toBe(true); }
  await expect(player.getByRole('button', { name: labels.en.switchB, exact: true })).toBeDisabled();
  expect(received(await api.GET('/projects/{project_id}/versions', { params: { path: { project_id: project.id } } }))).toEqual(rows);
  await info.attach('read-boundary-no-audio-not-a-persisted-legal-Version', { body: JSON.stringify({ malformed, actualSaved: rows, scope: 'Only the browser HTTP list boundary is anomalous; no invalid Version was persisted and production validation was not relaxed.' }, null, 2), contentType: 'application/json' });
});

test('changing to a shorter pair stops at zero and requests a new common region instead of silently cropping it', async ({ page, baseURL }, info) => {
  const { api, project, a, b } = await savedPair(baseURL);
  const otherLong = await generatedVersion(api, project.id, 'long', 'Another long 35s saved tone');
  await usePair(page, project.id, a.version, otherLong.version);
  const player = page.locator('#persistent-player');
  await region(page, '32', '34');
  await seek(page, 33);
  await player.getByRole('button', { name: playerLabels.en.play, exact: true }).click();
  await expect.poll(async () => (await nativeState(page)).time).toBeGreaterThan(33.1);
  await choosePair(page, a.version.id, b.version.id);
  await ready(page, a.version, 1679936 / 48000);
  expect((await nativeState(page)).time).toBe(0);
  expect((await nativeState(page)).paused).toBe(true);
  await expect(player.getByRole('alert').filter({ hasText: 'The new pair cannot contain the previous region.' })).toHaveText('The new pair cannot contain the previous region. Set a new one.');
  await expect(player.getByRole('button', { name: playerLabels.en.playRegion, exact: true })).toBeDisabled();
  await expect.poll(async () => Number(await player.getByLabel(playerLabels.en.start, { exact: true }).inputValue())).toBe(32);
  await expect.poll(async () => Number(await player.getByLabel(playerLabels.en.end, { exact: true }).inputValue())).toBe(34);
  await region(page, '2', '4');
  await expect(player.getByRole('alert')).toHaveCount(0);
  await player.getByRole('button', { name: playerLabels.en.playRegion, exact: true }).click();
  await expect.poll(async () => { const state = await nativeState(page); return { time: state.time, paused: state.paused }; }).toEqual({ time: 4, paused: true });
  await choosePair(page, a.version.id, a.version.id);
  await expect(page.locator('.compare-selection').getByRole('alert')).toContainText('two different saved versions');
  expect((await nativeState(page)).time).toBe(4);
  expect((await nativeState(page)).paused).toBe(true);
  await info.attach('new-pair-common-bound', { body: JSON.stringify({ previousPair: [a.version.id, otherLong.version.id], nextPair: [a.version.id, b.version.id], actualShort: b.header, final: await nativeState(page) }, null, 2), contentType: 'application/json' });
});

test('real missing Audio or ABC reads stop the prior comparison; restoration and reread recover the same saved history', async ({ page, baseURL }, info) => {
  const { api, project, a, b, versions } = await savedPair(baseURL);
  const score = received(await api.GET('/projects/{project_id}/scores/{score_id}', { params: { path: { project_id: project.id, score_id: b.version.score_id } } }));
  const abc = received(await api.GET('/projects/{project_id}/assets/{asset_id}', { params: { path: { project_id: project.id, asset_id: score.abc_asset_id } } }));
  const faults = [b.asset, abc];
  const facts: unknown[] = [];
  await usePair(page, project.id, a.version, b.version);
  const player = page.locator('#persistent-player');
  const writes: string[] = [];
  page.on('request', request => { if (request.method() === 'POST') writes.push(request.url()); });
  for (const asset of faults) {
    const file = resolve(runDir!, 'application', 'assets', project.id, `${asset.id}.${asset.format}`);
    const hidden = `${file}.owned-missing`;
    await player.getByRole('button', { name: labels.en.switchA, exact: true }).click();
    await ready(page, a.version, 1679936 / 48000);
    await player.getByRole('button', { name: playerLabels.en.play, exact: true }).click();
    await expect.poll(async () => (await nativeState(page)).time).toBeGreaterThan(.1);
    await rename(file, hidden);
    try {
      const result = await api.GET('/projects/{project_id}/versions', { params: { path: { project_id: project.id } } });
      expect(result.response.status).toBe(409);
      await page.locator('.section-heading').getByRole('button', { name: 'Reread versions', exact: true }).click();
      await expect(page.locator('.surface > .error-box')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'No saved versions yet', exact: true })).toHaveCount(0);
      await player.getByRole('button', { name: labels.en.switchB, exact: true }).click();
      await expect(player.getByRole('alert')).toBeVisible();
      expect((await nativeState(page)).paused).toBe(true);
      await expect(player.getByRole('button', { name: playerLabels.en.play, exact: true })).toBeDisabled();
      facts.push({ asset: asset.id, kind: asset.kind, actualStatus: result.response.status, stopped: await nativeState(page) });
    } finally { await rename(hidden, file); }
    await player.getByRole('button', { name: 'Reread audio', exact: true }).click();
    await ready(page, b.version, 31);
    await page.locator('.section-heading').getByRole('button', { name: 'Reread versions', exact: true }).click();
    await expect(page.getByRole('heading', { name: a.version.name, exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: b.version.name, exact: true })).toBeVisible();
    expect(received(await api.GET('/projects/{project_id}/versions', { params: { path: { project_id: project.id } } }))).toEqual(versions);
  }
  expect(writes).toEqual([]);
  await info.attach('actual-owned-missing-file-recovery', { body: JSON.stringify({ facts, writes, versions }, null, 2), contentType: 'application/json' });
});

test('same-length corrupt actual B bytes cause a playback failure while old A stops; explicit reread restores B without a new Job', async ({ page, baseURL }, info) => {
  const { api, project, a, b, versions } = await savedPair(baseURL);
  const file = resolve(runDir!, 'application', 'assets', project.id, `${b.asset.id}.${b.asset.format}`);
  const original = await readFile(file);
  const jobs = received(await api.GET('/projects/{project_id}/jobs', { params: { path: { project_id: project.id } } }));
  await usePair(page, project.id, a.version, b.version);
  const player = page.locator('#persistent-player');
  await seek(page, 12);
  await player.getByRole('button', { name: playerLabels.en.play, exact: true }).click();
  await expect.poll(async () => (await nativeState(page)).time).toBeGreaterThan(12.1);
  await writeFile(file, Buffer.alloc(original.length));
  let failure: unknown;
  try {
    const delivered = await assetBytes(api, project.id, b.asset.id);
    expect(delivered).toHaveLength(original.length);
    expect(delivered.every(byte => byte === 0)).toBe(true);
    await player.getByRole('button', { name: labels.en.switchB, exact: true }).click();
    await expect(player.getByRole('alert')).toContainText('This audio could not play');
    expect((await nativeState(page)).paused).toBe(true);
    await expect(player.getByRole('button', { name: playerLabels.en.play, exact: true })).toBeDisabled();
    failure = { actualContentBytes: delivered.length, corruptedSha256: hash(delivered), native: await nativeState(page) };
  } finally { await writeFile(file, original); }
  await player.getByRole('button', { name: 'Reread audio', exact: true }).click();
  await ready(page, b.version, 31);
  expect(await nativeHash(page)).toBe(b.asset.sha256);
  expect(received(await api.GET('/projects/{project_id}/jobs', { params: { path: { project_id: project.id } } }))).toEqual(jobs);
  expect(received(await api.GET('/projects/{project_id}/versions', { params: { path: { project_id: project.id } } }))).toEqual(versions);
  await expect(page.locator('audio')).toHaveCount(1);
  await info.attach('real-corrupt-byte-decode-and-reread', { body: JSON.stringify({ failure, restored: await nativeState(page), audioSHA: b.asset.sha256, jobs: jobs.map(job => job.id) }, null, 2), contentType: 'application/json' });
});

for (const fault of ['get', 'set'] as const) test(`comparison remains usable with an explicit warning when its choice storage ${fault} fails`, async ({ page, baseURL }) => {
  const { project, a, b } = await savedPair(baseURL);
  await page.addInitScript(mode => {
    if (mode === 'get') {
      const original = Storage.prototype.getItem;
      Object.defineProperty(Storage.prototype, 'getItem', { value: function (this: Storage, key: string) {
        if (key.startsWith('music.compare.v1:')) throw new DOMException('Owned compare storage unavailable', 'SecurityError');
        return original.call(this, key);
      } });
    } else {
      const original = Storage.prototype.setItem;
      Object.defineProperty(Storage.prototype, 'setItem', { value: function (this: Storage, key: string, value: string) {
        if (key.startsWith('music.compare.v1:')) throw new DOMException('Owned compare storage unavailable', 'SecurityError');
        return original.call(this, key, value);
      } });
    }
  }, fault);
  await usePair(page, project.id, a.version, b.version);
  await expect(page.getByText('Choice storage is unavailable. You can compare now; reload recovery is not guaranteed.', { exact: true })).toBeVisible();
  const player = page.locator('#persistent-player');
  await seek(page, 12);
  await player.getByRole('button', { name: labels.en.switchB, exact: true }).click();
  await ready(page, b.version, 31);
  expect((await nativeState(page)).time).toBeCloseTo(12, 2);
  expect((await nativeState(page)).paused).toBe(true);
  expect(await nativeHash(page)).toBe(b.asset.sha256);
});

for (const saved of [false, true]) test(`a ${saved ? 'saved' : 'unsaved'} first Candidate keeps its captured listening identity when a second succeeds; explicit listening and return change source`, async ({ page, baseURL }, info) => {
  const { api, project, a, b, versions } = await savedPair(baseURL);
  await usePair(page, project.id, a.version, b.version);
  const player = page.locator('#persistent-player');
  await page.locator('.tabs').getByRole('link', { name: playerLabels.en.generateTab, exact: true }).click();
  await expect(page.getByRole('button', { name: playerLabels.en.submit })).toBeVisible();
  await control({ audio: 'long' });
  await inputs(page, 'en', ' · first captured');
  const first = await completedCandidate(page, 'en');
  const firstCandidate = received(await api.GET('/projects/{project_id}/candidates/{candidate_id}', { params: { path: { project_id: project.id, candidate_id: first } } }));
  await page.locator('.candidate-detail').getByRole('button', { name: playerLabels.en.listen, exact: true }).click();
  await expect(player.getByRole('button', { name: playerLabels.en.play, exact: true })).toBeEnabled();
  await expect(player.locator('.player-title strong')).toContainText(firstCandidate.inputs.style);
  await expect.poll(async () => (await nativeState(page)).duration).toBeCloseTo(1679936 / 48000, 4);
  await seek(page, 8);
  await player.getByRole('button', { name: playerLabels.en.play, exact: true }).click();
  await expect.poll(async () => (await nativeState(page)).time).toBeGreaterThan(8.1);
  const firstSource = (await nativeState(page)).source;
  let firstListeningId = first;
  if (saved) {
    await page.getByRole('textbox', { name: playerLabels.en.name, exact: true }).fill('Saved first captured Candidate');
    await page.getByRole('button', { name: playerLabels.en.save, exact: true }).click();
    await expect(page.getByRole('link', { name: playerLabels.en.saved, exact: true })).toBeVisible();
    const firstSaved = received(await api.GET('/projects/{project_id}/versions', { params: { path: { project_id: project.id } } })).find(version => version.candidate_id === first);
    if (!firstSaved) throw new Error('No actual saved first Candidate');
    firstListeningId = firstSaved.id;
    await expect(player.locator('.player-title strong')).toHaveText(firstSaved.name);
    expect((await nativeState(page)).source).toBe(firstSource);
    expect((await nativeState(page)).paused).toBe(false);
  }
  const firstLabel = await player.locator('.player-title strong').innerText();
  await expect(player).toHaveAttribute('data-listening-id', firstListeningId);
  await expect(player).toHaveAttribute('data-listening-kind', saved ? 'version' : 'candidate');
  await control({ audio: 'short' });
  await inputs(page, 'en', ' · second different');
  const before = (await nativeState(page)).time;
  const second = await completedCandidate(page, 'en');
  expect(second).not.toBe(first);
  const secondCandidate = received(await api.GET('/projects/{project_id}/candidates/{candidate_id}', { params: { path: { project_id: project.id, candidate_id: second } } }));
  await expect.poll(async () => (await nativeState(page)).time).toBeGreaterThan(before);
  expect((await nativeState(page)).source).toBe(firstSource);
  expect((await nativeState(page)).paused).toBe(false);
  await expect(player.locator('.player-title strong')).toHaveText(firstLabel);
  await expect(player.locator('.player-title strong')).not.toContainText(secondCandidate.inputs.style);
  await expect(player).toHaveAttribute('data-listening-id', firstListeningId);
  const preserved = await nativeState(page);
  expect(received(await api.GET('/projects/{project_id}/versions', { params: { path: { project_id: project.id } } }))).toHaveLength(versions.length + (saved ? 1 : 0));
  await page.getByRole('textbox', { name: playerLabels.en.name, exact: true }).fill('Explicit saved second Candidate');
  await page.getByRole('button', { name: playerLabels.en.save, exact: true }).click();
  await expect(page.getByRole('link', { name: playerLabels.en.saved, exact: true })).toBeVisible();
  const secondSaved = received(await api.GET('/projects/{project_id}/versions', { params: { path: { project_id: project.id } } })).find(version => version.candidate_id === second);
  if (!secondSaved) throw new Error('No actual explicitly saved second Candidate');
  await expect(player).toHaveAttribute('data-listening-id', firstListeningId);
  await expect(player.locator('.player-title strong')).toHaveText(firstLabel);
  expect((await nativeState(page)).source).toBe(firstSource);
  expect((await nativeState(page)).paused).toBe(false);
  await page.locator('.candidate-detail').getByRole('button', { name: playerLabels.en.listen, exact: true }).click();
  await expect(player.getByRole('button', { name: playerLabels.en.play, exact: true })).toBeEnabled();
  await expect(player.locator('.player-title strong')).toHaveText(secondSaved.name);
  await expect(player).toHaveAttribute('data-listening-id', secondSaved.id);
  await expect.poll(async () => (await nativeState(page)).duration).toBeCloseTo(31, 4);
  expect((await nativeState(page)).time).toBe(0);
  expect((await nativeState(page)).paused).toBe(true);
  const secondAsset = received(await api.GET('/projects/{project_id}/assets/{asset_id}', { params: { path: { project_id: project.id, asset_id: secondCandidate.audio_asset_id } } }));
  expect(await nativeHash(page)).toBe(secondAsset.sha256);
  await player.getByRole('button', { name: labels.en.return, exact: true }).click();
  await ready(page, a.version, 1679936 / 48000);
  expect((await nativeState(page)).time).toBe(0);
  expect((await nativeState(page)).paused).toBe(true);
  await expect(page.locator('audio')).toHaveCount(1);
  await info.attach('immutable-candidate-listening-identity', { body: JSON.stringify({ first, firstListeningId, second, secondSaved, saved, firstLabel, preserved, explicitSecond: secondAsset.id, returned: await nativeState(page) }, null, 2), contentType: 'application/json' });
});

test('actual reload and a cold lyrics route restore only verified pair IDs and side, at zero paused with no region or business writes', async ({ page, baseURL }, info) => {
  const { api, project, a, b, versions } = await savedPair(baseURL);
  await usePair(page, project.id, a.version, b.version);
  const player = page.locator('#persistent-player');
  await player.getByRole('button', { name: labels.en.switchB, exact: true }).click();
  await ready(page, b.version, 31);
  await region(page, '2', '4');
  await seek(page, 7);
  await player.getByRole('button', { name: playerLabels.en.play, exact: true }).click();
  await expect.poll(async () => (await nativeState(page)).time).toBeGreaterThan(7.1);
  const stored = await page.evaluate(projectId => localStorage.getItem(`music.compare.v1:${projectId}`), project.id);
  expect(JSON.parse(stored!)).toEqual({ a: a.version.id, b: b.version.id, side: 'b' });
  const writes: string[] = [];
  page.on('request', request => { if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method())) writes.push(`${request.method()} ${request.url()}`); });
  await page.reload();
  await expect(page.getByRole('heading', { name: b.version.name, exact: true })).toBeVisible();
  await ready(page, b.version, 31);
  expect((await nativeState(page)).time).toBe(0);
  expect((await nativeState(page)).paused).toBe(true);
  await expect(player.locator('.player-title strong')).toHaveText(`B · ${b.version.name}`);
  if (await player.locator('.player-regions').getAttribute('open') === null) await player.locator('.player-regions summary').click();
  await expect(player.getByLabel(playerLabels.en.start, { exact: true })).toHaveValue('0');
  await expect(player.getByLabel(playerLabels.en.end, { exact: true })).toHaveValue('0');
  await expect(player.locator('.wave-container [part~="region"]')).toHaveCount(0);
  await expect(player.getByRole('button', { name: playerLabels.en.playRegion, exact: true })).toBeDisabled();
  await page.goto(`/projects/${project.id}/lyrics`);
  await expect(page.getByRole('heading', { name: 'Lyrics for this attempt', exact: true })).toBeVisible();
  await ready(page, b.version, 31);
  expect((await nativeState(page)).time).toBe(0);
  expect((await nativeState(page)).paused).toBe(true);
  expect(writes).toEqual([]);
  expect(received(await api.GET('/projects/{project_id}/versions', { params: { path: { project_id: project.id } } }))).toEqual(versions);
  expect(hash(await assetBytes(api, project.id, a.asset.id))).toBe(a.asset.sha256);
  expect(hash(await assetBytes(api, project.id, b.asset.id))).toBe(b.asset.sha256);
  expect(await nativeHash(page)).toBe(b.asset.sha256);
  await info.attach('recovered-minimal-selection-intent', { body: JSON.stringify({ stored: JSON.parse(stored!), writes, final: await nativeState(page), versions }, null, 2), contentType: 'application/json' });
});

test('missing, duplicate and foreign saved choices are reported after API validation and can be explicitly replaced', async ({ page, baseURL }, info) => {
  const { project, a, b } = await savedPair(baseURL);
  const foreign = await savedPair(baseURL);
  await usePair(page, project.id, a.version, b.version);
  const writes: string[] = [];
  page.on('request', request => { if (request.method() === 'POST') writes.push(request.url()); });
  const invalid = [
    { a: a.version.id, b: randomUUID(), side: 'b' },
    { a: a.version.id, b: a.version.id, side: 'a' },
    { a: a.version.id, b: foreign.b.version.id, side: 'b' },
  ];
  for (const value of invalid) {
    await page.evaluate(({ projectId, value }) => localStorage.setItem(`music.compare.v1:${projectId}`, JSON.stringify(value)), { projectId: project.id, value });
    await page.reload();
    await expect(page.getByRole('heading', { name: a.version.name, exact: true })).toBeVisible();
    await expect(page.getByText('Pair choices are unavailable. Choose saved versions again.', { exact: true })).toBeVisible();
    await expect(page.locator('#persistent-player').getByRole('button', { name: playerLabels.en.play, exact: true })).toBeDisabled();
    await expect(page.locator('[data-version-id]')).toHaveCount(2);
  }
  await page.locator('.compare-selection').getByRole('combobox', { name: labels.en.a, exact: true }).selectOption(a.version.id);
  await page.locator('.compare-selection').getByRole('combobox', { name: labels.en.b, exact: true }).selectOption(b.version.id);
  await page.locator('.compare-selection').getByRole('button', { name: labels.en.use, exact: true }).click();
  await ready(page, a.version, 1679936 / 48000);
  expect(writes).toEqual([]);
  await info.attach('stored-invalid-public-choices', { body: JSON.stringify({ invalid, writes, recovered: await nativeState(page) }, null, 2), contentType: 'application/json' });
});

test('a held older B content read cannot replace the later ready A identity, source or paused clock', async ({ page, baseURL }, info) => {
  const { project, a, b } = await savedPair(baseURL);
  let release: (() => void) | undefined;
  const held = new Promise<void>(resolve => { release = resolve; });
  const transport: string[] = [];
  await page.route(`**/api/projects/${project.id}/assets/${b.asset.id}/content`, async route => {
    const response = await route.fetch();
    transport.push(`actual B content HTTP ${response.status()} held`);
    await held;
    try { await route.fulfill({ response }); transport.push('old B response released'); }
    catch (error) { transport.push(`old read already cancelled: ${error instanceof Error ? error.message : String(error)}`); }
  });
  try {
    await usePair(page, project.id, a.version, b.version);
    await seek(page, 12);
    const player = page.locator('#persistent-player');
    const request = page.waitForRequest(value => value.url().endsWith(`/assets/${b.asset.id}/content`));
    await player.getByRole('button', { name: labels.en.switchB, exact: true }).click();
    await request;
    await expect(player.getByRole('status').filter({ hasText: 'Reading audio' })).toBeVisible();
    expect((await nativeState(page)).paused).toBe(true);
    await player.getByRole('button', { name: labels.en.switchA, exact: true }).click();
    await ready(page, a.version, 1679936 / 48000);
    expect((await nativeState(page)).time).toBeCloseTo(12, 2);
    expect((await nativeState(page)).paused).toBe(true);
    release?.();
    await expect.poll(() => transport.length).toBe(2);
    expect(await nativeHash(page)).toBe(a.asset.sha256);
    expect((await nativeState(page)).time).toBeCloseTo(12, 2);
    expect((await nativeState(page)).paused).toBe(true);
    await expect(player.locator('.player-title strong')).toContainText(a.version.name);
    await expect(page.locator('audio')).toHaveCount(1);
    await expect(player.getByRole('alert')).toHaveCount(0);
    await info.attach('held-public-GET-latest-choice', { body: JSON.stringify({ transport, final: await nativeState(page), a: a.version.id, b: b.version.id,
      scope: 'Delayed public content GET ownership; no claim about every non-abortable decode interleaving' }, null, 2), contentType: 'application/json' });
  } finally { release?.(); }
});

test('the latest visible side choice wins on a real FLAC seek error and retains the saved records and original bytes', async ({ page, baseURL }, info) => {
  const { api, project, a, b, versions } = await savedPair(baseURL, 'original');
  expect(b.asset.sha256).toBe('26e916c7854f1a924b5ca9e8b90f66fa6acd95d8dba4e79fed49ea1c99171f2c');
  await usePair(page, project.id, a.version, b.version);
  const player = page.locator('#persistent-player');
  await player.getByRole('button', { name: labels.en.switchB, exact: true }).click();
  await ready(page, b.version, 31);
  await expect(player.locator('.wave-container')).toBeVisible();
  expect(await nativeHash(page)).toBe(b.asset.sha256);
  await seek(page, 4.7);
  const before = await nativeState(page);
  expect(before.paused).toBe(true);
  expect(before.error).toBeNull();
  const writes: string[] = [];
  page.on('request', request => { if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method())) writes.push(`${request.method()} ${request.url()}`); });
  const observation = await player.locator('audio').evaluateHandle((audio: HTMLAudioElement) => {
    const events: { at: number; time: number; duration: number; paused: boolean; source: string; code: number | null; message: string | null; action: string | null }[] = [];
    // Schedule the existing DOM action on an actual native error, after the
    // mounted Player's listeners. This does not manufacture MediaError or state.
    audio.addEventListener('error', () => {
      const error = audio.error;
      const button = Array.from(document.querySelectorAll('#persistent-player button')).find(element => element.textContent?.trim() === 'Switch to A');
      const supported = error?.code === 2 && error.message.includes('demuxer seek failed');
      const action = supported && button instanceof HTMLButtonElement && !button.disabled ? button : null;
      events.push({ at: performance.now(), time: audio.currentTime, duration: audio.duration, paused: audio.paused, source: audio.currentSrc,
        code: error?.code ?? null, message: error?.message ?? null, action: action?.textContent?.trim() ?? null });
      action?.click();
    }, { once: true });
    return { events };
  });
  const slider = player.getByRole('slider', { name: playerLabels.en.seek, exact: true });
  await slider.focus(); await slider.press('End');
  await expect.poll(async () => (await nativeState(page)).time).toBe(31);
  await slider.press('ArrowLeft');
  await expect.poll(async () => (await observation.evaluate(value => value.events)).length).toBe(1);
  const events = await observation.evaluate(value => value.events);
  await info.attach('real-native-error-public-side-action', { body: JSON.stringify({ before, events, scope: 'The actual native error invokes the visible DOM Switch to A action; no claim that a recovery status painted or a decoder response was deliberately held.' }, null, 2), contentType: 'application/json' });
  expect(events[0]).toMatchObject({ time: 30.9, duration: 31, paused: true, code: 2, action: labels.en.switchA });
  expect(events[0]?.message).toContain('demuxer seek failed');
  await ready(page, a.version, 1679936 / 48000);
  await expect(player.locator('.wave-container')).toBeVisible();
  await expect(player.getByRole('button', { name: labels.en.switchA, exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(player).toHaveAttribute('data-listening-id', a.version.id);
  const settled = await nativeState(page);
  expect(settled.time).toBeCloseTo(30.9, 2);
  expect(settled.paused).toBe(true);
  expect(settled.error).toBeNull();
  expect(await nativeHash(page)).toBe(a.asset.sha256);
  await expect(page.locator('audio')).toHaveCount(1);
  await expect(player.getByRole('alert')).toHaveCount(0);
  // A fresh supported position qualifies the second old-B action; the one-shot
  // side listener has already fired and cannot hide its terminal read failure.
  await seek(page, 0);
  await player.getByRole('button', { name: labels.en.switchB, exact: true }).click();
  await ready(page, b.version, 31);
  expect((await nativeState(page)).time).toBe(0);
  expect(await nativeHash(page)).toBe(b.asset.sha256);
  await setSeekInput(page, 30.8);
  await expect(player.getByRole('alert')).toContainText('This audio could not play');
  const terminal = await nativeState(page);
  expect(terminal.error).toBe(2);
  expect(terminal.paused).toBe(true);
  await info.attach('unsupported-original-tail-seek-terminal-state', { body: JSON.stringify(terminal), contentType: 'application/json' });
  await player.getByRole('button', { name: 'Reread audio', exact: true }).click();
  await ready(page, b.version, 31);
  const explicitlyRetried = await nativeState(page);
  expect(explicitlyRetried.time).toBe(0);
  expect(explicitlyRetried.paused).toBe(true);
  expect(explicitlyRetried.error).toBeNull();
  expect(await nativeHash(page)).toBe(b.asset.sha256);
  await expect(page.locator('audio')).toHaveCount(1);
  await expect(player.getByRole('alert')).toHaveCount(0);
  expect(received(await api.GET('/projects/{project_id}/versions', { params: { path: { project_id: project.id } } }))).toEqual(versions);
  expect(hash(await assetBytes(api, project.id, a.asset.id))).toBe(a.asset.sha256);
  expect(hash(await assetBytes(api, project.id, b.asset.id))).toBe(b.asset.sha256);
  expect(writes).toEqual([]);
  await info.attach('settled-latest-saved-side-and-original-bytes', { body: JSON.stringify({ a: a.version.id, b: b.version.id, settled, terminal, explicitlyRetried, originalHashes: [a.asset.sha256, b.asset.sha256], writes, versions }, null, 2), contentType: 'application/json' });
});

test('common one-shot regions stop both native tracks; seeking cancels the bound and ended replay is explicit', async ({ page, baseURL }, info) => {
  const { project, a, b } = await savedPair(baseURL);
  await usePair(page, project.id, a.version, b.version);
  const player = page.locator('#persistent-player');
  await region(page, '2', '4');
  await expect(player.getByRole('button', { name: playerLabels.en.playRegion, exact: true })).toBeEnabled();
  await player.getByRole('button', { name: playerLabels.en.playRegion, exact: true }).click();
  await expect.poll(async () => { const state = await nativeState(page); return { time: state.time, paused: state.paused }; }).toEqual({ time: 4, paused: true });
  await player.getByRole('button', { name: labels.en.switchB, exact: true }).click();
  await ready(page, b.version, 31);
  await expect.poll(async () => Number(await player.getByLabel(playerLabels.en.start, { exact: true }).inputValue())).toBe(2);
  await expect.poll(async () => Number(await player.getByLabel(playerLabels.en.end, { exact: true }).inputValue())).toBe(4);
  await player.getByRole('button', { name: playerLabels.en.playRegion, exact: true }).click();
  await expect.poll(async () => { const state = await nativeState(page); return { time: state.time, paused: state.paused }; }).toEqual({ time: 4, paused: true });
  for (const [start, end] of [['', '4'], ['-1', '4'], ['4', '2'], ['30', '32']] as const) {
    await region(page, start, end);
    await expect(player.getByRole('alert')).toBeVisible();
    expect((await nativeState(page)).paused).toBe(true);
  }
  await region(page, '2', '4');
  await player.getByRole('button', { name: playerLabels.en.playRegion, exact: true }).click();
  await expect.poll(async () => (await nativeState(page)).time).toBeGreaterThan(2.1);
  await player.getByRole('button', { name: labels.en.switchA, exact: true }).click();
  await expect.poll(async () => { const state = await nativeState(page); return { time: state.time, paused: state.paused }; }).toEqual({ time: 4, paused: true });
  expect(await nativeHash(page)).toBe(a.asset.sha256);
  await player.getByRole('button', { name: labels.en.switchB, exact: true }).click();
  await ready(page, b.version, 31);
  const seekObservation = await player.getByRole('slider', { name: playerLabels.en.seek, exact: true }).evaluateHandle((slider: HTMLInputElement) => {
    const audio = document.querySelector('#persistent-player audio');
    if (!(audio instanceof HTMLAudioElement)) throw new Error('No sole native media for the public input observation');
    const events: { at: number; type: string; key: string | null; value: string; time: number; paused: boolean; duration: number; source: string; error: number | null; message: string | null }[] = [];
    function observe(event: Event) {
      if (!(audio instanceof HTMLAudioElement)) return;
      events.push({ at: performance.now(), type: event.type, key: event instanceof KeyboardEvent ? event.key : null, value: slider.value, time: audio.currentTime, paused: audio.paused,
        duration: audio.duration, source: audio.currentSrc, error: audio.error?.code ?? null, message: audio.error?.message ?? null });
      if (event.type === 'input') queueMicrotask(() => observe(new Event('after-input')));
    }
    slider.addEventListener('keydown', observe, true);
    slider.addEventListener('input', observe, true);
    for (const event of ['play', 'pause', 'timeupdate', 'seeking', 'seeked', 'error', 'ended']) audio.addEventListener(event, observe);
    return { events };
  });
  await player.getByRole('button', { name: playerLabels.en.playRegion, exact: true }).click();
  try {
    await expect.poll(async () => { const state = await nativeState(page); return state.time > 2 && state.time < 4 && !state.paused; }).toBe(true);
  } finally {
    await info.attach('public-region-play-prerequisite', { body: JSON.stringify({ native: await nativeState(page), events: await seekObservation.evaluate(value => value.events) }, null, 2), contentType: 'application/json' });
  }
  const immediatelyBeforeSeek = await nativeState(page);
  await seek(page, 4.3);
  await info.attach('public-native-seek-order', { body: JSON.stringify({ immediatelyBeforeSeek, inputs: await seekObservation.evaluate(value => value.events), afterSeek: await nativeState(page) }, null, 2), contentType: 'application/json' });
  await expect.poll(async () => (await nativeState(page)).time).toBeGreaterThan(4.45);
  expect((await nativeState(page)).paused).toBe(false);
  await player.getByRole('button', { name: playerLabels.en.pause, exact: true }).click();
  await expect.poll(async () => Number(await player.getByLabel(playerLabels.en.start, { exact: true }).inputValue())).toBe(2);
  await expect.poll(async () => Number(await player.getByLabel(playerLabels.en.end, { exact: true }).inputValue())).toBe(4);
  await expect(player.getByRole('button', { name: labels.en.switchB, exact: true })).toHaveAttribute('aria-pressed', 'true');
  await ready(page, b.version, 31);
  await expect(player.locator('.wave-container')).toBeVisible();
  await expect(player).toHaveAttribute('data-listening-id', b.version.id);
  expect(await nativeHash(page)).toBe(b.asset.sha256);
  const beforeNearEnd = await nativeState(page);
  expect(beforeNearEnd.error).toBeNull();
  expect(beforeNearEnd.paused).toBe(true);
  await info.attach('native-before-near-end-input', { body: JSON.stringify(beforeNearEnd), contentType: 'application/json' });
  await seek(page, 30.8);
  const nearEnd = await nativeState(page);
  await info.attach('native-after-near-end-input', { body: JSON.stringify({ ...nearEnd, events: await seekObservation.evaluate(value => value.events) }), contentType: 'application/json' });
  expect(nearEnd.time).toBeCloseTo(30.8, 2);
  expect(nearEnd.duration).toBe(31);
  expect(nearEnd.error).toBeNull();
  await expect(player.getByRole('button', { name: playerLabels.en.play, exact: true })).toBeEnabled();
  await player.getByRole('button', { name: playerLabels.en.play, exact: true }).click();
  const afterPlay = await nativeState(page);
  await info.attach('native-after-near-end-play', { body: JSON.stringify(afterPlay), contentType: 'application/json' });
  await expect.poll(async () => { const state = await nativeState(page); return { time: state.time, paused: state.paused, ended: state.ended }; }).toEqual({ time: 31, paused: true, ended: true });
  const ended = await nativeState(page);
  await player.getByRole('button', { name: playerLabels.en.play, exact: true }).click();
  await expect.poll(async () => (await nativeState(page)).time).toBeGreaterThan(.1);
  expect((await nativeState(page)).time).toBeLessThan(2);
  expect((await nativeState(page)).paused).toBe(false);
  await info.attach('one-shot-common-region-native-facts', { body: JSON.stringify({ a: a.header, b: b.header, beforeNearEnd, nearEnd, afterPlay, ended, replay: await nativeState(page) }, null, 2), contentType: 'application/json' });
});
