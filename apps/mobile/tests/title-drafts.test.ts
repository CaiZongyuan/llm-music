import assert from 'node:assert/strict';
import test from 'node:test';
import { createMobileSession, MobileFailure } from '../src/data/session.ts';

const serverId = '9071c074-d9d8-4e27-bb84-32d8e58dc92f';
const deviceId = 'f6257463-40e5-4b09-9f10-e979b2e7864e';
const projectId = 'b28b8f6f-45a7-465b-b4e3-1ca13b85cb01';
const candidateId = 'ef1980d2-e96c-4f3c-a821-26f79a6c0375';

test('name read requires hydrated server identity even when a legacy document has no title entries', async () => {
  const session = createMobileSession({
    store: { load: async () => null, save: async () => {} },
    credentials: { get: async () => null, set: async () => {} },
    random: { uuid: () => deviceId, token: async () => 'ab'.repeat(32) },
    fetch: async () => { throw new Error('No network before pairing'); },
  });
  const unavailable = (error: unknown) => error instanceof MobileFailure && error.code === 'draft_unavailable';
  assert.throws(() => session.getTitleDraft({ kind: 'project' }), unavailable);
  await session.hydrate();
  assert.throws(() => session.getTitleDraft({ kind: 'project' }), unavailable);
  session.dispose();
});

test('unsubmitted Project and Version names survive cold reconstruction without creating an intent or write request', async () => {
  let local: unknown = null;
  const secrets = new Map<string, string>();
  const requests: Request[] = [];
  const options = {
    store: { load: async () => local, save: async (value: unknown) => { local = structuredClone(value); } },
    credentials: { get: async (key: string) => secrets.get(key) ?? null, set: async (key: string, value: string) => { secrets.set(key, value); } },
    random: { uuid: () => deviceId, token: async () => 'ab'.repeat(32) },
    fetch: async (request: Request) => {
      requests.push(request);
      return new URL(request.url).pathname === '/connection'
        ? Response.json({ server_id: serverId, protocol_version: 1, pairing_available: true })
        : Response.json({ server_id: serverId, device: { id: deviceId, name: '手机', created_at: 1, revoked_at: null } });
    },
  };
  const first = createMobileSession(options);
  await first.hydrate(); await first.pair('http://192.168.1.8:8001', '246810', '手机');
  const before = requests.length;
  await first.updateTitleDraft({ kind: 'project' }, '  未提交的新项目  ');
  await first.updateTitleDraft({ kind: 'version', projectId, candidateId }, '手机试听后的名字');
  assert.equal(first.listIntents().length, 0);
  assert.equal(requests.length, before, 'typing names must not perform any HTTP operation');
  first.dispose();
  const cold = createMobileSession(options);
  await cold.hydrate();
  assert.equal(cold.getTitleDraft({ kind: 'project' }), '  未提交的新项目  ');
  assert.equal(cold.getTitleDraft({ kind: 'version', projectId, candidateId }), '手机试听后的名字');
  assert.equal(cold.getTitleDraft({ kind: 'version', projectId, candidateId: 'd38e9dd8-0779-4e61-9a9f-05757336d4ea' }), '');
  assert.equal(cold.listIntents().length, 0);
  cold.dispose();
});

test('name drafts are isolated across computers and a failed save retains the latest name while blocking submission', async () => {
  const otherServer = 'ea6da798-6dcf-439d-9a6b-8d3d3c9f8d6c';
  let local: unknown = null, failSaves = false;
  const secrets = new Map<string, string>();
  let writes = 0;
  const session = createMobileSession({
    store: { load: async () => local, save: async value => { if (failSaves) throw new Error('external storage write failed'); local = structuredClone(value); } },
    credentials: { get: async key => secrets.get(key) ?? null, set: async (key, value) => { secrets.set(key, value); } },
    random: { uuid: () => deviceId, token: async () => 'ab'.repeat(32) },
    fetch: async request => {
      const identity = new URL(request.url).hostname.endsWith('.9') ? otherServer : serverId;
      if (request.method === 'POST') writes++;
      return new URL(request.url).pathname === '/connection'
        ? Response.json({ server_id: identity, protocol_version: 1, pairing_available: true })
        : Response.json({ server_id: identity, device: { id: deviceId, name: '手机', created_at: 1, revoked_at: null } });
    },
  });
  await session.hydrate(); await session.pair('http://192.168.1.8:8001', '246810', '手机');
  await session.updateTitleDraft({ kind: 'project' }, '电脑A上的项目名');
  await session.pair('http://192.168.1.9:8001', '246810', '手机');
  assert.equal(session.getTitleDraft({ kind: 'project' }), '');
  await session.updateTitleDraft({ kind: 'project' }, '电脑B自己的名字');
  await session.switchServer(serverId);
  assert.equal(session.getTitleDraft({ kind: 'project' }), '电脑A上的项目名');
  const before = writes;
  failSaves = true;
  await assert.rejects(session.updateTitleDraft({ kind: 'project' }, '保存失败时仍保留的新名字'));
  assert.equal(session.getTitleDraft({ kind: 'project' }), '保存失败时仍保留的新名字');
  assert.equal(session.getSnapshot().storage, 'error');
  await assert.rejects(session.prepareIntent({ operation: 'create_project', body: { name: '保存失败时仍保留的新名字' } }),
    (error: unknown) => error instanceof MobileFailure && error.code === 'storage_unavailable');
  failSaves = false;
  await session.retryStorage();
  assert.equal(session.getSnapshot().storage, 'ready');
  assert.equal(session.getTitleDraft({ kind: 'project' }), '保存失败时仍保留的新名字');
  assert.equal(writes, before, 'storage retry and name editing must never create a Project');
  session.dispose();
});
