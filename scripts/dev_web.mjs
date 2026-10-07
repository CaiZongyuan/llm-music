import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const config = JSON.parse(await readFile(process.argv[2], 'utf8'));
if (process.env.MUSIC_WEB_API_TARGET !== config.api_url) throw new Error('Web API target differs from launcher identity');
const requireWeb = createRequire(resolve(config.root, 'apps/web/package.json'));
const { createServer } = await import(pathToFileURL(requireWeb.resolve('vite')).href);
const server = await createServer({ root: resolve(config.root, 'apps/web'), configFile: resolve(config.root, 'apps/web/vite.config.ts'), server: { host: '127.0.0.1', port: config.port, strictPort: true } });
await server.listen();
await writeFile(config.owner_file, JSON.stringify({ pid: process.pid, config }) + '\n');
let stopping = false;
const watcher = setInterval(async () => {
  if (stopping) return;
  let token;
  try { token = await readFile(config.stop_file, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  if (token !== config.stop_token) return;
  stopping = true;
  clearInterval(watcher);
  await server.close();
  await writeFile(config.stopped_file, JSON.stringify({ graceful: true, service: 'web' }) + '\n');
}, 100);
