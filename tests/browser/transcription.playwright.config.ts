import { defineConfig } from '@playwright/test';
process.env.MUSIC_BROWSER_PORT ??= '18040';
process.env.MUSIC_WEB_PORT ??= '18039';
const { default: base } = await import('./jobs.playwright.config.js');
export default defineConfig({ ...base, testMatch: 'transcription-recovery.controlled.ts' });
