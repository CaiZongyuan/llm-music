import { test, expect } from '@playwright/test';

const labels = {
  'zh-CN': { title: '开始之前，看一眼', device: '设备观测', unknown: '未知', settings: '使用设置', settingsTitle: '专注音乐，其他按需查看', metadata: '应用配置参考',
    defaults: '下列数值是 API 声明的默认值，不是当前进程的生效配置。', queue: '应用任务队列', empty: '没有活跃的应用任务', refresh: '重新检查', fake: 'CPU 示例环境。', dark: '暗色模式', memoryTotal: 'GPU 设备显存总量' },
  en: { title: 'A quick check before creating', device: 'Device observations', unknown: 'Unknown', settings: 'Settings', settingsTitle: 'Focus on music; inspect the rest when needed', metadata: 'Application configuration reference',
    defaults: 'Values below are defaults declared by the API, rather than the current process configuration.', queue: 'Application Job queue', empty: 'No active application Jobs', refresh: 'Check again', fake: 'CPU fixture environment.', dark: 'Dark mode', memoryTotal: 'GPU device memory total' },
};
for (const locale of ['zh-CN', 'en'] as const) for (const theme of ['light', 'dark'] as const) {
  test(`${locale}/${theme}: read-only Runtime and declared settings keep honest CPU unknowns`, async ({ page, baseURL }, info) => {
    const t = labels[locale];
    const errors: string[] = [], writes: string[] = [], native: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      if (request.method() !== 'GET') writes.push(request.url());
      if (request.url().includes(':8188') || !request.url().startsWith(baseURL ?? '')) native.push(request.url());
    });
    await page.goto('/runtime');
    await page.getByRole('combobox').selectOption(locale);
    if (theme === 'dark') await page.getByRole('button', { name: t.dark, exact: true }).click();
    await expect(page.getByRole('heading', { name: t.title, exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: t.device, exact: true })).toContainText(t.unknown);
    await expect(page.getByLabel(t.memoryTotal, { exact: true }).locator('strong')).toHaveText(t.unknown);
    await expect(page.getByText(t.fake, { exact: false })).toBeVisible();
    await expect(page.getByRole('region', { name: t.queue, exact: true })).toContainText(t.empty);
    await page.getByRole('button', { name: t.refresh, exact: true }).click();
    await page.screenshot({ path: info.outputPath(`${locale}-${theme}-runtime.png`), fullPage: true });
    await page.locator('main').getByRole('link', { name: t.settings, exact: true }).click();
    await expect(page.getByRole('heading', { name: t.settingsTitle, exact: true })).toBeVisible();
    const metadata = page.getByRole('region', { name: t.metadata, exact: true });
    await expect(metadata).toContainText(t.defaults);
    await expect(metadata).toContainText('MUSIC_API_MAX_UPLOAD_BYTES');
    await expect(metadata).toContainText('67108864');
    await expect(metadata).toContainText('music_api.config.Settings.model_json_schema');
    expect(await page.locator('main input, main select, main textarea').count()).toBe(0);
    await page.reload();
    await expect(metadata).toContainText(t.defaults);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    expect(errors).toEqual([]); expect(writes).toEqual([]); expect(native).toEqual([]);
    await page.screenshot({ path: info.outputPath(`${locale}-${theme}-settings.png`), fullPage: true });
    await info.attach('scope', { body: 'Actual Chromium and production FastAPI, identified CPU Runtime; no device measurement or music inference.', contentType: 'text/plain' });
  });
}
