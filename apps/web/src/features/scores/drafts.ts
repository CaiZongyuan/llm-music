import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { GenerateFromScoreCreate } from '@llm-music/api-client';

export type SelectedScore = Readonly<Pick<GenerateFromScoreCreate, 'abc' | 'source_score_id' | 'parent_version_id'> & { revision: number; abcSha256: string }>;
type ScoreDraft = { abc: string; revision: number; checkedABC: string | null; selected: SelectedScore | null; selectedContext: string | symbol | null };
const drafts = new Map<string, ScoreDraft>();
const listeners = new Set<() => void>();
const selected = new Map<string, SelectedScore>();
const owners = new Map<string, symbol>();

function notify() { listeners.forEach(listener => listener()); }

function draftFor(key: string, abc: string): ScoreDraft {
  let draft = drafts.get(key);
  if (!draft) { draft = { abc, revision: 1, checkedABC: null, selected: null, selectedContext: null }; drafts.set(key, draft); }
  return draft;
}
// Creative drafts persist across tabs in this session. Durable Scores stay in Query/API.
export function useScoreDraft(projectId: string, scoreId: string, initialABC: string, context: string | symbol = 'score') {
  const key = `${projectId}/${scoreId}`;
  const owner = useRef(Symbol(key)).current;
  const draft = useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => draftFor(key, initialABC));
  useEffect(() => {
    owners.set(projectId, owner);
    selected.delete(projectId);
    notify();
    return () => {
      if (owners.get(projectId) !== owner) return;
      owners.delete(projectId); selected.delete(projectId); notify();
    };
  }, [projectId, owner, context]);
  function edit(abc: string) {
    if (owners.get(projectId) !== owner) return;
    const current = draftFor(key, initialABC);
    drafts.set(key, { ...current, abc, revision: current.revision + 1, checkedABC: null });
    selected.delete(projectId);
    notify();
  }
  function select(value: SelectedScore) {
    // A late save may fill Query's durable cache, but cannot change the choice
    // in a different editor or in a remounted instance of this editor.
    if (owners.get(projectId) !== owner) return;
    const snapshot = Object.freeze({ ...value });
    drafts.set(key, { ...draftFor(key, initialABC), selected: snapshot, selectedContext: context });
    if (draftFor(key, initialABC).checkedABC === snapshot.abc) selected.set(projectId, snapshot);
    notify();
  }
  function check(abc: string | null) {
    if (owners.get(projectId) !== owner) return;
    const current = draftFor(key, initialABC);
    if (abc !== null && current.abc !== abc) return;
    drafts.set(key, { ...current, checkedABC: abc });
    if (abc && current.selected?.abc === abc && current.selectedContext === context) selected.set(projectId, current.selected);
    else selected.delete(projectId);
    notify();
  }
  return [draft, edit, select, check] as const;
}

// #42 consumes only explicit saved selections. Editing invalidates readiness.
export function selectedScore(projectId: string): SelectedScore | null { return selected.get(projectId) ?? null; }
export function subscribeSelectedScore(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
