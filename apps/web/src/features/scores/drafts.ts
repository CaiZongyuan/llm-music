import { useSyncExternalStore } from 'react';
import type { GenerateFromScoreCreate } from '@llm-music/api-client';

export type SelectedScore = Readonly<Pick<GenerateFromScoreCreate, 'abc' | 'source_score_id' | 'parent_version_id'> & { revision: number; abcSha256: string }>;
type ScoreDraft = { abc: string; revision: number; checkedABC: string | null; selected: SelectedScore | null };
const drafts = new Map<string, ScoreDraft>();
const listeners = new Set<() => void>();
const selected = new Map<string, SelectedScore>();

function draftFor(key: string, abc: string): ScoreDraft {
  let draft = drafts.get(key);
  if (!draft) { draft = { abc, revision: 1, checkedABC: null, selected: null }; drafts.set(key, draft); }
  return draft;
}
// Creative drafts persist across tabs in this session. Durable Scores stay in Query/API.
export function useScoreDraft(projectId: string, scoreId: string, initialABC: string) {
  const key = `${projectId}/${scoreId}`;
  const draft = useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => draftFor(key, initialABC));
  function edit(abc: string) {
    const current = draftFor(key, initialABC);
    drafts.set(key, { ...current, abc, revision: current.revision + 1, checkedABC: null });
    selected.delete(projectId);
    listeners.forEach(listener => listener());
  }
  function select(value: SelectedScore) {
    const snapshot = Object.freeze({ ...value });
    drafts.set(key, { ...draftFor(key, initialABC), selected: snapshot });
    if (draftFor(key, initialABC).checkedABC === snapshot.abc) selected.set(projectId, snapshot);
    listeners.forEach(listener => listener());
  }
  function check(abc: string | null) {
    const current = draftFor(key, initialABC);
    if (abc !== null && current.abc !== abc) return;
    drafts.set(key, { ...current, checkedABC: abc });
    if (abc && current.selected?.abc === abc) selected.set(projectId, current.selected);
    else selected.delete(projectId);
    listeners.forEach(listener => listener());
  }
  return [draft, edit, select, check] as const;
}

// #42 consumes only explicit saved selections. Editing invalidates readiness.
export function selectedScore(projectId: string): SelectedScore | null { return selected.get(projectId) ?? null; }
export function subscribeSelectedScore(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
