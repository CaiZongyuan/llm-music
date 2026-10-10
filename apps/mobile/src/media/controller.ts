import type { AudioWriter, CachedAudio, MediaOptions, MediaSelection, MediaSnapshot, Playback, PlaybackStatus } from './types.ts';

export class MediaFailure extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.name = 'MediaFailure'; this.code = code; }
}

export function createMediaController(options: MediaOptions) {
  let revision = 0;
  let disposed = false;
  let player: Playback | null = null;
  let file: CachedAudio | null = null;
  let unsubscribePlayer: (() => void) | undefined;
  let download: AbortController | undefined;
  let downloadReader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let unsubscribeSession: (() => void) | undefined;
  let authorizationTimer: ReturnType<typeof setTimeout> | undefined;
  let rejectReady: ((reason: unknown) => void) | undefined;
  let scope: { epoch: number; serverId: string; deviceId?: string } | null = null;
  let selectionServerId: string | null = null;
  let actionPending: number | null = null;
  let actionSequence = 0;
  let initialized = false;
  let initialization: Promise<void> | undefined;
  let snapshot: MediaSnapshot = Object.freeze({ selection: null, status: 'idle', playing: false, position: 0, duration: 0,
    error: null, canPlay: false, canSeek: false, seeking: false, ended: false, verified: null });
  const listeners = new Set<() => void>();
  type Cleanup = { remove(): Promise<void> };
  type PlayerCleanup = { active: Playback; unsubscribe?: () => void; released: boolean };
  const pendingCleanup = new Set<Cleanup>();
  const removingCleanup = new Set<Cleanup>();
  const pendingPlayers = new Set<PlayerCleanup>();

  function publish(patch: Partial<MediaSnapshot>) {
    const session = options.session.getSnapshot();
    const next = { ...snapshot, ...patch };
    if (pendingPlayers.size && next.status === 'idle') { next.status = 'error'; next.error = 'media_release_failed'; }
    const authorized = !disposed && session.foreground && session.connection === 'connected';
    snapshot = Object.freeze({ ...next,
      canPlay: !!next.selection && authorized && !['authorizing', 'loading'].includes(next.status),
      canSeek: !!player && authorized && next.status === 'ready' && next.duration > 0 && !next.seeking,
    });
    listeners.forEach(listener => listener());
  }
  function guard(captured: number, current: () => boolean) {
    if (disposed || captured !== revision || !current()) throw new MediaFailure('media_session_changed');
  }
  function start() {
    if (disposed) throw new MediaFailure('media_disposed');
    if (!initialized && !initialization) {
      initialization = Promise.resolve().then(() => options.cache.clear?.()).then(() => { initialized = true; }).catch(() => {
        initialization = undefined;
        if (!disposed) publish({ status: 'error', error: 'media_cache_cleanup_failed' });
        throw new MediaFailure('media_cache_cleanup_failed');
      });
      void initialization.catch(() => {});
    }
    if (!unsubscribeSession) unsubscribeSession = options.session.subscribe(reconcileSession);
    reconcileSession();
  }
  function releaseForSession() {
    const cleaning = revision + 1;
    void release().catch(error => {
      if (cleaning === revision) publish({ status: 'error', error: error instanceof MediaFailure ? error.code : 'media_release_failed' });
    });
  }
  function reconcileSession() {
    const state = options.session.getSnapshot();
    if (snapshot.selection && selectionServerId && state.server && selectionServerId !== state.server.serverId) {
      releaseForSession();
      selectionServerId = null;
      publish({ selection: null, status: 'idle', playing: false, position: 0, duration: 0, ended: false, error: null });
      return;
    }
    if (snapshot.selection && (!state.foreground || state.connection !== 'connected' || scope &&
      (scope.epoch !== state.epoch || scope.serverId !== state.server?.serverId || scope.deviceId !== state.server?.deviceId))) {
      releaseForSession();
      publish({ status: 'blocked', error: 'media_authorization_required' });
    } else if (!player && snapshot.status === 'blocked' && state.connection === 'connected' && state.foreground) {
      publish({ status: 'idle', error: null });
    } else publish({});
  }
  function playerState(status: PlaybackStatus) {
    publish({ playing: status.error ? false : status.playing, position: Number.isFinite(status.position) ? Math.max(0, status.position) : snapshot.position,
      duration: Number.isFinite(status.duration) ? Math.max(0, status.duration) : snapshot.duration, ended: status.ended,
      ...(status.error ? { status: 'error', error: 'media_decode_failed' } : !actionPending ? { status: status.loaded && status.duration > 0 ? 'ready' : 'loading' } : {}) });
  }
  async function removeOwned() {
    let failed = false;
    await Promise.all([...pendingCleanup].filter(value => !removingCleanup.has(value)).map(async value => {
      removingCleanup.add(value);
      try { await value.remove(); pendingCleanup.delete(value); } catch { failed = true; }
      finally { removingCleanup.delete(value); }
    }));
    if (failed) throw new MediaFailure('media_cache_cleanup_failed');
  }
  function releaseOwnedPlayers() {
    const failures: unknown[] = [];
    for (const owned of pendingPlayers) {
      try { owned.unsubscribe?.(); owned.unsubscribe = undefined; } catch (error) { failures.push(error); }
      if (!owned.released) {
        try { owned.active.pause(); } catch (error) { failures.push(error); }
        try { owned.active.release(); owned.released = true; } catch (error) { failures.push(error); }
      }
      if (owned.released && !owned.unsubscribe) pendingPlayers.delete(owned);
    }
    return failures;
  }
  async function release() {
    revision++;
    const captured = revision;
    const failures: unknown[] = [];
    actionPending = null;
    clearTimeout(authorizationTimer); authorizationTimer = undefined;
    download?.abort(); download = undefined;
    void downloadReader?.cancel().catch(() => {}); downloadReader = undefined;
    rejectReady?.(new MediaFailure('media_session_changed')); rejectReady = undefined;
    const active = player; player = null;
    if (active) {
      try { const actual = active.getStatus(); if (Number.isFinite(actual.position)) publish({ position: Math.max(0, actual.position) }); } catch (error) { failures.push(error); }
      pendingPlayers.add({ active, unsubscribe: unsubscribePlayer, released: false });
      unsubscribePlayer = undefined;
    }
    failures.push(...releaseOwnedPlayers());
    const old = file; file = null; scope = null;
    if (old) pendingCleanup.add(old);
    publish({ status: failures.length ? 'error' : 'idle', playing: false, seeking: false, verified: null });
    try { await removeOwned(); } catch (error) { failures.push(error); }
    if (failures.length) {
      if (captured === revision) publish({ status: 'error', error: pendingCleanup.size ? 'media_cache_cleanup_failed' : 'media_release_failed' });
      throw new MediaFailure(pendingCleanup.size ? 'media_cache_cleanup_failed' : 'media_release_failed');
    }
    if (captured === revision) publish({ status: 'idle', error: null });
  }
  async function select(selection: MediaSelection | null) {
    start();
    const prepared = initialization;
    const initial = options.session.getSnapshot();
    const captured = revision + 1;
    await release();
    if (captured !== revision || selection && initial.epoch !== options.session.getSnapshot().epoch) throw new MediaFailure('media_session_changed');
    if (!selection) { selectionServerId = null; publish({ selection: null, position: 0, duration: 0, ended: false, error: null }); return; }
    selectionServerId = initial.server?.serverId ?? null;
    publish({ selection: Object.freeze({ ...selection }), status: 'authorizing', position: 0, duration: 0, ended: false, error: null });
    let fragment: Cleanup | undefined;
    let completed: CachedAudio | undefined;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    const abort = new AbortController(); download = abort;
    let timedOut = false;
    const deadline = Date.now() + (options.timeoutMs ?? 30000);
    const cancellation = new Promise<never>((_, reject) => abort.signal.addEventListener('abort', () => {
      reject(new MediaFailure(timedOut ? 'media_timed_out' : 'media_session_changed'));
    }, { once: true }));
    const timer = setTimeout(() => { timedOut = true; abort.abort(); }, options.timeoutMs ?? 30000);
    const within = <T>(operation: Promise<T>) => Promise.race([operation.then(value => {
      if (Date.now() >= deadline && !abort.signal.aborted) { timedOut = true; abort.abort(); }
      if (abort.signal.aborted) throw new MediaFailure(timedOut ? 'media_timed_out' : 'media_session_changed');
      if (captured !== revision) throw new MediaFailure('media_session_changed');
      return value;
    }), cancellation]);
    try {
      if (prepared) await within(prepared);
      const lease = await within(options.session.authorizeMedia(selection.projectId, selection.assetId));
      guard(captured, lease.isCurrent);
      const asset = await within(options.session.getAsset(selection.projectId, selection.assetId));
      guard(captured, lease.isCurrent);
      if (asset.id !== selection.assetId || asset.project_id !== selection.projectId || asset.format !== 'flac' || asset.media_type !== 'audio/flac'
        || asset.channels !== 2 || asset.sample_rate !== 48000 || asset.sample_width_bits !== 16
        || !Number.isSafeInteger(asset.size_bytes) || asset.size_bytes <= 0 || !/^[0-9a-f]{64}$/.test(asset.sha256)) throw new MediaFailure('media_format_unsupported');
      publish({ status: 'loading' });
      const response = await within(options.fetch(lease.createRequest(abort.signal), { redirect: 'error' }).then(value => {
        if (abort.signal.aborted) void value.body?.cancel().catch(() => {});
        return value;
      }));
      guard(captured, lease.isCurrent);
      if (response.status !== 200 || response.redirected || !response.body || response.headers.get('content-type')?.split(';')[0] !== 'audio/flac') throw new MediaFailure('media_download_failed');
      const advertisedSize = response.headers.get('content-length');
      if (advertisedSize !== null && Number(advertisedSize) !== asset.size_bytes) throw new MediaFailure('media_integrity_failed');
      const activeWriter = await within<AudioWriter>(options.cache.create().then(value => {
        fragment = { remove: () => value.discard() };
        if (abort.signal.aborted || captured !== revision) {
          pendingCleanup.add(fragment);
          void removeOwned().catch(() => {
            if (captured + 1 === revision) publish({ status: 'error', error: 'media_cache_cleanup_failed' });
          });
        }
        return value;
      })); guard(captured, lease.isCurrent);
      reader = response.body.getReader(); downloadReader = reader;
      let size = 0;
      const magic: number[] = [];
      while (true) {
        const { value, done } = await within(reader.read()); guard(captured, lease.isCurrent);
        if (done) break;
        size += value.byteLength;
        if (size > asset.size_bytes) throw new MediaFailure('media_integrity_failed');
        magic.push(...value.subarray(0, 4 - magic.length));
        await within(activeWriter.write(value)); guard(captured, lease.isCurrent);
      }
      if (size !== asset.size_bytes || magic.join(',') !== '102,76,97,67') throw new MediaFailure('media_integrity_failed');
      completed = await within(activeWriter.finish()); fragment = undefined; guard(captured, lease.isCurrent);
      if (completed.sizeBytes !== asset.size_bytes || completed.sha256 !== asset.sha256 || !completed.uri.startsWith('file://')) throw new MediaFailure('media_integrity_failed');
      file = completed;
      scope = { epoch: lease.epoch, serverId: lease.serverId, deviceId: lease.deviceId };
      publish({ verified: Object.freeze({ sizeBytes: completed.sizeBytes, sha256: completed.sha256 }) });
      const selectedPlayer = await within(Promise.resolve(options.player.create(completed.uri)).then(value => {
        if (abort.signal.aborted || captured !== revision || !lease.isCurrent()) {
          pendingPlayers.add({ active: value, released: false });
          if (releaseOwnedPlayers().length && captured + 1 === revision) publish({ status: 'error', error: 'media_release_failed' });
          throw new MediaFailure('media_session_changed');
        }
        return value;
      }));
      player = selectedPlayer;
      let ready = false;
      let decoderFailed = false;
      await within(new Promise<void>((resolve, reject) => {
        rejectReady = reject;
        const changed = (status: PlaybackStatus) => {
          if (captured !== revision || !lease.isCurrent() || abort.signal.aborted) return;
          playerState(status);
          if (captured !== revision) return;
          if (status.error) {
            decoderFailed = true;
            reject(new MediaFailure('media_decode_failed'));
            if (ready) {
              const cleaning = revision + 1;
              void release().then(() => {
                if (cleaning === revision) publish({ status: 'error', error: 'media_decode_failed' });
              }).catch(error => {
                if (cleaning === revision) publish({ status: 'error', error: error instanceof MediaFailure ? error.code : 'media_release_failed' });
              });
            }
          }
          else if (status.loaded && status.duration > 0) resolve();
        };
        unsubscribePlayer = selectedPlayer.subscribe(changed);
        changed(selectedPlayer.getStatus());
      }));
      if (decoderFailed) throw new MediaFailure('media_decode_failed');
      ready = true;
      rejectReady = undefined; guard(captured, lease.isCurrent);
      scheduleAuthorization();
    } catch (error) {
      if (reader) void reader.cancel().catch(() => {});
      if (fragment) pendingCleanup.add(fragment);
      if (completed) pendingCleanup.add(completed);
      let problem = error;
      if (captured === revision) {
        const cleaning = revision + 1;
        try { await release(); } catch (failure) { problem = failure; }
        if (cleaning === revision) publish({ status: 'error', playing: false, verified: null, error: problem instanceof MediaFailure ? problem.code : 'media_download_failed' });
      } else { try { await removeOwned(); } catch (failure) { problem = failure; } }
      throw problem;
    } finally {
      clearTimeout(timer);
      if (download === abort) download = undefined;
      if (downloadReader === reader) downloadReader = undefined;
    }
  }
  async function authorizeAction() {
    if (!snapshot.selection || !player || !scope) throw new MediaFailure('media_not_ready');
    const captured = revision;
    const lease = await options.session.authorizeMedia(snapshot.selection.projectId, snapshot.selection.assetId);
    guard(captured, lease.isCurrent);
    if (scope.epoch !== lease.epoch || scope.serverId !== lease.serverId || scope.deviceId !== lease.deviceId) throw new MediaFailure('media_session_changed');
    return captured;
  }
  function scheduleAuthorization() {
    clearTimeout(authorizationTimer);
    if (!file || !snapshot.selection) return;
    const captured = revision;
    authorizationTimer = setTimeout(() => {
      authorizationTimer = undefined;
      void (async () => {
        try { await authorizeAction(); }
        catch {
          if (captured === revision) { await release(); publish({ status: 'blocked', error: 'media_authorization_required' }); }
        } finally { if (captured === revision && file) scheduleAuthorization(); }
      })().catch(error => {
        if (captured + 1 === revision) publish({ status: 'error', error: error instanceof MediaFailure ? error.code : 'media_release_failed' });
      });
    }, options.authorizationIntervalMs ?? 5000);
  }
  async function action(operation: (active: Playback, current: () => void) => Promise<void>, seeking = false) {
    if (actionPending || snapshot.status === 'loading' || snapshot.status === 'authorizing') throw new MediaFailure('media_busy');
    const owner = ++actionSequence;
    actionPending = owner;
    publish({ status: 'authorizing', seeking, error: null });
    let captured = revision;
    try {
      captured = await authorizeAction();
      const current = () => {
        if (captured !== revision || actionPending !== owner) throw new MediaFailure('media_action_changed');
      };
      current();
      const active = player!;
      await operation(active, current);
      current();
      actionPending = null;
      playerState(active.getStatus());
      publish({ seeking: false });
    } catch (error) {
      if (captured === revision && actionPending === owner) {
        await release();
        publish({ status: 'blocked', error: error instanceof MediaFailure ? error.code : 'media_authorization_failed' });
      }
      throw error;
    } finally { if (actionPending === owner) actionPending = null; }
  }
  async function play() {
    if (disposed) throw new MediaFailure('media_disposed');
    start();
    const state = options.session.getSnapshot();
    if (!snapshot.selection || !state.foreground || state.connection !== 'connected') throw new MediaFailure('media_authorization_required');
    if (actionPending || snapshot.status === 'loading' || snapshot.status === 'authorizing') throw new MediaFailure('media_busy');
    const restore = !player || snapshot.status === 'error' ? snapshot.ended ? 0 : snapshot.position : undefined;
    if (restore !== undefined) await select(snapshot.selection);
    await action(async (active, current) => {
      if (restore !== undefined && restore > 0) await active.seekTo(Math.min(restore, snapshot.duration));
      else if (snapshot.ended || snapshot.duration > 0 && snapshot.position >= snapshot.duration) await active.seekTo(0);
      current();
      active.play();
    });
  }
  async function pause() {
    actionPending = null;
    if (!player) return;
    player.pause(); playerState(player.getStatus());
    publish({ seeking: false });
  }
  async function seekTo(seconds: number) {
    if (!Number.isFinite(seconds)) throw new MediaFailure('media_invalid_seek');
    await action(async active => { await active.seekTo(Math.max(0, Math.min(seconds, snapshot.duration))); }, true);
  }
  async function suspend() { unsubscribeSession?.(); unsubscribeSession = undefined; await release(); }
  async function dispose() { disposed = true; await suspend(); listeners.clear(); }
  return { select, play, pause, seekTo, release, start, suspend, dispose, getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; } };
}
