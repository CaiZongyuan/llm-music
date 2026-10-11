import assert from 'node:assert/strict';
import test from 'node:test';
import { createMobileSession, MobileFailure } from '../src/data/session.ts';

const serverId = '9071c074-d9d8-4e27-bb84-32d8e58dc92f';
const deviceId = 'f6257463-40e5-4b09-9f10-e979b2e7864e';
const token = 'ab'.repeat(32);

test('a lost claim response keeps the saved credential and cold start only verifies the original device', async () => {
  let local: unknown = null;
  const secrets = new Map<string, string>();
  let claims = 0;
  let grant: { device_id: string; device_token: string; device_name: string } | undefined;
  const options = {
    store: { load: async () => local, save: async (value: unknown) => { local = structuredClone(value); } },
    credentials: { get: async (key: string) => secrets.get(key) ?? null, set: async (key: string, value: string) => { secrets.set(key, value); } },
    random: { uuid: () => deviceId, token: async () => token },
    fetch: async (request: Request) => {
      const path = new URL(request.url).pathname;
      if (path === '/connection') return Response.json({ server_id: serverId, protocol_version: 1, pairing_available: true });
      if (path === '/pairing/claim') {
        claims++;
        assert.ok(secrets.size > 0, 'the secure provider must finish before the server accepts a claim');
        grant = await request.json();
        throw new Error('accepted response was lost');
      }
      assert.equal(path, '/device');
      assert.equal(request.headers.get('authorization'), 'Bearer ' + grant?.device_token);
      return Response.json({ server_id: serverId, device: { id: grant!.device_id, name: grant!.device_name, created_at: 1, revoked_at: null } });
    },
  };
  const first = createMobileSession(options);
  await first.hydrate();
  await assert.rejects(first.pair('http://192.168.1.8:8001', '246810', '我的手机'));
  assert.equal(first.getSnapshot().connection, 'disconnected');
  first.dispose();
  const restarted = createMobileSession(options);
  await restarted.hydrate();
  assert.equal(restarted.getSnapshot().connection, 'connected');
  assert.equal(restarted.getSnapshot().server?.serverId, serverId);
  assert.equal(restarted.getSnapshot().server?.deviceId, deviceId);
  assert.equal(claims, 1, 'hydrate must not replay a POST');
  assert.ok(!JSON.stringify(restarted.getSnapshot()).includes(token), 'credentials are absent from the screen snapshot');
  restarted.dispose();
});

test('Chinese multiline Creation Draft survives rebuilding the session on the same server', async () => {
  let local: unknown = null;
  const secrets = new Map<string, string>();
  const options = {
    store: { load: async () => local, save: async (value: unknown) => { local = structuredClone(value); } },
    credentials: { get: async (key: string) => secrets.get(key) ?? null, set: async (key: string, value: string) => { secrets.set(key, value); } },
    random: { uuid: () => deviceId, token: async () => token },
    fetch: async (request: Request) => new URL(request.url).pathname === '/connection'
      ? Response.json({ server_id: serverId, protocol_version: 1, pairing_available: true })
      : Response.json({ server_id: serverId, device: { id: deviceId, name: '我的手机', created_at: 1, revoked_at: null } }),
  };
  const first = createMobileSession(options);
  await first.hydrate(); await first.pair('http://192.168.1.8:8001', '246810', '我的手机');
  const projectId = 'b28b8f6f-45a7-465b-b4e3-1ca13b85cb01';
  await first.updateDraft(projectId, { style: '慢速民谣', lyrics: '[Verse]\n雨落在窗前\n我还记得昨天', seed: '42', maxSeconds: '' });
  first.dispose();
  const restarted = createMobileSession(options);
  await restarted.hydrate();
  assert.deepEqual(restarted.getDraft(projectId), { style: '慢速民谣', lyrics: '[Verse]\n雨落在窗前\n我还记得昨天', seed: '42', maxSeconds: '' });
  restarted.dispose();
});

test('cold start with a missing saved credential blocks writes and does not silently generate another authorization', async () => {
  let local: unknown = null;
  const secrets = new Map<string, string>();
  let claims = 0;
  const options = {
    store: { load: async () => local, save: async (value: unknown) => { local = structuredClone(value); } },
    credentials: { get: async (key: string) => secrets.get(key) ?? null, set: async (key: string, value: string) => { secrets.set(key, value); } },
    random: { uuid: () => deviceId, token: async () => token },
    fetch: async (request: Request) => {
      if (new URL(request.url).pathname === '/connection') return Response.json({ server_id: serverId, protocol_version: 1, pairing_available: true });
      if (request.method === 'POST') claims++;
      return Response.json({ server_id: serverId, device: { id: deviceId, name: '我的手机', created_at: 1, revoked_at: null } });
    },
  };
  const first = createMobileSession(options);
  await first.hydrate();
  await first.pair('http://192.168.1.8:8001', '246810', '我的手机');
  assert.equal(first.getSnapshot().connection, 'connected');
  first.dispose(); secrets.clear();
  const restarted = createMobileSession(options);
  await restarted.hydrate();
  assert.equal(restarted.getSnapshot().error, 'credential_missing');
  assert.equal(restarted.getSnapshot().connection, 'disconnected');
  await assert.rejects(restarted.pair('http://192.168.1.8:8001', '246810', '我的手机'));
  assert.equal(claims, 1);
  restarted.dispose();
});

test('effect cleanup can suspend and hydrate the same session without replacing its authorization', async () => {
  let local: unknown = null;
  const secrets = new Map<string, string>();
  let claims = 0;
  const session = createMobileSession({
    store: { load: async () => local, save: async value => { local = structuredClone(value); } },
    credentials: { get: async key => secrets.get(key) ?? null, set: async (key, value) => { secrets.set(key, value); } },
    random: { uuid: () => deviceId, token: async () => token },
    fetch: async request => {
      if (new URL(request.url).pathname === '/connection') return Response.json({ server_id: serverId, protocol_version: 1, pairing_available: true });
      if (request.method === 'POST') claims++;
      return Response.json({ server_id: serverId, device: { id: deviceId, name: '实际手机名称', created_at: 1, revoked_at: null } });
    },
  });
  await session.hydrate(); await session.pair('http://192.168.1.8:8001', '246810', '我的手机');
  session.suspend();
  await session.hydrate();
  assert.equal(session.getSnapshot().connection, 'connected');
  assert.equal(session.getSnapshot().server?.deviceName, '实际手机名称');
  assert.equal(claims, 1);
  session.dispose();
});

test('a superseded credential write cannot overwrite the next confirmed authorization on cold start', async () => {
  let local: unknown = null;
  const secrets = new Map<string, string>();
  let releaseFirst!: () => void;
  let beganFirst!: () => void;
  const firstStarted = new Promise<void>(resolve => { beganFirst = resolve; });
  const firstHeld = new Promise<void>(resolve => { releaseFirst = resolve; });
  let writes = 0, claims = 0, ids = 0;
  let accepted: { device_id: string; device_name: string; device_token: string } | undefined;
  const options = {
    store: { load: async () => local, save: async (value: unknown) => { local = structuredClone(value); } },
    credentials: {
      get: async (key: string) => secrets.get(key) ?? null,
      set: async (key: string, value: string) => {
        if (++writes === 1) { beganFirst(); await firstHeld; }
        secrets.set(key, value);
      },
    },
    random: { uuid: () => ++ids === 1 ? deviceId : 'd38e9dd8-0779-4e61-9a9f-05757336d4ea', token: async () => token },
    fetch: async (request: Request) => {
      const path = new URL(request.url).pathname;
      if (path === '/connection') return Response.json({ server_id: serverId, protocol_version: 1, pairing_available: true });
      if (path === '/pairing/claim') { claims++; accepted = await request.json(); }
      assert.equal(request.method === 'POST' || request.headers.get('authorization') === 'Bearer ' + accepted?.device_token, true);
      return Response.json({ server_id: serverId, device: { id: accepted!.device_id, name: accepted!.device_name, created_at: 1, revoked_at: null } });
    },
  };
  const session = createMobileSession(options);
  await session.hydrate();
  const superseded = session.pair('http://192.168.1.8:8001', '246810', '旧授权').catch(error => error);
  await firstStarted;
  const next = session.pair('http://192.168.1.8:8001', '135790', '新授权', true);
  await new Promise(resolve => setImmediate(resolve));
  releaseFirst();
  assert.equal((await superseded).code, 'session_changed');
  await next;
  session.dispose();
  const restarted = createMobileSession(options);
  await restarted.hydrate();
  assert.equal(restarted.getSnapshot().connection, 'connected');
  assert.equal(restarted.getSnapshot().server?.deviceId, 'd38e9dd8-0779-4e61-9a9f-05757336d4ea');
  assert.equal(claims, 1, 'the obsolete operation must never claim and hydrate must only read');
  restarted.dispose();
});

test('the generated ErrorResponse is available to callers without losing recovery information', async () => {
  const detail = { code: 'pairing_expired', message: '配对码已过期', recovery: '重新生成短码', resource_id: null };
  const session = createMobileSession({
    store: { load: async () => null, save: async () => {} },
    credentials: { get: async () => null, set: async () => {} },
    random: { uuid: () => deviceId, token: async () => token },
    fetch: async request => new URL(request.url).pathname === '/connection'
      ? Response.json({ server_id: serverId, protocol_version: 1, pairing_available: true })
      : Response.json({ error: detail }, { status: 410 }),
  });
  await session.hydrate();
  await assert.rejects(session.pair('http://192.168.1.8:8001', '246810', '我的手机'), error => {
    assert.ok(error instanceof MobileFailure); assert.deepEqual(error.detail, detail); return true;
  });
  session.dispose();
});

test('a failed draft save preserves edited Chinese input and storage retry persists it before permitting a new intent', async () => {
  let local: unknown = null, failSave = false, ids = 0;
  const secrets = new Map<string, string>();
  const projectId = 'b28b8f6f-45a7-465b-b4e3-1ca13b85cb01';
  const options = {
    store: { load: async () => local, save: async (value: unknown) => { if (failSave) throw new Error('disk full'); local = structuredClone(value); } },
    credentials: { get: async (key: string) => secrets.get(key) ?? null, set: async (key: string, value: string) => { secrets.set(key, value); } },
    random: { uuid: () => ++ids === 1 ? deviceId : '5146ba0a-8a34-462c-ac92-f5e783de28f8', token: async () => token },
    fetch: async (request: Request) => new URL(request.url).pathname === '/connection'
      ? Response.json({ server_id: serverId, protocol_version: 1, pairing_available: true })
      : Response.json({ server_id: serverId, device: { id: deviceId, name: '我的手机', created_at: 1, revoked_at: null } }),
  };
  const session = createMobileSession(options);
  await session.hydrate(); await session.pair('http://192.168.1.8:8001', '246810', '我的手机');
  failSave = true;
  await assert.rejects(session.updateDraft(projectId, { style: '慢速民谣', lyrics: '雨落在窗前\n我还记得昨天' }));
  assert.equal(session.getDraft(projectId).lyrics, '雨落在窗前\n我还记得昨天');
  await assert.rejects(session.prepareGenerate(projectId));
  failSave = false;
  await session.retryStorage();
  assert.equal(session.getSnapshot().storage, 'ready');
  await session.prepareGenerate(projectId);
  session.dispose();
  const restarted = createMobileSession(options); await restarted.hydrate();
  assert.equal(restarted.getDraft(projectId).lyrics, '雨落在窗前\n我还记得昨天');
  assert.equal(restarted.listIntents(projectId)[0].phase, 'prepared');
  restarted.dispose();
});
