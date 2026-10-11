import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Reuse the production-build browser harness: fresh CPU data, owned loopback ports.
const root = fileURLToPath(new URL('../../../', import.meta.url));
const runDir = resolve(root, 'tests/browser/.artifacts', `acid-preview-${randomUUID()}`);
async function port() {
  const socket = createServer();
  const candidate = 20000 + Math.floor(Math.random() * 40000);
  try {
    await new Promise((accept, reject) => { socket.once('error', reject); socket.listen(candidate, '127.0.0.1', accept); });
  } catch (error) {
    if (['EADDRINUSE', 'EACCES'].includes(error.code)) return port();
    throw error;
  }
  const number = socket.address().port;
  await new Promise(accept => socket.close(accept));
  return number;
}
const apiPort = await port();
let webPort = await port();
while (webPort === apiPort) webPort = await port();
const env = { ...process.env, MUSIC_BROWSER_RUN_DIR: runDir, MUSIC_BROWSER_PORT: String(apiPort), MUSIC_WEB_PORT: String(webPort), MUSIC_WEB_API_TARGET: `http://127.0.0.1:${apiPort}` };
const children = [];
function start(command, args, receipt) {
  const child = spawn(command, args, { cwd: root, env, stdio: 'inherit', windowsHide: true });
  children.push({ child, receipt });
  child.on('error', error => { console.error(error); void stop(1); });
  child.on('exit', code => { if (!stopping) void stop(code || 1); });
  return child;
}
let stopping = false;
async function waitFor(check) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    if (stopping) throw new Error('Preview stopped during startup');
    if (await check()) return;
    await new Promise(accept => setTimeout(accept, 100));
  }
  throw new Error('Preview startup timed out');
}
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  const deadline = Date.now() + 25000;
  let requested = false;
  while (children.some(({ child }) => child.pid && child.exitCode === null) && Date.now() < deadline) {
    if (!requested) {
      try { await writeFile(resolve(runDir, 'stop'), 'Stop owned preview children\n'); requested = true; }
      catch (error) { if (error.code !== 'ENOENT') { console.error(error); code = 1; } }
    }
    await new Promise(accept => setTimeout(accept, 100));
  }
  for (const { child, receipt } of children) {
    if (!child.pid) continue;
    if (child.exitCode === null) {
      console.error(`Owned preview child ${child.pid} did not stop within 25 seconds: ${runDir}`);
      code = 1;
      if (process.platform === 'win32') {
        await new Promise(accept => {
          const cleanup = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'inherit', windowsHide: true });
          cleanup.once('error', accept); cleanup.once('exit', accept);
        });
      } else child.kill();
    }
    if (requested) {
      try {
        const acknowledgement = JSON.parse(await readFile(resolve(runDir, receipt), 'utf8'));
        if (acknowledgement.graceful !== true) throw new Error(`Missing graceful shutdown: ${receipt}`);
      } catch (error) { console.error(error); code = 1; }
    }
  }
  process.exitCode = code;
}
process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());
try {
  start('uv', ['run', '--project', 'services/api', '--frozen', '--no-sync', 'python', 'tests/browser/run_generation_api.py'], 'stopped.json');
  await waitFor(async () => fetch(`http://127.0.0.1:${apiPort}/openapi.json`).then(response => response.ok).catch(() => false));
  start(process.execPath, ['tests/browser/run_web.mjs'], 'web-stopped.json');
  await waitFor(async () => readFile(resolve(runDir, 'web-owner.json')).then(() => true).catch(() => false));
  console.log(`\nAcid Hardware preview: http://127.0.0.1:${webPort}\nFake data and fault controls: ${runDir}\nCtrl+C stops both owned servers.\n`);
} catch (error) { if (!stopping) { console.error(error); await stop(1); } }
