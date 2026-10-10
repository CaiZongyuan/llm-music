import type { components } from '@llm-music/api-client';

export type ServerRecord = Readonly<{ serverId: string; baseUrl: string; deviceName: string; credentialExpected?: boolean }>;
export type CreationDraft = Readonly<{ style: string; lyrics: string; seed: string; maxSeconds: string }>;
export type TitleTarget = Readonly<{ kind: 'project' } | { kind: 'version'; projectId: string; candidateId: string }>;
export type IntentInput =
  | { operation: 'create_project'; body: components['schemas']['ProjectCreate'] }
  | { operation: 'generate'; projectId: string; body: components['schemas']['GenerateCreate'] }
  | { operation: 'retry'; projectId: string; jobId: string }
  | { operation: 'save_version'; projectId: string; body: components['schemas']['VersionSave'] };
export type PendingIntent = Readonly<IntentInput & {
  id: string; serverId: string; phase: 'prepared' | 'unknown' | 'confirmed' | 'rejected'; resourceId?: string; error?: string;
}>;
export type LocalDocument = {
  version: 1; activeServerId: string | null; servers: Record<string, ServerRecord>;
  drafts?: Record<string, CreationDraft>; intents?: Record<string, PendingIntent>; titles?: Record<string, string>;
};
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const scopedKey = (serverId: string, id: string) => JSON.stringify([serverId, id]);
export const emptyDocument = (): LocalDocument => ({ version: 1, activeServerId: null, servers: {} });

export function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(item => freeze(item));
    Object.freeze(value);
  }
  return value;
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function string(value: unknown): asserts value is string {
  if (typeof value !== 'string') throw new Error('invalid local document');
}
function id(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !uuidPattern.test(value)) throw new Error('invalid local identity');
}
export function titleDraftKey(serverId: string, target: TitleTarget): string {
  id(serverId);
  if (target.kind === 'project') return JSON.stringify([serverId, 'project']);
  if (target.kind !== 'version') throw new Error('invalid title target');
  id(target.projectId); id(target.candidateId);
  return JSON.stringify([serverId, 'version', target.projectId, target.candidateId]);
}
function partition(key: string, servers: Record<string, ServerRecord>) {
  const value: unknown = JSON.parse(key);
  if (!Array.isArray(value) || value.length !== 2) throw new Error('invalid local partition');
  id(value[0]); id(value[1]);
  if (!servers[value[0]] || scopedKey(value[0], value[1]) !== key) throw new Error('invalid local partition');
  return value;
}

// The envelope validates only the durable mobile-owned shape. Business types
// remain generated from OpenAPI and the server validates their domain rules.
export function parseDocument(raw: unknown, normalizeUrl: (url: string) => string): LocalDocument {
  if (raw === null) return emptyDocument();
  if (!record(raw) || raw.version !== 1 || !record(raw.servers)) throw new Error('invalid local document');
  const servers: Record<string, ServerRecord> = {};
  for (const [key, value] of Object.entries(raw.servers)) {
    id(key);
    if (!record(value) || value.serverId !== key) throw new Error('invalid local server');
    string(value.baseUrl); string(value.deviceName);
    if (normalizeUrl(value.baseUrl) !== value.baseUrl || value.credentialExpected !== undefined && typeof value.credentialExpected !== 'boolean') throw new Error('invalid local server');
    servers[key] = freeze({ serverId: key, baseUrl: value.baseUrl, deviceName: value.deviceName,
      ...(value.credentialExpected === undefined ? {} : { credentialExpected: value.credentialExpected }) });
  }
  if (raw.activeServerId !== null) { id(raw.activeServerId); if (!servers[raw.activeServerId]) throw new Error('invalid active server'); }
  const drafts: Record<string, CreationDraft> = {};
  if (raw.drafts !== undefined) {
    if (!record(raw.drafts)) throw new Error('invalid local drafts');
    for (const [key, value] of Object.entries(raw.drafts)) {
      partition(key, servers);
      if (!record(value)) throw new Error('invalid local draft');
      string(value.style); string(value.lyrics); string(value.seed); string(value.maxSeconds);
      drafts[key] = freeze({ style: value.style, lyrics: value.lyrics, seed: value.seed, maxSeconds: value.maxSeconds });
    }
  }
  const intents: Record<string, PendingIntent> = {};
  if (raw.intents !== undefined) {
    if (!record(raw.intents)) throw new Error('invalid local intents');
    for (const [key, value] of Object.entries(raw.intents)) {
      const [serverId, intentId] = partition(key, servers);
      if (!record(value) || value.id !== intentId || value.serverId !== serverId || !['prepared', 'unknown', 'confirmed', 'rejected'].includes(String(value.phase))) throw new Error('invalid local intent');
      if (value.resourceId !== undefined) id(value.resourceId);
      if (value.phase === 'confirmed' && value.resourceId === undefined) throw new Error('invalid confirmed intent');
      if (value.error !== undefined) string(value.error);
      const input = parseIntentInput(value);
      intents[key] = freeze({ ...input, id: intentId, serverId, phase: value.phase as PendingIntent['phase'],
        ...(value.resourceId === undefined ? {} : { resourceId: value.resourceId }),
        ...(value.error === undefined ? {} : { error: value.error }) });
    }
  }
  const titles: Record<string, string> = {};
  if (raw.titles !== undefined) {
    if (!record(raw.titles)) throw new Error('invalid local titles');
    for (const [key, value] of Object.entries(raw.titles)) {
      const parts: unknown = JSON.parse(key);
      if (!Array.isArray(parts)) throw new Error('invalid title partition');
      id(parts[0]);
      if (!servers[parts[0]]) throw new Error('invalid title server');
      let target: TitleTarget;
      if (parts.length === 2 && parts[1] === 'project') target = { kind: 'project' };
      else if (parts.length === 4 && parts[1] === 'version') {
        id(parts[2]); id(parts[3]); target = { kind: 'version', projectId: parts[2], candidateId: parts[3] };
      } else throw new Error('invalid title partition');
      if (titleDraftKey(parts[0], target) !== key) throw new Error('invalid title partition');
      string(value); titles[key] = value;
    }
  }
  return { version: 1, activeServerId: raw.activeServerId, servers, drafts, intents, titles };
}

export function parseIntentInput(value: unknown): IntentInput {
  if (!record(value)) throw new Error('invalid local intent');
  if (value.operation === 'retry') { id(value.projectId); id(value.jobId); return { operation: 'retry', projectId: value.projectId, jobId: value.jobId }; }
  if (!record(value.body)) throw new Error('invalid local intent');
  const body = value.body;
  if (value.operation === 'create_project') {
    string(body.name); if (body.description !== undefined) string(body.description);
    return { operation: 'create_project', body: { name: body.name, ...(body.description === undefined ? {} : { description: body.description }) } };
  }
  id(value.projectId);
  if (value.operation === 'generate') {
    string(body.style); string(body.lyrics);
    if (typeof body.seed !== 'number' || !Number.isSafeInteger(body.seed) || body.max_seconds !== undefined && (typeof body.max_seconds !== 'number' || !Number.isInteger(body.max_seconds))) throw new Error('invalid generate input');
    return { operation: 'generate', projectId: value.projectId, body: { style: body.style, lyrics: body.lyrics, seed: body.seed,
      ...(body.max_seconds === undefined ? {} : { max_seconds: body.max_seconds }) } };
  }
  if (value.operation === 'save_version') {
    id(body.candidate_id); string(body.name); if (body.parent_version_id !== undefined && body.parent_version_id !== null) id(body.parent_version_id);
    return { operation: 'save_version', projectId: value.projectId, body: { candidate_id: body.candidate_id, name: body.name,
      ...(body.parent_version_id === undefined ? {} : { parent_version_id: body.parent_version_id }) } };
  }
  throw new Error('invalid intent operation');
}
