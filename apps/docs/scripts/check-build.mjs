import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { parse } from 'parse5';
import { validateManifest } from './content.mjs';

function walk(node, callback) {
  callback(node);
  for (const child of node.childNodes || []) walk(child, callback);
}
const attribute = (node, name) => node.attrs?.find(attr => attr.name === name)?.value;
const nodeText = node => node.nodeName === '#text' ? node.value : (node.childNodes || []).map(nodeText).join('');
async function filesIn(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) files.push(...await filesIn(resolve(directory, entry.name)));
    else files.push(resolve(directory, entry.name));
  }
  return files;
}

export async function checkArtifact({ root, manifest, sources, dist = resolve(root, 'apps/docs/dist') }) {
  validateManifest(manifest);
  const files = await filesIn(dist);
  const htmlFiles = files.filter(file => extname(file) === '.html');
  const documents = new Map();
  const site = new URL(manifest.site);
  let checkedReferences = 0;
  for (const file of htmlFiles) {
    const document = parse(await readFile(file, 'utf8'));
    const ids = new Set(), refs = [], metadata = new Map(), copyControls = [], routeCaptions = new Map(), routeLinks = [];
    walk(document, node => {
      const id = attribute(node, 'id');
      if (node.tagName === 'h3' && id?.startsWith('operation-')) routeCaptions.set(id, nodeText(node).trim());
      if (node.tagName === 'a' && attribute(node, 'href')?.startsWith('#operation-') && /^(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|TRACE) /.test(nodeText(node).trim())) routeLinks.push({ id: attribute(node, 'href').slice(1), text: nodeText(node).trim() });
      if (node.tagName === 'button' && attribute(node, 'data-code')) copyControls.push({ title: attribute(node, 'title'), copied: attribute(node, 'data-copied') });
      if (id) { if (ids.has(id)) throw new Error(`Duplicate HTML id ${id}: ${file}`); ids.add(id); }
      // The generic 404's canonical/alternate metadata describes an unknown request path.
      const generic404Metadata = file.endsWith('404.html') && node.tagName === 'link' && ['canonical', 'alternate'].includes(attribute(node, 'rel'));
      for (const name of ['href', 'src', 'poster']) if (attribute(node, name) && !generic404Metadata) refs.push(attribute(node, name));
      if (attribute(node, 'srcset')) refs.push(...attribute(node, 'srcset').split(',').map(value => value.trim().split(/\s+/)[0]));
      if (node.tagName === 'meta') {
        metadata.set(attribute(node, 'name'), attribute(node, 'content'));
        if (attribute(node, 'http-equiv')?.toLowerCase() === 'refresh') {
          const destination = /url=(.+)$/i.exec(attribute(node, 'content') || '');
          if (destination) refs.push(destination[1]);
        }
      }
    });
    for (const link of routeLinks) if (routeCaptions.get(link.id) !== link.text) throw new Error(`Contract route caption differs: ${file}#${link.id}`);
    documents.set(file, { ids, refs, metadata, copyControls });
  }
  const artifactFile = url => {
    const path = decodeURIComponent(url.pathname);
    if (!path.startsWith(manifest.base)) throw new Error(`URL bypasses deployment base: ${url.href}`);
    const suffix = path.slice(manifest.base.length);
    const file = resolve(dist, suffix + (path.endsWith('/') ? 'index.html' : ''));
    const remainder = relative(dist, file);
    if (remainder.startsWith('..')) throw new Error(`Artifact reference escapes dist: ${url.href}`);
    return file;
  };
  const checkReference = async (reference, origin) => {
    if (/^(?:data:|mailto:|tel:)/i.test(reference)) return;
    const url = new URL(reference, origin);
    if (url.origin !== site.origin) return;
    const target = artifactFile(url);
    try { if (!(await stat(target)).isFile()) throw new Error('Not a file'); }
    catch { throw new Error(`Missing built link or asset: ${reference} from ${origin}`); }
    if (url.hash && documents.has(target) && !documents.get(target).ids.has(decodeURIComponent(url.hash.slice(1)))) throw new Error(`Missing built anchor: ${url.href}`);
    checkedReferences++;
  };
  for (const [file, document] of documents) {
    const path = relative(dist, file).replaceAll('\\', '/');
    const current = new URL(`${manifest.base}${path.replace(/index\.html$/, '')}`, site);
    for (const reference of document.refs) await checkReference(reference, current);
  }
  for (const file of files.filter(file => extname(file) === '.css')) {
    const origin = new URL(`${manifest.base}${relative(dist, file).replaceAll('\\', '/')}`, site);
    for (const match of (await readFile(file, 'utf8')).matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) await checkReference(match[1].trim(), origin);
  }
  const allowedHtml = new Set(['index.html', '404.html', ...Object.keys(manifest.locales).map(locale => `${locale}/index.html`)]);
  for (const page of sources.pages) {
    const file = artifactFile(new URL(page.url, site));
    allowedHtml.add(relative(dist, file).replaceAll('\\', '/'));
    const document = documents.get(file);
    if (!document) throw new Error(`Registered page was not built: ${page.url}`);
    if (document.metadata.get('music-source-commit') !== sources.revision || document.metadata.get('music-source-path') !== page.source || document.metadata.get('music-source-workspace') !== String(sources.workingCopy)) throw new Error(`Built source receipt differs: ${page.url}`);
    if (sources.renderInputsHash && document.metadata.get('music-markdown-render-inputs') !== sources.renderInputsHash) throw new Error(`Markdown render inputs differ: ${page.url}`);
    if (document.copyControls.length) {
      const labels = JSON.parse(await readFile(resolve(root, `apps/docs/src/content/i18n/${page.locale}.json`), 'utf8'));
      if (document.copyControls.some(control => control.title !== labels['expressiveCode.copyButtonTooltip'] || control.copied !== labels['expressiveCode.copyButtonCopied'])) throw new Error(`Code controls use the wrong locale: ${page.url}`);
    }
    for (const heading of page.headings) if (!document.ids.has(heading)) throw new Error(`Stable section was not built: ${page.url}#${heading}`);
  }
  for (const file of htmlFiles) if (!allowedHtml.has(relative(dist, file).replaceAll('\\', '/'))) throw new Error(`Unregistered page was published: ${file}`);
  const search = JSON.parse(await readFile(resolve(dist, 'search-index.json'), 'utf8'));
  if (search.length !== sources.pages.length || search.some(entry => !sources.pages.some(page => page.id === entry.id && page.locale === entry.locale && page.url === entry.url))) throw new Error('Search index differs from registered pages');
  if (!sources.workingCopy) for (const file of sources.files) execFileSync('git', ['cat-file', '-e', `${sources.revision}:${file}`], { cwd: root, windowsHide: true, stdio: 'pipe' });
  return { registeredPages: sources.pages.length, htmlFiles: htmlFiles.length, checkedReferences, sourceCommit: sources.revision, workingCopy: sources.workingCopy, deploymentBase: manifest.base };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  try {
    const args = process.argv.slice(2);
    const manifest = JSON.parse(await readFile(resolve(root, args.includes('--manifest') ? args[args.indexOf('--manifest') + 1] : 'docs/site.json'), 'utf8'));
    const sources = JSON.parse(await readFile(resolve(root, 'apps/docs/.generated/sources.json'), 'utf8'));
    const result = await checkArtifact({ root, manifest, sources });
    process.stdout.write(`Checked artifact: ${JSON.stringify(result)}\n`);
  } catch (error) { process.stderr.write(`Documentation artifact check failed: ${error.message}\n`); process.exitCode = 1; }
}
