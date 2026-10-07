import { defineConfig } from '@playwright/test';
process.env.MUSIC_BROWSER_PORT ??= '18038';
process.env.MUSIC_WEB_PORT ??= '18037';
process.env.MUSIC_WEB_CONTROLLED_JOBS = '1';
const { default: base } = await import('./web.playwright.config.js');
if (!Array.isArray(base.webServer)) throw new Error('Expected the owned CPU API and Web servers');
export default defineConfig({ ...base, testMatch: 'jobs-monitor.web.ts', webServer: base.webServer.map((server, index) => index === 0 ? { ...server, command: 'uv run --project services/api --no-sync python tests/browser/run_jobs_api.py' } : server) });
