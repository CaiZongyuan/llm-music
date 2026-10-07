import base from './web.playwright.config.js';

if (!Array.isArray(base.webServer)) throw new Error('Generation checks require both owned CPU servers');
export default { ...base, testMatch: ['web-generation.web.ts', 'generation-recovery.controlled.ts'], webServer: base.webServer.map((server, index) => index === 0
  ? { ...server, command: 'uv run --project services/api --no-sync python tests/browser/run_generation_api.py' }
  : server) };
