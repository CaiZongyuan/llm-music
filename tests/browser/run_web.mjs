import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
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
const { build, preview } = await import(pathToFileURL(requireWeb.resolve('vite')).href);
const buildDir = resolve(runDir, 'web-dist');
await mkdir(buildDir);
const config = {
  root: resolve(root, 'apps/web'), configFile: resolve(root, 'apps/web/vite.config.ts'), mode: 'production',
  build: { outDir: buildDir, emptyOutDir: false, rolldownOptions: { input: [
    resolve(root, 'apps/web/index.html'),
    resolve(root, 'apps/web/test/consumer.html'),
    resolve(root, 'apps/web/test/job-results.html'),
  ] } },
};
await build(config);
const entrySha256 = createHash('sha256').update(await readFile(resolve(buildDir, 'index.html'))).digest('hex');
const server = await preview({ ...config, preview: { host: '127.0.0.1', port, strictPort: true } });
const owner = { pid: process.pid, parent_pid: process.ppid, port, api_port: apiOwner.port, cwd: root, mode: 'production-preview', build_dir: buildDir, entry_sha256: entrySha256, started_at: new Date().toISOString() };
await writeFile(resolve(runDir, 'web-owner.json'), JSON.stringify(owner, null, 2) + '\n');
let stopping = false;
const watcher = setInterval(async () => {
  if (stopping) return;
  try { await readFile(resolve(runDir, 'stop')); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  stopping = true;
  clearInterval(watcher);
  await server.close();
  await writeFile(resolve(runDir, 'web-stopped.json'), JSON.stringify({ ...owner, graceful: true, stopped_at: new Date().toISOString() }, null, 2) + '\n');
}, 100);
