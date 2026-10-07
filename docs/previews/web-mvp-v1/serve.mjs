import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const port = Number(process.argv[2] ?? 18032);
if (!Number.isInteger(port) || port < 1024 || port > 65535 || port === 8188) throw new Error('Use an unprivileged preview port other than 8188.');
const base = '/llm-music/web-preview/';
const root = dirname(fileURLToPath(import.meta.url));
const types = { 'index.html': 'text/html; charset=utf-8', 'styles.css': 'text/css; charset=utf-8', 'app.js': 'text/javascript; charset=utf-8', 'sample-pr58.mp3': 'audio/mpeg', 'sample-provenance.json': 'application/json', 'reference-16s.wav': 'audio/wav', 'preview-score.abc': 'text/vnd.abc', 'preview-score.mid': 'audio/midi' };
const server = createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return; }
  const path = new URL(request.url, 'http://127.0.0.1').pathname;
  if (path === '/favicon.ico') { response.writeHead(204); response.end(); return; }
  if (path === '/' || path === base.slice(0, -1)) { response.writeHead(302, { Location: base }); response.end(); return; }
  const file = path === base ? 'index.html' : path.slice(base.length);
  if (!path.startsWith(base) || !Object.hasOwn(types, file)) { response.writeHead(404); response.end('Not found'); return; }
  try {
    const data = await readFile(join(root, file));
    response.writeHead(200, { 'Content-Type': types[file], 'Content-Length': data.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...(file.startsWith('preview-score.') ? { 'Content-Disposition': `attachment; filename="${file}"` } : {}), 'Content-Security-Policy': "default-src 'self'; connect-src 'self'; media-src 'self' blob:; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'" });
    response.end(request.method === 'HEAD' ? undefined : data);
  } catch { response.writeHead(503); response.end('Preview content unavailable'); }
});
server.listen(port, '127.0.0.1', () => process.stdout.write(`${JSON.stringify({ preview: 'web-mvp-v1', pid: process.pid, url: `http://127.0.0.1:${port}${base}` })}\n`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
