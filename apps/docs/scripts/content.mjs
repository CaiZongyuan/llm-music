import { readFile, realpath } from 'node:fs/promises';
import { resolve, relative, dirname, extname, isAbsolute } from 'node:path';
import { execFileSync } from 'node:child_process';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import { visit } from 'unist-util-visit';
import { toString } from 'mdast-util-to-string';

const markdown = unified().use(remarkParse).use(remarkStringify, { fences: true, bullet: '-' });
const localesOf = manifest => Object.keys(manifest.locales);
export const chapterUrl = (manifest, chapter, locale) => `${manifest.base}${locale}/${chapter.path}/`;
const fail = message => { throw new Error(message); };
const safeSlug = value => typeof value === 'string' && /^[a-z0-9]+(?:[/-][a-z0-9]+)*$/.test(value);

export async function repositoryFile(root, source) {
  if (typeof source !== 'string' || isAbsolute(source)) fail(`Repository path must be relative: ${source}`);
  const path = await realpath(resolve(root, source));
  const remainder = relative(await realpath(root), path);
  if (remainder === '..' || remainder.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(remainder)) fail(`Source escapes repository: ${source}`);
  return path;
}

export function validateManifest(manifest) {
  if (manifest.schemaVersion !== 1) fail('Unsupported chapter manifest version');
  if (!/^\/[a-z0-9/-]+\/$/.test(manifest.base) || manifest.base.includes('..') || manifest.base.includes('//')) fail('Deployment base must be an absolute path ending in /');
  if (new URL(manifest.site).protocol !== 'https:' || !/^https:\/\/github\.com\/[\w-]+\/[\w.-]+$/.test(manifest.repository)) fail('Site and repository URLs must use HTTPS');
  const locales = localesOf(manifest);
  if (!locales.length || !locales.includes(manifest.defaultLocale)) fail('Default locale must exist');
  for (const locale of locales) {
    if (!safeSlug(locale) || !manifest.locales[locale]?.label || !manifest.locales[locale]?.lang || !manifest.title[locale]) fail(`Incomplete locale: ${locale}`);
  }
  const requirePaired = (values, name) => {
    if (!values || locales.some(locale => typeof values[locale] !== 'string' || !values[locale].trim()) || Object.keys(values).some(locale => !locales.includes(locale))) fail(`Language pair is incomplete: ${name}`);
  };
  const groups = new Set();
  for (const group of manifest.groups) {
    if (!safeSlug(group.id) || groups.has(group.id)) fail(`Duplicate or invalid group: ${group.id}`);
    groups.add(group.id);
    requirePaired(group.titles, `group ${group.id}`);
  }
  const ids = new Set(), paths = new Set(), sources = new Set();
  for (const chapter of manifest.chapters) {
    if (!safeSlug(chapter.id) || ids.has(chapter.id)) fail(`Duplicate or invalid chapter id: ${chapter.id}`);
    if (!safeSlug(chapter.path) || paths.has(chapter.path)) fail(`Duplicate or invalid publish path: ${chapter.path}`);
    if (!['overview', 'tutorial', 'guide', 'concept', 'reference'].includes(chapter.type) || !groups.has(chapter.group)) fail(`Invalid type or group: ${chapter.id}`);
    ids.add(chapter.id); paths.add(chapter.path);
    requirePaired(chapter.titles, `${chapter.id} titles`);
    requirePaired(chapter.labels, `${chapter.id} labels`);
    requirePaired(chapter.sources, `${chapter.id} sources`);
    for (const source of Object.values(chapter.sources)) {
      if (!source.startsWith('docs/') || !source.endsWith('.md') || sources.has(source)) fail(`Duplicate or invalid body source: ${source}`);
      sources.add(source);
    }
    if (chapter.sources.en !== chapter.sources['zh-cn']?.replace(/\.md$/, '.en.md')) fail(`Paired body filenames differ: ${chapter.id}`);
  }
  if (!manifest.chapters.length) fail('At least one chapter must be registered');
  const chapters = new Map(manifest.chapters.map(chapter => [chapter.id, chapter]));
  for (const chapter of manifest.chapters) for (const [direction, reverse] of [['previous', 'next'], ['next', 'previous']]) {
    if (chapter[direction] === undefined) continue;
    const target = chapters.get(chapter[direction]);
    if (!target || target.id === chapter.id || target[reverse] !== chapter.id) fail(`Navigation is not reciprocal: ${chapter.id} ${direction}`);
  }
  for (const chapter of manifest.chapters) {
    const seen = new Set([chapter.id]);
    let next = chapter.next;
    while (next) {
      if (seen.has(next)) fail(`Chapter chain contains a cycle: ${chapter.id}`);
      seen.add(next); next = chapters.get(next).next;
    }
  }
  return manifest;
}

export function sourceVersion(root) {
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
  if (!/^[a-f0-9]{40}$/.test(revision)) fail('No Git source commit was found');
  const relevantChanges = execFileSync('git', ['status', '--porcelain', '--', 'docs/learn', 'docs/site.json', 'apps/docs', 'runtime/comfyui/examples', 'package.json', 'pnpm-workspace.yaml', 'pnpm-lock.yaml'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
  return { revision, workingCopy: Boolean(relevantChanges) };
}

export async function loadPages(root, manifest, version = sourceVersion(root)) {
  root = await realpath(root);
  validateManifest(manifest);
  const registeredSources = new Map(manifest.chapters.flatMap(chapter => Object.values(chapter.sources).map(source => [resolve(root, source), chapter])));
  const chapters = new Map(manifest.chapters.map(chapter => [chapter.id, chapter]));
  const sources = new Set();
  const pages = [];
  const github = source => `${manifest.repository}/blob/${version.revision}/${source.split('/').map(encodeURIComponent).join('/')}`;
  for (const chapter of manifest.chapters) {
    let pairedHeadings;
    for (const locale of localesOf(manifest)) {
      const source = chapter.sources[locale];
      const file = await repositoryFile(root, source);
      sources.add(source);
      const body = await readFile(file, 'utf8');
      if (/^---\s*\r?\n/.test(body)) fail(`Body must not define generated frontmatter: ${source}`);
      const tree = markdown.parse(body);
      const headings = [];
      visit(tree, 'heading', node => {
        const marker = /\s+\{#([a-z][a-z0-9-]*)\}$/.exec(toString(node));
        if (!marker || headings.includes(marker[1])) fail(`Heading needs a unique stable id: ${source}`);
        headings.push(marker[1]);
      });
      if (pairedHeadings && JSON.stringify(headings) !== JSON.stringify(pairedHeadings)) fail(`Language section ids differ: ${chapter.id}`);
      pairedHeadings = headings;
      const rewriteUrl = async url => {
        if (/^(?:https?:|mailto:|tel:|data:|#)/i.test(url)) return url;
        if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//')) fail(`Unsupported link: ${source}: ${url}`);
        const match = /^([^?#]*)(.*)$/.exec(url);
        const target = resolve(dirname(file), decodeURIComponent(match[1]));
        await repositoryFile(root, relative(root, target));
        const registered = registeredSources.get(target);
        if (registered) return chapterUrl(manifest, registered, locale) + match[2];
        const repositoryPath = relative(root, target).replaceAll('\\', '/');
        sources.add(repositoryPath);
        return github(repositoryPath) + match[2];
      };
      const pending = [];
      visit(tree, node => {
        if (node.type === 'link' || node.type === 'image' || node.type === 'definition') pending.push((async () => { node.url = await rewriteUrl(node.url); })());
        if (node.type === 'html') pending.push((async () => {
          const links = [...node.value.matchAll(/\b(?:href|src)=(["'])(.*?)\1/g)];
          for (const link of links) node.value = node.value.replace(link[0], link[0].replace(link[2], await rewriteUrl(link[2])));
        })());
      });
      await Promise.all(pending);
      for (let index = 0; index < tree.children.length; index++) {
        const node = tree.children[index];
        const include = node.type === 'paragraph' ? /^<<<\s+(.+)$/.exec(toString(node)) : null;
        if (!include) continue;
        const includedFile = await repositoryFile(root, relative(root, resolve(dirname(file), include[1])));
        const includedPath = relative(root, includedFile).replaceAll('\\', '/');
        const languages = { '.ps1': 'powershell', '.py': 'python', '.json': 'json', '.ts': 'typescript', '.js': 'javascript', '.mjs': 'javascript', '.yaml': 'yaml', '.yml': 'yaml' };
        if (!languages[extname(includedFile)]) fail(`Unsupported source include: ${includedPath}`);
        const code = await readFile(includedFile, 'utf8');
        if (code.includes('\0')) fail(`Source include is not text: ${includedPath}`);
        sources.add(includedPath);
        tree.children.splice(index, 1, { type: 'code', lang: languages[extname(includedFile)], value: code.trimEnd() }, { type: 'paragraph', children: [{ type: 'link', url: github(includedPath), children: [{ type: 'text', value: `${locale === 'en' ? 'Complete example' : '完整示例'}: ${includedPath} ↗` }] }] });
        index++;
      }
      const navigation = direction => chapter[direction] ? { link: chapterUrl(manifest, chapters.get(chapter[direction]), locale), label: chapters.get(chapter[direction]).labels[locale] } : false;
      const meta = {
        title: chapter.titles[locale], description: toString(tree.children.find(node => node.type === 'paragraph')).replace(/\s+/g, ' ').trim(),
        sidebar: { label: chapter.labels[locale] }, editUrl: false, lastUpdated: false,
        prev: navigation('previous'), next: navigation('next'),
        head: [{ tag: 'meta', attrs: { name: 'music-source-commit', content: version.revision } }, { tag: 'meta', attrs: { name: 'music-source-path', content: source } }, { tag: 'meta', attrs: { name: 'music-source-workspace', content: String(version.workingCopy) } }, ...(version.renderInputsHash ? [{ tag: 'meta', attrs: { name: 'music-markdown-render-inputs', content: version.renderInputsHash } }] : [])],
      };
      const footer = `<div class="page-source" data-pagefind-ignore><span>${locale === 'en' ? 'Source version' : '源码版本'}: <a href="${manifest.repository}/tree/${version.revision}"><code>${version.revision.slice(0, 7)}</code></a>${version.workingCopy ? ` · ${locale === 'en' ? 'working copy' : '工作副本'}` : ''}</span><span>${locale === 'en' ? 'Page source' : '正文来源'}: <a href="${github(source)}">${source}</a></span></div>`;
      pages.push({ id: chapter.id, locale, path: `${locale}/${chapter.path}.md`, url: chapterUrl(manifest, chapter, locale), source, headings, markdown: `---\n${JSON.stringify(meta, null, 2)}\n---\n\n${markdown.stringify(tree)}\n${footer}\n`, search: { locale, id: chapter.id, url: chapterUrl(manifest, chapter, locale), title: chapter.labels[locale], summary: meta.description, text: toString(tree).replace(/\s+/g, ' ').trim() } });
    }
  }
  const translated = labels => Object.fromEntries(localesOf(manifest).map(locale => [manifest.locales[locale].lang, labels[locale]]));
  const sidebar = manifest.groups.map(group => ({ label: group.titles[manifest.defaultLocale], translations: translated(group.titles), items: manifest.chapters.filter(chapter => chapter.group === group.id).map(chapter => ({ slug: chapter.path, label: chapter.labels[manifest.defaultLocale], translations: translated(chapter.labels) })) }));
  return { pages, sidebar, sourcePaths: [...sources], version };
}
