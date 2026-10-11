import assert from 'node:assert/strict';
import test from 'node:test';
import { createMusicClient } from '@llm-music/api-client';
import { createPairingAdmin } from '../../web/src/features/mobile-pairing/controller.ts';

const serverId = '9071c074-d9d8-4e27-bb84-32d8e58dc92f';
const firstId = 'b28b8f6f-45a7-465b-b4e3-1ca13b85cb01';
const secondId = '5146ba0a-8a34-462c-ac92-f5e783de28f8';

test('an accepted pairing-window response lost after renewal hides the previous code and recovers only its public summary', async () => {
  let created = 0;
  let challenge: { id: string; expires_at: number; attempts_remaining: number; status: string } | null = null;
  const client = createMusicClient({ baseUrl: 'http://127.0.0.1:19000', fetch: async request => {
    const path = new URL(request.url).pathname;
    if (path === '/pairing/owner') return Response.json({ server_id: serverId, owner_csrf: 'owner-only', lan_address: 'http://192.168.1.8:19001', challenge });
    if (path === '/pairing/devices') return Response.json([]);
    assert.equal(path, '/pairing/challenges'); assert.equal(request.headers.get('x-owner-csrf'), 'owner-only');
    challenge = { id: ++created === 1 ? firstId : secondId, expires_at: Date.now() / 1000 + 120, attempts_remaining: 5, status: 'active' };
    if (created === 2) throw new Error('created reply lost');
    return Response.json({ ...challenge, code: '246810' }, { status: 201 });
  } });
  const admin = createPairingAdmin(client);
  await admin.refresh(); await admin.open();
  assert.equal(admin.getSnapshot().code?.code, '246810');
  await assert.rejects(admin.open());
  assert.equal(admin.getSnapshot().code, null);
  assert.equal(admin.getSnapshot().owner?.challenge?.id, secondId);
  assert.equal(admin.getSnapshot().unknownOpen, true);
  assert.equal(created, 2, 'readback must not automatically open a third pairing window');
});

test('closing a window accepts its bodyless 204 and retains existing authorized devices', async () => {
  let closed = false, deletes = 0;
  const deviceId = 'f6257463-40e5-4b09-9f10-e979b2e7864e';
  const device = { id: deviceId, name: '已配对手机', created_at: 1, revoked_at: null };
  const client = createMusicClient({ baseUrl: 'http://127.0.0.1:19000', fetch: async request => {
    const path = new URL(request.url).pathname;
    if (path === '/pairing/owner') return Response.json({ server_id: serverId, owner_csrf: 'owner-only', lan_address: 'http://192.168.1.8:19001',
      challenge: { id: firstId, status: closed ? 'closed' : 'active', expires_at: Date.now() / 1000 + 120, attempts_remaining: 5 } });
    if (path === '/pairing/devices') return Response.json([device]);
    assert.equal(path, '/pairing/challenges/current'); assert.equal(request.method, 'DELETE');
    assert.equal(request.headers.get('x-owner-csrf'), 'owner-only');
    deletes++; closed = true; return new Response(null, { status: 204 });
  } });
  const admin = createPairingAdmin(client); await admin.refresh(); await admin.close();
  assert.equal(admin.getSnapshot().owner?.challenge?.status, 'closed');
  assert.deepEqual(admin.getSnapshot().devices, [device]); assert.equal(deletes, 1);
});

test('an expired owner CSRF is refreshed through reads and opening is repeated only after another explicit action', async () => {
  let currentToken = 'first-owner', posts = 0;
  const client = createMusicClient({ baseUrl: 'http://127.0.0.1:19000', fetch: async request => {
    const path = new URL(request.url).pathname;
    if (path === '/pairing/owner') return Response.json({ server_id: serverId, owner_csrf: currentToken, lan_address: 'http://192.168.1.8:19001', challenge: null });
    if (path === '/pairing/devices') return Response.json([]);
    assert.equal(path, '/pairing/challenges'); posts++;
    if (request.headers.get('x-owner-csrf') !== currentToken) return Response.json({ error: { code: 'owner_csrf_required', message: 'Expired owner', recovery: 'Read owner' } }, { status: 403 });
    return Response.json({ id: firstId, expires_at: Date.now() / 1000 + 120, attempts_remaining: 5, status: 'active', code: '246810' }, { status: 201 });
  } });
  const admin = createPairingAdmin(client); await admin.refresh(); currentToken = 'restarted-owner';
  await assert.rejects(admin.open()); assert.equal(posts, 1); assert.equal(admin.getSnapshot().unknownOpen, false);
  await admin.open(); assert.equal(posts, 2); assert.equal(admin.getSnapshot().code?.code, '246810');
});

test('device revocation reads the actual retained revoked record without removing unrelated devices', async () => {
  const ownId = 'f6257463-40e5-4b09-9f10-e979b2e7864e', otherId = 'd38e9dd8-0779-4e61-9a9f-05757336d4ea';
  let revokedAt: number | null = null;
  const devices = () => [{ id: ownId, name: '本次手机', created_at: 1, revoked_at: revokedAt }, { id: otherId, name: '另一台手机', created_at: 1, revoked_at: null }];
  const client = createMusicClient({ baseUrl: 'http://127.0.0.1:19000', fetch: async request => {
    const path = new URL(request.url).pathname;
    if (path === '/pairing/owner') return Response.json({ server_id: serverId, owner_csrf: 'owner-only', lan_address: 'http://192.168.1.8:19001', challenge: null });
    if (path === '/pairing/devices') return Response.json(devices());
    assert.equal(path, `/pairing/devices/${ownId}`); assert.equal(request.method, 'DELETE');
    assert.equal(request.headers.get('x-owner-csrf'), 'owner-only'); revokedAt = 2;
    return Response.json(devices()[0]);
  } });
  const admin = createPairingAdmin(client); await admin.refresh(); await admin.revoke(ownId);
  assert.equal(admin.getSnapshot().devices?.find(value => value.id === ownId)?.revoked_at, 2);
  assert.equal(admin.getSnapshot().devices?.find(value => value.id === otherId)?.revoked_at, null);
});
