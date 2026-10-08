import { expect, type Page } from '@playwright/test';
import type { JobRead } from '@llm-music/api-client';
import { ABC, EDITED_ABC, received, seed } from './score-fixtures.js';

export const STYLE = 'gentle folk pop, warm piano';
export const LYRICS = '[Verse]\nAfter rain, we walk into morning.';
export const SEED = '2026420002';
export const translations = {
  en: { abc: 'ABC Score text', current: 'Notation and MIDI match the current draft.', saveScore: 'Save and select this Score', ready: 'The saved Score matches this valid draft.', select: 'Select saved Score', generate: 'Generate from selected Score', style: 'Music style', lyrics: 'Lyrics', seed: 'Random seed', listen: 'Listen to this music', name: 'Version name', save: 'Save as a version', saved: 'View saved version', snapshot: 'Submitted inputs', source: 'Inspect submitted source Score', versions: 'Versions', scores: 'Scores', inputs: 'Lyrics and inputs', play: 'Play', pause: 'Pause' },
  'zh-CN': { abc: 'ABC 乐谱文本', current: '谱面和 MIDI 对应当前草稿。', saveScore: '保存并选定此 Score', ready: '已保存 Score 对应当前有效草稿。', select: '选定已保存 Score', generate: '从选定 Score 生成', style: '音乐风格', lyrics: '歌词', seed: '随机种子', listen: '试听这段音乐', name: '版本名称', save: '保存为版本', saved: '查看已存版本', snapshot: '提交时的输入', source: '查看提交的来源乐谱', versions: '版本', scores: '乐谱', inputs: '歌词与输入', play: '播放', pause: '暂停' },
};

export async function withParent(baseURL: string | undefined) {
  const { api, project, score: standalone } = await seed(baseURL);
  const path = { project_id: project.id };
  const job = received(await api.POST('/projects/{project_id}/jobs/generate-from-score', { params: { path }, body: { abc: ABC, source_score_id: standalone.id, parent_version_id: null, style: 'original piano', lyrics: '[Verse]\nKeep the first morning.', seed: 2026420000, max_seconds: 35 } }));
  let complete: JobRead = job;
  await expect.poll(async () => {
    complete = received(await api.GET('/projects/{project_id}/jobs/{job_id}', { params: { path: { ...path, job_id: job.id } } }));
    return complete.status;
  }).toBe('completed');
  if (!complete.result?.candidate_id) throw new Error('No original completed Candidate');
  const original = received(await api.POST('/projects/{project_id}/versions', { params: { path }, body: { candidate_id: complete.result.candidate_id, name: 'Original V1' } }));
  const score = received(await api.GET('/projects/{project_id}/scores/{score_id}', { params: { path: { ...path, score_id: original.score_id } } }));
  const originalABC = received(await api.GET('/projects/{project_id}/assets/{asset_id}/content', { params: { path: { ...path, asset_id: score.abc_asset_id } }, parseAs: 'text' }));
  expect(originalABC).toBe(ABC);
  return { api, project, score, original };
}

export async function selectEdited(page: Page, projectId: string, scoreId: string, locale: keyof typeof translations = 'en') {
  const t = translations[locale];
  await page.goto(`/projects/${projectId}/scores/${scoreId}`);
  await page.locator('.preferences select').selectOption(locale);
  await page.getByRole('textbox', { name: t.abc, exact: true }).fill(EDITED_ABC);
  await expect(page.getByText(t.current, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: t.saveScore, exact: true }).click();
  await expect(page.getByText(t.ready, { exact: true })).toBeVisible();
  const id = await page.locator('.selected-score').getAttribute('data-selected-score-id');
  if (!id || id === scoreId) throw new Error('The edit must be independently saved and selected');
  return id;
}

export async function fillGeneration(page: Page, locale: keyof typeof translations = 'en') {
  const t = translations[locale];
  await page.getByRole('textbox', { name: t.style, exact: true }).fill(STYLE);
  await page.getByRole('textbox', { name: t.lyrics, exact: true }).fill(LYRICS);
  await page.getByRole('textbox', { name: t.seed, exact: true }).fill(SEED);
}

export async function generateCandidate(page: Page, locale: keyof typeof translations = 'en') {
  const t = translations[locale];
  await fillGeneration(page, locale);
  const posted = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/jobs/generate-from-score'));
  await page.getByRole('button', { name: t.generate, exact: true }).click();
  const response = await posted;
  expect(response.status()).toBe(202);
  const job: JobRead = await response.json();
  const region = page.locator('.candidate-detail');
  await expect(region).toBeVisible();
  await expect(region.locator('.record-details code').filter({ hasText: job.id })).toHaveCount(1);
  const id = await region.getAttribute('data-candidate-id');
  if (!id) throw new Error('No resulting Candidate identity');
  return id;
}
