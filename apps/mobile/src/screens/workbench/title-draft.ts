import { useState, useSyncExternalStore } from 'react';
import { useMobileSession } from '@/data/provider';
import { MobileFailure, type TitleTarget } from '@/data/session';
import { creatorMessage } from './use-creator-action';

export function useTitleDraft(kind: 'project' | 'version', projectId = '', candidateId = '') {
  const { session, state } = useMobileSession(), [error, setError] = useState('');
  const target: TitleTarget = kind === 'project' ? { kind } : { kind, projectId, candidateId };
  const readTitle = () => {
    try { return session.getTitleDraft(target); }
    catch (problem) {
      if (!(problem instanceof MobileFailure) || problem.code !== 'draft_unavailable') throw problem;
      return undefined;
    }
  };
  // Typing changes the document while the session/server dependencies stay stable.
  const value = useSyncExternalStore(session.subscribe, readTitle, readTitle);
  const key = JSON.stringify([state.server?.serverId, kind, projectId, candidateId]);
  return {
    key, available: value !== undefined, value: value ?? '',
    error: state.storage === 'error' ? error : '',
    set: (value: string) => {
      const serverId = state.server?.serverId;
      void session.updateTitleDraft(target, value).catch(problem => {
        if (session.getSnapshot().server?.serverId === serverId) setError(creatorMessage(problem));
      });
    },
  };
}
