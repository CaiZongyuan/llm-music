import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const browserDir = fileURLToPath(new URL('.', import.meta.url));
const repositoryDir = resolve(browserDir, '../..');

async function availablePort(): Promise<number> {
  const reservation = createServer();
  await new Promise<void>((resolve, reject) => {
    reservation.once('error', reject);
    reservation.listen(0, '127.0.0.1', resolve);
  });
  const address = reservation.address();
  if (!address || typeof address === 'string') throw new Error('No loopback port allocated');
  const port = address.port;
  await new Promise<void>((resolve, reject) => reservation.close(error => error ? reject(error) : resolve()));
  return port;
}

const port = Number(process.env.MUSIC_BROWSER_PORT ?? await availablePort());
if (!Number.isInteger(port) || port < 1 || port > 65535 || port === 8188) {
  throw new Error('MUSIC_BROWSER_PORT must be a valid port other than the reserved Runtime port 8188');
}
const runDir = process.env.MUSIC_BROWSER_RUN_DIR ?? resolve(browserDir, '.artifacts', randomUUID());
process.env.MUSIC_BROWSER_PORT = String(port);
process.env.MUSIC_BROWSER_RUN_DIR = runDir;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: browserDir,
  testMatch: '*.spec.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: resolve(browserDir, 'test-results'),
  reporter: [['list'], ['html', { outputFolder: resolve(browserDir, 'playwright-report'), open: 'never' }]],
  globalTeardown: './teardown.ts',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: process.env.PLAYWRIGHT_RECORD_VIDEO === 'on' ? 'on' : 'retain-on-failure',
  },
  projects: [{
    name: 'chromium',
    use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--disable-gpu'] } },
  }],
  webServer: {
    command: 'uv run --project services/api --no-sync python tests/browser/run_api.py',
    cwd: repositoryDir,
    url: `${baseURL}/openapi.json`,
    timeout: 60_000,
    reuseExistingServer: false,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { MUSIC_BROWSER_PORT: String(port), MUSIC_BROWSER_RUN_DIR: runDir },
  },
});
