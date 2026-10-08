import { expect, test } from '@playwright/test';
import { ABC, EDITED_ABC, NEXT_ABC, downloadMidi, expectMusic, inspectAudition, projectOnly, received, seed } from './score-fixtures.js';

test('edited ABC exports and auditions its actual notes; explicit save creates an immutable independent Score', async ({ page, baseURL }, info) => {
  const { api, project, score } = await seed(baseURL);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`/projects/${project.id}/scores/${score.id}`);
  await page.locator('.preferences select').selectOption('en');
  const draft = page.getByRole('textbox', { name: 'ABC Score text', exact: true });
  await expect(draft).toHaveValue(ABC);
  await expect(page.getByText('Notation and MIDI match the current draft.', { exact: true })).toBeVisible();
  const originalMidi = await downloadMidi(page);
  const originalMusic = expectMusic(originalMidi);
  await page.getByRole('button', { name: 'Audition draft MIDI', exact: true }).click();
  const originalAudio = await inspectAudition(page);
  expect(originalAudio.frequency).toBeCloseTo(261.6256, 0);
  await draft.fill(EDITED_ABC);
  await expect(page.getByText('Notation and MIDI match the current draft.', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Score preview', exact: true }).locator('svg')).toHaveCount(1);
  const midi = await downloadMidi(page), music = expectMusic(midi, true);
  expect(midi.equals(originalMidi)).toBe(false);
  await page.getByRole('button', { name: 'Audition draft MIDI', exact: true }).click();
  const audio = await inspectAudition(page);
  expect(audio.frequency).toBeCloseTo(391.9954, 0);
  expect(audio.bytes.equals(originalAudio.bytes)).toBe(false);
  const auditionSource = audio.state.source;
  for (const tab of ['Lyrics and inputs', 'Versions']) {
    const before = await page.locator('#persistent-player audio').evaluate((element: HTMLAudioElement) => element.currentTime);
    await page.getByRole('link', { name: tab, exact: true }).click();
    await expect(page.locator('audio')).toHaveCount(1);
    await expect(page.locator('#persistent-player audio')).toHaveAttribute('src', auditionSource);
    await expect.poll(() => page.locator('#persistent-player audio').evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThan(before);
  }
  await page.getByRole('link', { name: 'Scores', exact: true }).click();
  await page.getByRole('link', { name: 'Inspect score →', exact: true }).click();
  await expect(draft).toHaveValue(EDITED_ABC);
  await expect(page.getByText('Notation and MIDI match the current draft.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save and select this Score', exact: true }).click();
  await expect(page.getByText('The saved Score matches this valid draft.', { exact: true })).toBeVisible();
  const scores = received(await api.GET('/projects/{project_id}/scores', { params: { path: { project_id: project.id } } }));
  expect(scores).toHaveLength(2);
  const edited = scores.find(value => value.id !== score.id);
  if (!edited) throw new Error('No independently saved edited Score');
  expect(edited.job_id).toBeNull();
  expect(edited.source_score_id).toBe(score.id);
  await expect(page.locator('.selected-score')).toHaveAttribute('data-selected-score-id', edited.id);
  const savedABC = received(await api.GET('/projects/{project_id}/assets/{asset_id}/content', { params: { path: { project_id: project.id, asset_id: edited.abc_asset_id } }, parseAs: 'text' }));
  expect(savedABC).toBe(EDITED_ABC);
  expect(received(await api.GET('/projects/{project_id}/scores/{score_id}', { params: { path: { project_id: project.id, score_id: score.id } } }))).toEqual(score);
  expect(received(await api.GET('/projects/{project_id}/assets/{asset_id}/content', { params: { path: { project_id: project.id, asset_id: score.abc_asset_id } }, parseAs: 'text' }))).toBe(ABC);
  expect(received(await api.GET('/projects/{project_id}/jobs', { params: { path: { project_id: project.id } } }))).toEqual([]);
  expect(received(await api.GET('/projects/{project_id}/versions', { params: { path: { project_id: project.id } } }))).toEqual([]);
  await page.getByRole('link', { name: 'Open saved Score', exact: true }).click();
  await expect(draft).toHaveValue(EDITED_ABC);
  await expect(page.locator('p.hint').filter({ hasText: 'This Score was explicitly saved independently, without an inference Job.' })).toBeVisible();
  await page.reload();
  await expect(draft).toHaveValue(EDITED_ABC);
  expect(errors).toEqual([]);
  await info.attach('original-midi', { body: originalMidi, contentType: 'audio/midi' });
  await info.attach('edited-midi', { body: midi, contentType: 'audio/midi' });
  await info.attach('original-audition', { body: originalAudio.bytes, contentType: 'audio/wav' });
  await info.attach('edited-audition', { body: audio.bytes, contentType: 'audio/wav' });
  await info.attach('saved-score-and-music', { body: JSON.stringify({ score, edited, savedABC, originalMusic, music, originalAudio: { frequency: originalAudio.frequency, duration: originalAudio.duration }, audio: { frequency: audio.frequency, duration: audio.duration } }, null, 2), contentType: 'application/json' });
});

for (const locale of ['zh-CN', 'en'] as const) for (const theme of ['light', 'dark'] as const) {
  test(`${locale}/${theme}: an empty Project can save and reopen an independent example Score`, async ({ page, baseURL }, info) => {
    const { api, project } = await projectOnly(baseURL);
    const exampleABC = `${ABC}\n`;
    const requests: string[] = [], errors: string[] = [];
    page.on('request', request => requests.push(request.url()));
    page.on('pageerror', error => errors.push(error.message));
    const t = locale === 'en'
      ? { empty: 'No score to inspect yet', example: 'Open example Score', label: 'ABC Score text', current: 'Notation and MIDI match the current draft.', save: 'Save and select this Score', ready: 'The saved Score matches this valid draft.', open: 'Open saved Score', independent: 'This Score was explicitly saved independently, without an inference Job.', export: 'Export draft MIDI' }
      : { empty: '还没有可以查看的乐谱', example: '打开示例 Score', label: 'ABC 乐谱文本', current: '谱面和 MIDI 对应当前草稿。', save: '保存并选定此 Score', ready: '已保存 Score 对应当前有效草稿。', open: '打开已保存 Score', independent: '这份 Score 由创作者独立保存，没有推理任务。', export: '导出草稿 MIDI' };
    await page.setViewportSize({ width: theme === 'dark' ? 390 : 1440, height: 960 });
    await page.goto(`/projects/${project.id}/scores`);
    await page.locator('.preferences select').selectOption(locale);
    if (theme === 'dark') await page.locator('.preferences button').click();
    await expect(page.getByRole('heading', { name: t.empty, exact: true })).toBeVisible();
    await page.getByRole('button', { name: t.example, exact: true }).click();
    const draft = page.getByRole('textbox', { name: t.label, exact: true });
    await expect(draft).toHaveValue(exampleABC);
    await expect(page.getByText(t.current, { exact: true })).toBeVisible();
    await page.locator('.preferences select').selectOption(locale === 'en' ? 'zh-CN' : 'en');
    await page.locator('.preferences button').click();
    await page.locator('.preferences select').selectOption(locale);
    await page.locator('.preferences button').click();
    await expect(draft).toHaveValue(exampleABC);
    expectMusic(await downloadMidi(page, t.export));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator('.score-notation').evaluate(element => {
      const svg = element.querySelector('svg');
      return Boolean(svg && svg.getBoundingClientRect().right <= element.getBoundingClientRect().right + 1);
    })).toBe(true);
    await page.getByRole('button', { name: t.save, exact: true }).click();
    await expect(page.getByText(t.ready, { exact: true })).toBeVisible();
    const scores = received(await api.GET('/projects/{project_id}/scores', { params: { path: { project_id: project.id } } }));
    expect(scores).toHaveLength(1);
    const score = scores[0]!;
    expect(score).toMatchObject({ job_id: null, source_score_id: null, parent_version_id: null });
    await page.getByRole('link', { name: t.open, exact: true }).click();
    await expect(page.locator('p.hint').filter({ hasText: t.independent })).toBeVisible();
    await page.reload();
    await expect(draft).toHaveValue(exampleABC);
    await expect(page.getByText(t.current, { exact: true })).toBeVisible();
    await expect(page.locator('.score-notation svg')).toHaveCount(1);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    expect(received(await api.GET('/projects/{project_id}/jobs', { params: { path: { project_id: project.id } } }))).toEqual([]);
    expect(errors).toEqual([]);
    expect(requests.every(url => url.startsWith(baseURL!) || url.startsWith('blob:'))).toBe(true);
    await page.screenshot({ path: info.outputPath(`${locale}-${theme}.png`), fullPage: true });
    await info.attach('independent-score', { body: JSON.stringify({ project, score, locale, theme, requests }, null, 2), contentType: 'application/json' });
  });
}

test('a notation bundle network failure preserves saved ABC and Update notation recovers', async ({ page, baseURL }) => {
  const { api, project, score } = await seed(baseURL);
  const bundle = '**/assets/abcjs-*.js*';
  await page.route(bundle, route => route.abort('failed'));
  await page.goto(`/projects/${project.id}/scores/${score.id}`);
  await page.locator('.preferences select').selectOption('en');
  const draft = page.getByRole('textbox', { name: 'ABC Score text', exact: true });
  await expect(page.getByRole('alert')).toContainText('Notation could not be displayed. Update notation to retry.');
  await expect(draft).toHaveValue(ABC);
  await expect(page.getByText('Notation will appear here after the draft passes checks.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Audition draft MIDI', exact: true })).toBeDisabled();
  await page.unroute(bundle);
  await page.getByRole('button', { name: 'Update notation', exact: true }).click();
  await expect(page.getByText('Notation and MIDI match the current draft.', { exact: true })).toBeVisible();
  expectMusic(await downloadMidi(page));
  expect(received(await api.GET('/projects/{project_id}/assets/{asset_id}/content', { params: { path: { project_id: project.id, asset_id: score.abc_asset_id } }, parseAs: 'text' }))).toBe(ABC);
});

test('native export and audio resource failures preserve the draft and recover through their public actions', async ({ page, baseURL }) => {
  const { api, project, score } = await seed(baseURL);
  await page.addInitScript(() => {
    const original = URL.createObjectURL;
    URL.createObjectURL = function (blob) {
      if (blob instanceof Blob && sessionStorage.getItem('score-test-failed-type') === blob.type) throw new DOMException('Test resource creation unavailable', 'QuotaExceededError');
      return original.call(URL, blob);
    };
  });
  await page.goto(`/projects/${project.id}/scores/${score.id}`);
  await page.locator('.preferences select').selectOption('en');
  const draft = page.getByRole('textbox', { name: 'ABC Score text', exact: true });
  await draft.fill(EDITED_ABC);
  await expect(page.getByText('Notation and MIDI match the current draft.', { exact: true })).toBeVisible();
  await page.evaluate(() => sessionStorage.setItem('score-test-failed-type', 'audio/midi'));
  await page.getByRole('button', { name: 'Export draft MIDI', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Audition or export could not be prepared. Your draft and saved results remain; retry.');
  await expect(draft).toHaveValue(EDITED_ABC);
  await page.evaluate(() => sessionStorage.removeItem('score-test-failed-type'));
  expectMusic(await downloadMidi(page), true);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.evaluate(() => sessionStorage.setItem('score-test-failed-type', 'audio/wav'));
  await page.getByRole('button', { name: 'Audition draft MIDI', exact: true }).click();
  await expect(page.locator('#persistent-player').getByRole('alert')).toContainText('This audio could not play.');
  await expect(draft).toHaveValue(EDITED_ABC);
  await page.evaluate(() => sessionStorage.removeItem('score-test-failed-type'));
  await page.locator('#persistent-player').getByRole('button', { name: 'Reread audio', exact: true }).click();
  const audio = await inspectAudition(page);
  expect(audio.frequency).toBeCloseTo(391.9954, 0);
  await expect(page.locator('audio')).toHaveCount(1);
  expect(received(await api.GET('/projects/{project_id}/scores', { params: { path: { project_id: project.id } } }))).toEqual([score]);
});

test('editing a saved Version Score retains its parent and never overwrites the old Version or Assets', async ({ page, baseURL }, info) => {
  const { api, project } = await projectOnly(baseURL);
  const path = { project_id: project.id };
  // Public CPU Fake generation establishes a real pre-existing saved graph.
  const submitted = received(await api.POST('/projects/{project_id}/jobs/generate', { params: { path }, body: { style: 'warm piano', lyrics: '[Verse]\nA quiet morning', seed: 408, max_seconds: 35 } }));
  let job = submitted;
  await expect.poll(async () => {
    job = received(await api.GET('/projects/{project_id}/jobs/{job_id}', { params: { path: { ...path, job_id: submitted.id } } }));
    return job.status;
  }).toBe('completed');
  const candidateId = job.result?.candidate_id;
  if (!candidateId) throw new Error('The CPU fixture did not produce a Candidate');
  const version = received(await api.POST('/projects/{project_id}/versions', { params: { path }, body: { candidate_id: candidateId, name: 'Original Version before editing' } }));
  const source = received(await api.GET('/projects/{project_id}/scores/{score_id}', { params: { path: { ...path, score_id: version.score_id } } }));
  const originalABC = received(await api.GET('/projects/{project_id}/assets/{asset_id}/content', { params: { path: { ...path, asset_id: source.abc_asset_id } }, parseAs: 'text' }));
  expect(originalABC).toContain('C4 D4 E4 G4');
  const editedABC = originalABC.replace('C4 D4 E4 G4', 'G4 A4 B4 c4');
  const assets = received(await api.GET('/projects/{project_id}/assets', { params: { path } }));
  const contents = await Promise.all(assets.map(async asset => {
    const result = await api.GET('/projects/{project_id}/assets/{asset_id}/content', { params: { path: { ...path, asset_id: asset.id } }, parseAs: 'arrayBuffer' });
    return Buffer.from(received(result));
  }));
  await page.goto(`/projects/${project.id}/scores/${source.id}`);
  await page.locator('.preferences select').selectOption('en');
  await page.getByRole('textbox', { name: 'ABC Score text', exact: true }).fill(editedABC);
  await expect(page.getByText('Notation and MIDI match the current draft.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save and select this Score', exact: true }).click();
  await expect(page.getByText('The saved Score matches this valid draft.', { exact: true })).toBeVisible();
  const id = await page.locator('.selected-score').getAttribute('data-selected-score-id');
  if (!id) throw new Error('Edited Score was not explicitly selected');
  const edited = received(await api.GET('/projects/{project_id}/scores/{score_id}', { params: { path: { ...path, score_id: id } } }));
  expect(edited).toMatchObject({ job_id: null, source_score_id: source.id, parent_version_id: version.id });
  await expect(page.locator('.selected-score')).toContainText(version.id);
  expect(received(await api.GET('/projects/{project_id}/versions', { params: { path } }))).toEqual([version]);
  expect(received(await api.GET('/projects/{project_id}/scores/{score_id}', { params: { path: { ...path, score_id: source.id } } }))).toEqual(source);
  expect(received(await api.GET('/projects/{project_id}/jobs', { params: { path } }))).toEqual([job]);
  for (let index = 0; index < assets.length; index++) {
    const asset = assets[index]!;
    expect(received(await api.GET('/projects/{project_id}/assets/{asset_id}', { params: { path: { ...path, asset_id: asset.id } } }))).toEqual(asset);
    const bytes = Buffer.from(received(await api.GET('/projects/{project_id}/assets/{asset_id}/content', { params: { path: { ...path, asset_id: asset.id } }, parseAs: 'arrayBuffer' })));
    expect(bytes.equals(contents[index]!)).toBe(true);
  }
  await page.getByRole('link', { name: 'Versions', exact: true }).click();
  await page.getByRole('link', { name: 'View version', exact: true }).click();
  await page.reload();
  await expect(page.locator('[data-version-id]')).toHaveAttribute('data-version-id', version.id);
  await expect(page.getByRole('heading', { name: version.name, exact: true })).toBeVisible();
  await info.attach('retained-version-graph', { body: JSON.stringify({ source, edited, version, job, assets, scope: 'real public CPU Fake fixture; no GPU inference' }, null, 2), contentType: 'application/json' });
});

test('invalid text, native rejection, failed validation and a late check preserve the draft and saved selection', async ({ page, baseURL }) => {
  const { api, project, score } = await seed(baseURL);
  await page.goto(`/projects/${project.id}/scores/${score.id}`);
  await page.locator('.preferences select').selectOption('en');
  const draft = page.getByRole('textbox', { name: 'ABC Score text', exact: true });
  const current = page.getByText('Notation and MIDI match the current draft.', { exact: true });
  const audition = page.getByRole('button', { name: 'Audition draft MIDI', exact: true });
  await expect(current).toBeVisible();
  await page.getByRole('button', { name: 'Select saved Score', exact: true }).click();
  await expect(page.locator('.selected-score')).toHaveAttribute('data-selected-score-id', score.id);
  const invalid = ABC.replace('C D E F', 'C ? D E F');
  await draft.fill(invalid);
  await expect(page.getByRole('alert')).toContainText(/Music Line:\d+:\d+:/);
  await expect(draft).toHaveValue(invalid);
  await expect(page.getByText('Showing the last valid notation; it is not the current draft.', { exact: true })).toBeVisible();
  await expect(audition).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Export draft MIDI', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Save and select this Score', exact: true })).toBeDisabled();
  await expect(page.locator('.selected-score')).toContainText('The draft changed.');
  await draft.fill(ABC.replace('z8 | z8 |', 'z4 | z8 |'));
  await expect(page.getByRole('alert')).toContainText('Outside the currently supported Score format');
  await expect(audition).toBeDisabled();
  let fail = true;
  const validationURL = `**/api/projects/${project.id}/scores/validate`;
  await page.route(validationURL, route => fail ? (fail = false, route.abort('failed')) : route.continue());
  await draft.fill(EDITED_ABC);
  await expect(page.getByRole('alert')).toContainText('The Score could not be checked. Update notation to retry.');
  await expect(draft).toHaveValue(EDITED_ABC);
  await expect(audition).toBeDisabled();
  await page.getByRole('button', { name: 'Update notation', exact: true }).click();
  await expect(current).toBeVisible();
  await page.unroute(validationURL);
  let release!: () => void, captured!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const waiting = new Promise<void>(resolve => { captured = resolve; });
  await page.route(validationURL, async route => {
    if (route.request().postDataJSON().abc !== ABC) return route.continue();
    const response = await route.fetch();
    captured(); await gate;
    await route.fulfill({ response });
  });
  try {
    await draft.fill(ABC);
    await waiting;
    await expect(page.getByText('Checking draft…', { exact: true })).toBeVisible();
    await expect(audition).toBeDisabled();
    await draft.fill(NEXT_ABC);
    await expect(current).toBeVisible();
  } finally { release(); await page.unrouteAll({ behavior: 'wait' }); }
  await expect(draft).toHaveValue(NEXT_ABC);
  await expect(current).toBeVisible();
  await expect(page.locator('.selected-score')).toHaveAttribute('data-selected-score-id', score.id);
  await expect(page.locator('.selected-score')).toContainText('The draft changed.');
  expect(received(await api.GET('/projects/{project_id}/assets/{asset_id}/content', { params: { path: { project_id: project.id, asset_id: score.abc_asset_id } }, parseAs: 'text' }))).toBe(ABC);
});

test('lost save acknowledgement retries the frozen snapshot once while newer text stays dirty', async ({ page, baseURL }, info) => {
  const { api, project, score } = await seed(baseURL);
  await page.goto(`/projects/${project.id}/scores/${score.id}`);
  await page.locator('.preferences select').selectOption('en');
  const draft = page.getByRole('textbox', { name: 'ABC Score text', exact: true });
  const current = page.getByText('Notation and MIDI match the current draft.', { exact: true });
  await draft.fill(EDITED_ABC);
  await expect(current).toBeVisible();
  let release!: () => void, committed!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const savedOnServer = new Promise<void>(resolve => { committed = resolve; });
  const writes: unknown[] = [];
  let drop = true;
  const saveURL = `**/api/projects/${project.id}/scores`;
  await page.route(saveURL, async route => {
    if (route.request().method() !== 'POST') return route.continue();
    writes.push(route.request().postDataJSON());
    if (!drop) return route.continue();
    drop = false;
    const response = await route.fetch();
    expect(response.status()).toBe(201);
    committed(); await gate;
    await route.abort('failed');
  });
  try {
    await page.getByRole('button', { name: 'Save and select this Score', exact: true }).click();
    await savedOnServer;
    await expect(page.getByRole('button', { name: 'Saving Score…', exact: true })).toBeDisabled();
    await draft.fill(NEXT_ABC);
    await expect(current).toBeVisible();
  } finally { release(); }
  await expect(page.getByRole('alert')).toContainText('Saving is unconfirmed.');
  await expect(draft).toHaveValue(NEXT_ABC);
  await page.getByRole('alert').getByRole('button', { name: 'Save the same snapshot again', exact: true }).click();
  await expect(page.getByText('Score saved independently; no Job or Version was created.', { exact: true })).toBeVisible();
  expect(writes).toHaveLength(2);
  expect(writes[1]).toEqual(writes[0]);
  const scores = received(await api.GET('/projects/{project_id}/scores', { params: { path: { project_id: project.id } } }));
  expect(scores).toHaveLength(2);
  const saved = scores.find(value => value.id !== score.id);
  if (!saved) throw new Error('No committed Score to recover');
  await expect(page.locator('.selected-score')).toHaveAttribute('data-selected-score-id', saved.id);
  await expect(page.locator('.selected-score')).toContainText('The draft changed.');
  await page.getByText('Inspect selected ABC snapshot', { exact: true }).click();
  await expect(page.locator('.selected-score .score-code')).toHaveText(EDITED_ABC);
  expect(received(await api.GET('/projects/{project_id}/assets/{asset_id}/content', { params: { path: { project_id: project.id, asset_id: saved.abc_asset_id } }, parseAs: 'text' }))).toBe(EDITED_ABC);
  await page.unroute(saveURL);
  await page.getByRole('button', { name: 'Save and select this Score', exact: true }).click();
  await expect(page.getByText('The saved Score matches this valid draft.', { exact: true })).toBeVisible();
  const final = received(await api.GET('/projects/{project_id}/scores', { params: { path: { project_id: project.id } } }));
  expect(final).toHaveLength(3);
  await expect(draft).toHaveValue(NEXT_ABC);
  expect(received(await api.GET('/projects/{project_id}/versions', { params: { path: { project_id: project.id } } }))).toEqual([]);
  await info.attach('frozen-save-recovery', { body: JSON.stringify({ writes, scores, final }, null, 2), contentType: 'application/json' });
});
