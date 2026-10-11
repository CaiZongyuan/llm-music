import { createMediaController, MediaFailure } from './controller';
import type { MediaSession } from './types';

export function createNativeMediaController(session: MediaSession) {
  return createMediaController({ session,
    fetch: (request, init) => fetch(request, init),
    cache: { create: async () => { throw new MediaFailure('media_native_required'); } },
    player: { create: () => { throw new MediaFailure('media_native_required'); } },
  });
}
