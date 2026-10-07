import { createHash } from 'node:crypto';
import { rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, type Page } from '@playwright/test';

export const runDir = process.env.MUSIC_BROWSER_RUN_DIR;
if (!runDir) throw new Error('Generation checks require their owned API directory');
export const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export async function control(value: Record<string, string>) {
  const path = resolve(runDir!, 'generation-control.json');
  await writeFile(`${path}.tmp`, JSON.stringify(value));
  await rename(`${path}.tmp`, path);
}
export function received<T>(result: { data?: T; response: Response }): T {
  expect(result.response.ok).toBe(true);
  if (result.data === undefined) throw new Error('Missing public API data');
  return result.data;
}
export const labels = {
  'zh-CN': { style: '音乐风格', lyrics: '歌词', seed: '随机种子', submit: '生成一段音乐', listen: '试听这段音乐', play: '播放', pause: '暂停', seek: '播放位置（秒）', region: '试听片段', start: '片段起点（秒）', end: '片段终点（秒）', apply: '设置片段', playRegion: '播放片段', invalidRegion: '起点必须小于终点，且片段须在音频时长内。', save: '保存为版本', name: '版本名称', saved: '查看已存版本', score: '查看乐谱', lyricsTab: '歌词与输入', versionsTab: '版本', generateTab: '音乐生成' },
  en: { style: 'Music style', lyrics: 'Lyrics', seed: 'Random seed', submit: 'Generate a music clip', listen: 'Listen to this music', play: 'Play', pause: 'Pause', seek: 'Playback position (seconds)', region: 'Listening region', start: 'Region start (seconds)', end: 'Region end (seconds)', apply: 'Set region', playRegion: 'Play region', invalidRegion: 'The start must precede the end, and the region must stay within the audio duration.', save: 'Save as a version', name: 'Version name', saved: 'View saved version', score: 'View score', lyricsTab: 'Lyrics and inputs', versionsTab: 'Versions', generateTab: 'Generate music' },
};
export async function inputs(page: Page, locale: keyof typeof labels, suffix = '') {
  const t = labels[locale];
  await page.getByRole('textbox', { name: t.style, exact: true }).fill(`温暖的钢琴 · warm piano${suffix}`);
  await page.getByRole('textbox', { name: t.lyrics, exact: true }).fill('[Verse]\n雨停之后，我们走向晨光。\nAfter rain, we walk into morning.');
  await page.getByRole('textbox', { name: t.seed, exact: true }).fill('2026192201');
}
export async function completedCandidate(page: Page, locale: keyof typeof labels) {
  await page.getByRole('button', { name: labels[locale].submit }).click();
  await expect(page.locator('[data-candidate-id]')).toBeVisible();
  const id = await page.locator('[data-candidate-id]').getAttribute('data-candidate-id');
  if (!id) throw new Error('No Candidate identity');
  return id;
}
export async function mediaState(page: Page) {
  return page.locator('audio').evaluate(element => {
    if (!(element instanceof HTMLAudioElement)) throw new Error('Expected the sole native audio player');
    return { duration: element.duration, time: element.currentTime, paused: element.paused, error: element.error?.code ?? null };
  });
}


