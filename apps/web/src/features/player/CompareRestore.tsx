import { useEffect, useSyncExternalStore } from 'react';
import { compareChoice, playerSelection, restorePlayerCompare, subscribePlayerSelection } from './index';
import { useMessages } from '../preferences/Preferences';
import { playerMessages } from './messages';

export function CompareRestore({ projectId }: { projectId: string }) {
  const t = useMessages(playerMessages);
  const choice = useSyncExternalStore(subscribePlayerSelection, () => compareChoice(projectId));
  const selection = useSyncExternalStore(subscribePlayerSelection, playerSelection);
  useEffect(() => { restorePlayerCompare(projectId); }, [projectId]);
  return choice.notice && !(selection?.kind === 'compare' && selection.projectId === projectId)
    ? <p className="field-help" role="alert">{choice.notice === 'storage' ? t.storageWarning : t.pairLost}</p> : null;
}
