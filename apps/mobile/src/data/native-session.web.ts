import { createMobileSession } from './session';

// Native credentials and SQLite exclusive transactions have no web substitute in this product entrypoint.
export function createNativeSession() {
  const unavailable = async (): Promise<never> => { throw new Error('Native storage is unavailable on web'); };
  return createMobileSession({
    store: { load: unavailable, save: unavailable },
    credentials: { get: unavailable, set: unavailable },
    random: { uuid: () => '', token: unavailable },
    fetch: request => fetch(request),
  });
}
