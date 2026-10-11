import assert from 'node:assert/strict';
import test from 'node:test';
import type { components, JobRead } from '@llm-music/api-client';
import { createMobileSession } from '../src/data/session.ts';
import { createWorkbenchActions, generationBlocked, pendingJobRecords } from '../src/screens/workbench/actions.ts';
import { createCreatorIntentStore } from '../src/screens/workbench/intent-store.ts';

const serverId = '9071c074-d9d8-4e27-bb84-32d8e58dc92f', deviceId = 'f6257463-40e5-4b09-9f10-e979b2e7864e';
const projectId = 'b28b8f6f-45a7-465b-b4e3-1ca13b85cb01', intentId = '5146ba0a-8a34-462c-ac92-f5e783de28f8';
const jobId = 'd38e9dd8-0779-4e61-9a9f-05757336d4ea', candidateId = '5f952066-87a3-40ab-a870-cd76acbd1c71';
const versionId = '949b88d7-607e-4c99-be9d-68065f961e18';
const candidate: components['schemas']['CandidateRead'] = { id: candidateId, project_id: projectId, job_id: jobId,
  audio_asset_id: versionId, score_id: intentId, inputs: { style: '原风格', lyrics: '原歌词', seed: 42, max_seconds: 5 },
  provenance: {}, output_snapshot: {}, created_at: '2026-10-10T01:00:00Z' };

async function connected(fetch: (request: Request) => Promise<Response>) {
  let local: unknown = null, sequence = 0;
  const secrets = new Map<string, string>();
  const session = createMobileSession({
    store: { load: async () => local, save: async value => { local = structuredClone(value); } },
    credentials: { get: async key => secrets.get(key) ?? null, set: async (key, value) => { secrets.set(key, value); } },
    random: { uuid: () => ++sequence === 1 ? deviceId : intentId, token: async () => 'ab'.repeat(32) },
    fetch: async request => {
      const path = new URL(request.url).pathname;
      if (path === '/connection') return Response.json({ server_id: serverId, protocol_version: 1, pairing_available: true });
      if (path === '/device' || path === '/pairing/claim') return Response.json({ server_id: serverId,
        device: { id: deviceId, name: '手机', created_at: 1, revoked_at: null } });
      return fetch(request);
    },
  });
  await session.hydrate(); await session.pair('http://192.168.1.8:8001', '246810', '手机');
  return session;
}

test('the mounted intent view changes from no save to unknown to confirmed without replaying an accepted save', async t => {
  let posts = 0, reads = 0, saved: components['schemas']['VersionRead'] | undefined;
  const session = await connected(async request => {
    assert.equal(new URL(request.url).pathname, `/projects/${projectId}/versions`);
    if (request.method === 'GET') { reads++; return Response.json(saved ? [saved] : []); }
    posts++;
    const body = await request.json();
    saved = { ...candidate, id: versionId, candidate_id: candidateId, name: body.name, parent_version_id: null };
    return Response.json({ error: { code: 'accepted_reply_unavailable', message: 'Accepted reply unavailable', recovery: 'Read the original save' } }, { status: 503 });
  });
  t.after(() => session.dispose());
  const store = createCreatorIntentStore(session, projectId), actions = createWorkbenchActions(session);
  const initial = store.getSnapshot(); assert.equal(initial.length, 0);
  assert.equal(store.getSnapshot(), initial, 'unchanged external snapshots must remain stable for React');
  const observed: string[] = [];
  const unsubscribe = store.subscribe(() => { observed.push(...store.getSnapshot().map(intent => intent.phase)); });
  t.after(unsubscribe);
  await assert.rejects(actions.saveVersion(candidate, '  原保存名称  ', []));
  const unknown = store.getSnapshot();
  assert.notEqual(unknown, initial); assert.equal(unknown[0]?.phase, 'unknown');
  assert.equal(store.getSnapshot(), unknown); assert.ok(observed.includes('prepared')); assert.ok(observed.includes('unknown'));
  await session.updateTitleDraft({ kind: 'version', projectId, candidateId }, '后来输入的名称');
  const pending = store.getSnapshot()[0]!;
  assert.equal(pending.operation, 'save_version');
  if (pending.operation !== 'save_version') throw new Error('Expected a save intent');
  assert.equal(pending.body.name, '原保存名称');
  const result = await actions.recover(pending.id);
  assert.equal(result.resourceId, versionId);
  assert.equal(store.getSnapshot()[0]?.phase, 'confirmed'); assert.ok(observed.includes('confirmed'));
  assert.equal(posts, 1); assert.ok(reads > 0, 'recovery reads the existing Version');
});

for (const operation of ['generate', 'retry'] as const) test(`a live ${operation} view blocks another event while the confirmed child is absent from an unchanged Job index`, async t => {
  const original: JobRead = { id: jobId, project_id: projectId, operation: 'Generate', status: 'cancelled', phase: null,
    progress: null, inputs: candidate.inputs, provenance: {}, error: null, result: null, recovery_required: false,
    cancel_requested: true, created_at: candidate.created_at, updated_at: candidate.created_at };
  const child = { ...original, id: versionId, status: 'completed', cancel_requested: false } satisfies JobRead;
  let posts = 0;
  const session = await connected(async request => {
    assert.equal(request.method, 'POST'); posts++;
    assert.equal(new URL(request.url).pathname, operation === 'generate' ? `/projects/${projectId}/jobs/generate` : `/projects/${projectId}/jobs/${jobId}/retry`);
    return Response.json(child, { status: 202 });
  });
  t.after(() => session.dispose());
  await session.updateDraft(projectId, { style: '原风格', lyrics: '原歌词', seed: '42', maxSeconds: '5' });
  const store = createCreatorIntentStore(session, projectId), actions = createWorkbenchActions(session);
  const jobs = operation === 'generate' ? [] : [original];
  assert.equal(generationBlocked(store.getSnapshot(), jobs), false);
  const prepared = operation === 'generate' ? await session.prepareGenerate(projectId)
    : await session.prepareIntent({ operation: 'retry', projectId, jobId });
  assert.equal(generationBlocked(store.getSnapshot(), jobs), true);
  const repeat = () => operation === 'generate' ? actions.generate(projectId, jobs) : actions.retry(original, jobs);
  await assert.rejects(repeat(), /jobs_unconfirmed/); assert.equal(posts, 0);
  await session.submitIntent(prepared.id);
  assert.equal(store.getSnapshot()[0]?.phase, 'confirmed');
  assert.equal(pendingJobRecords(store.getSnapshot(), jobs)[0]?.resourceId, versionId);
  assert.equal(generationBlocked(store.getSnapshot(), jobs), true);
  await assert.rejects(repeat(), /jobs_unconfirmed/); assert.equal(posts, 1);
  assert.equal(generationBlocked(store.getSnapshot(), [...jobs, child]), false);
});

test('a mounted Library view receives its unknown Project intent and the existing action cannot create a second request', async t => {
  let posts = 0;
  const session = await connected(async request => {
    assert.equal(new URL(request.url).pathname, '/projects'); posts++;
    return Response.json({ error: { code: 'accepted_reply_unavailable', message: 'Accepted reply unavailable', recovery: 'Read original Project' } }, { status: 503 });
  });
  t.after(() => session.dispose());
  const store = createCreatorIntentStore(session), actions = createWorkbenchActions(session);
  const first = store.getSnapshot(); assert.equal(first.length, 0);
  await assert.rejects(actions.createProject('  原项目名称  '));
  const next = store.getSnapshot(); assert.notEqual(next, first); assert.equal(next[0]?.phase, 'unknown');
  assert.equal(next[0]?.operation, 'create_project');
  await assert.rejects(actions.createProject('另一个名称'), /intent_pending/);
  assert.equal(posts, 1); assert.equal(store.getSnapshot()[0]?.id, next[0]?.id);
});
