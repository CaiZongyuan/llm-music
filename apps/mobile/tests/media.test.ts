import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test, { type TestContext } from 'node:test';
import { createMobileSession } from '../src/data/session.ts';
import { createMediaController } from '../src/media/controller.ts';
import type { CachedAudio, MediaOptions, PlaybackStatus } from '../src/media/types.ts';

const serverId = '9071c074-d9d8-4e27-bb84-32d8e58dc92f';
const deviceId = 'f6257463-40e5-4b09-9f10-e979b2e7864e';
const projectId = '02de6571-943d-441d-ad61-c4acb46dc2c9';
const assetId = '805cecaa-c24a-42bd-ab63-801c07a53f17';
const originalSha256 = '2e36c3fd44bc2738d02a023c65461e58016b7dd33e1ed98b9fb15d350be27897';
const selection = { projectId, assetId, recordId: '1dd5cfde-b06d-4b5f-9fac-3d650508b75d', label: 'Original Candidate' };

async function fixture() {
  const original = new Uint8Array(await readFile(new URL('./fixtures/original-35s.flac', import.meta.url)));
  let local: unknown = null;
  const secrets = new Map<string, string>();
  const stats = { authorizations: 0, revoked: false };
  let authorizationGate: Promise<void> | null = null;
  const asset = { id: assetId, project_id: projectId, kind: 'generated_audio', format: 'flac', media_type: 'audio/flac',
    size_bytes: 467960, sha256: originalSha256, duration_seconds: 34.998666666666665, channels: 2, sample_rate: 48000, sample_width_bits: 16 };
  const session = createMobileSession({
    store: { load: async () => local, save: async value => { local = structuredClone(value); } },
    credentials: { get: async key => secrets.get(key) ?? null, set: async (key, value) => { secrets.set(key, value); } },
    random: { uuid: () => deviceId, token: async () => 'ab'.repeat(32) },
    fetch: async request => {
      const identity = new URL(request.url).origin === 'http://192.168.1.9:8002' ? '8c3c8c40-4b3b-47c0-b9c4-7f88b6f09f59' : serverId;
      if (new URL(request.url).pathname === '/connection') return Response.json({ server_id: identity, protocol_version: 1, pairing_available: true });
      if (new URL(request.url).pathname.endsWith('/assets/' + assetId)) return Response.json(asset);
      if (new URL(request.url).pathname === '/device') {
        stats.authorizations++;
        if (authorizationGate) await authorizationGate;
        if (stats.revoked) return Response.json({ error: { code: 'device_unauthorized', message: 'Revoked', recovery: 'Pair again' } }, { status: 401 });
      }
      return Response.json({ server_id: identity, device: { id: deviceId, name: 'Phone', created_at: 1, revoked_at: null } });
    },
  });
  await session.hydrate(); await session.pair('http://192.168.1.8:8001', '246810', 'Phone');
  const files = new Map<string, Uint8Array>();
  let fileIds = 0;
  const playerSources: string[] = [];
  const nativeListeners = new Set<(value: PlaybackStatus) => void>();
  let playing = false, position = 0, ended = false;
  const status = (): PlaybackStatus => ({ loaded: true, playing, position, duration: 34.998666666666665, ended, error: null });
  const emit = () => nativeListeners.forEach(listener => listener(status()));
  const ports: MediaOptions = {
    session,
    fetch: async (request, init) => {
      assert.equal(request.url, `http://192.168.1.8:8001/projects/${projectId}/assets/${assetId}/content`);
      assert.equal(request.headers.has('authorization'), true);
      assert.equal(init.redirect, 'error', 'the real fetch init must carry policy, independently of RN Request properties');
      return new Response(original, { headers: { 'Content-Type': 'audio/flac', 'Content-Length': '467960' } });
    },
    cache: { clear: async () => { files.clear(); }, create: async () => {
      const chunks: Uint8Array[] = [];
      const uri = `file:///owned-cache/${++fileIds}.flac`;
      files.set(uri, new Uint8Array());
      let closed = false;
      return {
        write: async bytes => { if (closed) throw new Error('Cache is closed'); chunks.push(bytes.slice()); files.set(uri, Buffer.concat(chunks)); },
        finish: async (): Promise<CachedAudio> => {
          closed = true; const body = Buffer.concat(chunks); files.set(uri, body);
          return { uri, sizeBytes: body.length, sha256: createHash('sha256').update(body).digest('hex'), remove: async () => { files.delete(uri); } };
        },
        discard: async () => { closed = true; files.delete(uri); },
      };
    } },
    player: { create: uri => {
      assert.ok(uri.startsWith('file:///')); assert.ok(files.has(uri)); playerSources.push(uri);
      playing = false; position = 0; ended = false;
      return { getStatus: status, subscribe: listener => { nativeListeners.add(listener); return () => { nativeListeners.delete(listener); }; },
        play: () => { playing = true; emit(); }, pause: () => { playing = false; emit(); },
        seekTo: async seconds => { position = seconds; ended = position >= 34.998666666666665; emit(); }, release: () => { playing = false; } };
    } },
  };
  return { original, session, ports, files, playerSources, stats,
    holdAuthorization: (gate: Promise<void> | null) => { authorizationGate = gate; },
    finishPlayback: () => { ended = true; position = 34.998666666666665; playing = false; emit(); } };
}

function owned(t: TestContext, f: Awaited<ReturnType<typeof fixture>>) {
  const controller = createMediaController(f.ports);
  t.after(async () => { await controller.dispose(); f.session.dispose(); });
  return controller;
}

test('selecting the protected original FLAC verifies bytes and loads only a paused local source', async t => {
  const f = await fixture();
  const controller = owned(t, f);
  await controller.select(selection);
  assert.equal(f.playerSources.length, 1);
  assert.deepEqual(Buffer.from([...f.files.values()][0]), Buffer.from(f.original));
  assert.equal(controller.getSnapshot().status, 'ready');
  assert.equal(controller.getSnapshot().playing, false);
  assert.deepEqual(controller.getSnapshot().verified, { sizeBytes: 467960, sha256: originalSha256 });
  await controller.release();
  assert.equal(f.files.size, 0);
  f.session.dispose();
});

async function waitFor(ready: () => boolean) {
  const deadline = Date.now() + 500;
  while (!ready()) { assert.ok(Date.now() < deadline, 'Public condition did not settle'); await new Promise(resolve => setImmediate(resolve)); }
}

test('background aborts an unfinished download, removes partial bytes and cannot register a late player', async t => {
  const f = await fixture();
  let signal: AbortSignal | undefined;
  let finish = () => {};
  f.ports.fetch = async request => {
    signal = request.signal;
    return new Response(new ReadableStream<Uint8Array>({ start(stream) {
      stream.enqueue(f.original.slice(0, 1024));
      finish = () => { try { stream.enqueue(f.original.slice(1024)); stream.close(); } catch {} };
    } }), { headers: { 'Content-Type': 'audio/flac' } });
  };
  const controller = owned(t, f);
  const loading = controller.select(selection).catch(error => error);
  try {
    await waitFor(() => [...f.files.values()].some(bytes => bytes.length === 1024));
    await f.session.setForeground(false);
    assert.equal(signal?.aborted, true);
    await waitFor(() => f.files.size === 0);
    finish(); await loading;
    assert.equal(f.playerSources.length, 0);
    await f.session.setForeground(true);
    assert.equal(controller.getSnapshot().playing, false);
    assert.equal(f.files.size, 0, 'foreground recovery cannot rebuild audio without an explicit action');
  } finally { finish(); await loading; await controller.release(); f.session.dispose(); }
});

test('cached play and seek each check current authorization and display actual decoder position', async t => {
  const f = await fixture();
  const controller = owned(t, f);
  await controller.select(selection);
  const checks = f.stats.authorizations;
  await controller.play();
  assert.equal(controller.getSnapshot().playing, true);
  await controller.seekTo(12);
  assert.equal(controller.getSnapshot().position, 12);
  assert.equal(f.stats.authorizations, checks + 2);
  await controller.pause();
  assert.equal(controller.getSnapshot().playing, false);
  await controller.release(); f.session.dispose();
});

test('a download provider that ignores abort still ends within the public timeout and cannot load late bytes', async t => {
  const f = await fixture();
  f.ports.timeoutMs = 30;
  let finish!: () => void;
  f.ports.fetch = async () => new Promise<Response>(resolve => { finish = () => resolve(new Response(f.original, { headers: { 'Content-Type': 'audio/flac' } })); });
  const controller = owned(t, f);
  const loading = controller.select(selection).catch(error => error);
  try {
    const result = await Promise.race([loading, new Promise<string>(resolve => setTimeout(() => resolve('still pending'), 200))]);
    assert.notEqual(result, 'still pending', 'a reported timeout must reject even if the native provider has not acknowledged cancellation');
    assert.equal(result.code, 'media_timed_out');
    finish(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.playerSources.length, 0);
    assert.equal(f.files.size, 0);
  } finally { finish(); await controller.release(); await loading; f.session.dispose(); }
});

for (const stalled of ['body', 'decoder']) {
  test(`${stalled} readiness shares the download timeout and removes its local file`, async t => {
    const f = await fixture(); f.ports.timeoutMs = 30;
    if (stalled === 'body') f.ports.fetch = async () => new Response(new ReadableStream<Uint8Array>({ start(stream) {
      stream.enqueue(f.original.slice(0, 1024));
    } }), { headers: { 'Content-Type': 'audio/flac' } });
    else f.ports.player.create = () => ({
      getStatus: () => ({ loaded: false, playing: false, position: 0, duration: 0, ended: false, error: null }),
      subscribe: () => () => {}, play: () => { throw new Error('An unloaded decoder cannot play'); },
      pause: () => {}, seekTo: async () => {}, release: () => {},
    });
    const controller = owned(t, f);
    await assert.rejects(controller.select(selection), error => error instanceof Error && error.message === 'media_timed_out');
    assert.equal(f.files.size, 0);
    assert.equal(controller.getSnapshot().verified, null);
    assert.equal(controller.getSnapshot().playing, false);
    await controller.dispose(); f.session.dispose();
  });
}

test('foreground authorization notices revocation after a terminal Job without a live observation socket', async t => {
  const f = await fixture(); f.ports.authorizationIntervalMs = 15;
  const controller = owned(t, f);
  await controller.select(selection); await controller.play();
  f.stats.revoked = true;
  try {
    await waitFor(() => f.session.getSnapshot().connection === 'revoked');
    await waitFor(() => f.files.size === 0);
    assert.equal(controller.getSnapshot().playing, false);
    assert.equal(controller.getSnapshot().canSeek, false);
    assert.equal(controller.getSnapshot().verified, null);
    await assert.rejects(controller.play());
  } finally { await controller.dispose(); f.session.dispose(); }
});

test('background releases local playback and foreground waits for explicit play before restoring position', async t => {
  const f = await fixture();
  const controller = owned(t, f);
  await controller.select(selection); await controller.play(); await controller.seekTo(12);
  await f.session.setForeground(false);
  await waitFor(() => f.files.size === 0);
  assert.equal(controller.getSnapshot().position, 12);
  assert.equal(controller.getSnapshot().playing, false);
  await f.session.setForeground(true);
  assert.equal(f.playerSources.length, 1);
  assert.equal(f.files.size, 0);
  await controller.play();
  assert.equal(f.playerSources.length, 2);
  assert.equal(controller.getSnapshot().position, 12);
  assert.equal(controller.getSnapshot().playing, true);
  await controller.dispose(); f.session.dispose();
});

test('pause supersedes a play action whose authorization reply arrives later', async t => {
  const f = await fixture();
  const controller = owned(t, f);
  await controller.select(selection);
  let resume!: () => void;
  f.holdAuthorization(new Promise<void>(resolve => { resume = resolve; }));
  const before = f.stats.authorizations;
  const playing = controller.play().catch(error => error);
  await waitFor(() => f.stats.authorizations > before);
  await controller.pause();
  resume(); await playing;
  assert.equal(controller.getSnapshot().playing, false);
  assert.equal(f.files.size, 1, 'a pause preserves the current authorized local source');
  await controller.dispose(); f.session.dispose();
});

test('changing computers drops the old record even when its Project and Asset UUIDs also exist on the new server', async t => {
  const f = await fixture(); const controller = owned(t, f);
  await controller.select(selection); await controller.play();
  await f.session.pair('http://192.168.1.9:8002', '135790', 'Computer B');
  await waitFor(() => f.files.size === 0);
  assert.equal(controller.getSnapshot().selection, null);
  assert.equal(controller.getSnapshot().canPlay, false);
  await assert.rejects(controller.play());
  assert.equal(f.playerSources.length, 1);
});

test('a delayed old-file removal cannot overwrite the later explicit record selection', async t => {
  const f = await fixture();
  const create = f.ports.cache.create;
  let remove!: () => void, began!: () => void;
  const started = new Promise<void>(resolve => { began = resolve; });
  const held = new Promise<void>(resolve => { remove = resolve; });
  let first = true;
  f.ports.cache.create = async () => {
    const writer = await create();
    return { ...writer, finish: async () => {
      const file = await writer.finish(); const original = first; first = false;
      return { ...file, remove: async () => { if (original) { began(); await held; } await file.remove(); } };
    } };
  };
  const controller = owned(t, f); await controller.select(selection);
  const obsolete = controller.select({ ...selection, recordId: 'older-choice', label: 'Older choice' }).catch(error => error);
  await started;
  await controller.select({ ...selection, recordId: 'latest-choice', label: 'Latest choice' });
  remove(); await obsolete;
  assert.equal(controller.getSnapshot().selection?.recordId, 'latest-choice');
  assert.equal(f.files.size, 1, 'only the current playback session keeps bytes');
});

test('final disposal rejects later actions and leaves no local playback resources', async t => {
  const f = await fixture(); const controller = owned(t, f);
  await controller.select(selection); await controller.dispose();
  await assert.rejects(controller.select(selection));
  await assert.rejects(controller.play());
  assert.equal(f.files.size, 0);
  assert.equal(f.playerSources.length, 1);
  assert.equal(controller.getSnapshot().canPlay, false);
});

test('startup removes this cache owner\'s crash leftovers without creating a player or replaying a request', async t => {
  const f = await fixture();
  f.files.set('file:///owned-cache/old-session.flac', f.original.slice(0, 1024));
  const controller = owned(t, f);
  const checked = f.stats.authorizations;
  controller.start();
  await waitFor(() => f.files.size === 0);
  assert.equal(f.playerSources.length, 0);
  assert.equal(f.stats.authorizations, checked, 'cleaning local residue does not perform a network action');
});

test('a decoder pause failure still releases the native object and deletes the owned source', async t => {
  const f = await fixture(); const create = f.ports.player.create;
  let releases = 0;
  f.ports.player.create = async uri => {
    const active = await create(uri);
    return { ...active, pause: () => { throw new Error('Native pause failed'); }, release: () => { releases++; active.release(); } };
  };
  const controller = owned(t, f); await controller.select(selection);
  await assert.rejects(controller.release());
  assert.equal(releases, 1);
  assert.equal(f.files.size, 0);
  assert.equal(controller.getSnapshot().verified, null);
});

test('reported cache deletion failure retains cleanup ownership so a later release removes the file', async t => {
  const f = await fixture(); const create = f.ports.cache.create; let denied = true;
  f.ports.cache.create = async () => { const writer = await create(); return { ...writer, finish: async () => {
    const file = await writer.finish(); return { ...file, remove: async () => { if (denied) throw new Error('Filesystem refused deletion'); await file.remove(); } };
  } }; };
  const controller = owned(t, f); await controller.select(selection);
  await assert.rejects(controller.release());
  assert.equal(f.files.size, 1);
  assert.equal(controller.getSnapshot().verified, null);
  denied = false; await controller.release();
  assert.equal(f.files.size, 0);
});

test('ended playback explicitly starts again at zero without downloading another original', async t => {
  const f = await fixture(); const controller = owned(t, f);
  await controller.select(selection); await controller.play(); f.finishPlayback();
  assert.equal(controller.getSnapshot().ended, true);
  await controller.play();
  assert.equal(controller.getSnapshot().position, 0);
  assert.equal(controller.getSnapshot().playing, true);
  assert.equal(f.playerSources.length, 1);
});

for (const failure of ['redirect', 'changed-bytes']) {
  test(`${failure} cannot become an audio source or survive as a cached original`, async t => {
    const f = await fixture();
    f.ports.fetch = async () => {
      if (failure === 'redirect') return new Response(null, { status: 302, headers: { Location: 'http://192.168.1.9:8002/target' } });
      const altered = f.original.slice(); altered[altered.length - 1] ^= 1;
      return new Response(altered, { headers: { 'Content-Type': 'audio/flac' } });
    };
    const controller = owned(t, f);
    await assert.rejects(controller.select(selection));
    assert.equal(f.playerSources.length, 0);
    assert.equal(f.files.size, 0);
    assert.equal(controller.getSnapshot().verified, null);
  });
}

test('failed partial-file cleanup reports an error and a later release retries the same owned fragment', async t => {
  const f = await fixture(); const create = f.ports.cache.create; let denied = true;
  f.ports.fetch = async () => new Response(f.original.slice(0, 1024), { headers: { 'Content-Type': 'audio/flac' } });
  f.ports.cache.create = async () => { const writer = await create(); return { ...writer, discard: async () => {
    if (denied) throw new Error('Filesystem refused partial cleanup'); await writer.discard();
  } }; };
  const controller = owned(t, f);
  await assert.rejects(controller.select(selection));
  assert.equal(controller.getSnapshot().status, 'error');
  assert.equal(f.files.size, 1);
  denied = false; await controller.release();
  assert.equal(f.files.size, 0);
  assert.equal(f.playerSources.length, 0);
});

test('an asynchronous decoder failure stops playback, releases the source, and permits explicit recovery', async t => {
  const f = await fixture(); const create = f.ports.player.create;
  let notify!: (status: PlaybackStatus) => void;
  let releases = 0;
  f.ports.player.create = async uri => {
    const active = await create(uri);
    return { ...active, subscribe: listener => { notify = listener; return active.subscribe(listener); },
      release: () => { releases++; active.release(); } };
  };
  const controller = owned(t, f); await controller.select(selection); await controller.play(); await controller.seekTo(12);
  notify({ loaded: false, playing: true, position: 12, duration: 35, ended: false, error: 'Decoder failed' });
  await waitFor(() => controller.getSnapshot().status === 'error' && f.files.size === 0);
  assert.equal(controller.getSnapshot().playing, false);
  assert.equal(controller.getSnapshot().verified, null);
  assert.equal(releases, 1);
  await controller.play();
  assert.equal(controller.getSnapshot().playing, true);
  assert.equal(controller.getSnapshot().position, 12);
  assert.equal(f.playerSources.length, 2);
});

test('a cache writer created after timeout still retains ownership when its first cleanup fails', async t => {
  const f = await fixture(); const create = f.ports.cache.create;
  f.ports.timeoutMs = 30;
  let resume!: () => void, began!: () => void;
  const started = new Promise<void>(resolve => { began = resolve; });
  const held = new Promise<void>(resolve => { resume = resolve; });
  let denied = true;
  f.ports.cache.create = async () => {
    began(); await held; const writer = await create();
    return { ...writer, discard: async () => { if (denied) throw new Error('Filesystem refused late cleanup'); await writer.discard(); } };
  };
  const controller = owned(t, f);
  const loading = controller.select(selection).catch(error => error);
  await started;
  assert.equal((await loading).code, 'media_timed_out');
  resume(); await waitFor(() => f.files.size === 1);
  denied = false; await controller.release();
  assert.equal(f.files.size, 0);
  assert.equal(f.playerSources.length, 0);
});

test('failed native release remains owned, blocks replacement, and is retried before another player can exist', async t => {
  const f = await fixture(); const create = f.ports.player.create;
  let denied = true, attempts = 0, released = false;
  f.ports.player.create = async uri => {
    const active = await create(uri);
    return { ...active, release: () => { attempts++; if (denied) throw new Error('Native release refused'); released = true; active.release(); } };
  };
  const controller = owned(t, f); await controller.select(selection);
  try {
    await assert.rejects(controller.release());
    assert.equal(controller.getSnapshot().status, 'error');
    await assert.rejects(controller.select({ ...selection, recordId: 'replacement' }));
    assert.equal(f.playerSources.length, 1, 'an unreleased native object must not acquire a replacement');
    assert.equal(released, false);
    denied = false; await controller.release();
    assert.equal(attempts, 3, 'both failed cleanup attempts and the successful retry target the same owner');
    assert.equal(released, true);
    assert.equal(controller.getSnapshot().status, 'idle');
    await controller.select({ ...selection, recordId: 'replacement' });
    assert.equal(f.playerSources.length, 2);
  } finally { denied = false; await controller.release(); }
});

for (const resume of ['start', 'play']) test(`${resume} after a suspended cross-computer change clears the old record before any future session event`, async t => {
  const f = await fixture(); const controller = owned(t, f);
  f.ports.fetch = async () => new Response(f.original, { headers: { 'Content-Type': 'audio/flac' } });
  await controller.select(selection); await controller.seekTo(12); await controller.suspend();
  await f.session.pair('http://192.168.1.9:8002', '135790', 'Computer B');
  if (resume === 'start') controller.start();
  else await assert.rejects(controller.play());
  assert.equal(controller.getSnapshot().selection, null);
  assert.equal(controller.getSnapshot().position, 0);
  assert.equal(controller.getSnapshot().duration, 0);
  await assert.rejects(controller.play());
  assert.equal(f.playerSources.length, 1, 'the old record must not be reinterpreted on the new server');
  assert.equal(f.files.size, 0);
});
