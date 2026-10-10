import assert from 'node:assert/strict';
import test from 'node:test';
import { createMobileSession, type IntentInput } from '../src/data/session.ts';

const serverId = '9071c074-d9d8-4e27-bb84-32d8e58dc92f';
const projectId = 'b28b8f6f-45a7-465b-b4e3-1ca13b85cb01';
const deviceId = 'f6257463-40e5-4b09-9f10-e979b2e7864e';
const jobId = 'd38e9dd8-0779-4e61-9a9f-05757336d4ea';
const requestId = '5146ba0a-8a34-462c-ac92-f5e783de28f8';

test('an accepted Generate with a lost response cold-recovers its original Job and frozen input without replay', async () => {
  let local: unknown = null;
  const secrets = new Map<string, string>();
  let uuids = 0, submissions = 0;
  let submitted: unknown;
  const job = { id: jobId, project_id: projectId, status: 'queued', operation: 'Generate' };
  const options = {
    store: { load: async () => local, save: async (value: unknown) => { local = structuredClone(value); } },
    credentials: { get: async (key: string) => secrets.get(key) ?? null, set: async (key: string, value: string) => { secrets.set(key, value); } },
    random: { uuid: () => ++uuids === 1 ? deviceId : requestId, token: async () => 'ab'.repeat(32) },
    fetch: async (request: Request) => {
      const path = new URL(request.url).pathname;
      if (path === '/connection') return Response.json({ server_id: serverId, protocol_version: 1, pairing_available: true });
      if (path === '/pairing/claim' || path === '/device') return Response.json({ server_id: serverId, device: { id: deviceId, name: '我的手机', created_at: 1, revoked_at: null } });
      if (path === `/projects/${projectId}/jobs/generate`) {
        submissions++; submitted = await request.json();
        assert.equal(request.headers.get('idempotency-key'), requestId);
        assert.ok(JSON.stringify(local).includes(requestId), 'the request identity is durable before acceptance');
        throw new Error('accepted response lost');
      }
      if (path === '/requests/' + requestId) return Response.json({ request_id: requestId, operation: 'generate', project_id: projectId, resource_type: 'job', resource_id: jobId, source_job_id: null, created_at: '2026-10-10T00:00:00Z' });
      assert.equal(path, `/projects/${projectId}/jobs/${jobId}`);
      return Response.json(job);
    },
  };
  const first = createMobileSession(options);
  await first.hydrate(); await first.pair('http://192.168.1.8:8001', '246810', '我的手机');
  await first.updateDraft(projectId, { style: '慢速民谣', lyrics: '[Verse]\n雨落在窗前', seed: '42', maxSeconds: '' });
  const intent = await first.prepareGenerate(projectId);
  await first.updateDraft(projectId, { lyrics: '后来修改的歌词' });
  await assert.rejects(first.submitIntent(intent.id));
  first.dispose();
  const restarted = createMobileSession(options);
  await restarted.hydrate();
  assert.equal(submissions, 1);
  assert.deepEqual(submitted, { style: '慢速民谣', lyrics: '[Verse]\n雨落在窗前', seed: 42, max_seconds: 0 });
  assert.equal(restarted.listIntents(projectId)[0].phase, 'confirmed');
  assert.equal(restarted.listIntents(projectId)[0].resourceId, jobId);
  assert.equal(restarted.getDraft(projectId).lyrics, '后来修改的歌词');
  restarted.dispose();
});

for (const input of [
  { operation: 'create_project', body: { name: '雨声', description: '新项目' } },
  { operation: 'retry', projectId, jobId },
] satisfies IntentInput[]) {
  test(`${input.operation}: receipt 404 keeps the original identity and only explicit replay resubmits frozen input`, async () => {
    let local: unknown = null, uuids = 0, posts = 0;
    const secrets = new Map<string, string>();
    const received: { key: string | null; body: string; path: string }[] = [];
    const options = {
      store: { load: async () => local, save: async (value: unknown) => { local = structuredClone(value); } },
      credentials: { get: async (key: string) => secrets.get(key) ?? null, set: async (key: string, value: string) => { secrets.set(key, value); } },
      random: { uuid: () => ++uuids === 1 ? deviceId : requestId, token: async () => 'ab'.repeat(32) },
      fetch: async (request: Request) => {
        const path = new URL(request.url).pathname;
        if (path === '/connection') return Response.json({ server_id: serverId, protocol_version: 1, pairing_available: true });
        if (path === '/pairing/claim' || path === '/device') return Response.json({ server_id: serverId, device: { id: deviceId, name: '我的手机', created_at: 1, revoked_at: null } });
        if (path === '/requests/' + requestId) return Response.json({ error: { code: 'request_not_found', message: '仍未确认', recovery: '稍后查询' } }, { status: 404 });
        assert.equal(request.method, 'POST');
        received.push({ key: request.headers.get('idempotency-key'), body: await request.text(), path });
        if (++posts === 1) throw new Error('unknown response');
        return Response.json(input.operation === 'create_project' ? { id: projectId, name: '雨声', description: '新项目', created_at: '2026-10-10T00:00:00Z' }
          : { id: requestId, project_id: projectId, status: 'queued', operation: 'Generate' });
      },
    };
    const first = createMobileSession(options);
    await first.hydrate(); await first.pair('http://192.168.1.8:8001', '246810', '我的手机');
    const intent = await first.prepareIntent(input);
    await assert.rejects(first.submitIntent(intent.id)); first.dispose();
    const restarted = createMobileSession(options);
    await restarted.hydrate();
    assert.equal(restarted.listIntents()[0].phase, 'unknown');
    assert.equal(posts, 1);
    await assert.rejects(restarted.prepareIntent(input), error => error instanceof Error && error.message === 'intent_pending');
    await restarted.recoverIntent(intent.id);
    assert.equal(posts, 1);
    await restarted.replayIntent(intent.id);
    assert.equal(restarted.listIntents()[0].phase, 'confirmed');
    assert.deepEqual(received[1], received[0]);
    assert.equal(received[0].path, input.operation === 'create_project' ? '/projects' : `/projects/${projectId}/jobs/${jobId}/retry`);
    if (input.operation === 'retry') assert.equal(received[0].body, '', 'retry belongs to the original Job snapshot, with no reconstructed input');
    restarted.dispose();
  });
}

for (const actualName of ['雨声 · 首版', '电脑上已保存的名称']) {
  test(`Version save resolves a lost response by Candidate and retains actual saved name ${actualName}`, async () => {
    let local: unknown = null, uuids = 0, saves = 0;
    const secrets = new Map<string, string>();
    const candidateId = '5f952066-87a3-40ab-a870-cd76acbd1c71';
    const versionId = '949b88d7-607e-4c99-be9d-68065f961e18';
    const input = { candidate_id: candidateId, name: '雨声 · 首版', parent_version_id: null };
    let savedBody: unknown;
    const options = {
      store: { load: async () => local, save: async (value: unknown) => { local = structuredClone(value); } },
      credentials: { get: async (key: string) => secrets.get(key) ?? null, set: async (key: string, value: string) => { secrets.set(key, value); } },
      random: { uuid: () => ++uuids === 1 ? deviceId : requestId, token: async () => 'ab'.repeat(32) },
      fetch: async (request: Request) => {
        const path = new URL(request.url).pathname;
        if (path === '/connection') return Response.json({ server_id: serverId, protocol_version: 1, pairing_available: true });
        if (path === '/pairing/claim' || path === '/device') return Response.json({ server_id: serverId, device: { id: deviceId, name: '我的手机', created_at: 1, revoked_at: null } });
        assert.equal(path, `/projects/${projectId}/versions`);
        if (request.method === 'POST') {
          assert.equal(request.headers.has('idempotency-key'), false, 'Version save uses the Candidate uniqueness contract');
          saves++; savedBody = await request.json(); throw new Error('accepted Version response lost');
        }
        return Response.json([{ id: versionId, project_id: projectId, candidate_id: candidateId, name: actualName, parent_version_id: null }]);
      },
    };
    const first = createMobileSession(options);
    await first.hydrate(); await first.pair('http://192.168.1.8:8001', '246810', '我的手机');
    const intent = await first.prepareIntent({ operation: 'save_version', projectId, body: input });
    input.name = '后来的输入';
    await assert.rejects(first.submitIntent(intent.id)); first.dispose();
    const restarted = createMobileSession(options);
    await restarted.hydrate();
    const recovered = restarted.listIntents()[0];
    assert.equal(recovered.resourceId, versionId);
    assert.equal(recovered.phase, actualName === '雨声 · 首版' ? 'confirmed' : 'rejected');
    assert.deepEqual(savedBody, { candidate_id: candidateId, name: '雨声 · 首版', parent_version_id: null });
    await restarted.replayIntent(intent.id);
    assert.equal(saves, 1, 'known saved Candidates cannot trigger a replacement save');
    restarted.dispose();
  });
}

for (const sourceOperation of ['GenerateFromScore', 'Cover']) {
  test(`${sourceOperation}: an explicit null save parent cold-recovers the producer's retained source parent`, async () => {
    let local: unknown = null, uuids = 0, saves = 0;
    const secrets = new Map<string, string>();
    const candidateId = '5f952066-87a3-40ab-a870-cd76acbd1c71';
    const versionId = '949b88d7-607e-4c99-be9d-68065f961e18';
    const sourceParent = 'ac1681a6-81ca-4f1c-bf98-b53e2b601155';
    let savedBody: unknown;
    const options = {
      store: { load: async () => local, save: async (value: unknown) => { local = structuredClone(value); } },
      credentials: { get: async (key: string) => secrets.get(key) ?? null, set: async (key: string, value: string) => { secrets.set(key, value); } },
      random: { uuid: () => ++uuids === 1 ? deviceId : requestId, token: async () => 'ab'.repeat(32) },
      fetch: async (request: Request) => {
        const path = new URL(request.url).pathname;
        if (path === '/connection') return Response.json({ server_id: serverId, protocol_version: 1, pairing_available: true });
        if (path === '/pairing/claim' || path === '/device') return Response.json({ server_id: serverId, device: { id: deviceId, name: '我的手机', created_at: 1, revoked_at: null } });
        if (path === `/projects/${projectId}/candidates/${candidateId}`) return Response.json({
          id: candidateId, project_id: projectId, inputs: { source_score_id: jobId, parent_version_id: sourceParent,
            ...(sourceOperation === 'Cover' ? { mode: 'full' } : {}) },
        });
        assert.equal(path, `/projects/${projectId}/versions`);
        if (request.method === 'POST') { saves++; savedBody = await request.json(); throw new Error('accepted Version response lost'); }
        return Response.json([{ id: versionId, project_id: projectId, candidate_id: candidateId, name: '雨声 · 首版', parent_version_id: sourceParent }]);
      },
    };
    const first = createMobileSession(options);
    await first.hydrate(); await first.pair('http://192.168.1.8:8001', '246810', '我的手机');
    const intent = await first.prepareIntent({ operation: 'save_version', projectId, body: { candidate_id: candidateId, name: '雨声 · 首版', parent_version_id: null } });
    await assert.rejects(first.submitIntent(intent.id)); first.dispose();
    const restarted = createMobileSession(options); await restarted.hydrate();
    const recovered = restarted.listIntents()[0];
    assert.equal(recovered.phase, 'confirmed');
    assert.equal(recovered.resourceId, versionId);
    assert.equal(recovered.error, undefined);
    assert.deepEqual(savedBody, { candidate_id: candidateId, name: '雨声 · 首版', parent_version_id: null });
    await restarted.replayIntent(intent.id);
    assert.equal(saves, 1);
    restarted.dispose();
  });
}
