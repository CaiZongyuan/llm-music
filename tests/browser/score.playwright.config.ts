import { defineConfig } from '@playwright/test';
const { default: base } = await import('./web.playwright.config.js');
export default defineConfig({ ...base, testMatch: 'score-editor.controlled.ts' });
