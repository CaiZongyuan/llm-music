import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';
import webConfig from './web.playwright.config.js';

const browserDir = fileURLToPath(new URL('.', import.meta.url));
if (!Array.isArray(webConfig.webServer)) throw new Error('Runtime checks require the owned API and Web servers');
export default defineConfig({ ...webConfig,
  testMatch: 'runtime.controlled.ts',
  outputDir: resolve(browserDir, 'runtime-results'),
  reporter: [['list'], ['html', { outputFolder: resolve(browserDir, 'runtime-report'), open: 'never' }]],
  webServer: webConfig.webServer.map((server, index) => index === 0
    ? { ...server, command: 'uv run --project services/api --no-sync python tests/browser/run_runtime_api.py' } : server),
});
