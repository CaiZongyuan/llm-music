import { createContext, use, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';

import { useMobileSession } from '@/data/provider';
import { createNativeMediaController } from './native-controller';

type MediaController = ReturnType<typeof createNativeMediaController>;
const MediaContext = createContext<MediaController | null>(null);

export function MobileMediaProvider({ children }: { children: ReactNode }) {
  const { session } = useMobileSession();
  const [controller] = useState(() => createNativeMediaController(session));
  useEffect(() => { controller.start(); return () => { void controller.suspend().catch(() => {}); }; }, [controller]);
  return <MediaContext value={controller}>{children}</MediaContext>;
}

export function useMediaPlayer() {
  const controller = use(MediaContext);
  if (!controller) throw new Error('MobileMediaProvider is missing');
  return { controller, state: useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot) };
}
