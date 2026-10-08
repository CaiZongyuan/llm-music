import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const browserDir = fileURLToPath(new URL('.', import.meta.url));
const repositoryDir = resolve(browserDir, '../..');
async function availablePort(): Promise<number> {
  const reservation = createServer();
  // Use ordinary HTTP ports; Windows may allocate a browser-blocked port for listen(0).
  const candidate = 20_000 + Math.floor(Math.random() * 40_000);
  try {
    await new Promise<void>((fulfill, reject) => { reservation.once('error', reject); reservation.listen(candidate, '127.0.0.1', fulfill); });
  } catch (error) {
    if (error instanceof Error && 'code' in error && (error.code === 'EADDRINUSE' || error.code === 'EACCES')) return availablePort();
    throw error;
  }
  const address = reservation.address();
  if (!address || typeof address === 'string') throw new Error('No owned loopback port');
  const port = address.port;
  await new Promise<void>((fulfill, reject) => reservation.close(error => error ? reject(error) : fulfill()));
  if ([8188, 18030, 18031, 18032, 18033].includes(port)) return availablePort();
  return port;
}
const apiPort = Number(process.env.MUSIC_BROWSER_PORT ?? await availablePort());
let webPort = Number(process.env.MUSIC_WEB_PORT ?? await availablePort());
while (webPort === apiPort) webPort = await availablePort();
const runDir = process.env.MUSIC_BROWSER_RUN_DIR ?? resolve(browserDir, '.artifacts', `web-${randomUUID()}`);
// Playwright loads config again in workers; preserve the servers' actual identities.
process.env.MUSIC_BROWSER_PORT = String(apiPort);
process.env.MUSIC_WEB_PORT = String(webPort);
process.env.MUSIC_BROWSER_RUN_DIR = runDir;
const apiURL = `http://127.0.0.1:${apiPort}`;
const env = { MUSIC_BROWSER_PORT: String(apiPort), MUSIC_BROWSER_RUN_DIR: runDir, MUSIC_WEB_PORT: String(webPort), MUSIC_WEB_API_TARGET: apiURL };

export default defineConfig({
  testDir: browserDir, testMatch: '*.web.ts', workers: 1, fullyParallel: false,
  forbidOnly: Boolean(process.env.CI), retries: 0, timeout: 60_000, expect: { timeout: 10_000 },
  outputDir: resolve(browserDir, 'test-results'),
  reporter: [['list'], ['html', { outputFolder: resolve(browserDir, 'playwright-report'), open: 'never' }]],
  globalTeardown: './web-teardown.ts',
  use: { baseURL: `http://127.0.0.1:${webPort}`, trace: 'retain-on-failure', screenshot: 'only-on-failure', video: 'off' },
  projects: [{ name: 'chromium-web', use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--disable-gpu'] } } }],
  webServer: [
    { command: 'uv run --project services/api --no-sync python tests/browser/run_api.py', cwd: repositoryDir,
      url: `${apiURL}/openapi.json`, reuseExistingServer: false, timeout: 60_000, stdout: 'pipe', stderr: 'pipe', env },
    { command: 'node tests/browser/run_web.mjs', cwd: repositoryDir,
      url: `http://127.0.0.1:${webPort}`, reuseExistingServer: false, timeout: 60_000, stdout: 'pipe', stderr: 'pipe', env },
  ],
});
