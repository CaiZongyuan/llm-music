import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const port = Number(process.argv[2] ?? 18072);
if (!Number.isInteger(port) || port < 1024 || port > 65535 || [8188, 18030, 18031, 18032, 18033].includes(port)) throw new Error('Use an independent preview port.');
const root = dirname(fileURLToPath(import.meta.url));
const base = '/llm-music/score-preview/';
const files = {
  'index.html': ['index.html', 'text/html; charset=utf-8'],
  'styles.css': ['styles.css', 'text/css; charset=utf-8'],
  'app.js': ['app.js', 'text/javascript; charset=utf-8'],
  'abcjs.js': ['node_modules/abcjs/dist/abcjs-basic-min.js', 'text/javascript; charset=utf-8'],
  'sample.mp3': ['../web-mvp-v1/sample-pr58.mp3', 'audio/mpeg'],
  'sample-provenance.json': ['../web-mvp-v1/sample-provenance.json', 'application/json'],
};
const server = createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return; }
  const path = new URL(request.url, 'http://127.0.0.1').pathname;
  if (path === '/favicon.ico') { response.writeHead(204); response.end(); return; }
  if (path === '/' || path === base.slice(0, -1)) { response.writeHead(302, { Location: base }); response.end(); return; }
  const file = path === base ? 'index.html' : path.slice(base.length);
  if (!path.startsWith(base) || !Object.hasOwn(files, file)) { response.writeHead(404); response.end(); return; }
  try {
    const [relative, type] = files[file];
    const content = await readFile(join(root, relative));
    response.writeHead(200, {
      'Content-Type': type, 'Content-Length': content.length, 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'self'; connect-src 'none'; media-src 'self' blob:; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'",
    });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch { response.writeHead(503); response.end('Preview content unavailable'); }
});
server.listen(port, '127.0.0.1', () => process.stdout.write(`${JSON.stringify({ preview: 'score-editing-v1', pid: process.pid, startedAt: new Date().toISOString(), url: `http://127.0.0.1:${port}${base}` })}\n`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
