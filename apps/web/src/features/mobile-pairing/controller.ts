import type { components, createMusicClient, ErrorResponse } from '@llm-music/api-client';

type Owner = components['schemas']['OwnerRead'];
type Device = components['schemas']['DeviceRead'];
type Code = components['schemas']['ChallengeCreated'];
type PublicOwner = Omit<Owner, 'owner_csrf'>;
export type PairingSnapshot = Readonly<{ owner?: PublicOwner; devices?: readonly Device[]; code: Code | null;
  loading: boolean; busy: boolean; ownerError: string | null; deviceError: string | null; error: string | null; unknownOpen: boolean }>;

class PairingFailure extends Error {
  readonly status: number;
  constructor(code: string, status = 0) { super(code); this.status = status; }
}
function received<T>(result: { data?: T; error?: ErrorResponse; response: Response }): T {
  if (!result.response.ok || result.data === undefined) throw new PairingFailure(result.error?.error?.code ?? 'pairing_read_failed', result.response.status);
  return result.data;
}
const codeOf = (error: unknown) => error instanceof PairingFailure ? error.message : 'pairing_connection_unavailable';

/** Owner tokens and plaintext codes remain in this mounted computer panel. */
export function createPairingAdmin(client: ReturnType<typeof createMusicClient>) {
  let csrf = '', epoch = 0;
  let state: PairingSnapshot = Object.freeze({ code: null, loading: false, busy: false, ownerError: null, deviceError: null, error: null, unknownOpen: false });
  const listeners = new Set<() => void>();
  const requests = new Set<AbortController>();
  const publish = (patch: Partial<PairingSnapshot>) => { state = Object.freeze({ ...state, ...patch }); listeners.forEach(listener => listener()); };
  const guard = (captured: number) => { if (captured !== epoch) throw new PairingFailure('pairing_panel_changed'); };
  async function readAll(captured = epoch) {
    publish({ loading: true });
    const controller = new AbortController(); requests.add(controller);
    const results = await Promise.allSettled([
      client.GET('/pairing/owner', { redirect: 'error', signal: controller.signal }).then(received),
      client.GET('/pairing/devices', { redirect: 'error', signal: controller.signal }).then(received),
    ]).finally(() => requests.delete(controller));
    guard(captured);
    const owner = results[0], devices = results[1];
    if (owner.status === 'fulfilled') {
      const value = owner.value; csrf = value.owner_csrf;
      const publicOwner: PublicOwner = { server_id: value.server_id, lan_address: value.lan_address, challenge: value.challenge ? Object.freeze({ ...value.challenge }) : null };
      const code = state.code && value.challenge?.id === state.code.id && value.challenge.status === 'active' && value.challenge.expires_at > Date.now() / 1000 ? state.code : null;
      publish({ owner: Object.freeze(publicOwner), ownerError: null, code });
    } else { csrf = ''; publish({ ownerError: codeOf(owner.reason), code: null }); }
    if (devices.status === 'fulfilled') publish({ devices: Object.freeze(devices.value.map(device => Object.freeze(device))), deviceError: null });
    else publish({ deviceError: codeOf(devices.reason) });
    publish({ loading: false });
  }
  async function open() {
    if (state.busy || state.loading) throw new PairingFailure('pairing_busy');
    const captured = epoch;
    const controller = new AbortController(); requests.add(controller);
    let posted = false;
    publish({ busy: true, code: null, error: null, unknownOpen: false });
    try {
      if (!csrf) await readAll(captured);
      guard(captured);
      if (!csrf) throw new PairingFailure('pairing_read_failed');
      posted = true;
      const created = received(await client.POST('/pairing/challenges', { headers: { 'X-Owner-CSRF': csrf }, redirect: 'error', signal: controller.signal }));
      guard(captured);
      const challenge = { id: created.id, expires_at: created.expires_at, attempts_remaining: created.attempts_remaining, status: created.status };
      publish({ code: Object.freeze(created), owner: state.owner ? Object.freeze({ ...state.owner, challenge: Object.freeze(challenge) }) : undefined });
    } catch (error) {
      guard(captured);
      const unknownOpen = posted && (!(error instanceof PairingFailure) || error.status === 0 || error.status >= 500);
      publish({ error: codeOf(error), unknownOpen, code: null });
      await readAll(captured); throw error;
    } finally { requests.delete(controller); if (captured === epoch) publish({ busy: false }); }
  }
  async function manage(operation: (token: string, signal: AbortSignal) => Promise<{ response: Response; error?: ErrorResponse }>) {
    if (state.busy || state.loading) throw new PairingFailure('pairing_busy');
    const captured = epoch, controller = new AbortController(); requests.add(controller);
    publish({ busy: true, error: null, code: null });
    try {
      if (!csrf) await readAll(captured);
      guard(captured);
      if (!csrf) throw new PairingFailure('pairing_read_failed');
      const result = await operation(csrf, controller.signal); guard(captured);
      // Closing returns 204: success has no JSON data and must not use received().
      if (!result.response.ok) throw new PairingFailure(result.error?.error?.code ?? 'pairing_write_failed', result.response.status);
      await readAll(captured);
    } catch (error) {
      guard(captured); publish({ error: codeOf(error) }); await readAll(captured); throw error;
    } finally { requests.delete(controller); if (captured === epoch) publish({ busy: false }); }
  }
  return {
    open,
    close: () => manage((token, signal) => client.DELETE('/pairing/challenges/current', { headers: { 'X-Owner-CSRF': token }, redirect: 'error', signal })),
    revoke: (deviceId: string) => manage((token, signal) => client.DELETE('/pairing/devices/{device_id}', {
      params: { path: { device_id: deviceId } }, headers: { 'X-Owner-CSRF': token }, redirect: 'error', signal,
    })),
    refresh: () => state.busy || state.loading ? Promise.resolve() : readAll(),
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    suspend: () => { epoch++; csrf = ''; requests.forEach(request => request.abort()); requests.clear(); publish({ code: null, busy: false, loading: false }); },
  };
}
