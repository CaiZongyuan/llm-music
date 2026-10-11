import assert from 'node:assert/strict';
import test from 'node:test';
import { createMobileSession, MobileFailure, normalizeServerUrl, type SessionOptions } from '../src/data/session.ts';
import { scopedKey, titleDraftKey } from '../src/data/local-state.ts';

const serverId = '9071c074-d9d8-4e27-bb84-32d8e58dc92f';
const secondServerId = '8c3c8c40-4b3b-47c0-b9c4-7f88b6f09f59';
const projectId = '02de6571-943d-441d-ad61-c4acb46dc2c9';
const requestId = '5146ba0a-8a34-462c-ac92-f5e783de28f8';
const jobId = '949b88d7-607e-4c99-be9d-68065f961e18';
const assetId = '805cecaa-c24a-42bd-ab63-801c07a53f17';
const address = 'http://192.168.1.8:8001';
const draft = { style: '独立流行，温暖女声', lyrics: '[Verse]\n雨落在窗前\n唱到天亮', seed: '42', maxSeconds: '40' };
const identity = (id = serverId) => Response.json({ server_id: id, protocol_version: 1, access_method: 'direct', pairing_available: false });

function localStore(initial: unknown = null) {
  let document = initial;
  return {
    load: async () => structuredClone(document),
    save: async (value: unknown) => { document = structuredClone(value); },
    value: () => structuredClone(document),
  };
}
function options(store: ReturnType<typeof localStore>, fetch: SessionOptions['fetch']): SessionOptions {
  return { store, random: { uuid: () => requestId }, fetch };
}

test('one address connects with only public identity and reads projects without a device credential', async () => {
  const requests: Request[] = [];
  const session = createMobileSession(options(localStore(), async request => {
    requests.push(request);
    assert.equal(request.headers.has('authorization'), false);
    const path = new URL(request.url).pathname;
    if (path === '/connection') return identity();
    assert.equal(path, '/projects');
    return Response.json([]);
  }));
  await session.hydrate();
  await session.connect('  http://192.168.1.8:8001/  ');
  assert.equal(session.getSnapshot().connection, 'connected');
  assert.deepEqual(session.getSnapshot().server, { serverId, baseUrl: address, accessMethod: 'direct' });
  assert.deepEqual(await session.getProjects(), []);
  assert.deepEqual(requests.map(request => [request.method, new URL(request.url).pathname]), [['GET', '/connection'], ['GET', '/projects']]);
  session.dispose();
});

test('a saved paired registry upgrades to direct on cold start while preserving SID drafts, titles and frozen intent', async () => {
  const body = { style: draft.style, lyrics: draft.lyrics, seed: 42, max_seconds: 40 };
  const intent = { id: requestId, serverId, operation: 'generate', projectId, body, phase: 'unknown' };
  const store = localStore({ version: 1, activeServerId: serverId,
    servers: { [serverId]: { serverId, baseUrl: address, deviceName: '旧手机', credentialExpected: true } },
    drafts: { [scopedKey(serverId, projectId)]: draft },
    titles: { [titleDraftKey(serverId, { kind: 'project' })]: '雨后手记' },
    intents: { [scopedKey(serverId, requestId)]: intent },
  });
  const seen: string[] = [];
  const session = createMobileSession({ ...options(store, async request => {
    assert.equal(request.method, 'GET');
    assert.equal(request.headers.has('authorization'), false);
    const path = new URL(request.url).pathname; seen.push(path);
    if (path === '/connection') return identity();
    assert.equal(path, '/requests/' + requestId);
    return Response.json({ error: { code: 'request_not_found', message: '尚未接受', recovery: '先读取原请求' } }, { status: 404 });
  }), credentials: { get: async () => { throw new Error('SecureStore must not be read'); }, set: async () => { throw new Error('SecureStore must not be written'); } } });
  await session.hydrate();
  assert.equal(session.getSnapshot().connection, 'connected');
  assert.equal(session.getSnapshot().storage, 'ready');
  assert.deepEqual(session.getDraft(projectId), draft);
  assert.equal(session.getTitleDraft({ kind: 'project' }), '雨后手记');
  assert.deepEqual(session.listIntents(), [intent]);
  assert.deepEqual(seen, ['/connection', '/requests/' + requestId]);
  session.dispose();
  const restarted = createMobileSession(options(store, async request => new URL(request.url).pathname === '/connection'
    ? identity() : Response.json({ error: { code: 'request_not_found' } }, { status: 404 })));
  await restarted.hydrate();
  assert.equal(restarted.getSnapshot().connection, 'connected');
  assert.deepEqual(restarted.getDraft(projectId), draft);
  assert.equal(restarted.getTitleDraft({ kind: 'project' }), '雨后手记');
  restarted.dispose();
});

test('a lost direct Generate reply recovers the original Job after cold start without replaying or using the edited draft', async () => {
  const store = localStore();
  let accepted = false, posts = 0;
  const sessionOptions = options(store, async request => {
    assert.equal(request.headers.has('authorization'), false);
    const path = new URL(request.url).pathname;
    if (path === '/connection') return identity();
    if (request.method === 'POST') {
      assert.equal(path, `/projects/${projectId}/jobs/generate`);
      assert.equal(request.headers.get('idempotency-key'), requestId);
      assert.deepEqual(await request.json(), { style: draft.style, lyrics: draft.lyrics, seed: 42, max_seconds: 40 });
      posts++; accepted = true; throw new Error('response lost after acceptance');
    }
    if (path === '/requests/' + requestId) {
      assert.equal(accepted, true);
      return Response.json({ request_id: requestId, operation: 'generate', resource_type: 'job', resource_id: jobId, project_id: projectId, source_job_id: null });
    }
    assert.equal(path, `/projects/${projectId}/jobs/${jobId}`);
    return Response.json({ id: jobId, project_id: projectId, status: 'completed' });
  });
  const first = createMobileSession(sessionOptions);
  await first.hydrate(); await first.connect(address); await first.updateDraft(projectId, draft);
  const intent = await first.prepareGenerate(projectId);
  await assert.rejects(first.submitIntent(intent.id));
  await first.updateDraft(projectId, { style: '编辑后的另一种风格', lyrics: '编辑后的歌词' });
  first.dispose();
  const restarted = createMobileSession(sessionOptions);
  await restarted.hydrate();
  assert.equal(restarted.getSnapshot().connection, 'connected');
  assert.equal(posts, 1);
  assert.equal(restarted.listIntents()[0]?.phase, 'confirmed');
  assert.equal(restarted.listIntents()[0]?.resourceId, jobId);
  const recovered = restarted.listIntents()[0];
  assert.deepEqual(recovered?.operation === 'generate' ? recovered.body : null,
    { style: draft.style, lyrics: draft.lyrics, seed: 42, max_seconds: 40 });
  assert.equal(restarted.getDraft(projectId).lyrics, '编辑后的歌词');
  restarted.dispose();
});

test('offline cold start retains local work and recovers at the same address without reenrollment', async () => {
  const store = localStore(); let offline = false;
  const sessionOptions = options(store, async () => { if (offline) throw new Error('offline'); return identity(); });
  const first = createMobileSession(sessionOptions);
  await first.hydrate(); await first.connect(address); await first.updateDraft(projectId, draft); first.dispose();
  offline = true;
  const restarted = createMobileSession(sessionOptions); await restarted.hydrate();
  assert.equal(restarted.getSnapshot().connection, 'disconnected');
  assert.equal(restarted.getSnapshot().storage, 'ready');
  assert.deepEqual(restarted.getDraft(projectId), draft);
  await restarted.updateDraft(projectId, { lyrics: '断网时仍保留的歌词' });
  offline = false; await restarted.verify();
  assert.equal(restarted.getSnapshot().connection, 'connected');
  assert.equal(restarted.getDraft(projectId).lyrics, '断网时仍保留的歌词');
  restarted.dispose();
});

test('an address returning a different SID blocks cold recovery until an explicit connection and keeps the original partition', async () => {
  const store = localStore(); let current = serverId;
  const sessionOptions = options(store, async () => identity(current));
  const first = createMobileSession(sessionOptions);
  await first.hydrate(); await first.connect(address); await first.updateDraft(projectId, draft); first.dispose();
  current = secondServerId;
  const restarted = createMobileSession(sessionOptions); await restarted.hydrate();
  assert.equal(restarted.getSnapshot().connection, 'server_mismatch');
  assert.equal(restarted.getSnapshot().server?.serverId, serverId);
  assert.deepEqual(restarted.getDraft(projectId), draft);
  await assert.rejects(restarted.prepareGenerate(projectId), error => error instanceof MobileFailure && error.code === 'connection_required');
  await restarted.connect(address);
  assert.equal(restarted.getSnapshot().server?.serverId, secondServerId);
  assert.equal(restarted.getDraft(projectId).lyrics, '');
  current = serverId; await restarted.switchServer(serverId);
  assert.deepEqual(restarted.getDraft(projectId), draft);
  restarted.dispose();
});

test('changing a computer address with the same SID retains its drafts and updates the persisted address', async () => {
  const store = localStore(); const sessionOptions = options(store, async () => identity());
  const first = createMobileSession(sessionOptions);
  await first.hydrate(); await first.connect(address); await first.updateDraft(projectId, draft);
  await first.connect('http://192.168.1.9:8001');
  assert.deepEqual(first.getDraft(projectId), draft); first.dispose();
  const restarted = createMobileSession(sessionOptions); await restarted.hydrate();
  assert.equal(restarted.getSnapshot().server?.baseUrl, 'http://192.168.1.9:8001');
  assert.deepEqual(restarted.getDraft(projectId), draft); restarted.dispose();
});

test('direct WebSocket and original audio requests use the selected origin without credentials', async () => {
  let opened: (() => void) | undefined;
  const socketOpened = new Promise<void>(resolve => { opened = resolve; });
  const session = createMobileSession({ ...options(localStore(), async request => {
    assert.equal(request.headers.has('authorization'), false);
    const path = new URL(request.url).pathname;
    if (path === '/connection') return identity();
    if (path.endsWith('/jobs/' + jobId)) return Response.json({ id: jobId, project_id: projectId, status: 'running' });
    assert.equal(path, `/projects/${projectId}/assets/${assetId}`);
    return Response.json({ id: assetId, project_id: projectId, kind: 'generated_audio' });
  }), socket: (url, headers) => {
    assert.equal(url, `ws://192.168.1.8:8001/projects/${projectId}/jobs/${jobId}/events`);
    assert.deepEqual(headers, {}); opened!(); return { close() {} };
  } });
  await session.hydrate(); await session.connect(address);
  const stop = session.watchJob(projectId, jobId, { job() {}, error(error) { throw error; } });
  await socketOpened;
  const lease = await session.authorizeMedia(projectId, assetId);
  const request = lease.createRequest();
  assert.equal(request.url, `${address}/projects/${projectId}/assets/${assetId}/content`);
  assert.equal(request.headers.has('authorization'), false);
  assert.equal(lease.deviceId, undefined);
  assert.equal(lease.isCurrent(), true);
  await session.setForeground(false);
  assert.equal(lease.isCurrent(), false);
  assert.throws(() => lease.createRequest()); stop(); session.dispose();
});

test('endpoint normalization rejects embedded credentials and other origins hidden in URL components', () => {
  for (const value of ['http://name:secret@192.168.1.8:8001', address + '/projects', address + '?token=secret', address + '#fragment', 'file:///tmp/music']) {
    assert.throws(() => normalizeServerUrl(value), error => error instanceof MobileFailure && error.code === 'invalid_address');
  }
});
