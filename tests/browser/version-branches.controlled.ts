import { expect, test } from '@playwright/test';
import type { JobRead } from '@llm-music/api-client';
import { randomUUID } from 'node:crypto';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { abcBytes, assetBytes, EDITED_MELODY, FULL_ABC, MELODY_ABC, projectOnly, type Score } from './cover-fixtures.js';
import { control, hash, mediaState, runDir } from './generation-fixtures.js';
import { received, seed } from './score-fixtures.js';
import { BRANCH_INPUTS, candidateOf, coverForest, generateFromCurrent, labels, resetFaults, saveCompleted, savedVersions, setInputs, startBranch } from './version-branch-fixtures.js';

test.beforeEach(async () => { await resetFaults(); });

test('branching from saved Cover V2 uses V2, preserves old provenance, and saves only the explicit child', async ({ page, baseURL }, info) => {
  const fixture = await coverForest(baseURL);
  const { api, project, original, cover, coverScore, sibling, reference, immutable } = fixture;
  const path = { project_id: project.id };
  await startBranch(page, project.id, cover);
  await page.getByRole('button', { name: labels.en.select, exact: true }).click();
  await expect(page.locator('.selected-score')).toHaveAttribute('data-selected-score-id', coverScore.id);
  await setInputs(page);
  const { job, body } = await generateFromCurrent(page);
  await info.attach('branch-origin-counterexample', { body: JSON.stringify({ original, chosen: cover, inheritedScoreParent: coverScore.parent_version_id, newerSibling: sibling, actualBody: body, acceptedJob: job }, null, 2), contentType: 'application/json' });
  const expected = { abc: MELODY_ABC, source_score_id: coverScore.id, parent_version_id: cover.id, ...BRANCH_INPUTS, max_seconds: 35 };
  expect(body).toEqual(expected);
  expect(job.inputs).toEqual(expected);
  const candidateId = await candidateOf(page, job.id);
  expect(new URL(page.url()).searchParams.get('branchVersionId')).toBe(cover.id);
  expect(new URL(page.url()).searchParams.get('jobId')).toBe(job.id);
  expect(await savedVersions(api, project.id)).toEqual(immutable.versions);
  await page.getByRole('link', { name: labels.en.versions, exact: true }).click();
  await expect(page.locator('[data-version-id]')).toHaveCount(3);
  await expect(page.getByRole('heading', { name: cover.name, exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.locator('.candidate-detail')).toHaveAttribute('data-candidate-id', candidateId);
  await expect(page.getByRole('button', { name: labels.en.generate, exact: true })).toBeDisabled();
  await page.getByRole('textbox', { name: labels.en.name, exact: true }).fill('Explicit Cover branch V4');
  await page.getByRole('button', { name: labels.en.save, exact: true }).click();
  await page.getByRole('link', { name: labels.en.saved, exact: true }).click();
  const versions = await savedVersions(api, project.id);
  expect(versions).toHaveLength(4);
  const child = versions.find(value => value.candidate_id === candidateId);
  if (!child) throw new Error('No explicitly saved branch');
  expect(child).toMatchObject({ name: 'Explicit Cover branch V4', parent_version_id: cover.id, inputs: expected });
  await expect(page.locator('.version-detail')).toHaveAttribute('data-version-id', child.id);
  await expect(page.locator('.version-detail').getByRole('link', { name: cover.name, exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('.version-detail')).toHaveAttribute('data-version-id', child.id);
  await expect(page.locator('.version-detail').getByRole('link', { name: cover.name, exact: true })).toBeVisible();
  for (const before of immutable.versions) expect(versions.find(value => value.id === before.id)).toEqual(before);
  expect(received(await api.GET('/projects/{project_id}/assets/{asset_id}/reference-origin', { params: { path: { ...path, asset_id: reference.id } } }))).toEqual(immutable.referenceOrigin);
  expect(await abcBytes(api, project.id, coverScore)).toBe(immutable.coverABC);
  expect(await Promise.all(immutable.versions.map(async value => ({ id: value.id, sha256: hash(await assetBytes(api, project.id, value.audio_asset_id)) })))).toEqual(immutable.audioHashes);
  await page.getByRole('link', { name: labels.en.versions, exact: true }).click();
  await expect(page.locator('[data-version-id]')).toHaveCount(4);
  await expect(page.getByRole('heading', { name: cover.name, exact: true })).toBeVisible();
  await info.attach('saved-branch-readback', { body: JSON.stringify({ child, versions, immutable }, null, 2), contentType: 'application/json' });
});

test('malformed complete HTTP history does not invent roots or partial relations; explicit reread restores the saved forest', async ({ page, baseURL }, info) => {
  const { api, project, immutable } = await coverForest(baseURL);
  const rows = immutable.versions;
  const [root, cover] = rows;
  if (!root || !cover) throw new Error('Missing literal saved relation fixture');
  const responses = {
    missingParent: rows.map(value => value.id === cover.id ? { ...value, parent_version_id: randomUUID() } : value),
    cycle: rows.map(value => value.id === root.id ? { ...value, parent_version_id: cover.id } : value),
    foreign: rows.map(value => value.id === cover.id ? { ...value, project_id: randomUUID() } : value),
    duplicate: [...rows, cover],
    valid: rows,
  };
  let selected: keyof typeof responses = 'missingParent';
  await page.route(`**/api/projects/${project.id}/versions`, async route => {
    if (route.request().method() !== 'GET') return route.continue();
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    await route.fulfill({ response, json: responses[selected] });
  });
  await page.goto(`/projects/${project.id}/versions`);
  await page.locator('.preferences select').selectOption('en');
  for (const scenario of ['missingParent', 'cycle', 'foreign', 'duplicate'] as const) {
    selected = scenario;
    await page.locator('.section-heading').getByRole('button', { name: labels.en.reread, exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Version relationships could not be confirmed.');
    await expect(page.getByRole('list', { name: 'Saved Version relationships', exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'No saved versions yet', exact: true })).toHaveCount(0);
    expect(await savedVersions(api, project.id)).toEqual(rows);
  }
  selected = 'valid';
  await page.locator('.section-heading').getByRole('button', { name: labels.en.reread, exact: true }).click();
  await expect(page.getByRole('list', { name: 'Saved Version relationships', exact: true })).toBeVisible();
  await expect(page.locator(`[data-version-id="${cover.id}"]`).getByRole('link', { name: root.name, exact: true })).toBeVisible();
  await expect(page.locator('[data-version-id]')).toHaveCount(3);
  await info.attach('http-read-boundary-fixtures-not-persisted-records', { body: JSON.stringify(responses, null, 2), contentType: 'application/json' });
});

test('saved inputs, outputs and named parent survive cold reload; bilingual narrow navigation preserves one actual Player', async ({ page, baseURL }, info) => {
  const { api, project, cover, original } = await coverForest(baseURL);
  const writes: string[] = [], errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (request.method() === 'POST' && !request.url().endsWith('/scores/validate')) writes.push(request.url());
  });
  await page.goto(`/projects/${project.id}/versions/${cover.id}`);
  await page.locator('.preferences select').selectOption('en');
  if (await page.locator('html').getAttribute('data-theme') !== 'light') await page.locator('.preferences button').click();
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.getByText('Submitted inputs', { exact: true }).click();
  await expect(page.locator('[data-submitted-abc]')).toHaveText(FULL_ABC);
  await expect(page.locator('[data-effective-abc]')).toHaveText(MELODY_ABC);
  await page.getByText('Inspect output snapshot', { exact: true }).click();
  const outputText = await page.locator('.version-outputs pre').innerText();
  expect(JSON.parse(outputText)).toEqual(cover.output_snapshot);
  await expect(page.locator('.version-detail > .facts').getByRole('link', { name: original.name, exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1440);
  const player = page.locator('#persistent-player');
  const native = await player.locator('audio').elementHandle();
  if (!native) throw new Error('Missing persistent native audio');
  await page.getByRole('button', { name: 'Listen to version', exact: true }).click();
  await expect(player.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
  await expect.poll(async () => (await mediaState(page)).duration).toBeCloseTo(34.9986667, 4);
  await player.getByRole('button', { name: 'Play', exact: true }).click();
  await expect.poll(async () => (await mediaState(page)).time).toBeGreaterThan(.1);
  const time = (await mediaState(page)).time;
  const source = await player.locator('audio').getAttribute('src');
  await page.getByRole('link', { name: labels.en.branch, exact: true }).click();
  await expect(page.locator('.branch-origin')).toHaveAttribute('data-branch-version-id', cover.id);
  await expect.poll(async () => (await mediaState(page)).time).toBeGreaterThan(time);
  await page.locator('.preferences select').selectOption('zh-CN');
  await page.locator('.preferences button').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.branch-origin').getByRole('link', { name: cover.name, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: labels['zh-CN'].reuse, exact: true })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.getByRole('link', { name: labels['zh-CN'].versions, exact: true }).click();
  await expect(page.getByRole('list', { name: '已保存版本关系', exact: true })).toBeVisible();
  await expect(page.locator('audio')).toHaveCount(1);
  expect(await native.evaluate(element => element === document.querySelector('#persistent-player audio'))).toBe(true);
  await expect(player.locator('audio')).toHaveAttribute('src', source!);
  expect((await mediaState(page)).paused).toBe(false);
  await page.locator(`a[href="/projects/${project.id}/versions/${cover.id}"]`).click();
  await page.getByText('提交时的输入', { exact: true }).click();
  await page.getByText('查看输出快照', { exact: true }).click();
  await expect(page.locator('[data-submitted-abc]')).toHaveText(FULL_ABC);
  expect(JSON.parse(await page.locator('.version-outputs pre').innerText())).toEqual(cover.output_snapshot);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await player.getByRole('button', { name: '暂停', exact: true }).click();
  await page.reload();
  await expect(page.locator('.version-detail')).toHaveAttribute('data-version-id', cover.id);
  await expect(page.locator('.version-detail > .facts').getByRole('link', { name: original.name, exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('audio')).toHaveCount(1);
  expect((await mediaState(page)).paused).toBe(true);
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
  expect(received(await api.GET('/projects/{project_id}/versions/{version_id}', { params: { path: { project_id: project.id, version_id: cover.id } } }))).toEqual(cover);
  await info.attach('public-output-and-persistent-player', { body: JSON.stringify({ version: cover, output: JSON.parse(outputText), writes, errors, source, media: await mediaState(page) }, null, 2), contentType: 'application/json' });
});

test('failed and cancelled branch Jobs keep history; save failures and lost acknowledgement recover one frozen child', async ({ page, baseURL }, info) => {
  const { api, project, cover, coverScore, immutable } = await coverForest(baseURL);
  const path = { project_id: project.id };
  await startBranch(page, project.id, cover);
  await page.getByRole('button', { name: labels.en.select, exact: true }).click();
  await setInputs(page);
  const expected = { abc: MELODY_ABC, source_score_id: coverScore.id, parent_version_id: cover.id, ...BRANCH_INPUTS, max_seconds: 35 };
  await control({ scenario: 'runtime_out_of_memory' });
  const failed = await generateFromCurrent(page);
  const failedRegion = page.locator(`.score-regeneration [data-job-id="${failed.job.id}"]`);
  await expect(failedRegion.getByRole('alert')).toContainText('runtime_out_of_memory');
  expect(await savedVersions(api, project.id)).toEqual(immutable.versions);
  await expect(page.getByRole('heading', { name: 'Previously completed Candidate', exact: true })).toBeVisible();
  await control({ scenario: 'hold' });
  const heldResponse = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith(`/jobs/${failed.job.id}/retry`));
  await failedRegion.getByRole('button', { name: 'Create a new retry job', exact: true }).click();
  const held: JobRead = await (await heldResponse).json();
  expect(held.id).not.toBe(failed.job.id);
  expect(held.inputs).toEqual(expected);
  const heldRegion = page.locator(`.score-regeneration [data-job-id="${held.id}"]`);
  await heldRegion.getByRole('button', { name: 'Request cancellation', exact: true }).click();
  await expect(heldRegion.getByText('Cancelled', { exact: true })).toBeVisible();
  expect(await savedVersions(api, project.id)).toEqual(immutable.versions);
  await control({});
  const retryResponse = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith(`/jobs/${held.id}/retry`));
  await heldRegion.getByRole('button', { name: 'Create a new retry job', exact: true }).click();
  const retry: JobRead = await (await retryResponse).json();
  expect(retry.id).not.toBe(held.id);
  expect(retry.inputs).toEqual(expected);
  const candidateId = await candidateOf(page, retry.id);
  expect(await savedVersions(api, project.id)).toEqual(immutable.versions);
  const saves: unknown[] = [];
  page.on('request', request => {
    if (request.method() === 'POST' && request.url().endsWith(`/projects/${project.id}/versions`)) saves.push(request.postDataJSON());
  });
  const name = 'Frozen recovered Cover child';
  await page.getByRole('textbox', { name: labels.en.name, exact: true }).fill(name);
  await writeFile(resolve(runDir!, 'fail-version-save'), 'owned branch persistence fault');
  await page.getByRole('button', { name: labels.en.save, exact: true }).click();
  await expect(page.locator('.save-candidate [role="alert"]')).toContainText('version_commit_unconfirmed');
  expect(await savedVersions(api, project.id)).toEqual(immutable.versions);
  await page.getByRole('textbox', { name: labels.en.name, exact: true }).fill('Later draft name must not replace first intent');
  await writeFile(resolve(runDir!, 'lose-version-ack'), 'owned branch acknowledgement fault');
  await page.getByRole('button', { name: 'Save the same version again', exact: true }).click();
  await expect(page.locator('.save-candidate [role="alert"]')).toContainText('version_commit_unconfirmed');
  const committed = await savedVersions(api, project.id);
  expect(committed).toHaveLength(4);
  const child = committed.find(value => value.candidate_id === candidateId);
  expect(child).toMatchObject({ name, parent_version_id: cover.id, inputs: expected });
  await page.getByRole('button', { name: 'Reread saved versions', exact: true }).click();
  await page.getByRole('link', { name: labels.en.saved, exact: true }).click();
  if (!child) throw new Error('No durably committed child');
  await expect(page.locator('.version-detail')).toHaveAttribute('data-version-id', child.id);
  await expect(page.locator('.version-detail').getByRole('link', { name: cover.name, exact: true })).toBeVisible();
  expect(saves).toEqual([{ candidate_id: candidateId, name }, { candidate_id: candidateId, name }]);
  expect(await savedVersions(api, project.id)).toEqual(committed);
  await info.attach('branch-failure-and-save-recovery', { body: JSON.stringify({ failed, held, retry, child, committed, saves }, null, 2), contentType: 'application/json' });
});

test('a late ordinary edit acknowledgement cannot replace an explicit branch selection of the same Score', async ({ page, baseURL }, info) => {
  const { api, project, original, cover, coverScore, reference, immutable } = await coverForest(baseURL);
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let ordinaryEdit: Score | undefined;
  let delivered = false;
  const saves: unknown[] = [];
  await page.route(`**/api/projects/${project.id}/scores`, async route => {
    if (route.request().method() !== 'POST') return route.continue();
    saves.push(route.request().postDataJSON());
    if (saves.length !== 1) return route.continue();
    const response = await route.fetch();
    expect(response.status()).toBe(201);
    ordinaryEdit = await response.json();
    await held;
    await route.fulfill({ response });
    delivered = true;
  });
  try {
    await page.goto(`/projects/${project.id}/scores/${coverScore.id}`);
    await page.locator('.preferences select').selectOption('en');
    await expect(page.getByText(labels.en.current, { exact: true })).toBeVisible();
    await setInputs(page);
    await page.getByRole('textbox', { name: labels.en.abc, exact: true }).fill(EDITED_MELODY);
    await expect(page.getByText(labels.en.current, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Save and select this Score', exact: true }).click();
    await expect.poll(() => Boolean(ordinaryEdit)).toBe(true);
    expect(ordinaryEdit).toMatchObject({ parent_version_id: original.id, source_score_id: coverScore.id });
    await page.getByRole('link', { name: labels.en.versions, exact: true }).click();
    await page.locator(`a[href="/projects/${project.id}/versions/${cover.id}"]`).click();
    await expect(page.locator('.version-detail')).toHaveAttribute('data-version-id', cover.id);
    await page.locator('.version-detail').getByRole('link', { name: labels.en.branch, exact: true }).click();
    await expect(page.getByRole('textbox', { name: labels.en.abc, exact: true })).toHaveValue(EDITED_MELODY);
    await expect(page.getByText(labels.en.current, { exact: true })).toBeVisible();
    await expect(page.locator('.score-regeneration').getByRole('textbox', { name: labels.en.style, exact: true })).toHaveValue(BRANCH_INPUTS.style);
    await expect(page.getByRole('button', { name: labels.en.generate, exact: true })).toBeDisabled();
    const secondSave = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith(`/projects/${project.id}/scores`));
    await page.getByRole('button', { name: 'Save and select this Score', exact: true }).click();
    const secondResponse = await secondSave;
    expect(secondResponse.status()).toBe(201);
    const branchEdit: Score = await secondResponse.json();
    expect(branchEdit).toMatchObject({ parent_version_id: cover.id, source_score_id: coverScore.id });
    expect(branchEdit.id).not.toBe(ordinaryEdit?.id);
    await expect(page.locator('.selected-score')).toHaveAttribute('data-selected-score-id', branchEdit.id);
    await expect(page.getByText(labels.en.ready, { exact: true })).toBeVisible();
    release();
    await expect.poll(() => delivered).toBe(true);
    await expect(page.locator('.selected-score')).toHaveAttribute('data-selected-score-id', branchEdit.id);
    await expect(page.getByText(labels.en.ready, { exact: true })).toBeVisible();
    const { job, body } = await generateFromCurrent(page);
    expect(body).toEqual({ abc: EDITED_MELODY, source_score_id: branchEdit.id, parent_version_id: cover.id, ...BRANCH_INPUTS, max_seconds: 35 });
    await candidateOf(page, job.id);
    expect(await savedVersions(api, project.id)).toEqual(immutable.versions);
    expect(await abcBytes(api, project.id, coverScore)).toBe(immutable.coverABC);
    expect(received(await api.GET('/projects/{project_id}/assets/{asset_id}/reference-origin', { params: { path: { project_id: project.id, asset_id: reference.id } } }))).toEqual(immutable.referenceOrigin);
    await info.attach('late-edit-origin-ownership', { body: JSON.stringify({ ordinaryParent: original.id, branchParent: cover.id, sameSourceScore: coverScore.id, ordinaryEdit, branchEdit, saves, body, job }, null, 2), contentType: 'application/json' });
  } finally { release(); }
});

test('empty history differs from a failed whole saved forest; multiple roots and original bytes recover by explicit reread', async ({ page, baseURL }, info) => {
  const empty = await projectOnly(baseURL);
  await page.goto(`/projects/${empty.project.id}/versions`);
  await page.locator('.preferences select').selectOption('en');
  await expect(page.getByRole('heading', { name: 'No saved versions yet', exact: true })).toBeVisible();
  const { api, project, original, cover, coverScore } = await coverForest(baseURL);
  const path = { project_id: project.id };
  const standalone = received(await api.POST('/projects/{project_id}/scores', { params: { path }, body: { abc: MELODY_ABC } }));
  const rootJob = received(await api.POST('/projects/{project_id}/jobs/generate-from-score', { params: { path }, body: {
    abc: MELODY_ABC, source_score_id: standalone.id, parent_version_id: null,
    style: 'independent second root', lyrics: '[Verse]\nBegin a separate creative path.', seed: 2026470004, max_seconds: 35,
  } }));
  const secondRoot = await saveCompleted(api, project.id, rootJob, 'Independent root V4');
  const before = await savedVersions(api, project.id);
  expect(before.filter(value => value.parent_version_id === null).map(value => value.id)).toEqual([original.id, secondRoot.id]);
  const writes: string[] = [];
  page.on('request', request => { if (request.method() === 'POST') writes.push(request.url()); });
  await page.goto(`/projects/${project.id}/versions`);
  await expect(page.locator('[data-version-id]')).toHaveCount(4);
  await expect(page.getByRole('heading', { name: secondRoot.name, exact: true })).toBeVisible();
  await expect(page.locator(`[data-version-id="${cover.id}"]`).getByRole('link', { name: original.name, exact: true })).toBeVisible();
  const recovered: { kind: string; sha256: string }[] = [];
  for (const target of [{ kind: 'audio', id: cover.audio_asset_id, format: 'flac' }, { kind: 'abc', id: coverScore.abc_asset_id, format: 'abc' }]) {
    const file = resolve(runDir!, 'application', 'assets', project.id, `${target.id}.${target.format}`);
    const bytes = await readFile(file);
    await rename(file, `${file}.temporarily-unavailable`);
    try {
      const list = await api.GET('/projects/{project_id}/versions', { params: { path } });
      expect(list.response.status).toBe(409);
      const read = page.waitForResponse(response => response.request().method() === 'GET' && response.url().endsWith(`/projects/${project.id}/versions`));
      await page.getByRole('button', { name: labels.en.reread, exact: true }).click();
      expect((await read).status()).toBe(409);
      await expect(page.getByRole('alert')).toContainText('asset_unavailable');
      await expect(page.locator('[data-version-id]')).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'No saved versions yet', exact: true })).toHaveCount(0);
    } finally { await rename(`${file}.temporarily-unavailable`, file); }
    await page.getByRole('button', { name: labels.en.reread, exact: true }).click();
    await expect(page.locator('[data-version-id]')).toHaveCount(4);
    expect(await savedVersions(api, project.id)).toEqual(before);
    expect(await assetBytes(api, project.id, target.id)).toEqual(bytes);
    recovered.push({ kind: target.kind, sha256: hash(bytes) });
  }
  await page.reload();
  await expect(page.locator('[data-version-id]')).toHaveCount(4);
  expect(await savedVersions(api, project.id)).toEqual(before);
  expect(writes).toEqual([]);
  await info.attach('failed-forest-readback', { body: JSON.stringify({ before, recovered, writes }, null, 2), contentType: 'application/json' });
});

test('checking an old Version preserves drafts; only explicit reuse replaces inputs and an edit saves with the chosen origin', async ({ page, baseURL }, info) => {
  const { api, project, cover, coverScore } = await coverForest(baseURL);
  const writes: string[] = [];
  page.on('request', request => {
    if (request.method() === 'POST' && /\/(?:jobs\/generate-from-score|versions)$/.test(request.url())) writes.push(request.url());
  });
  await startBranch(page, project.id, cover);
  await setInputs(page);
  await page.getByRole('textbox', { name: labels.en.abc, exact: true }).fill(EDITED_MELODY);
  await expect(page.getByText(labels.en.current, { exact: true })).toBeVisible();
  await page.getByRole('link', { name: labels.en.versions, exact: true }).click();
  await page.locator(`a[href="/projects/${project.id}/versions/${cover.id}"]`).click();
  await expect(page.locator('.version-detail')).toHaveAttribute('data-version-id', cover.id);
  await page.locator('.version-detail').getByRole('link', { name: labels.en.branch, exact: true }).click();
  await expect(page.getByRole('textbox', { name: labels.en.abc, exact: true })).toHaveValue(EDITED_MELODY);
  const form = page.locator('.score-regeneration');
  await expect(form.getByRole('textbox', { name: labels.en.style, exact: true })).toHaveValue(BRANCH_INPUTS.style);
  await expect(form.getByRole('textbox', { name: labels.en.lyrics, exact: true })).toHaveValue(BRANCH_INPUTS.lyrics);
  await expect(form.getByRole('textbox', { name: labels.en.seed, exact: true })).toHaveValue(String(BRANCH_INPUTS.seed));
  await expect(page.getByRole('button', { name: labels.en.generate, exact: true })).toBeDisabled();
  expect(writes).toEqual([]);
  await page.getByRole('button', { name: labels.en.reuse, exact: true }).click();
  await expect(form.getByRole('textbox', { name: labels.en.style, exact: true })).toHaveValue(cover.inputs.style);
  await expect(form.getByRole('textbox', { name: labels.en.lyrics, exact: true })).toHaveValue(cover.inputs.lyrics);
  await expect(form.getByRole('textbox', { name: labels.en.seed, exact: true })).toHaveValue(String(cover.inputs.seed));
  await expect(page.getByRole('textbox', { name: labels.en.abc, exact: true })).toHaveValue(EDITED_MELODY);
  const saved = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith(`/projects/${project.id}/scores`));
  await page.getByRole('button', { name: 'Save and select this Score', exact: true }).click();
  const response = await saved;
  expect(response.status()).toBe(201);
  const selected: Score = await response.json();
  expect(selected).toMatchObject({ parent_version_id: cover.id, source_score_id: coverScore.id });
  await expect(page.locator('.selected-score')).toHaveAttribute('data-selected-score-id', selected.id);
  const { job, body } = await generateFromCurrent(page);
  expect(body).toEqual({ abc: EDITED_MELODY, source_score_id: selected.id, parent_version_id: cover.id,
    style: cover.inputs.style, lyrics: cover.inputs.lyrics, seed: cover.inputs.seed, max_seconds: 35 });
  await candidateOf(page, job.id);
  expect(await savedVersions(api, project.id)).toHaveLength(3);
  await info.attach('explicit-reuse-and-edited-origin', { body: JSON.stringify({ origin: cover, selected, body, job, writes }, null, 2), contentType: 'application/json' });
});

test('ordinary Cover-output Score keeps its inherited source; unowned, missing and foreign branch contexts cannot select or generate', async ({ page, baseURL }, info) => {
  const { api, project, original, cover, coverScore, sibling } = await coverForest(baseURL);
  const writes: unknown[] = [];
  page.on('request', request => {
    if (request.method() === 'POST' && request.url().endsWith('/jobs/generate-from-score')) writes.push(request.postDataJSON());
  });
  await page.goto(`/projects/${project.id}/scores/${coverScore.id}`);
  await page.locator('.preferences select').selectOption('en');
  await expect(page.getByText(labels.en.current, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: labels.en.select, exact: true }).click();
  await setInputs(page);
  const submitted = await generateFromCurrent(page);
  expect(submitted.body).toEqual({ abc: MELODY_ABC, source_score_id: coverScore.id, parent_version_id: original.id, ...BRANCH_INPUTS, max_seconds: 35 });
  await candidateOf(page, submitted.job.id);
  for (const origin of [sibling.id, randomUUID(), 'false', '42']) {
    await page.goto(`/projects/${project.id}/scores/${coverScore.id}?branchVersionId=${origin}`);
    await expect(page.locator('.branch-origin [role="alert"]')).toBeVisible();
    await expect(page.getByRole('button', { name: labels.en.select, exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: labels.en.generate, exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: labels.en.reuse, exact: true })).toHaveCount(0);
  }
  const foreign = await seed(baseURL);
  await page.goto(`/projects/${foreign.project.id}/scores/${foreign.score.id}?branchVersionId=${cover.id}`);
  await expect(page.locator('.branch-origin [role="alert"]')).toContainText('version_not_found');
  await expect(page.getByRole('button', { name: labels.en.select, exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: labels.en.generate, exact: true })).toBeDisabled();
  expect(writes).toHaveLength(1);
  expect(await savedVersions(api, project.id)).toHaveLength(3);
  await info.attach('ordinary-and-invalid-origin-boundaries', { body: JSON.stringify({ original, chosen: cover, coverScore, sibling, foreignProject: foreign.project.id, writes }, null, 2), contentType: 'application/json' });
});
