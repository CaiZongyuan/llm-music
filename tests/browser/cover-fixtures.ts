import { randomUUID } from 'node:crypto';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMusicClient, type CoverCreate, type JobRead, type components } from '@llm-music/api-client';
import { expect, type Page } from '@playwright/test';
import { hash, runDir } from './generation-fixtures.js';
import { inspectMidi, received } from './score-fixtures.js';
import { withParent } from './score-generation-fixtures.js';

// Worked four-bar fixtures are deliberately literal. Neither expected ABC nor
// musical events are obtained from the application's Cover transform.
export const FULL_ABC = 'X:1\nT:\nM:4/4\nL:1/8\nQ:1/4=96\nV: Vocal clef=treble name="Vocal Melody" snm="Vocal"\nV: Ins clef=treble name="Ins Melody" snm="Inst."\nK:C\n% verse\nV: Vocal\n"C"z8 | "Am"z8 | "F"z8 | "G"z8 |\nV: Ins\nC D E F G2 E2 | F E D C D4 | E F G A G2 E2 | D E F D C4 |';
export const MELODY_ABC = 'X:1\nT:\nM:4/4\nL:1/8\nQ:1/4=96\nV: Vocal clef=treble name="Vocal Melody" snm="Vocal"\nV: Ins clef=treble name="Ins Melody" snm="Inst."\nK:C\n% verse\nV: Vocal\nz8 | z8 | z8 | z8 |\nV: Ins\nC D E F G2 E2 | F E D C D4 | E F G A G2 E2 | D E F D C4 |';
export const EDITED_FULL = 'X:1\nT:\nM:4/4\nL:1/8\nQ:1/4=96\nV: Vocal clef=treble name="Vocal Melody" snm="Vocal"\nV: Ins clef=treble name="Ins Melody" snm="Inst."\nK:C\n% verse\nV: Vocal\n"C"z8 | "Am"z8 | "F"z8 | "G"z8 |\nV: Ins\nG A B c d2 B2 | F E D C D4 | E F G A G2 E2 | D E F D C4 |';
export const EDITED_MELODY = 'X:1\nT:\nM:4/4\nL:1/8\nQ:1/4=96\nV: Vocal clef=treble name="Vocal Melody" snm="Vocal"\nV: Ins clef=treble name="Ins Melody" snm="Inst."\nK:C\n% verse\nV: Vocal\nz8 | z8 | z8 | z8 |\nV: Ins\nG A B c d2 B2 | F E D C D4 | E F G A G2 E2 | D E F D C4 |';
export const NEXT_FULL = 'X:1\nT:\nM:4/4\nL:1/8\nQ:1/4=96\nV: Vocal clef=treble name="Vocal Melody" snm="Vocal"\nV: Ins clef=treble name="Ins Melody" snm="Inst."\nK:C\n% verse\nV: Vocal\n"C"z8 | "Am"z8 | "F"z8 | "G"z8 |\nV: Ins\nA B c d e2 c2 | F E D C D4 | E F G A G2 E2 | D E F D C4 |';
export const STYLE = 'gentle folk pop, warm piano';
export const LYRICS = '[Verse]\nAfter rain, we walk into morning.';
export const SEED = 2026440001;
export const referencePath = resolve(fileURLToPath(new URL('../../', import.meta.url)), 'docs/previews/web-mvp-v1/reference-16s.wav');
export type Api = ReturnType<typeof createMusicClient>;
export type Asset = components['schemas']['AssetRead'];
export type Score = components['schemas']['ScoreRead'];
export const labels = {
  en: { abc: 'ABC Score text', current: 'Notation and MIDI match the current draft.', saveScore: 'Save and select this Score', selectScore: 'Select saved Score', ready: 'The saved Score matches this valid draft.', inspect: 'Inspect melody input', select: 'Select this melody input', audition: 'Audition effective MIDI', midi: 'Export effective MIDI', generate: 'Generate melody Cover', style: 'Music style', lyrics: 'Lyrics', seed: 'Random seed', play: 'Play', pause: 'Pause', name: 'Version name', save: 'Save as a version', saved: 'View saved version', snapshot: 'Submitted inputs', listen: 'Listen to this music', source: 'Inspect submitted source Score' },
  'zh-CN': { abc: 'ABC 乐谱文本', current: '谱面和 MIDI 对应当前草稿。', saveScore: '保存并选定此 Score', selectScore: '选定已保存 Score', ready: '已保存 Score 对应当前有效草稿。', inspect: '检查 melody 输入', select: '选定此 melody 输入', audition: '试听有效输入 MIDI', midi: '导出有效输入 MIDI', generate: '生成 melody 改编', style: '音乐风格', lyrics: '歌词', seed: '随机种子', play: '播放', pause: '暂停', name: '版本名称', save: '保存为版本', saved: '查看已存版本', snapshot: '提交时的输入', listen: '试听这段音乐', source: '查看提交的来源乐谱' },
};
export type Locale = keyof typeof labels;
export type CoverMode = CoverCreate['mode'];
export function modeLabels(locale: Locale, mode: CoverMode) {
  if (mode === 'melody') return labels[locale];
  return { ...labels[locale],
    inspect: locale === 'en' ? 'Inspect full input' : '检查 full 输入',
    select: locale === 'en' ? 'Select this full input' : '选定此 full 输入',
    generate: locale === 'en' ? 'Generate full Cover' : '生成 full 改编',
  };
}

export async function control(value: Record<string, string>) {
  const path = resolve(runDir!, 'cover-control.json');
  await writeFile(`${path}.tmp`, JSON.stringify(value));
  await rename(`${path}.tmp`, path);
}

export async function projectOnly(baseURL: string | undefined) {
  if (!baseURL) throw new Error('Missing owned production Web URL');
  const api = createMusicClient({ baseUrl: `${baseURL}/api` });
  const project = received(await api.POST('/projects', { body: { name: `Cover · ${randomUUID().slice(0, 8)}` } }));
  return { api, project };
}

export async function uploadReference(api: Api, projectId: string, name = 'local-reference-16s.wav') {
  const file = new Blob([new Uint8Array(await readFile(referencePath))], { type: 'audio/wav' });
  const body = new FormData();
  body.set('file', file, name);
  return received(await api.POST('/projects/{project_id}/assets', {
    params: { path: { project_id: projectId } },
    body: { file }, bodySerializer: () => body,
  }));
}

export async function completedJob(api: Api, projectId: string, job: JobRead) {
  let current = job;
  await expect.poll(async () => {
    current = received(await api.GET('/projects/{project_id}/jobs/{job_id}', { params: { path: { project_id: projectId, job_id: job.id } } }));
    return current.status;
  }).toBe('completed');
  return current;
}

export async function transcribe(api: Api, projectId: string, reference: Asset) {
  const job = received(await api.POST('/projects/{project_id}/transcriptions', { params: { path: { project_id: projectId } }, body: { reference_asset_id: reference.id } }));
  const completed = await completedJob(api, projectId, job);
  if (!completed.result?.score_id) throw new Error('No completed public transcription Score');
  const score = received(await api.GET('/projects/{project_id}/scores/{score_id}', { params: { path: { project_id: projectId, score_id: completed.result.score_id } } }));
  expect(await abcBytes(api, projectId, score)).toBe(FULL_ABC);
  return { transcribedJob: completed, score };
}

export async function abcBytes(api: Api, projectId: string, score: Score) {
  return received(await api.GET('/projects/{project_id}/assets/{asset_id}/content', { params: { path: { project_id: projectId, asset_id: score.abc_asset_id } }, parseAs: 'text' }));
}

export async function assetBytes(api: Api, projectId: string, assetId: string) {
  return Buffer.from(received(await api.GET('/projects/{project_id}/assets/{asset_id}/content', { params: { path: { project_id: projectId, asset_id: assetId } }, parseAs: 'arrayBuffer' })));
}

export async function derivedSeed(baseURL: string | undefined) {
  const seeded = await withParent(baseURL);
  const { api, project, original } = seeded;
  const reference = received(await api.POST('/projects/{project_id}/reference-audio/from-version', { params: { path: { project_id: project.id } }, body: { source_version_id: original.id, save_id: randomUUID() } }));
  const origin = received(await api.GET('/projects/{project_id}/assets/{asset_id}/reference-origin', { params: { path: { project_id: project.id, asset_id: reference.id } } }));
  return { ...seeded, reference, origin, ...await transcribe(api, project.id, reference) };
}

export async function uploadedSeed(baseURL: string | undefined) {
  const seeded = await projectOnly(baseURL);
  const reference = await uploadReference(seeded.api, seeded.project.id);
  return { ...seeded, reference, ...await transcribe(seeded.api, seeded.project.id, reference) };
}

export function expectedInput(referenceId: string, sourceScoreId: string, parent: string | null, abc = EDITED_FULL, effective = EDITED_MELODY, mode: CoverMode = 'melody'): CoverCreate {
  return { abc, source_score_id: sourceScoreId, reference_asset_id: referenceId, parent_version_id: parent, mode,
    effective_abc_sha256: hash(Buffer.from(effective)), mode_transform_version: '1.0.0', style: STYLE, lyrics: LYRICS, seed: SEED, max_seconds: 35 };
}

export function expectReferenceWav(bytes: Buffer) {
  expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
  expect(bytes.toString('ascii', 8, 12)).toBe('WAVE');
  expect(bytes.readUInt32LE(16)).toBe(16);
  expect(bytes.readUInt16LE(20)).toBe(1);
  expect(bytes.readUInt16LE(22)).toBe(2);
  expect(bytes.readUInt32LE(24)).toBe(48000);
  expect(bytes.readUInt16LE(34)).toBe(16);
  expect(bytes.toString('ascii', 36, 40)).toBe('data');
  expect(bytes.readUInt32LE(40)).toBe(768000 * 2 * 2);
  expect(bytes.length).toBe(44 + 768000 * 2 * 2);
  return { frames: 768000, seconds: 16, sampleRate: 48000, channels: 2, sha256: hash(bytes) };
}

export function coverUrl(projectId: string, referenceId?: string, scoreId?: string, transcriptionJobId?: string) {
  const query = new URLSearchParams();
  if (referenceId) query.set('referenceAssetId', referenceId);
  if (scoreId) query.set('scoreId', scoreId);
  if (transcriptionJobId) query.set('transcriptionJobId', transcriptionJobId);
  return `/projects/${projectId}/cover${query.size ? `?${query}` : ''}`;
}

export async function openCover(page: Page, projectId: string, referenceId: string, score: Score, locale: Locale = 'en') {
  await page.goto(coverUrl(projectId, referenceId, score.id, score.job_id ?? undefined));
  await page.locator('.preferences select').selectOption(locale);
  await expect(page.locator('.cover-workspace')).toBeVisible();
  await expect(page.getByRole('textbox', { name: labels[locale].abc, exact: true })).toHaveValue(FULL_ABC);
  await expect(page.getByText(labels[locale].current, { exact: true })).toBeVisible();
}

export async function selectMelody(page: Page, projectId: string, referenceId: string, score: Score, locale: Locale = 'en', edited = true) {
  await openCover(page, projectId, referenceId, score, locale);
  return selectCurrentMelody(page, referenceId, score.id, locale, edited);
}

export async function selectFull(page: Page, projectId: string, referenceId: string, score: Score, locale: Locale = 'en') {
  await openCover(page, projectId, referenceId, score, locale);
  await page.locator('.cover-mode input[value="full"]').check();
  return selectCurrentMode(page, referenceId, score.id, locale, true, 'full');
}

export async function selectCurrentMelody(page: Page, referenceId: string, sourceScoreId: string, locale: Locale = 'en', edited = true) {
  return selectCurrentMode(page, referenceId, sourceScoreId, locale, edited, 'melody');
}

async function selectCurrentMode(page: Page, referenceId: string, sourceScoreId: string, locale: Locale, edited: boolean, mode: CoverMode) {
  const t = labels[locale];
  if (edited) await page.getByRole('textbox', { name: t.abc, exact: true }).fill(EDITED_FULL);
  await expect(page.getByText(t.current, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: edited ? t.saveScore : t.selectScore, exact: true }).click();
  await expect(page.getByText(t.ready, { exact: true })).toBeVisible();
  const selected = await page.locator('.selected-score').getAttribute('data-selected-score-id');
  if (!selected || edited && selected === sourceScoreId) throw new Error('No independently saved selected Score');
  const effective = mode === 'full' ? edited ? EDITED_FULL : FULL_ABC : edited ? EDITED_MELODY : MELODY_ABC;
  await inspectAndSelect(page, referenceId, selected, locale, effective, mode);
  return selected;
}

export async function inspectAndSelect(page: Page, referenceId: string, selectedId: string, locale: Locale = 'en', effective = EDITED_MELODY, mode: CoverMode = 'melody') {
  const t = modeLabels(locale, mode);
  await page.getByRole('button', { name: t.inspect, exact: true }).click();
  await expect(page.locator('.cover-effective [data-effective-abc]')).toHaveText(effective);
  await page.getByRole('button', { name: t.select, exact: true }).click();
  const selection = page.locator('.cover-selection');
  await expect(selection).toHaveAttribute('data-selected-score-id', selectedId);
  await expect(selection).toHaveAttribute('data-reference-id', referenceId);
  await expect(selection).toHaveAttribute('data-mode', mode);
}

export async function fillCover(page: Page, locale: Locale = 'en') {
  const region = page.locator('.cover-generation'), t = labels[locale];
  await region.getByRole('textbox', { name: t.style, exact: true }).fill(STYLE);
  await region.getByRole('textbox', { name: t.lyrics, exact: true }).fill(LYRICS);
  await region.getByRole('textbox', { name: t.seed, exact: true }).fill(String(SEED));
}

export async function generateCover(page: Page, locale: Locale = 'en', mode: CoverMode = 'melody') {
  await fillCover(page, locale);
  const posted = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/jobs/cover'));
  await page.getByRole('button', { name: modeLabels(locale, mode).generate, exact: true }).click();
  const response = await posted;
  expect(response.status()).toBe(202);
  const job: JobRead = await response.json();
  const region = page.locator('.cover-generation .candidate-detail');
  await expect(region).toBeVisible();
  await expect(region.locator('.record-details code').filter({ hasText: job.id })).toHaveCount(1);
  const candidateId = await region.getAttribute('data-candidate-id');
  if (!candidateId) throw new Error('No resulting public Cover Candidate');
  return { job, candidateId };
}

export function expectFullMusic(bytes: Buffer) {
  const facts = inspectMidi(bytes);
  expect(facts.meters).toEqual([{ numerator: 4, denominator: 4 }]);
  const pitches = [67, 69, 71, 72, 74, 71, 65, 64, 62, 60, 62, 64, 65, 67, 69, 67, 64, 62, 64, 65, 62, 60];
  const starts = [0, .3125, .625, .9375, 1.25, 1.875, 2.5, 2.8125, 3.125, 3.4375, 3.75, 5, 5.3125, 5.625, 5.9375, 6.25, 6.875, 7.5, 7.8125, 8.125, 8.4375, 8.75];
  const accompaniment = [...facts.notes];
  // Remove exactly one literal Ins event per note; remaining voices are the
  // written C/Am/F/G accompaniment, not values read from a native transform.
  pitches.forEach((pitch, index) => {
    const at = accompaniment.findIndex(note => note.pitch === pitch && note.start === starts[index]);
    expect(at).toBeGreaterThanOrEqual(0);
    accompaniment.splice(at, 1);
  });
  expect(accompaniment).toHaveLength(32);
  const chords = [[0, 4, 7], [0, 4, 9], [0, 5, 9], [2, 7, 11]];
  chords.forEach((chord, bar) => {
    const notes = accompaniment.filter(note => note.start >= bar * 2.5 && note.start < (bar + 1) * 2.5);
    expect(notes).toHaveLength(8);
    expect([...new Set(notes.map(note => note.pitch % 12))].sort((a, b) => a - b)).toEqual(chord);
    expect(notes.map(note => note.start - bar * 2.5)).toEqual([0, .625, .625, .625, 1.25, 1.875, 1.875, 1.875]);
  });
  return { ...facts, accompaniment };
}

// Hold the mounted public origin read after the real server has answered. This
// fixes the overlap with a producer's list update without inspecting Query.
export async function holdMountedOrigin(page: Page, projectId: string, referenceId: string, sourceVersionId: string, sourceAssetId: string) {
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const reads: { ordinal: number; status: number }[] = [], failures: string[] = [];
  const suffix = `/api/projects/${projectId}/assets/${referenceId}/reference-origin`;
  page.on('requestfailed', request => {
    if (request.url().endsWith(suffix)) failures.push(request.failure()?.errorText ?? 'unknown request failure');
  });
  await page.route(`**${suffix}`, async route => {
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ reference_asset_id: referenceId, source_version_id: sourceVersionId, source_asset_id: sourceAssetId });
    const ordinal = reads.length + 1;
    reads.push({ ordinal, status: response.status() });
    if (ordinal === 1) await held;
    await route.fulfill({ response });
  });
  return { ready: () => reads.length > 0, release: () => release(), reads, failures };
}
