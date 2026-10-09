import { expect, test } from '@playwright/test';
import { EDITED_ABC, NEXT_ABC, received, seed } from './score-fixtures.js';

test('a late save of A cannot replace the currently selected B for generation', async ({ page, baseURL }, info) => {
  const { api, project, score: a } = await seed(baseURL);
  const b = received(await api.POST('/projects/{project_id}/scores', { params: { path: { project_id: project.id } }, body: { abc: NEXT_ABC } }));
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let committed!: () => void;
  const saveCommitted = new Promise<void>(resolve => { committed = resolve; });
  await page.route(`**/api/projects/${project.id}/scores`, async route => {
    if (route.request().method() !== 'POST') { await route.continue(); return; }
    const response = await route.fetch();
    committed();
    await held;
    await route.fulfill({ response });
  });
  try {
    await page.goto(`/projects/${project.id}/scores/${a.id}`);
    await page.locator('.preferences select').selectOption('en');
    await page.getByRole('textbox', { name: 'ABC Score text', exact: true }).fill(EDITED_ABC);
    await expect(page.getByText('Notation and MIDI match the current draft.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Save and select this Score', exact: true }).click();
    await saveCommitted;
    await page.getByRole('link', { name: 'Scores', exact: true }).click();
    await page.locator(`a[href="/projects/${project.id}/scores/${b.id}"]`).click();
    await expect(page.getByText('Notation and MIDI match the current draft.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Select saved Score', exact: true }).click();
    await expect(page.locator('.selected-score')).toHaveAttribute('data-selected-score-id', b.id);
    const releasedResponse = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith(`/projects/${project.id}/scores`));
    release();
    await (await releasedResponse).finished();
    await expect(page.locator('.selected-score')).toHaveAttribute('data-selected-score-id', b.id);
    await page.getByRole('textbox', { name: 'Music style', exact: true }).fill('gentle folk pop, warm piano');
    await page.getByRole('textbox', { name: 'Lyrics', exact: true }).fill('[Verse]\nAfter rain, we walk into morning.');
    await page.getByRole('textbox', { name: 'Random seed', exact: true }).fill('2026420001');
    const posted = page.waitForRequest(request => request.method() === 'POST' && request.url().endsWith('/jobs/generate-from-score'));
    await page.getByRole('button', { name: 'Generate from selected Score', exact: true }).click();
    const body: unknown = (await posted).postDataJSON();
    expect(body).toEqual({ style: 'gentle folk pop, warm piano', lyrics: '[Verse]\nAfter rain, we walk into morning.', seed: 2026420001, max_seconds: 0, abc: NEXT_ABC, source_score_id: b.id, parent_version_id: null });
    const monitor = page.locator('.job-monitor');
    await expect(monitor).toBeVisible();
    const jobId = await monitor.getAttribute('data-job-id');
    if (!jobId) throw new Error('No submitted application Job');
    const job = received(await api.GET('/projects/{project_id}/jobs/{job_id}', { params: { path: { project_id: project.id, job_id: jobId } } }));
    expect(job.operation).toBe('GenerateFromScore');
    expect(job.inputs).toEqual(body);
    await info.attach('actual-selected-score-job', { body: JSON.stringify({ a, b, job }, null, 2), contentType: 'application/json' });
  } finally { release(); }
});
