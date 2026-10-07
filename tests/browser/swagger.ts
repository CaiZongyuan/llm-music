import { createRequire } from 'node:module';
import { expect, test as base, type Locator, type Page } from '@playwright/test';

const require = createRequire(import.meta.url);
const cdn = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/';

export const test = base.extend({
  page: async ({ page }, use) => {
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    const servedAssets = new Set<string>();
    const vendorAssets = new Map([['swagger-ui-bundle.js', 'text/javascript'], ['swagger-ui.css', 'text/css']]);
    for (const [file, contentType] of vendorAssets) {
      await page.route(cdn + file, async route => {
        await route.fulfill({ path: require.resolve('swagger-ui-dist/' + file), contentType });
        servedAssets.add(file);
      });
    }
    await page.route('https://fastapi.tiangolo.com/img/favicon.png', route => route.abort());
    await use(page);
    expect(pageErrors).toEqual([]);
    expect([...servedAssets].sort()).toEqual([...vendorAssets.keys()].sort());
  },
});

export { expect };

export async function openDocs(page: Page): Promise<void> {
  await page.goto('/docs');
  await expect(page.getByRole('heading', { name: 'Music Application API' })).toBeVisible();
}

export async function operation(page: Page, method: string, path: string): Promise<Locator> {
  const toggle = page.getByRole('button', { name: method.toLowerCase() + ' ' + path, exact: true });
  const block = page.locator('.opblock').filter({ has: toggle });
  await expect(block).toHaveCount(1);
  if (!(await block.locator('.opblock-body').isVisible())) await block.getByRole('button', { name: method.toLowerCase() + ' ' + path, exact: true }).click();
  await expect(block.locator('.opblock-body')).toBeVisible();
  const tryItOut = block.getByRole('button', { name: 'Try it out', exact: true });
  await expect(tryItOut.or(block.getByRole('button', { name: 'Cancel', exact: true }))).toBeVisible();
  if (await tryItOut.isVisible()) await tryItOut.click();
  await expect(block.getByRole('button', { name: 'Execute', exact: true })).toBeVisible();
  return block;
}

export async function execute(page: Page, block: Locator, method: string, path: string, status: number): Promise<unknown> {
  const [response] = await Promise.all([
    page.waitForResponse(response => new URL(response.url()).pathname === path && response.request().method() === method),
    block.getByRole('button', { name: 'Execute', exact: true }).click(),
  ]);
  expect(response.status()).toBe(status);
  await expect(block.locator('.live-responses-table tbody .response-col_status')).toHaveText(String(status));
  const rendered = block.locator('.live-responses-table .highlight-code pre').first();
  await expect(rendered).toBeVisible();
  const responseBody: unknown = await response.json();
  await expect.poll(async () => JSON.parse(await rendered.innerText())).toEqual(responseBody);
  return JSON.parse(await rendered.innerText());
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function object(value: unknown): Record<string, unknown> {
  if (!isObject(value)) throw new Error('Expected rendered JSON object');
  return value;
}

export function stringField(value: unknown, key: string): string {
  const result = object(value)[key];
  if (typeof result !== 'string') throw new Error(`Expected rendered string field ${key}`);
  return result;
}
