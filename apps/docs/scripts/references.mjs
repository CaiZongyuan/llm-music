import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const methods = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);
const id = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const code = value => '```json\n' + JSON.stringify(value, null, 2) + '\n```\n';
const schemaId = name => `schema-${id(name)}`;

export function renderAPI(document, locale) {
  const en = locale === 'en';
  const operations = Object.entries(document.paths).flatMap(([path, route]) => Object.entries(route)
    .filter(([method]) => methods.has(method)).map(([method, operation]) => ({ path, method, operation })));
  const lines = [`## ${en ? 'HTTP index' : 'HTTP 分类索引'} {#http-index}`, '',
    ...operations.map(({ path, method, operation }) => `- [\`${method.toUpperCase()} ${path}\`](#operation-${id(operation.operationId)})`), ''];
  for (const { path, method, operation } of operations) {
    lines.push(`### \`${method.toUpperCase()} ${path}\` {#operation-${id(operation.operationId)}}`, '', operation.summary ?? '', '',
      `${en ? 'Operation' : '操作'}: \`${operation.operationId}\`.`, '');
    if (operation.description) lines.push(operation.description, '');
    if (operation.parameters) lines.push(en ? 'Parameters, locations, and required values:' : '参数、位置与必填值：', '', code(operation.parameters));
    if (operation.requestBody) lines.push(en ? 'Request body and media types:' : '请求正文与媒体类型：', '', code(operation.requestBody));
    else lines.push(en ? 'This operation has no request body.' : '此操作没有请求正文。', '');
    lines.push(en ? 'Responses, error statuses, and media types:' : '返回、错误状态与媒体类型：', '', code(operation.responses));
    const refs = [...new Set([...JSON.stringify(operation).matchAll(/#\/components\/schemas\/([^"\\]+)/g)].map(match => match[1]))];
    if (refs.length) lines.push(`${en ? 'Schemas' : '结构'}: ${refs.map(name => `[\`${name}\`](#${schemaId(name)})`).join(' · ')}`, '');
  }
  lines.push(`## ${en ? 'Job event channel' : 'Job 事件通道'} {#job-events}`, '',
    en ? 'The registered WebSocket route and message schema come from the same OpenAPI extension. HTTP remains the recovery source; see the Job events guide.' : '已注册 WebSocket 路径与消息结构来自同一 OpenAPI 扩展。HTTP 仍是恢复来源；用法见 Job 事件指南。', '', code(document['x-websockets']),
    `## ${en ? 'Schema index' : '结构索引'} {#schema-index}`, '',
    ...Object.keys(document.components.schemas).map(name => `- [\`${name}\`](#${schemaId(name)})`), '');
  for (const [name, schema] of Object.entries(document.components.schemas)) {
    lines.push(`### ${name} {#${schemaId(name)}}`, '', code(schema));
  }
  return lines.join('\n');
}

export function renderSettings(document, locale) {
  const en = locale === 'en';
  const lines = [`## ${en ? 'Environment variable index' : '环境变量索引'} {#settings-index}`, '',
    ...Object.keys(document.settings_schema.properties).map(name => `- [\`${document.environment_variables[name]}\`](#setting-${id(name)})`), ''];
  for (const [name, schema] of Object.entries(document.settings_schema.properties)) {
    lines.push(`### ${document.environment_variables[name]} {#setting-${id(name)}}`, '',
      `${en ? 'Settings field' : 'Settings 字段'}: \`${name}\`.`, '',
      en ? 'Type, default, allowed values, and validation constraints from Settings:' : '来自 Settings 的类型、默认值、可选值与验证限制：', '', code(schema));
  }
  return lines.join('\n');
}

export async function exportReferences(root) {
  const temporary = await mkdtemp(join(tmpdir(), 'llm-music-docs-reference-'));
  let completed = false;
  const data = join(temporary, 'absent-application-data');
  const run = args => {
    const result = spawnSync('uv', ['run', '--project', resolve(root, 'services/api'), '--no-sync', 'python', ...args], {
      cwd: root, encoding: 'utf8', timeout: 30_000,
      env: { ...Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.toUpperCase().startsWith('MUSIC_API_'))), MUSIC_API_RUNTIME_MODE: 'fake' },
    });
    assert.equal(result.status, 0, result.error?.message ?? result.stderr);
  };
  try {
    run(['-m', 'music_api', 'openapi', '--data-dir', data, '--output', join(temporary, 'openapi.json')]);
    run([resolve(root, 'apps/docs/scripts/settings-metadata.py'), join(temporary, 'settings.json')]);
    await assert.rejects(access(data), { code: 'ENOENT' }, 'Reference export must not initialize application data');
    const openapi = JSON.parse(await readFile(join(temporary, 'openapi.json'), 'utf8'));
    const settings = JSON.parse(await readFile(join(temporary, 'settings.json'), 'utf8'));
    assert.ok(openapi.paths && openapi.components?.schemas && openapi['x-websockets'], 'HTTP and Job event contracts must be exported together');
    completed = true;
    return { openapi, settings };
  } catch (error) {
    error.message += `\nReference export evidence retained at ${temporary}`;
    throw error;
  } finally {
    // Retain failures for diagnosis; remove successful exports only.
    if (completed) await rm(temporary, { recursive: true, force: true });
  }
}
