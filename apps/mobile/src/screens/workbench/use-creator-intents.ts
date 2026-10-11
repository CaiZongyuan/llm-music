import { useMemo, useSyncExternalStore } from 'react';
import { useMobileSession } from '@/data/provider';
import { createCreatorIntentStore } from './intent-store';

export function useCreatorIntents(projectId?: string) {
  const { session } = useMobileSession();
  const store = useMemo(() => createCreatorIntentStore(session, projectId), [session, projectId]);
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
