import { useSyncExternalStore } from 'react';
import type { components } from '@llm-music/api-client';
import type { SelectedScore } from '../scores/drafts';

export type CoverMode = components['schemas']['CoverCreate']['mode'];
export type CoverInspection = Readonly<{ id: string; score: SelectedScore; referenceId: string; contextScoreId: string; mode: CoverMode; modeRevision: number; validation: components['schemas']['CoverValidationRead'] }>;
type Selection = Readonly<{ mode: CoverMode; modeRevision: number; inspection: CoverInspection | null; choice: CoverInspection | null }>;
const selections = new Map<string, Selection>();
const listeners = new Set<() => void>();
const empty: Selection = Object.freeze({ mode: 'melody', modeRevision: 0, inspection: null, choice: null });
export function coverSelection(projectId: string): Selection { return selections.get(projectId) ?? empty; }
function set(projectId: string, value: Selection) { selections.set(projectId, Object.freeze(value)); listeners.forEach(listener => listener()); }
// Retain readable snapshots. Each mode change requires a new inspection and
// choice, including switching back to a mode with identical effective ABC.
export function setCoverMode(projectId: string, mode: CoverMode) {
  const current = coverSelection(projectId);
  if (mode !== current.mode) set(projectId, { ...current, mode, modeRevision: current.modeRevision + 1 });
}
export function inspectCoverInput(projectId: string, value: CoverInspection) {
  const current = coverSelection(projectId);
  if (value.mode === current.mode && value.modeRevision === current.modeRevision && value.validation.mode === current.mode) set(projectId, { ...current, inspection: Object.freeze(value) });
}
export function chooseCoverInput(projectId: string, value: CoverInspection) {
  const current = coverSelection(projectId);
  if (value === current.inspection && value.mode === current.mode && value.modeRevision === current.modeRevision) set(projectId, { ...current, choice: value });
}
export function useCoverSelection(projectId: string) {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => coverSelection(projectId));
}
