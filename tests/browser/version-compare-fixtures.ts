import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, type Page } from '@playwright/test';
import type { components } from '@llm-music/api-client';
import { assetBytes, completedJob, type Api } from './cover-fixtures.js';
import { control, hash, labels as playerLabels, runDir } from './generation-fixtures.js';
import { projectOnly, received } from './score-fixtures.js';

export type Version = components['schemas']['VersionRead'];
export type Locale = 'en' | 'zh-CN';
export const labels = {
  en: { heading: 'Choose two saved versions', a: 'Version A', b: 'Version B', use: 'Use this pair', switchA: 'Switch to A', switchB: 'Switch to B', region: 'Common listening region', return: 'Return to comparison' },
  'zh-CN': { heading: '选择两份已保存版本', a: '版本 A', b: '版本 B', use: '使用这对版本', switchA: '切换到 A', switchB: '切换到 B', region: '共同试听片段', return: '返回比较' },
};
export const expectedFrames = { long: 1679936, short: 1488000 };
export type ShortProfile = 'regular' | 'original';
export const shortHashes = {
  regular: '5951549add804f77098922bcc86f9f1f21e5806281890ccd4087ee04c52e5875',
  original: '26e916c7854f1a924b5ca9e8b90f66fa6acd95d8dba4e79fed49ea1c99171f2c',
};

export async function generatedVersion(api: Api, projectId: string, length: keyof typeof expectedFrames, name: string, shortProfile: ShortProfile = 'regular') {
  const profile = length === 'short' && shortProfile === 'original' ? 'short-original' : length;
  await control({ audio: profile });
  const path = { project_id: projectId };
  const job = received(await api.POST('/projects/{project_id}/jobs/generate', { params: { path },
    body: { style: `CPU ${length} tone`, lyrics: '[Verse]\nCompare this saved direction.', seed: length === 'long' ? 2026480001 : 2026480002, max_seconds: 35 } }));
  const completed = await completedJob(api, projectId, job);
  if (!completed.result?.candidate_id) throw new Error('Missing actual completed Candidate');
  expect(received(await api.GET('/projects/{project_id}/versions', { params: { path } })).some(row => row.candidate_id === completed.result?.candidate_id)).toBe(false);
  const version = received(await api.POST('/projects/{project_id}/versions', { params: { path }, body: { candidate_id: completed.result.candidate_id, name } }));
  const asset = received(await api.GET('/projects/{project_id}/assets/{asset_id}', { params: { path: { ...path, asset_id: version.audio_asset_id } } }));
  const bytes = await assetBytes(api, projectId, asset.id);
  expect(bytes.toString('ascii', 0, 4)).toBe('fLaC');
  expect(bytes[4]! & 127).toBe(0);
  expect(bytes.readUIntBE(5, 3)).toBe(34);
  const packed = bytes.readBigUInt64BE(18);
  const header = { sample_rate: Number(packed >> 44n), channels: Number(packed >> 41n & 7n) + 1,
    bits_per_sample: Number(packed >> 36n & 31n) + 1, frames: Number(packed & ((1n << 36n) - 1n)) };
  expect(header).toEqual({ sample_rate: 48000, channels: 2, bits_per_sample: 16, frames: expectedFrames[length] });
  expect(hash(bytes)).toBe(asset.sha256);
  if (length === 'short') expect(asset.sha256).toBe(shortHashes[shortProfile]);
  expect(asset.duration_seconds).toBeCloseTo(expectedFrames[length] / 48000, 6);
  const receipts: { sha256: string; decoded_frames: number; header: typeof header; fixture_profile: string; pcm_sha256: string; packet_samples: number[] }[] = JSON.parse(await readFile(resolve(runDir!, 'compare-media.json'), 'utf8'));
  const receipt = receipts.find(value => value.sha256 === asset.sha256);
  expect(receipt).toMatchObject({ decoded_frames: expectedFrames[length], header, fixture_profile: profile });
  if (length === 'short') expect(receipt?.pcm_sha256).toBe('cc5c688c270350a2bba3ce5746489b9fb77a7062e6d470e1ee088b42f7352a23');
  if (length === 'short' && shortProfile === 'regular') expect(receipt?.packet_samples).toEqual(Array.from({ length: 310 }, () => 4800));
  return { version, asset, header, job: completed };
}

export async function savedPair(baseURL: string | undefined, shortProfile: ShortProfile = 'regular') {
  const { api, project } = await projectOnly(baseURL);
  const a = await generatedVersion(api, project.id, 'long', 'A long 35s saved tone');
  const b = await generatedVersion(api, project.id, 'short', 'B short 31s saved tone', shortProfile);
  const versions = received(await api.GET('/projects/{project_id}/versions', { params: { path: { project_id: project.id } } }));
  expect(versions.map(row => row.id)).toEqual([a.version.id, b.version.id]);
  return { api, project, a, b, versions };
}

export async function usePair(page: Page, projectId: string, a: Version, b: Version, locale: Locale = 'en') {
  await page.goto(`/projects/${projectId}/versions`);
  await page.locator('.preferences select').selectOption(locale);
  await expect(page.getByRole('heading', { name: a.name, exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: b.name, exact: true })).toBeVisible();
  await choosePair(page, a.id, b.id, locale);
  await ready(page, a, expectedFrames.long / 48000, locale);
}

export async function choosePair(page: Page, a: string, b: string | null, locale: Locale = 'en') {
  const form = page.locator('.compare-selection');
  await expect(form.getByRole('heading', { name: labels[locale].heading, exact: true })).toBeVisible();
  await form.getByRole('combobox', { name: labels[locale].a, exact: true }).selectOption(a);
  await form.getByRole('combobox', { name: labels[locale].b, exact: true }).selectOption(b ?? '');
  await form.getByRole('button', { name: labels[locale].use, exact: true }).click();
}

export async function ready(page: Page, version: Version, duration: number, locale: Locale = 'en') {
  const player = page.locator('#persistent-player');
  await expect(player.getByRole('button', { name: playerLabels[locale].play, exact: true })).toBeEnabled();
  await expect(player.locator('.player-title strong')).toContainText(version.name);
  await expect(page.locator('audio')).toHaveCount(1);
  await expect.poll(async () => (await nativeState(page)).duration).toBeCloseTo(duration, 4);
}

export async function region(page: Page, start: string, end: string, locale: Locale = 'en') {
  const player = page.locator('#persistent-player');
  const details = player.locator('.player-regions');
  if (await details.getAttribute('open') === null) await details.locator('summary').click();
  await player.getByLabel(playerLabels[locale].start, { exact: true }).fill(start);
  await player.getByLabel(playerLabels[locale].end, { exact: true }).fill(end);
  await player.getByRole('button', { name: playerLabels[locale].apply, exact: true }).click();
}

export async function nativeState(page: Page) {
  return page.locator('#persistent-player audio').evaluate((audio: HTMLAudioElement) => ({ duration: audio.duration, time: audio.currentTime,
    paused: audio.paused, ended: audio.ended, error: audio.error?.code ?? null, source: audio.currentSrc, readyState: audio.readyState }));
}

export async function nativeHash(page: Page) {
  return page.locator('#persistent-player audio').evaluate(async (audio: HTMLAudioElement) => {
    const bytes = await (await fetch(audio.currentSrc)).arrayBuffer();
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
  });
}

export async function setSeekInput(page: Page, seconds: number, locale: Locale = 'en') {
  const slider = page.locator('#persistent-player').getByRole('slider', { name: playerLabels[locale].seek, exact: true });
  await expect(slider).toBeEnabled();
  const min = Number(await slider.getAttribute('min'));
  const max = Number(await slider.getAttribute('max'));
  const step = Number(await slider.getAttribute('step'));
  if (![min, max, step, seconds].every(Number.isFinite) || step <= 0 || seconds < min || seconds > max
    || Math.abs(min + Math.round((seconds - min) / step) * step - seconds) > .000001) throw new Error('Seek must fit the public slider range and step');
  await slider.focus();
  await slider.press(max - seconds < seconds - min ? 'End' : 'Home');
  const endpoint = Number(await slider.inputValue());
  const count = Math.round(Math.abs(seconds - endpoint) / step);
  const direction = seconds < endpoint ? 'ArrowLeft' : 'ArrowRight';
  if (Math.abs(endpoint + (direction === 'ArrowLeft' ? -1 : 1) * count * step - seconds) > .000001) throw new Error('Public slider endpoint cannot reach the intended step');
  for (let index = 0; index < count; index++) await page.keyboard.press(direction);
}

export async function seek(page: Page, seconds: number, locale: Locale = 'en') {
  await setSeekInput(page, seconds, locale);
  await expect.poll(async () => Math.abs((await nativeState(page)).time - seconds) < .2).toBe(true);
}
