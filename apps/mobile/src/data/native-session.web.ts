import { createMobileSession } from './session';

// SQLite exclusive transactions have no web substitute in this product entrypoint.
export function createNativeSession() {
  const unavailable = async (): Promise<never> => { throw new Error('Native storage is unavailable on web'); };
  return createMobileSession({
    store: { load: unavailable, save: unavailable },
    random: { uuid: () => '' },
    fetch: request => fetch(request),
  });
}
