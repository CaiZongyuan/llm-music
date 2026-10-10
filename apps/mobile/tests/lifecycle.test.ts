import assert from 'node:assert/strict';
import test from 'node:test';
import { createMobileSession, MobileFailure } from '../src/data/session.ts';

const serverId = '9071c074-d9d8-4e27-bb84-32d8e58dc92f';
const deviceId = 'f6257463-40e5-4b09-9f10-e979b2e7864e';
const projectId = 'b28b8f6f-45a7-465b-b4e3-1ca13b85cb01';
const jobId = 'd38e9dd8-0779-4e61-9a9f-05757336d4ea';

test('foreground recovery reads authorization and Job before opening an authenticated observation socket', async () => {
  let local: unknown = null;
  const secrets = new Map<string, string>();
  const events: string[] = [];
  let closed = 0;
  let onClose!: (code: number) => void;
  const session = createMobileSession({
    store: { load: async () => local, save: async value => { local = structuredClone(value); } },
    credentials: { get: async key => secrets.get(key) ?? null, set: async (key, value) => { secrets.set(key, value); } },
    random: { uuid: () => deviceId, token: async () => 'ab'.repeat(32) },
    fetch: async request => {
      const path = new URL(request.url).pathname; events.push(path);
      if (path === '/connection') return Response.json({ server_id: serverId, protocol_version: 1, pairing_available: true });
      if (path === '/pairing/claim' || path === '/device') return Response.json({ server_id: serverId, device: { id: deviceId, name: '我的手机', created_at: 1, revoked_at: null } });
      assert.equal(path, `/projects/${projectId}/jobs/${jobId}`);
      return Response.json({ id: jobId, project_id: projectId, status: 'running', operation: 'Generate' });
    },
    socket: (url, headers, observer) => {
      assert.equal(url, `ws://192.168.1.8:8001/projects/${projectId}/jobs/${jobId}/events`);
      assert.equal(headers.Authorization, 'Bearer ' + 'ab'.repeat(32));
      onClose = observer.close;
      events.push('socket'); return { close: () => { closed++; } };
    },
  });
  await session.hydrate(); await session.pair('http://192.168.1.8:8001', '246810', '我的手机');
  const unwatch = session.watchJob(projectId, jobId, { job: () => {}, error: error => { throw error; } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(events.at(-1), 'socket');
  await session.setForeground(false);
  assert.ok(closed > 0);
  events.length = 0;
  await session.setForeground(true);
  assert.deepEqual(events, ['/connection', '/device', `/projects/${projectId}/jobs/${jobId}`, 'socket']);
  onClose(1000);
  assert.equal(session.getSnapshot().connection, 'connected', 'a normal stream close does not declare the whole computer offline');
  unwatch(); session.dispose();
});

test('the public HTTP timeout includes a transport that never settles and rejects without resubmitting', async () => {
  let local: unknown = null;
  const secrets = new Map<string, string>();
  let signal: AbortSignal | undefined;
  const session = createMobileSession({
    store: { load: async () => local, save: async value => { local = structuredClone(value); } },
    credentials: { get: async key => secrets.get(key) ?? null, set: async (key, value) => { secrets.set(key, value); } },
    random: { uuid: () => deviceId, token: async () => 'ab'.repeat(32) }, timeoutMs: 30,
    fetch: async request => {
      if (new URL(request.url).pathname === '/connection') return Response.json({ server_id: serverId, protocol_version: 1, pairing_available: true });
      if (new URL(request.url).pathname === '/projects') { signal = request.signal; return new Promise<Response>(() => {}); }
      return Response.json({ server_id: serverId, device: { id: deviceId, name: '我的手机', created_at: 1, revoked_at: null } });
    },
  });
  await session.hydrate(); await session.pair('http://192.168.1.8:8001', '246810', '我的手机');
  await assert.rejects(session.getProjects(), error => error instanceof MobileFailure && error.code === 'request_timed_out');
  assert.equal(signal?.aborted, true);
  session.dispose();
});

test('media authorization creates only a canonical current-server Request and cached playback cannot bypass revocation', async () => {
  let local: unknown = null, revoked = false;
  const secrets = new Map<string, string>();
  const assetId = '949b88d7-607e-4c99-be9d-68065f961e18';
  const session = createMobileSession({
    store: { load: async () => local, save: async value => { local = structuredClone(value); } },
    credentials: { get: async key => secrets.get(key) ?? null, set: async (key, value) => { secrets.set(key, value); } },
    random: { uuid: () => deviceId, token: async () => 'ab'.repeat(32) },
    fetch: async request => {
      const path = new URL(request.url).pathname;
      if (path === '/connection') return Response.json({ server_id: serverId, protocol_version: 1, pairing_available: true });
      if (path === `/projects/${projectId}/assets/${assetId}`) return Response.json({ id: assetId, project_id: projectId, kind: 'generated_audio', format: 'flac' });
      if (revoked) return Response.json({ error: { code: 'device_revoked', message: '已撤销', recovery: '重新授权' } }, { status: 401 });
      return Response.json({ server_id: serverId, device: { id: deviceId, name: '我的手机', created_at: 1, revoked_at: null } });
    },
  });
  await session.hydrate(); await session.pair('http://192.168.1.8:8001', '246810', '我的手机');
  const lease = await session.authorizeMedia(projectId, assetId);
  const request = lease.createRequest();
  assert.equal(request.url, `http://192.168.1.8:8001/projects/${projectId}/assets/${assetId}/content`);
  assert.equal(request.headers.get('authorization'), 'Bearer ' + 'ab'.repeat(32));
  assert.equal(request.redirect, 'error');
  assert.ok(!JSON.stringify(lease).includes('ab'.repeat(32)));
  revoked = true;
  await assert.rejects(session.authorizeMedia(projectId, assetId));
  assert.equal(session.getSnapshot().connection, 'revoked');
  assert.equal(lease.isCurrent(), false);
  assert.throws(() => lease.createRequest());
  session.dispose();
});

test('switching computers aborts stale reads and keeps the same Project UUID in separate draft and intent partitions', async () => {
  let local: unknown = null, ids = 0;
  const secondServerId = '8c3c8c40-4b3b-47c0-b9c4-7f88b6f09f59';
  const secondDeviceId = '5146ba0a-8a34-462c-ac92-f5e783de28f8';
  const secrets = new Map<string, string>(), grants = new Map<string, { device_id: string; device_name: string; device_token: string }>();
  let releaseOld!: () => void;
  let beganOld!: () => void;
  const oldStarted = new Promise<void>(resolve => { beganOld = resolve; });
  const oldHeld = new Promise<void>(resolve => { releaseOld = resolve; });
  let oldSignal: AbortSignal | undefined;
  const session = createMobileSession({
    store: { load: async () => local, save: async value => { local = structuredClone(value); } },
    credentials: { get: async key => secrets.get(key) ?? null, set: async (key, value) => { secrets.set(key, value); } },
    random: { uuid: () => [deviceId, jobId, secondDeviceId][ids++]!, token: async () => (ids ? 'cd' : 'ab').repeat(32) },
    fetch: async request => {
      const { origin, pathname } = new URL(request.url);
      const identity = origin.endsWith(':8001') ? serverId : secondServerId;
      if (pathname === '/connection') return Response.json({ server_id: identity, protocol_version: 1, pairing_available: true });
      if (pathname === '/pairing/claim') grants.set(origin, await request.json());
      const grant = grants.get(origin)!;
      if (pathname === '/device') assert.equal(request.headers.get('authorization'), 'Bearer ' + grant.device_token);
      if (pathname === `/projects/${projectId}/jobs/${jobId}`) {
        oldSignal = request.signal; beganOld(); await oldHeld;
        return Response.json({ id: jobId, project_id: projectId, status: 'running' });
      }
      return Response.json({ server_id: identity, device: { id: grant.device_id, name: grant.device_name, created_at: 1, revoked_at: null } });
    },
  });
  await session.hydrate(); await session.pair('http://192.168.1.8:8001', '246810', '电脑一');
  await session.updateDraft(projectId, { style: '慢速民谣', lyrics: '电脑一的歌词' });
  await session.prepareGenerate(projectId);
  assert.throws(() => Object.assign(session.getSnapshot().server!, { baseUrl: 'http://192.168.1.9:8001' }));
  assert.throws(() => Object.assign(session.getServers()[0], { baseUrl: 'http://192.168.1.9:8001' }),
    'the public index must not let a caller redirect a saved credential');
  assert.equal(session.getServers()[0].baseUrl, 'http://192.168.1.8:8001');
  const obsolete = session.getJob(projectId, jobId).catch(error => error);
  await oldStarted;
  await session.pair('http://192.168.1.9:8002', '135790', '电脑二');
  assert.equal(oldSignal?.aborted, true);
  releaseOld();
  assert.equal((await obsolete).code, 'session_changed');
  assert.equal(session.getSnapshot().server?.serverId, secondServerId);
  assert.equal(session.getDraft(projectId).lyrics, '');
  assert.equal(session.listIntents(projectId).length, 0);
  await session.updateDraft(projectId, { lyrics: '电脑二的歌词' });
  await session.switchServer(serverId);
  assert.equal(session.getDraft(projectId).lyrics, '电脑一的歌词');
  assert.equal(session.listIntents(projectId)[0].phase, 'prepared');
  session.dispose();
});

test('a lost cancel acknowledgement reads the original terminal Job without repeating the cancellation', async () => {
  let local: unknown = null, cancels = 0;
  const secrets = new Map<string, string>();
  const session = createMobileSession({
    store: { load: async () => local, save: async value => { local = structuredClone(value); } },
    credentials: { get: async key => secrets.get(key) ?? null, set: async (key, value) => { secrets.set(key, value); } },
    random: { uuid: () => deviceId, token: async () => 'ab'.repeat(32) },
    fetch: async request => {
      const path = new URL(request.url).pathname;
      if (path === '/connection') return Response.json({ server_id: serverId, protocol_version: 1, pairing_available: true });
      if (path === '/pairing/claim' || path === '/device') return Response.json({ server_id: serverId, device: { id: deviceId, name: '我的手机', created_at: 1, revoked_at: null } });
      if (path === `/projects/${projectId}/jobs/${jobId}/cancel`) { cancels++; throw new Error('cancel accepted, response lost'); }
      assert.equal(path, `/projects/${projectId}/jobs/${jobId}`);
      return Response.json({ id: jobId, project_id: projectId, status: 'cancelled', cancel_requested: true });
    },
  });
  await session.hydrate(); await session.pair('http://192.168.1.8:8001', '246810', '我的手机');
  const cancelled = await session.cancelJob(projectId, jobId);
  assert.equal(cancelled.status, 'cancelled'); assert.equal(cancels, 1);
  session.dispose();
});

test('a terminal socket notice arriving during HTTP refresh still triggers a final authoritative Job read', async () => {
  let local: unknown = null, reads = 0;
  const secrets = new Map<string, string>();
  const observed: string[] = [];
  let deliver!: (value: unknown) => void;
  let releaseRead!: () => void;
  let beganRead!: () => void;
  const started = new Promise<void>(resolve => { beganRead = resolve; });
  const held = new Promise<void>(resolve => { releaseRead = resolve; });
  const session = createMobileSession({
    store: { load: async () => local, save: async value => { local = structuredClone(value); } },
    credentials: { get: async key => secrets.get(key) ?? null, set: async (key, value) => { secrets.set(key, value); } },
    random: { uuid: () => deviceId, token: async () => 'ab'.repeat(32) },
    fetch: async request => {
      const path = new URL(request.url).pathname;
      if (path === '/connection') return Response.json({ server_id: serverId, protocol_version: 1, pairing_available: true });
      if (path === '/pairing/claim' || path === '/device') return Response.json({ server_id: serverId, device: { id: deviceId, name: '我的手机', created_at: 1, revoked_at: null } });
      assert.equal(path, `/projects/${projectId}/jobs/${jobId}`);
      if (++reads === 2) { beganRead(); await held; }
      return Response.json({ id: jobId, project_id: projectId, status: reads >= 3 ? 'completed' : 'running' });
    },
    socket: (_url, _headers, observer) => { deliver = observer.message; return { close: () => {} }; },
  });
  await session.hydrate(); await session.pair('http://192.168.1.8:8001', '246810', '我的手机');
  const stop = session.watchJob(projectId, jobId, { job: value => { observed.push(value.status); }, error: error => { throw error; } });
  await new Promise(resolve => setImmediate(resolve));
  deliver({}); await started; deliver({}); releaseRead();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(observed.at(-1), 'completed');
  stop(); session.dispose();
});

for (const action of ['unsubscribe', 'background']) {
  test(`an observer callback that chooses ${action} cannot open an orphaned authenticated socket`, async () => {
    let local: unknown = null, opened = 0, closed = 0, deliveries = 0;
    const secrets = new Map<string, string>();
    const session = createMobileSession({
      store: { load: async () => local, save: async value => { local = structuredClone(value); } },
      credentials: { get: async key => secrets.get(key) ?? null, set: async (key, value) => { secrets.set(key, value); } },
      random: { uuid: () => deviceId, token: async () => 'ab'.repeat(32) },
      fetch: async request => {
        const path = new URL(request.url).pathname;
        if (path === '/connection') return Response.json({ server_id: serverId, protocol_version: 1, pairing_available: true });
        if (path === '/pairing/claim' || path === '/device') return Response.json({ server_id: serverId, device: { id: deviceId, name: '我的手机', created_at: 1, revoked_at: null } });
        assert.equal(path, `/projects/${projectId}/jobs/${jobId}`);
        return Response.json({ id: jobId, project_id: projectId, status: 'running' });
      },
      socket: () => { opened++; return { close: () => { closed++; } }; },
    });
    await session.hydrate(); await session.pair('http://192.168.1.8:8001', '246810', '我的手机');
    let stop = () => {};
    stop = session.watchJob(projectId, jobId, { job: () => {
      deliveries++;
      if (action === 'unsubscribe') stop();
      else void session.setForeground(false);
    }, error: error => { throw error; } });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(deliveries, 1);
    assert.equal(opened, 0);
    await session.setForeground(false);
    stop(); session.dispose();
    assert.equal(closed, 0, 'no socket exists after the callback relinquished ownership');
  });
}

test('checking the same computer retains the cache identity when HTTP verification fails', async () => {
  let local: unknown = null, checking = false;
  const secrets = new Map<string, string>();
  let releaseCheck!: () => void;
  let beganCheck!: () => void;
  const started = new Promise<void>(resolve => { beganCheck = resolve; });
  const held = new Promise<void>(resolve => { releaseCheck = resolve; });
  const session = createMobileSession({
    store: { load: async () => local, save: async value => { local = structuredClone(value); } },
    credentials: { get: async key => secrets.get(key) ?? null, set: async (key, value) => { secrets.set(key, value); } },
    random: { uuid: () => deviceId, token: async () => 'ab'.repeat(32) },
    fetch: async request => {
      if (new URL(request.url).pathname === '/connection') {
        if (checking) { beganCheck(); await held; throw new Error('computer offline'); }
        return Response.json({ server_id: serverId, protocol_version: 1, pairing_available: true });
      }
      return Response.json({ server_id: serverId, device: { id: deviceId, name: '我的手机', created_at: 1, revoked_at: null } });
    },
  });
  await session.hydrate(); await session.pair('http://192.168.1.8:8001', '246810', '我的手机');
  checking = true;
  const verification = session.verify().catch(error => error);
  await started;
  const inProgress = session.getSnapshot();
  releaseCheck(); await verification;
  assert.equal(inProgress.connection, 'checking');
  assert.equal(inProgress.server?.deviceId, deviceId);
  assert.equal(session.getSnapshot().connection, 'disconnected');
  assert.equal(session.getSnapshot().server?.deviceId, deviceId);
  await assert.rejects(session.getProjects(), error => error instanceof MobileFailure && error.code === 'authorization_required');
  session.dispose();
});
