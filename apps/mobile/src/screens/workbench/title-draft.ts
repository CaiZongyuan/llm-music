import { useState } from 'react';
import { useMobileSession } from '@/data/provider';
import { MobileFailure, type TitleTarget } from '@/data/session';
import { creatorMessage } from './use-creator-action';

export function useTitleDraft(kind: 'project' | 'version', projectId = '', candidateId = '') {
  const { session, state } = useMobileSession(), [error, setError] = useState('');
  const target: TitleTarget = kind === 'project' ? { kind } : { kind, projectId, candidateId };
  let available = state.hydrated && !!state.server;
  let value = '';
  if (available) {
    try { value = session.getTitleDraft(target); }
    catch (problem) {
      if (!(problem instanceof MobileFailure) || problem.code !== 'draft_unavailable') throw problem;
      available = false;
    }
  }
  const key = JSON.stringify([state.server?.serverId, kind, projectId, candidateId]);
  return {
    key, available, value,
    error: state.storage === 'error' ? error : '',
    set: (value: string) => {
      const serverId = state.server?.serverId;
      void session.updateTitleDraft(target, value).catch(problem => {
        if (session.getSnapshot().server?.serverId === serverId) setError(creatorMessage(problem));
      });
    },
  };
}
