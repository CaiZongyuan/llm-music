import { useSyncExternalStore } from 'react';
import type { GenerateCreate } from '@llm-music/api-client';

export type GenerationDraft = { style: string; lyrics: string; seed: string };
const drafts = new Map<string, GenerationDraft>();
const listeners = new Set<() => void>();

function draftFor(projectId: string, initial?: GenerateCreate): GenerationDraft {
  let draft = drafts.get(projectId);
  if (!draft) {
    draft = { style: initial?.style ?? '', lyrics: initial?.lyrics ?? '', seed: String(initial?.seed ?? 42) };
    drafts.set(projectId, draft);
  }
  return draft;
}
// Draft text is local UI state. Candidate/Version snapshots always come from the API.
export function updateGenerationDraft(projectId: string, changes: Partial<GenerationDraft>) {
  drafts.set(projectId, { ...draftFor(projectId), ...changes });
  listeners.forEach(listener => listener());
}
export function useGenerationDraft(projectId: string, initial?: GenerateCreate) {
  const draft = useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => draftFor(projectId, initial));
  function update(changes: Partial<GenerationDraft>) {
    updateGenerationDraft(projectId, changes);
  }
  return [draft, update] as const;
}
