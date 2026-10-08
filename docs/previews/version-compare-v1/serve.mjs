import { createServer } from 'node:http';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.argv[2] ?? 18096);
if (!Number.isInteger(port) || port < 1024 || port > 65535 || [8188,18030,18031,18032,18033,18072,18084,18087,18089].includes(port)) throw new Error('Use an independent preview port.');
const mediaDirectory = resolve(process.argv[3] ?? join(root, 'media'));
const stopFile = resolve(process.argv[4] ?? join(mediaDirectory, 'stop-preview'));
const base = '/llm-music/version-preview/';
const files = {
  'index.html': [join(root,'index.html'),'text/html; charset=utf-8'],
  'app.js': [join(root,'app.js'),'text/javascript; charset=utf-8'],
  'styles.css': [join(root,'styles.css'),'text/css; charset=utf-8'],
  'media.js': [join(mediaDirectory,'media.js'),'text/javascript; charset=utf-8'],
  'sample-provenance.json': [join(root,'sample-provenance.json'),'application/json'],
  'wavesurfer.js': [join(root,'node_modules/wavesurfer.js/dist/wavesurfer.esm.js'),'text/javascript; charset=utf-8'],
  'regions.js': [join(root,'node_modules/wavesurfer.js/dist/plugins/regions.esm.js'),'text/javascript; charset=utf-8'],
};
await stat(files['media.js'][0]);
const server = createServer(async (request,response) => {
  if (!['GET','HEAD'].includes(request.method)) { response.writeHead(405,{Allow:'GET, HEAD'}); response.end(); return; }
  const path = new URL(request.url,'http://127.0.0.1').pathname;
  if (path === '/favicon.ico') { response.writeHead(204); response.end(); return; }
  if (path === '/' || path === base.slice(0,-1)) { response.writeHead(302,{Location:base}); response.end(); return; }
  const name = path === base ? 'index.html' : path.slice(base.length);
  if (!path.startsWith(base) || !Object.hasOwn(files,name)) { response.writeHead(404); response.end(); return; }
  try {
    const [file,type] = files[name], content = await readFile(file);
    response.writeHead(200,{'Content-Type':type,'Content-Length':content.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
      'Content-Security-Policy': "default-src 'self'; connect-src 'none'; media-src 'self' blob:; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'"});
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch { response.writeHead(503); response.end('Preview content unavailable'); }
});
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const servedHashes = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([name,[file]])=>[name,hash(await readFile(file))])));
server.listen(port,'127.0.0.1',async () => {
  const receipt = {preview:'version-compare-v1',pid:process.pid,parent:process.ppid,startedAt:new Date().toISOString(),url:`http://127.0.0.1:${port}${base}`,script:fileURLToPath(import.meta.url),stopFile,servedHashes};
  await writeFile(join(mediaDirectory,'server-owner.json'),JSON.stringify(receipt,null,2)+'\n');
  process.stdout.write(JSON.stringify(receipt)+'\n');
});
let closing = false;
function close() { if (closing) return; closing = true; clearInterval(stopTimer); server.close(()=>process.exit(0)); }
const stopTimer = setInterval(async ()=>{ try { await stat(stopFile); close(); } catch {} },500);
for (const signal of ['SIGINT','SIGTERM']) process.on(signal,close);
