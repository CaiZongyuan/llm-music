import base from './web.playwright.config.js';

if (!Array.isArray(base.webServer)) throw new Error('Version branch checks require both owned CPU servers');
export default { ...base, testMatch: 'version-branches.controlled.ts', webServer: base.webServer.map((server, index) => index === 0
  ? { ...server, command: 'uv run --project services/api --no-sync python tests/browser/run_version_branches_api.py' }
  : server) };
