import assert from 'node:assert/strict';
import test from 'node:test';
import { createMobileSession } from '../src/data/session.ts';
import { createWorkbenchActions } from '../src/screens/workbench/actions.ts';
import type { JobRead, components } from '@llm-music/api-client';

const serverId = '9071c074-d9d8-4e27-bb84-32d8e58dc92f';
const deviceId = 'f6257463-40e5-4b09-9f10-e979b2e7864e';
const projectId = 'b28b8f6f-45a7-465b-b4e3-1ca13b85cb01';
const intentId = '5146ba0a-8a34-462c-ac92-f5e783de28f8';
const jobId = 'd38e9dd8-0779-4e61-9a9f-05757336d4ea';

test('a creator keeps editing after an unknown Generate and checks the frozen original request without resubmitting', async () => {
  let local: unknown = null, sequence = 0, posts = 0;
  const secrets = new Map<string, string>();
  let received: unknown;
  const session = createMobileSession({
    store: { load: async () => local, save: async value => { local = structuredClone(value); } },
    credentials: { get: async key => secrets.get(key) ?? null, set: async (key, value) => { secrets.set(key, value); } },
    random: { uuid: () => ++sequence === 1 ? deviceId : intentId, token: async () => 'ab'.repeat(32) },
    fetch: async request => {
      const path = new URL(request.url).pathname;
      if (path === '/connection') return Response.json({ server_id: serverId, protocol_version: 1, pairing_available: true });
      if (path === '/device' || path === '/pairing/claim') return Response.json({ server_id: serverId, device: { id: deviceId, name: '我的手机', created_at: 1, revoked_at: null } });
      if (path === `/projects/${projectId}/jobs/generate`) { posts++; received = await request.json(); throw new Error('accepted reply lost'); }
      if (path === `/requests/${intentId}`) return Response.json({ request_id: intentId, operation: 'generate', project_id: projectId, resource_type: 'job', resource_id: jobId, source_job_id: null });
      assert.equal(path, `/projects/${projectId}/jobs/${jobId}`);
      return Response.json({ id: jobId, project_id: projectId, status: 'running', operation: 'Generate' });
    },
  });
  await session.hydrate(); await session.pair('http://192.168.1.8:8001', '246810', '我的手机');
  await session.updateDraft(projectId, { style: '  清晨民谣  ', lyrics: '[Verse]\n雨落在窗前\n  ', seed: '42', maxSeconds: '' });
  const actions = createWorkbenchActions(session);
  await assert.rejects(actions.generate(projectId, []));
  await session.updateDraft(projectId, { lyrics: '新歌词仍可编辑' });
  const recovered = await actions.recover(intentId);
  assert.equal(recovered.phase, 'confirmed');
  assert.equal(recovered.resourceId, jobId);
  assert.deepEqual(received, { style: '清晨民谣', lyrics: '[Verse]\n雨落在窗前', seed: 42, max_seconds: 0 });
  assert.equal(session.getDraft(projectId).lyrics, '新歌词仍可编辑');
  assert.equal(posts, 1);
  session.dispose();
});

test('project creation validates the entered name and submits one trimmed creator intent', async () => {
  let local: unknown = null, sequence = 0;
  const secrets = new Map<string, string>();
  const bodies: unknown[] = [];
  const session = createMobileSession({
    store: { load: async () => local, save: async value => { local = structuredClone(value); } },
    credentials: { get: async key => secrets.get(key) ?? null, set: async (key, value) => { secrets.set(key, value); } },
    random: { uuid: () => ++sequence === 1 ? deviceId : intentId, token: async () => 'ab'.repeat(32) },
    fetch: async request => {
      const path = new URL(request.url).pathname;
      if (path === '/connection') return Response.json({ server_id: serverId, protocol_version: 1, pairing_available: true });
      if (path === '/device' || path === '/pairing/claim') return Response.json({ server_id: serverId, device: { id: deviceId, name: '我的手机', created_at: 1, revoked_at: null } });
      assert.equal(path, '/projects'); bodies.push(await request.json());
      return Response.json({ id: projectId, name: '雨声', description: '' }, { status: 201 });
    },
  });
  await session.hydrate(); await session.pair('http://192.168.1.8:8001', '246810', '我的手机');
  const actions = createWorkbenchActions(session);
  await assert.rejects(actions.createProject('   '), /project_name_required/);
  await assert.rejects(actions.createProject('名'.repeat(201)), /project_name_too_long/);
  const created = await actions.createProject('  雨声  ');
  assert.equal(created.resourceId, projectId);
  assert.deepEqual(bodies, [{ name: '雨声' }]);
  session.dispose();
});

test('retry waits for a confirmed terminal Job and a cancelled Job may retain cancel_requested', async () => {
  let local: unknown = null, sequence = 0, retries = 0;
  const secrets = new Map<string, string>();
  const original: JobRead = { id: jobId, project_id: projectId, operation: 'Generate', status: 'cancelled', phase: null,
    progress: null, inputs: { style: '原风格', lyrics: '原歌词', seed: 42 }, provenance: {}, error: null, result: null,
    recovery_required: false, cancel_requested: true, created_at: '2026-10-10T01:00:00Z', updated_at: '2026-10-10T01:00:12Z' };
  const session = createMobileSession({
    store: { load: async () => local, save: async value => { local = structuredClone(value); } },
    credentials: { get: async key => secrets.get(key) ?? null, set: async (key, value) => { secrets.set(key, value); } },
    random: { uuid: () => ++sequence === 1 ? deviceId : intentId, token: async () => 'ab'.repeat(32) },
    fetch: async request => {
      const path = new URL(request.url).pathname;
      if (path === '/connection') return Response.json({ server_id: serverId, protocol_version: 1, pairing_available: true });
      if (path === '/device' || path === '/pairing/claim') return Response.json({ server_id: serverId, device: { id: deviceId, name: '我的手机', created_at: 1, revoked_at: null } });
      assert.equal(path, `/projects/${projectId}/jobs/${jobId}/retry`);
      assert.equal(await request.text(), '', 'the server retains the original input'); retries++;
      return Response.json({ ...original, id: intentId, status: 'queued', cancel_requested: false });
    },
  });
  await session.hydrate(); await session.pair('http://192.168.1.8:8001', '246810', '我的手机');
  const actions = createWorkbenchActions(session);
  await assert.rejects(actions.retry({ ...original, status: 'running' }), /retry_unconfirmed/);
  await assert.rejects(actions.retry({ ...original, recovery_required: true }), /retry_unconfirmed/);
  const result = await actions.retry(original);
  assert.equal(result.resourceId, intentId); assert.equal(retries, 1);
  session.dispose();
});

test('an accepted Generate cannot create a second request while its original Job is missing from a stale or failed index', async () => {
  let local: unknown = null, sequence = 0, posts = 0;
  const secrets = new Map<string, string>();
  const session = createMobileSession({
    store: { load: async () => local, save: async value => { local = structuredClone(value); } },
    credentials: { get: async key => secrets.get(key) ?? null, set: async (key, value) => { secrets.set(key, value); } },
    random: { uuid: () => [deviceId, intentId, '949b88d7-607e-4c99-be9d-68065f961e18'][sequence++]!, token: async () => 'ab'.repeat(32) },
    fetch: async request => {
      const path = new URL(request.url).pathname;
      if (path === '/connection') return Response.json({ server_id: serverId, protocol_version: 1, pairing_available: true });
      if (path === '/device' || path === '/pairing/claim') return Response.json({ server_id: serverId, device: { id: deviceId, name: '手机', created_at: 1, revoked_at: null } });
      assert.equal(path, `/projects/${projectId}/jobs/generate`); posts++;
      return Response.json({ id: jobId, project_id: projectId, status: 'queued', operation: 'Generate' }, { status: 202 });
    },
  });
  await session.hydrate(); await session.pair('http://192.168.1.8:8001', '246810', '手机');
  await session.updateDraft(projectId, { style: '民谣', lyrics: '原歌词', seed: '42', maxSeconds: '5' });
  const actions = createWorkbenchActions(session);
  const accepted = await actions.generate(projectId, []); assert.equal(accepted.resourceId, jobId);
  await assert.rejects(actions.generate(projectId, []), /jobs_unconfirmed/);
  await assert.rejects(actions.generate(projectId, undefined), /jobs_unconfirmed/);
  assert.equal(posts, 1); session.dispose();
});

test('Candidate save waits for known Version records and a confirmed save remains known when the list is stale', async () => {
  let local: unknown = null, sequence = 0, saves = 0;
  const secrets = new Map<string, string>();
  const candidateId = '5f952066-87a3-40ab-a870-cd76acbd1c71', versionId = '949b88d7-607e-4c99-be9d-68065f961e18';
  const candidate: components['schemas']['CandidateRead'] = { id: candidateId, project_id: projectId, job_id: jobId,
    audio_asset_id: versionId, score_id: intentId, inputs: { style: '原风格', lyrics: '原歌词', seed: 42, max_seconds: 5 },
    provenance: {}, output_snapshot: {}, created_at: '2026-10-10T01:00:00Z' };
  const session = createMobileSession({
    store: { load: async () => local, save: async value => { local = structuredClone(value); } },
    credentials: { get: async key => secrets.get(key) ?? null, set: async (key, value) => { secrets.set(key, value); } },
    random: { uuid: () => [deviceId, intentId, jobId][sequence++]!, token: async () => 'ab'.repeat(32) },
    fetch: async request => {
      const path = new URL(request.url).pathname;
      if (path === '/connection') return Response.json({ server_id: serverId, protocol_version: 1, pairing_available: true });
      if (path === '/device' || path === '/pairing/claim') return Response.json({ server_id: serverId, device: { id: deviceId, name: '手机', created_at: 1, revoked_at: null } });
      assert.equal(path, `/projects/${projectId}/versions`); saves++;
      const body = await request.json(); return Response.json({ ...candidate, id: versionId, candidate_id: candidateId, name: body.name, parent_version_id: null }, { status: 201 });
    },
  });
  await session.hydrate(); await session.pair('http://192.168.1.8:8001', '246810', '手机');
  const actions = createWorkbenchActions(session);
  await assert.rejects(actions.saveVersion(candidate, '未核对的名字', undefined), /versions_unconfirmed/);
  assert.equal(saves, 0);
  const first = await actions.saveVersion(candidate, '  首版  ', []);
  const repeated = await actions.saveVersion(candidate, '后来改的名字', []);
  assert.equal(first.resourceId, versionId); assert.equal(repeated.resourceId, versionId); assert.equal(saves, 1);
  session.dispose();
});

for (const acceptedFirst of [true, false]) {
  test(`explicit unknown-save continuation reads first and ${acceptedFirst ? 'keeps the existing Version without another POST' : 'sends only the original frozen save when no Version exists'}`, async () => {
    let local: unknown = null, sequence = 0, saves = 0, reads = 0;
    const secrets = new Map<string, string>();
    const bodies: unknown[] = [];
    const candidateId = '5f952066-87a3-40ab-a870-cd76acbd1c71', versionId = '949b88d7-607e-4c99-be9d-68065f961e18';
    const candidate: components['schemas']['CandidateRead'] = { id: candidateId, project_id: projectId, job_id: jobId,
      audio_asset_id: versionId, score_id: intentId, inputs: { style: '原风格', lyrics: '原歌词', seed: 42, max_seconds: 5 },
      provenance: {}, output_snapshot: {}, created_at: '2026-10-10T01:00:00Z' };
    let saved: components['schemas']['VersionRead'] | undefined;
    const session = createMobileSession({
      store: { load: async () => local, save: async value => { local = structuredClone(value); } },
      credentials: { get: async key => secrets.get(key) ?? null, set: async (key, value) => { secrets.set(key, value); } },
      random: { uuid: () => ++sequence === 1 ? deviceId : intentId, token: async () => 'ab'.repeat(32) },
      fetch: async request => {
        const path = new URL(request.url).pathname;
        if (path === '/connection') return Response.json({ server_id: serverId, protocol_version: 1, pairing_available: true });
        if (path === '/device' || path === '/pairing/claim') return Response.json({ server_id: serverId, device: { id: deviceId, name: '手机', created_at: 1, revoked_at: null } });
        assert.equal(path, `/projects/${projectId}/versions`);
        if (request.method === 'GET') { reads++; return Response.json(saved ? [saved] : []); }
        const body = await request.json(); bodies.push(body); saves++;
        if (saves > 1) assert.ok(reads > 0, 'continuation must inspect saved records before writing');
        if (acceptedFirst || saves > 1) saved = { ...candidate, id: versionId, candidate_id: candidateId, name: body.name, parent_version_id: null };
        if (saves === 1) throw new Error('original save reply unavailable');
        return Response.json(saved, { status: 201 });
      },
    });
    await session.hydrate(); await session.pair('http://192.168.1.8:8001', '246810', '手机');
    const actions = createWorkbenchActions(session);
    await assert.rejects(actions.saveVersion(candidate, '  原名称  ', []));
    const intent = session.listIntents(projectId)[0]!;
    await session.updateTitleDraft({ kind: 'version', projectId, candidateId }, '后来输入的名称');
    const result = await actions.replay(intent.id);
    assert.equal(result.resourceId, versionId); assert.equal(saves, acceptedFirst ? 1 : 2);
    assert.ok(reads > 0);
    assert.ok(bodies.every(value => JSON.stringify(value) === JSON.stringify({ candidate_id: candidateId, name: '原名称' })));
    assert.equal(session.getTitleDraft({ kind: 'version', projectId, candidateId }), '后来输入的名称');
    session.dispose();
  });
}
