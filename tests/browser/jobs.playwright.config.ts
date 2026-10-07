import { defineConfig } from '@playwright/test';
const { default: base } = await import('./web.playwright.config.js');
if (!Array.isArray(base.webServer)) throw new Error('Expected the owned CPU API and Web servers');
export default defineConfig({ ...base, testMatch: 'jobs-monitor.jobs.ts', webServer: base.webServer.map((server, index) => index === 0 ? { ...server, command: 'uv run --project services/api --no-sync python tests/browser/run_jobs_api.py' } : server) });
