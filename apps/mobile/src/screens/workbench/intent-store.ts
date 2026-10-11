import type { PendingIntent } from '../../data/session.ts';
import type { WorkbenchSession } from './actions.ts';

/** A mounted view of M3's document; M3 owns every intent and change signal. */
export function createCreatorIntentStore(session: WorkbenchSession, projectId?: string) {
  let parent: ReturnType<WorkbenchSession['getSnapshot']> | undefined;
  let intents: readonly PendingIntent[] = [];
  return {
    subscribe: session.subscribe,
    getSnapshot: () => {
      const next = session.getSnapshot();
      if (next !== parent) {
        intents = session.listIntents(projectId);
        parent = next;
      }
      return intents;
    },
  };
}
