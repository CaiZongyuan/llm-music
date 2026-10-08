import { expect, type Page } from '@playwright/test';
import type { components, JobRead } from '@llm-music/api-client';
import { assetBytes, abcBytes, completedJob, control as coverControl, derivedSeed, expectedInput, FULL_ABC, MELODY_ABC, type Api } from './cover-fixtures.js';
import { control as generationControl, hash } from './generation-fixtures.js';
import { received } from './score-fixtures.js';

export type Version = components['schemas']['VersionRead'];
export type Locale = 'en' | 'zh-CN';
export const labels = {
  en: { branch: 'Continue from this version', reuse: 'Use this version’s inputs', versions: 'Versions', reread: 'Reread versions', select: 'Select saved Score', current: 'Notation and MIDI match the current draft.', ready: 'The saved Score matches this valid draft.', generate: 'Generate from selected Score', save: 'Save as a version', name: 'Version name', saved: 'View saved version', style: 'Music style', lyrics: 'Lyrics', seed: 'Random seed', abc: 'ABC Score text' },
  'zh-CN': { branch: '从此版本继续创作', reuse: '使用此版本输入', versions: '版本', reread: '重新读取版本', select: '选定已保存 Score', current: '谱面和 MIDI 对应当前草稿。', ready: '已保存 Score 对应当前有效草稿。', generate: '从选定 Score 生成', save: '保存为版本', name: '版本名称', saved: '查看已存版本', style: '音乐风格', lyrics: '歌词', seed: '随机种子', abc: 'ABC 乐谱文本' },
};
export const BRANCH_INPUTS = { style: 'new brushed jazz branch', lyrics: '[Verse]\nKeep this chosen cover morning.', seed: 2026470001 };

export async function resetFaults() {
  await generationControl({});
  await coverControl({});
}

export async function savedVersions(api: Api, projectId: string) {
  return received(await api.GET('/projects/{project_id}/versions', { params: { path: { project_id: projectId } } }));
}

export async function saveCompleted(api: Api, projectId: string, job: JobRead, name: string) {
  const complete = await completedJob(api, projectId, job);
  if (!complete.result?.candidate_id) throw new Error('No public completed Candidate');
  return received(await api.POST('/projects/{project_id}/versions', { params: { path: { project_id: projectId } }, body: { candidate_id: complete.result.candidate_id, name } }));
}

export async function coverForest(baseURL: string | undefined) {
  const fixture = await derivedSeed(baseURL);
  const { api, project, original, reference, score } = fixture;
  const path = { project_id: project.id };
  const coverJob = received(await api.POST('/projects/{project_id}/jobs/cover', { params: { path },
    body: expectedInput(reference.id, score.id, original.id, FULL_ABC, MELODY_ABC) }));
  const cover = await saveCompleted(api, project.id, coverJob, 'Chosen Cover V2');
  const coverScore = received(await api.GET('/projects/{project_id}/scores/{score_id}', { params: { path: { ...path, score_id: cover.score_id } } }));
  expect(coverScore.parent_version_id).toBe(original.id);
  expect(cover.score_id).toBe(coverScore.id);
  expect(await abcBytes(api, project.id, coverScore)).toBe(MELODY_ABC);
  const siblingJob = received(await api.POST('/projects/{project_id}/jobs/generate-from-score', { params: { path }, body: {
    abc: MELODY_ABC, source_score_id: fixture.original.score_id, parent_version_id: original.id,
    style: 'latest sibling electronic', lyrics: '[Verse]\nA different later direction.', seed: 2026470099, max_seconds: 35,
  } }));
  const sibling = await saveCompleted(api, project.id, siblingJob, 'Latest sibling V3');
  const versions = await savedVersions(api, project.id);
  expect(versions.map(value => ({ id: value.id, parent: value.parent_version_id }))).toEqual([
    { id: original.id, parent: null }, { id: cover.id, parent: original.id }, { id: sibling.id, parent: original.id },
  ]);
  const immutable = {
    versions,
    referenceOrigin: fixture.origin,
    audioHashes: await Promise.all(versions.map(async value => ({ id: value.id, sha256: hash(await assetBytes(api, project.id, value.audio_asset_id)) }))),
    coverABC: await abcBytes(api, project.id, coverScore),
  };
  return { ...fixture, cover, coverScore, sibling, immutable };
}

export async function startBranch(page: Page, projectId: string, version: Version, locale: Locale = 'en') {
  await page.goto(`/projects/${projectId}/versions/${version.id}`);
  await page.locator('.preferences select').selectOption(locale);
  await expect(page.locator('.version-detail')).toHaveAttribute('data-version-id', version.id);
  await page.getByRole('link', { name: labels[locale].branch, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/scores/${version.score_id}\\?[^#]*branchVersionId=${version.id}`));
  await expect(page.getByText(labels[locale].current, { exact: true })).toBeVisible();
}

export async function setInputs(page: Page, value = BRANCH_INPUTS, locale: Locale = 'en') {
  const t = labels[locale], form = page.locator('.score-regeneration');
  await form.getByRole('textbox', { name: t.style, exact: true }).fill(value.style);
  await form.getByRole('textbox', { name: t.lyrics, exact: true }).fill(value.lyrics);
  await form.getByRole('textbox', { name: t.seed, exact: true }).fill(String(value.seed));
}

export async function generateFromCurrent(page: Page, locale: Locale = 'en') {
  const posted = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/jobs/generate-from-score'));
  await page.getByRole('button', { name: labels[locale].generate, exact: true }).click();
  const response = await posted;
  expect(response.status()).toBe(202);
  const job: JobRead = await response.json();
  const body: unknown = response.request().postDataJSON();
  return { job, body };
}

export async function candidateOf(page: Page, jobId: string) {
  const region = page.locator('.candidate-detail');
  await expect(region).toBeVisible();
  await expect(region.locator('.record-details code').filter({ hasText: jobId })).toHaveCount(1);
  const id = await region.getAttribute('data-candidate-id');
  if (!id) throw new Error('No resulting public Candidate');
  return id;
}
