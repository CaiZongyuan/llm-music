import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const argumentsList = process.argv.slice(2);
const valueFor = (flag, fallback) => argumentsList.includes(flag) ? argumentsList[argumentsList.indexOf(flag) + 1] : fallback;
const port = Number(valueFor("--port", "18030"));
const base = valueFor("--base", "/llm-music/docs-usage-preview/");
if (!Number.isInteger(port) || port < 1024 || port > 65535 || port === 8188) throw new Error("Choose an unprivileged preview port other than Runtime's 8188.");
if (!base?.startsWith("/") || !base.endsWith("/") || /[?#\\]/.test(base)) throw new Error("Base must be an absolute URL path ending in /.");
const directory = dirname(fileURLToPath(import.meta.url));
const types = { "index.html": "text/html; charset=utf-8", "styles.css": "text/css; charset=utf-8", "app.js": "text/javascript; charset=utf-8", "content.json": "application/json; charset=utf-8", "sample-pr58.mp3": "audio/mpeg", "sample-provenance.json": "application/json; charset=utf-8" };
const server = createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") { response.writeHead(405, { Allow: "GET, HEAD" }); response.end(); return; }
  const pathname = new URL(request.url, "http://127.0.0.1").pathname;
  if (pathname === "/favicon.ico") { response.writeHead(204); response.end(); return; }
  if (pathname === "/" || pathname === base.slice(0, -1)) { response.writeHead(302, { Location: base }); response.end(); return; }
  const file = pathname === base ? "index.html" : pathname.slice(base.length);
  if (!pathname.startsWith(base) || !Object.hasOwn(types, file)) { response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); response.end("Not found"); return; }
  try {
    const data = await readFile(join(directory, file));
    response.writeHead(200, { "Content-Type": types[file], "Content-Length": data.length, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    response.end(request.method === "HEAD" ? undefined : data);
  } catch { response.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" }); response.end("Preview content unavailable"); }
});
server.listen(port, "127.0.0.1", () => process.stdout.write(`${JSON.stringify({ preview: "documentation-v2", pid: process.pid, url: `http://127.0.0.1:${port}${base}` })}\n`));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close(() => process.exit(0)));
