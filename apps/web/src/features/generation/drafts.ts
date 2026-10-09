import { useSyncExternalStore } from 'react';
import type { GenerateCreate } from '@llm-music/api-client';

export type GenerationDraft = { style: string; lyrics: string; seed: string; maxSeconds: string };
const drafts = new Map<string, GenerationDraft>();
const listeners = new Set<() => void>();

// '' or '0' follows the lyrics (the model default); otherwise an integer ceiling of 5–360 seconds.
export function requestedCeiling(maxSeconds: string): number | null {
  const text = maxSeconds.trim();
  if (text === '' || text === '0') return 0;
  if (!/^\d+$/.test(text)) return null;
  const seconds = Number(text);
  return Number.isSafeInteger(seconds) && seconds >= 5 && seconds <= 360 ? seconds : null;
}

function draftFor(projectId: string, initial?: GenerateCreate): GenerationDraft {
  let draft = drafts.get(projectId);
  if (!draft) {
    draft = { style: initial?.style ?? '', lyrics: initial?.lyrics ?? '', seed: String(initial?.seed ?? 42),
      maxSeconds: initial?.max_seconds ? String(initial.max_seconds) : '' };
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
