import { fetch as expoFetch } from 'expo/fetch';

import { createMediaController } from './controller';
import { createNativeAudioCache } from './native-cache';
import { createNativePlayback } from './native-player';
import type { MediaSession } from './types';

export function createNativeMediaController(session: MediaSession) {
  return createMediaController({ session, cache: createNativeAudioCache(), player: { create: createNativePlayback },
    fetch: request => expoFetch(request, { redirect: 'error' }) });
}
