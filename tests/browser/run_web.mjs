import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const artifactRoot = resolve(root, 'tests/browser/.artifacts');
const runDir = resolve(process.env.MUSIC_BROWSER_RUN_DIR ?? '');
if (dirname(runDir) !== artifactRoot) throw new Error('Web test server requires its owned artifact directory');
const apiOwner = JSON.parse(await readFile(resolve(runDir, 'owner.json'), 'utf8'));
if (apiOwner.runtime_mode !== 'fake' || apiOwner.torch_installed !== false) throw new Error('Web tests require an owned CPU Fake API');
const port = Number(process.env.MUSIC_WEB_PORT);
if (!Number.isInteger(port) || port < 1 || port > 65535 || [8188, 18030, 18031, 18032, 18033, apiOwner.port].includes(port)) throw new Error('Invalid owned Web port');
if (process.env.MUSIC_WEB_API_TARGET !== `http://127.0.0.1:${apiOwner.port}`) throw new Error('Web proxy must target the owned Fake API');
const requireWeb = createRequire(resolve(root, 'apps/web/package.json'));
const { createServer } = await import(pathToFileURL(requireWeb.resolve('vite')).href);
const server = await createServer({ root: resolve(root, 'apps/web'), configFile: resolve(root, 'apps/web/vite.config.ts'), server: { host: '127.0.0.1', port, strictPort: true } });
await server.listen();
const owner = { pid: process.pid, parent_pid: process.ppid, port, api_port: apiOwner.port, cwd: root, started_at: new Date().toISOString() };
await writeFile(resolve(runDir, 'web-owner.json'), JSON.stringify(owner, null, 2) + '\n');
const watcher = setInterval(async () => {
  try { await readFile(resolve(runDir, 'stop')); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  clearInterval(watcher);
  await server.close();
  await writeFile(resolve(runDir, 'web-stopped.json'), JSON.stringify({ ...owner, graceful: true, stopped_at: new Date().toISOString() }, null, 2) + '\n');
}, 100);
