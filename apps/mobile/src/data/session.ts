import { createMusicClient, jobEventsUrl, type components, type ErrorResponse, type JobRead } from '@llm-music/api-client';
import { emptyDocument, freeze, parseDocument, parseIntentInput, scopedKey, titleDraftKey, uuidPattern as uuid,
  type CreationDraft, type IntentInput, type LocalDocument, type PendingIntent, type ServerRecord, type TitleTarget } from './local-state.ts';
export type { CreationDraft, IntentInput, LocalDocument, PendingIntent, ServerRecord, TitleTarget } from './local-state.ts';

type PairingClaim = components['schemas']['PairingClaim'];
type DeviceConnectionRead = components['schemas']['DeviceConnectionRead'];
export type ConnectionStatus = 'hydrating' | 'checking' | 'unpaired' | 'pairing' | 'connected' | 'disconnected' | 'revoked' | 'server_mismatch';
export type LocalStore = { load(): Promise<unknown>; save(value: LocalDocument): Promise<void> };
export type CredentialStore = { get(key: string): Promise<string | null>; set(key: string, value: string): Promise<void> };
type SavedCredential = { version: 1; claim: PairingClaim; phase: 'prepared' | 'paired' | 'rejected' };
export type SessionSnapshot = Readonly<{
  hydrated: boolean; connection: ConnectionStatus; storage: 'loading' | 'ready' | 'error'; epoch: number;
  server: (ServerRecord & { deviceId?: string }) | null; error: string | null; foreground: boolean;
}>;
type SocketObserver = { message(value: unknown): void; close(code: number): void };
type JobObserver = { job(value: JobRead): void; error(value: MobileFailure): void };
export type SessionOptions = {
  store: LocalStore; credentials: CredentialStore;
  random: { uuid(): string; token(): Promise<string> };
  fetch(request: Request): Promise<Response>; timeoutMs?: number;
  socket?(url: string, headers: Readonly<Record<string, string>>, observer: SocketObserver): { close(): void };
};

export class MobileFailure extends Error {
  readonly code: string;
  readonly status: number;
  readonly detail?: Readonly<ErrorResponse['error']>;
  constructor(code: string, status = 0, detail?: ErrorResponse['error']) {
    super(code); this.name = 'MobileFailure'; this.code = code; this.status = status;
    this.detail = detail ? Object.freeze({ ...detail }) : undefined;
  }
}

const credentialKey = (serverId: string) => `shengjian.device.v1.${serverId}`;
const blankDraft: CreationDraft = Object.freeze({ style: '', lyrics: '', seed: '42', maxSeconds: '' });
// A disposed session may still have an in-flight native write. The same provider
// serializes successors so that the latest authorization is always written last.
const credentialQueues = new WeakMap<CredentialStore, Promise<unknown>>();
const localQueues = new WeakMap<LocalStore, Promise<unknown>>();

export function normalizeServerUrl(raw: string): string {
  let value: URL;
  try { value = new URL(raw.trim()); } catch { throw new MobileFailure('invalid_address'); }
  if (!['http:', 'https:'].includes(value.protocol) || value.username || value.password || value.search || value.hash || !['', '/'].includes(value.pathname)) {
    throw new MobileFailure('invalid_address');
  }
  return value.origin;
}

export function createMobileSession(options: SessionOptions) {
  let document = emptyDocument();
  let credential: SavedCredential | null = null;
  let epoch = 0;
  let disposed = false;
  let loaded = false;
  let snapshot: SessionSnapshot = freeze({ hydrated: false, connection: 'hydrating', storage: 'loading', epoch, server: null, error: null, foreground: true });
  const listeners = new Set<() => void>();
  const requests = new Set<AbortController>();
  const sending = new Set<string>();
  type Watcher = { serverId: string; projectId: string; jobId: string; observer: JobObserver; socket?: { close(): void }; reading?: Promise<void>; refreshQueued?: boolean; stopped: boolean };
  const watchers = new Set<Watcher>();

  function publish(patch: Partial<SessionSnapshot>) {
    snapshot = freeze({ ...snapshot, ...patch, epoch });
    listeners.forEach(listener => listener());
  }
  function checkingServer(server: ServerRecord) {
    const deviceId = snapshot.server?.serverId === server.serverId ? snapshot.server.deviceId : undefined;
    return { ...server, ...(deviceId ? { deviceId } : {}) };
  }
  function guard(captured: number) {
    if (disposed || captured !== epoch) throw new MobileFailure('session_changed');
  }
  function advance() {
    epoch++;
    requests.forEach(request => request.abort()); requests.clear();
    watchers.forEach(watcher => { watcher.socket?.close(); watcher.socket = undefined; watcher.reading = undefined; watcher.refreshQueued = false; });
    credential = null;
    return epoch;
  }
  async function persist(captured = epoch) {
    const value: LocalDocument = JSON.parse(JSON.stringify(document));
    const write = (localQueues.get(options.store) ?? Promise.resolve()).then(() => { guard(captured); return options.store.save(value); });
    localQueues.set(options.store, write.catch(() => {}));
    try { await write; guard(captured); }
    catch (error) { guard(captured); publish({ storage: 'error', error: 'storage_unavailable' }); throw error instanceof MobileFailure ? error : new MobileFailure('storage_unavailable'); }
  }
  async function loadLocal(captured: number) {
    const read = (localQueues.get(options.store) ?? Promise.resolve()).then(() => { guard(captured); return options.store.load(); });
    localQueues.set(options.store, read.catch(() => {}));
    const value = await read; guard(captured); return value;
  }
  async function secureOperation<T>(captured: number, operation: () => Promise<T>): Promise<T> {
    const next = (credentialQueues.get(options.credentials) ?? Promise.resolve()).then(() => {
      guard(captured); return operation();
    });
    credentialQueues.set(options.credentials, next.catch(() => {}));
    const result = await next; guard(captured); return result;
  }
  async function secureSave(serverId: string, value: SavedCredential, captured: number) {
    try { await secureOperation(captured, () => options.credentials.set(credentialKey(serverId), JSON.stringify(value))); }
    catch { guard(captured); publish({ storage: 'error', error: 'secure_storage_unavailable' }); throw new MobileFailure('secure_storage_unavailable'); }
    guard(captured);
  }

  async function execute<T>(baseUrl: string, saved: SavedCredential | null, captured: number,
    operation: (client: ReturnType<typeof createMusicClient>) => Promise<{ data?: T; error?: ErrorResponse; response: Response }>) {
    guard(captured);
    const controller = new AbortController(); requests.add(controller);
    let timedOut = false;
    const cancellation = new Promise<never>((_, reject) => controller.signal.addEventListener('abort',
      () => reject(new MobileFailure(timedOut ? 'request_timed_out' : 'request_aborted')), { once: true }));
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, options.timeoutMs ?? 10000);
    const client = createMusicClient({ baseUrl, fetch: async original => {
      guard(captured);
      if (new URL(original.url).origin !== baseUrl) throw new MobileFailure('foreign_origin');
      const headers = new Headers(original.headers);
      if (saved) headers.set('Authorization', `Bearer ${saved.claim.device_token}`);
      const response = await options.fetch(new Request(original, { headers, signal: controller.signal, redirect: 'error' }));
      guard(captured);
      if (response.url && new URL(response.url).origin !== baseUrl) throw new MobileFailure('foreign_origin');
      return response;
    } });
    try {
      const result = await Promise.race([operation(client), cancellation]); guard(captured);
      if (!result.response.ok || result.data === undefined) throw new MobileFailure(result.error?.error.code ?? 'request_failed', result.response.status, result.error?.error);
      return result.data;
    } catch (error) {
      guard(captured);
      if (error instanceof MobileFailure) throw error;
      throw new MobileFailure(controller.signal.aborted ? 'request_aborted' : 'connection_unavailable');
    } finally { clearTimeout(timer); requests.delete(controller); }
  }

  async function discover(baseUrl: string, captured: number) {
    const value = await execute(baseUrl, null, captured, client => client.GET('/connection'));
    if (value.protocol_version !== 1 || !uuid.test(value.server_id)) throw new MobileFailure('invalid_server');
    return value;
  }
  async function validateDevice(server: ServerRecord, saved: SavedCredential, captured: number) {
    const advertised = await discover(server.baseUrl, captured);
    if (advertised.server_id !== server.serverId) throw new MobileFailure('server_mismatch');
    const device = await execute(server.baseUrl, saved, captured, client => client.GET('/device'));
    confirmDevice(server, saved, device);
    saved = { ...saved, phase: 'paired' };
    await secureSave(server.serverId, saved, captured); guard(captured);
    credential = saved;
    const confirmedServer = { ...document.servers[server.serverId], ...server, deviceName: device.device.name };
    document = { ...document, servers: { ...document.servers, [server.serverId]: confirmedServer } };
    await persist(captured); guard(captured);
    publish({ connection: 'connected', server: { ...confirmedServer, deviceId: saved.claim.device_id }, error: null });
  }
  async function completeConnection(server: ServerRecord, saved: SavedCredential, captured: number) {
    await validateDevice(server, saved, captured);
    await recoverPending(captured);
    await Promise.all([...watchers].map(watcher => refreshWatcher(watcher, captured)));
  }
  function confirmDevice(server: ServerRecord, saved: SavedCredential, value: DeviceConnectionRead) {
    if (value.server_id !== server.serverId || value.device.id !== saved.claim.device_id || value.device.revoked_at !== null) {
      throw new MobileFailure('server_mismatch');
    }
  }
  function failure(error: unknown, captured: number, prepared = false) {
    if (disposed || captured !== epoch) return;
    const problem = error instanceof MobileFailure ? error : new MobileFailure('connection_unavailable');
    if (problem.status === 401 && !prepared) advance();
    publish({ connection: problem.code === 'server_mismatch' ? 'server_mismatch' : problem.status === 401 && !prepared ? 'revoked' : 'disconnected', error: problem.code });
  }
  function parseCredential(raw: string | null): SavedCredential | null {
    if (!raw) return null;
    try {
      const value: SavedCredential = JSON.parse(raw);
      if (value.version !== 1 || !['prepared', 'paired', 'rejected'].includes(value.phase) || !uuid.test(value.claim.device_id)
        || !/^[0-9a-f]{64}$/.test(value.claim.device_token) || !/^[0-9]{6}$/.test(value.claim.code) || typeof value.claim.device_name !== 'string') throw new Error();
      return value;
    } catch { throw new MobileFailure('secure_storage_invalid'); }
  }

  async function hydrate() {
    const captured = advance();
    publish({ hydrated: false, connection: 'hydrating', storage: 'loading', error: null });
    try {
      if (!loaded) {
        const stored = await loadLocal(captured);
        try { document = parseDocument(stored, normalizeServerUrl); loaded = true; } catch { throw new MobileFailure('storage_invalid'); }
      }
      if (!document.activeServerId) { publish({ hydrated: true, storage: 'ready', connection: 'unpaired' }); return; }
      const server = document.servers[document.activeServerId];
      if (!server || !uuid.test(server.serverId) || normalizeServerUrl(server.baseUrl) !== server.baseUrl) throw new MobileFailure('storage_invalid');
      publish({ server: checkingServer(server) });
      const raw = await secureOperation(captured, () => options.credentials.get(credentialKey(server.serverId)));
      const saved = parseCredential(raw);
      if (!saved) throw new MobileFailure('credential_missing');
      if (saved.phase === 'rejected') { publish({ hydrated: true, storage: 'ready', connection: 'unpaired' }); return; }
      credential = saved;
      publish({ hydrated: true, storage: 'ready', connection: 'checking' });
      try { await completeConnection(server, saved, captured); }
      catch (error) { failure(error, captured, saved.phase === 'prepared'); }
    } catch (error) {
      if (disposed || captured !== epoch) return;
      publish({ hydrated: true, connection: 'disconnected', storage: 'error', error: error instanceof MobileFailure ? error.code : 'storage_unavailable' });
    }
  }

  async function pair(rawUrl: string, code: string, name: string, freshAuthorization = false) {
    if (!snapshot.foreground || !snapshot.hydrated || snapshot.storage !== 'ready' && !(freshAuthorization && snapshot.error === 'credential_missing')) throw new MobileFailure('storage_unavailable');
    let baseUrl: string;
    try {
      baseUrl = normalizeServerUrl(rawUrl);
      if (!/^[0-9]{6}$/.test(code) || !name.trim() || name.length > 200) throw new MobileFailure('invalid_pairing');
    } catch (error) {
      publish({ error: error instanceof MobileFailure ? error.code : 'invalid_pairing' }); throw error;
    }
    const revokedServer = snapshot.connection === 'revoked' ? snapshot.server?.serverId : undefined;
    const captured = advance(); publish({ connection: 'pairing', error: null });
    try {
      const serverInfo = await discover(baseUrl, captured);
      const fresh = freshAuthorization || revokedServer === serverInfo.server_id;
      const server: ServerRecord = { ...document.servers[serverInfo.server_id], serverId: serverInfo.server_id, baseUrl, deviceName: name.trim() };
      document = { ...document, activeServerId: server.serverId, servers: { ...document.servers, [server.serverId]: server } };
      // The ordinary registry is saved first, so a safe credential cannot become undiscoverable after a cross-store interruption.
      await persist(captured); guard(captured); publish({ server: checkingServer(server), storage: 'ready' });
      const raw = await secureOperation(captured, () => options.credentials.get(credentialKey(server.serverId)));
      let saved = parseCredential(raw);
      if (!saved && server.credentialExpected && !fresh) throw new MobileFailure('credential_missing');
      if (saved && saved.phase === 'paired' && !fresh) { await completeConnection(server, saved, captured); return; }
      if (saved && saved.phase === 'prepared' && !fresh) {
        try { await completeConnection(server, saved, captured); return; }
        catch (error) { if (!(error instanceof MobileFailure) || error.status !== 401) throw error; }
      }
      if (!saved || saved.phase === 'rejected' || fresh) {
        const generatedToken = await options.random.token(); guard(captured);
        saved = { version: 1, phase: 'prepared', claim: { device_id: options.random.uuid(), device_token: generatedToken, device_name: name.trim(), code } };
        await secureSave(server.serverId, saved, captured);
      }
      document = { ...document, servers: { ...document.servers, [server.serverId]: { ...server, credentialExpected: true } } };
      await persist(captured); guard(captured);
      guard(captured); credential = saved;
      let result: DeviceConnectionRead;
      try { result = await execute(baseUrl, null, captured, client => client.POST('/pairing/claim', { body: saved!.claim })); }
      catch (error) {
        if (error instanceof MobileFailure && [403, 409, 410, 422, 429].includes(error.status)) {
          await secureSave(server.serverId, { ...saved, phase: 'rejected' }, captured);
        }
        throw error;
      }
      confirmDevice(server, saved, result);
      await completeConnection(server, saved, captured);
    } catch (error) { failure(error, captured, true); throw error; }
  }

  function draftKey(projectId: string) {
    if (!snapshot.hydrated || !snapshot.server || !uuid.test(projectId)) throw new MobileFailure('draft_unavailable');
    return JSON.stringify([snapshot.server.serverId, projectId]);
  }
  function getDraft(projectId: string): CreationDraft {
    return document.drafts?.[draftKey(projectId)] ?? blankDraft;
  }
  async function updateDraft(projectId: string, changes: Partial<CreationDraft>) {
    const key = draftKey(projectId), previous = getDraft(projectId);
    const next = Object.freeze({
      style: typeof changes.style === 'string' ? changes.style : previous.style,
      lyrics: typeof changes.lyrics === 'string' ? changes.lyrics : previous.lyrics,
      seed: typeof changes.seed === 'string' ? changes.seed : previous.seed,
      maxSeconds: typeof changes.maxSeconds === 'string' ? changes.maxSeconds : previous.maxSeconds,
    });
    document = { ...document, drafts: { ...document.drafts, [key]: next } };
    publish({});
    await persist();
  }

  function titleKey(target: TitleTarget) {
    if (!snapshot.hydrated || !snapshot.server) throw new MobileFailure('draft_unavailable');
    try { return titleDraftKey(snapshot.server.serverId, target); }
    catch { throw new MobileFailure('draft_unavailable'); }
  }
  function getTitleDraft(target: TitleTarget): string {
    const key = titleKey(target);
    return document.titles?.[key] ?? '';
  }
  async function updateTitleDraft(target: TitleTarget, value: string) {
    const key = titleKey(target);
    if (typeof value !== 'string') throw new MobileFailure('draft_unavailable');
    document = { ...document, titles: { ...document.titles, [key]: value } };
    publish({});
    await persist();
  }

  function authorization(write = false) {
    if (!snapshot.hydrated || !snapshot.foreground || snapshot.connection !== 'connected' || !snapshot.server || !credential) throw new MobileFailure('authorization_required');
    if (write && snapshot.storage !== 'ready') throw new MobileFailure('storage_unavailable');
    return { server: snapshot.server, saved: credential, captured: epoch };
  }
  async function read<T>(operation: (client: ReturnType<typeof createMusicClient>) => Promise<{ data?: T; error?: ErrorResponse; response: Response }>) {
    const { server, saved, captured } = authorization();
    try { return freeze(await execute(server.baseUrl, saved, captured, operation)); }
    catch (error) { if (error instanceof MobileFailure && (error.status === 401 || error.status === 0)) failure(error, captured); throw error; }
  }
  const getProjects = () => read(client => client.GET('/projects'));
  const getProject = (projectId: string) => read(client => client.GET('/projects/{project_id}', { params: { path: { project_id: projectId } } }));
  const getJobs = (projectId: string) => read(client => client.GET('/projects/{project_id}/jobs', { params: { path: { project_id: projectId } } }));
  async function getJob(projectId: string, jobId: string) {
    const job = await read(client => client.GET('/projects/{project_id}/jobs/{job_id}', { params: { path: { project_id: projectId, job_id: jobId } } }));
    if (job.id !== jobId || job.project_id !== projectId) throw new MobileFailure('receipt_mismatch');
    return job;
  }
  const getCandidates = (projectId: string) => read(client => client.GET('/projects/{project_id}/candidates', { params: { path: { project_id: projectId } } }));
  const getCandidate = (projectId: string, candidateId: string) => read(client => client.GET('/projects/{project_id}/candidates/{candidate_id}', { params: { path: { project_id: projectId, candidate_id: candidateId } } }));
  const getVersions = (projectId: string) => read(client => client.GET('/projects/{project_id}/versions', { params: { path: { project_id: projectId } } }));
  const getVersion = (projectId: string, versionId: string) => read(client => client.GET('/projects/{project_id}/versions/{version_id}', { params: { path: { project_id: projectId, version_id: versionId } } }));
  const getAsset = (projectId: string, assetId: string) => read(client => client.GET('/projects/{project_id}/assets/{asset_id}', { params: { path: { project_id: projectId, asset_id: assetId } } }));
  async function cancelJob(projectId: string, jobId: string) {
    const { server, saved, captured } = authorization(true);
    try {
      await execute(server.baseUrl, saved, captured, client => client.POST('/projects/{project_id}/jobs/{job_id}/cancel', {
        params: { path: { project_id: projectId, job_id: jobId } },
      }));
    } catch (error) {
      guard(captured);
      if (!(error instanceof MobileFailure) || error.status !== 0) { failure(error, captured); throw error; }
    }
    guard(captured);
    return getJob(projectId, jobId);
  }

  async function verify() {
    if (!loaded || !snapshot.hydrated) { await hydrate(); return; }
    const server = document.activeServerId ? document.servers[document.activeServerId] : undefined;
    const captured = advance();
    if (!server) { publish({ connection: 'unpaired', server: null }); return; }
    publish({ connection: 'checking', server: checkingServer(server), error: null });
    try {
      const raw = await secureOperation(captured, () => options.credentials.get(credentialKey(server.serverId)));
      const saved = parseCredential(raw);
      if (!saved) throw new MobileFailure('credential_missing');
      if (saved.phase === 'rejected') { publish({ connection: 'unpaired' }); return; }
      await completeConnection(server, saved, captured);
    } catch (error) {
      if (error instanceof MobileFailure && ['credential_missing', 'secure_storage_invalid'].includes(error.code)) publish({ storage: 'error' });
      failure(error, captured); throw error;
    }
  }
  async function switchServer(serverId: string) {
    if (!loaded || snapshot.storage !== 'ready' || !document.servers[serverId]) throw new MobileFailure('server_not_saved');
    const captured = advance();
    document = { ...document, activeServerId: serverId };
    publish({ connection: 'checking', server: checkingServer(document.servers[serverId]), error: null });
    await persist(captured); await verify();
  }
  async function retryStorage() {
    if (!loaded) { await hydrate(); return; }
    const captured = epoch;
    await persist(captured);
    const server = document.activeServerId ? document.servers[document.activeServerId] : undefined;
    let shouldVerify = false;
    if (server) {
      try {
        const raw = await secureOperation(captured, () => options.credentials.get(credentialKey(server.serverId)));
        const saved = parseCredential(raw);
        if (!saved && server.credentialExpected) throw new MobileFailure('credential_missing');
        publish({ storage: 'ready', error: null });
        shouldVerify = !!saved && saved.phase !== 'rejected';
      } catch (error) {
        guard(captured);
        if (error instanceof MobileFailure && error.status === 0 && snapshot.storage !== 'ready') publish({ storage: 'error', error: error.code });
        throw error;
      }
    }
    if (shouldVerify) { await verify(); return; }
    publish({ storage: 'ready', connection: 'unpaired', error: null });
  }
  async function setForeground(active: boolean) {
    if (active === snapshot.foreground) return;
    if (!active) { advance(); publish({ foreground: false, connection: snapshot.server ? 'disconnected' : 'unpaired' }); return; }
    publish({ foreground: true }); await verify();
  }
  async function refreshWatcher(watcher: Watcher, captured: number, connect = true) {
    if (watcher.stopped || watcher.serverId !== snapshot.server?.serverId || !snapshot.foreground) return;
    if (watcher.reading) { watcher.refreshQueued = true; return watcher.reading; }
    const reading = (async () => {
      try {
        const job = await getJob(watcher.projectId, watcher.jobId); guard(captured);
        if (watcher.stopped) return;
        watcher.observer.job(job);
        guard(captured);
        if (watcher.stopped) return;
        if (['completed', 'failed', 'cancelled'].includes(job.status)) { watcher.socket?.close(); watcher.socket = undefined; return; }
        if (connect && !watcher.socket && options.socket) {
          const { server, saved } = authorization();
          watcher.socket = options.socket(jobEventsUrl(server.baseUrl, watcher.projectId, watcher.jobId).toString(),
            { Authorization: `Bearer ${saved.claim.device_token}` }, {
              message: () => { if (captured === epoch && !watcher.stopped) void refreshWatcher(watcher, captured); },
              close: code => {
                if (captured !== epoch || watcher.stopped) return;
                watcher.socket = undefined;
                if (code === 1008 || code === 4401) void verify().catch(() => {});
                else if (code !== 1000) void refreshWatcher(watcher, captured, false);
              },
            });
        }
      } catch (error) {
        if (!disposed && captured === epoch && !watcher.stopped) watcher.observer.error(error instanceof MobileFailure ? error : new MobileFailure('connection_unavailable'));
      }
    })();
    watcher.reading = reading;
    await reading;
    if (watcher.reading === reading) {
      watcher.reading = undefined;
      if (watcher.refreshQueued && captured === epoch && snapshot.connection === 'connected') {
        watcher.refreshQueued = false; await refreshWatcher(watcher, captured, connect);
      }
    }
  }
  function watchJob(projectId: string, jobId: string, observer: JobObserver) {
    const { server, captured } = authorization();
    const watcher: Watcher = { serverId: server.serverId, projectId, jobId, observer, stopped: false };
    watchers.add(watcher); void refreshWatcher(watcher, captured);
    return () => { watcher.stopped = true; watcher.socket?.close(); watchers.delete(watcher); };
  }
  async function authorizeMedia(projectId: string, assetId: string) {
    if (!uuid.test(projectId) || !uuid.test(assetId)) throw new MobileFailure('invalid_media');
    const { server, saved, captured } = authorization();
    try {
      const advertised = await discover(server.baseUrl, captured);
      if (advertised.server_id !== server.serverId) throw new MobileFailure('server_mismatch');
      const device = await execute(server.baseUrl, saved, captured, client => client.GET('/device'));
      confirmDevice(server, saved, device);
      const asset = await getAsset(projectId, assetId); guard(captured);
      if (asset.id !== assetId || asset.project_id !== projectId || !['generated_audio', 'reference_audio'].includes(asset.kind)) throw new MobileFailure('invalid_media');
      const isCurrent = () => !disposed && captured === epoch && snapshot.foreground && snapshot.connection === 'connected';
      return Object.freeze({
        epoch: captured, serverId: server.serverId, deviceId: saved.claim.device_id, projectId, assetId, isCurrent,
        createRequest: (signal?: AbortSignal) => {
          if (!isCurrent()) throw new MobileFailure('session_changed');
          return new Request(`${server.baseUrl}/projects/${projectId}/assets/${assetId}/content`, {
            headers: { Authorization: `Bearer ${saved.claim.device_token}` }, redirect: 'error', signal,
          });
        },
      });
    } catch (error) { failure(error, captured); throw error; }
  }
  function listIntents(projectId?: string) {
    const serverId = snapshot.server?.serverId;
    return Object.freeze(Object.values(document.intents ?? {}).filter(intent => intent.serverId === serverId &&
      (!projectId || 'projectId' in intent && intent.projectId === projectId)));
  }
  function getIntent(id: string) {
    if (!snapshot.server) throw new MobileFailure('authorization_required');
    const intent = document.intents?.[scopedKey(snapshot.server.serverId, id)];
    if (!intent) throw new MobileFailure('intent_not_found');
    return intent;
  }
  async function saveIntent(value: PendingIntent, captured: number) {
    guard(captured);
    document = { ...document, intents: { ...document.intents, [scopedKey(value.serverId, value.id)]: freeze(value) } };
    publish({}); await persist(captured); guard(captured);
    return value;
  }
  async function prepareIntent(input: IntentInput) {
    const { server, captured } = authorization(true);
    let frozen: IntentInput;
    try { frozen = parseIntentInput(input); } catch { throw new MobileFailure('invalid_intent'); }
    const sameTarget = (other: PendingIntent) => other.operation === frozen.operation &&
      (frozen.operation === 'create_project' || 'projectId' in other && other.projectId === frozen.projectId) &&
      (frozen.operation !== 'retry' || other.operation === 'retry' && other.jobId === frozen.jobId) &&
      (frozen.operation !== 'save_version' || other.operation === 'save_version' && other.body.candidate_id === frozen.body.candidate_id);
    if (listIntents().some(other => ['prepared', 'unknown'].includes(other.phase) && sameTarget(other))) throw new MobileFailure('intent_pending');
    const id = options.random.uuid();
    if (!uuid.test(id) || document.intents?.[scopedKey(server.serverId, id)]) throw new MobileFailure('intent_identity_invalid');
    return saveIntent({ ...frozen, id, serverId: server.serverId, phase: 'prepared' }, captured);
  }
  async function prepareGenerate(projectId: string) {
    const draft = getDraft(projectId);
    const style = draft.style.trim(), lyrics = draft.lyrics.trim();
    const seed = Number(draft.seed.trim()), maxSeconds = draft.maxSeconds.trim() === '' ? 0 : Number(draft.maxSeconds);
    if (!style || style.length > 1024 || !lyrics || lyrics.length > 10000 || !draft.seed.trim() || !Number.isSafeInteger(seed) || seed < 0 ||
      !Number.isInteger(maxSeconds) || maxSeconds !== 0 && (maxSeconds < 5 || maxSeconds > 360)) throw new MobileFailure('invalid_generate');
    return prepareIntent({ operation: 'generate', projectId, body: { style, lyrics, seed, max_seconds: maxSeconds } });
  }
  async function recoverIntent(id: string) {
    const intent = getIntent(id), { captured } = authorization();
    if (intent.phase !== 'unknown') return intent;
    try {
      if (intent.operation === 'save_version') {
        const versions = await read(client => client.GET('/projects/{project_id}/versions', { params: { path: { project_id: intent.projectId } } }));
        const actual = versions.find(version => version.candidate_id === intent.body.candidate_id);
        if (!actual) return intent;
        if (actual.project_id !== intent.projectId || !uuid.test(actual.id)) throw new MobileFailure('receipt_mismatch');
        let expectedParent = intent.body.parent_version_id ?? null;
        if (intent.body.parent_version_id == null && actual.parent_version_id !== null) {
          const candidate = await read(client => client.GET('/projects/{project_id}/candidates/{candidate_id}', {
            params: { path: { project_id: intent.projectId, candidate_id: intent.body.candidate_id } },
          }));
          if ('source_score_id' in candidate.inputs) expectedParent = candidate.inputs.parent_version_id ?? null;
        }
        guard(captured);
        const matching = actual.name === intent.body.name.trim() && actual.parent_version_id === expectedParent;
        return saveIntent({ ...intent, phase: matching ? 'confirmed' : 'rejected', resourceId: actual.id, error: matching ? undefined : 'version_already_saved' }, captured);
      }
      const receipt = await read(client => client.GET('/requests/{request_id}', { params: { path: { request_id: intent.id } } })); guard(captured);
      if (receipt.request_id !== intent.id || receipt.operation !== intent.operation || !uuid.test(receipt.resource_id) || !uuid.test(receipt.project_id) ||
        receipt.resource_type !== (intent.operation === 'create_project' ? 'project' : 'job') ||
        (intent.operation === 'create_project' ? receipt.project_id !== receipt.resource_id : receipt.project_id !== intent.projectId) ||
        receipt.source_job_id !== (intent.operation === 'retry' ? intent.jobId : null)) throw new MobileFailure('receipt_mismatch');
      if (intent.operation === 'create_project') {
        const project = await read(client => client.GET('/projects/{project_id}', { params: { path: { project_id: receipt.resource_id } } }));
        if (project.id !== receipt.resource_id) throw new MobileFailure('receipt_mismatch');
      } else {
        const job = await read(client => client.GET('/projects/{project_id}/jobs/{job_id}', { params: { path: { project_id: intent.projectId, job_id: receipt.resource_id } } }));
        if (job.id !== receipt.resource_id || job.project_id !== intent.projectId) throw new MobileFailure('receipt_mismatch');
      }
      guard(captured);
      return saveIntent({ ...intent, phase: 'confirmed', resourceId: receipt.resource_id, error: undefined }, captured);
    } catch (error) {
      guard(captured);
      if (error instanceof MobileFailure && error.status === 404) return intent;
      throw error;
    }
  }
  async function recoverPending(captured: number) {
    for (const intent of listIntents()) {
      guard(captured);
      if (intent.phase === 'unknown') await recoverIntent(intent.id);
    }
  }
  async function submitIntent(id: string, explicitReplay = false) {
    const { server, saved, captured } = authorization(true);
    const key = scopedKey(server.serverId, id);
    if (sending.has(key)) throw new MobileFailure('intent_in_flight');
    let intent = getIntent(id);
    if (intent.phase === 'confirmed' || intent.operation === 'save_version' && intent.resourceId) return intent;
    if (intent.phase !== 'prepared' && !explicitReplay) throw new MobileFailure('intent_needs_recovery');
    sending.add(key);
    try {
      if (explicitReplay && intent.phase === 'unknown') {
        intent = await recoverIntent(id); guard(captured);
        if (intent.phase === 'confirmed' || intent.operation === 'save_version' && intent.resourceId) return intent;
      }
      intent = await saveIntent({ ...intent, phase: 'unknown', error: undefined }, captured);
      const frozen = intent;
      let resourceId: string;
      if (frozen.operation === 'create_project') {
        const project = await execute(server.baseUrl, saved, captured, client => client.POST('/projects', { headers: { 'Idempotency-Key': frozen.id }, body: frozen.body }));
        resourceId = project.id;
      } else if (frozen.operation === 'generate' || frozen.operation === 'retry') {
        const job = frozen.operation === 'generate'
          ? await execute(server.baseUrl, saved, captured, client => client.POST('/projects/{project_id}/jobs/generate', {
            params: { path: { project_id: frozen.projectId } }, headers: { 'Idempotency-Key': frozen.id }, body: frozen.body,
          }))
          : await execute(server.baseUrl, saved, captured, client => client.POST('/projects/{project_id}/jobs/{job_id}/retry', {
            params: { path: { project_id: frozen.projectId, job_id: frozen.jobId } }, headers: { 'Idempotency-Key': frozen.id },
          }));
        if (job.project_id !== frozen.projectId) throw new MobileFailure('receipt_mismatch');
        resourceId = job.id;
      } else {
        const version = await execute(server.baseUrl, saved, captured, client => client.POST('/projects/{project_id}/versions', {
          params: { path: { project_id: frozen.projectId } }, body: frozen.body,
        }));
        if (version.project_id !== frozen.projectId || version.candidate_id !== frozen.body.candidate_id) throw new MobileFailure('receipt_mismatch');
        resourceId = version.id;
      }
      if (!uuid.test(resourceId)) throw new MobileFailure('receipt_mismatch');
      return await saveIntent({ ...intent, phase: 'confirmed', resourceId }, captured);
    } catch (error) {
      guard(captured);
      const problem = error instanceof MobileFailure ? error : new MobileFailure('connection_unavailable');
      if (snapshot.storage === 'ready') {
        const uncertainSaveConflict = intent.operation === 'save_version' && problem.status === 409;
        await saveIntent({ ...getIntent(id), phase: problem.status >= 400 && problem.status < 500 && !uncertainSaveConflict ? 'rejected' : 'unknown', error: problem.code }, captured);
        if (uncertainSaveConflict) await recoverIntent(id);
      }
      if (problem.status === 401 || problem.status === 0) failure(problem, captured);
      throw error;
    } finally { sending.delete(key); }
  }

  return {
    hydrate, pair, verify, switchServer, retryStorage, setForeground, watchJob, authorizeMedia, getDraft, updateDraft, getTitleDraft, updateTitleDraft,
    getProjects, getProject, getJobs, getJob, getCandidates, getCandidate, getVersions, getVersion, getAsset, cancelJob,
    prepareIntent, prepareGenerate, submitIntent, recoverIntent, listIntents,
    getServers: () => freeze(Object.values(document.servers)),
    replayIntent: (id: string) => submitIntent(id, true),
    suspend: () => { advance(); publish({ connection: snapshot.server ? 'disconnected' : 'unpaired' }); },
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    dispose: () => { disposed = true; advance(); listeners.clear(); watchers.clear(); },
  };
}
