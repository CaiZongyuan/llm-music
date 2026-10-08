import { useSyncExternalStore } from 'react';
import type { components } from '@llm-music/api-client';
import type { SelectedScore } from '../scores/drafts';

export type CoverInspection = Readonly<{ id: string; score: SelectedScore; referenceId: string; contextScoreId: string; validation: components['schemas']['CoverValidationRead'] }>;
type Selection = Readonly<{ inspection: CoverInspection | null; choice: CoverInspection | null }>;
const selections = new Map<string, Selection>();
const listeners = new Set<() => void>();
const empty: Selection = Object.freeze({ inspection: null, choice: null });
function state(projectId: string): Selection { return selections.get(projectId) ?? empty; }
function set(projectId: string, value: Selection) { selections.set(projectId, Object.freeze(value)); listeners.forEach(listener => listener()); }
// Selection intent survives editor/source changes; current eligibility is always
// derived from the actual saved Score, Reference and visible transcription.
export function inspectCoverInput(projectId: string, value: CoverInspection) { set(projectId, { ...state(projectId), inspection: Object.freeze(value) }); }
export function chooseCoverInput(projectId: string, value: CoverInspection) { set(projectId, { ...state(projectId), choice: value }); }
export function useCoverSelection(projectId: string) {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => state(projectId));
}
