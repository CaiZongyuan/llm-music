import type { components } from '@llm-music/api-client';

export type ListeningRecord = { kind: 'candidate' | 'version'; id: string };
export type PlayerAssetSelection = { kind?: 'asset'; projectId: string; assetId: string; label: string; record?: ListeningRecord };
export type PlayerScoreSelection = { kind: 'score'; projectId: string; id: string; label: string; revision: number; abcSha256: string; blob: Blob; durationSeconds: number };
export type ComparePair = { a: string; b: string | null; side: 'a' | 'b' };
export type PlayerCompareSelection = { kind: 'compare'; projectId: string; pair: ComparePair; preserveTime: boolean; requestId: number };
export type PlayerSelection = PlayerAssetSelection | PlayerScoreSelection | PlayerCompareSelection;
export type ScorePlayback = { projectId: string; abcSha256: string; time: number; playing: boolean } | null;

// Local selection intent only. Asset metadata and bytes remain owned by Query/API.
let selection: PlayerSelection | null = null;
const listeners = new Set<() => void>();
let playback: ScorePlayback = null;
const playbackListeners = new Set<(value: ScorePlayback) => void>();
export type CompareChoice = { pair: ComparePair | null; notice: 'storage' | 'lost' | null };
const emptyChoice: CompareChoice = Object.freeze({ pair: null, notice: null });
const choices = new Map<string, CompareChoice>();
let compareRequestId = 0;

export function playerMediaKey(value: PlayerSelection | null): string {
  if (!value) return '';
  return value.kind === 'compare' ? `compare:${value.projectId}:${value.requestId}` : value.kind === 'score' ? `score:${value.projectId}:${value.id}` : `asset:${value.projectId}:${value.assetId}`;
}

export function compareChoice(projectId: string): CompareChoice { return choices.get(projectId) ?? emptyChoice; }
const choiceKey = (projectId: string) => `music.compare.v1:${projectId}`;

export function restorePlayerCompare(projectId: string): void {
  if (choices.has(projectId)) return;
  let value: CompareChoice = emptyChoice;
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(choiceKey(projectId)) ?? 'null');
    if (raw !== null) {
      if (typeof raw !== 'object' || !('a' in raw) || !('b' in raw) || !('side' in raw)
        || typeof raw.a !== 'string' || !raw.a || raw.a.length > 128
        || raw.b !== null && (typeof raw.b !== 'string' || !raw.b || raw.b.length > 128)
        || raw.a === raw.b || raw.side !== 'a' && raw.side !== 'b' || raw.side === 'b' && !raw.b) value = { pair: null, notice: 'lost' };
      else value = { pair: Object.freeze({ a: raw.a, b: raw.b, side: raw.side }), notice: null };
    }
  } catch (error) { value = { pair: null, notice: error instanceof SyntaxError ? 'lost' : 'storage' }; }
  choices.set(projectId, value);
  if (value.pair && !selection) selection = { kind: 'compare', projectId, pair: value.pair, preserveTime: false, requestId: ++compareRequestId };
  listeners.forEach(listener => listener());
}

export function invalidateCompareChoice(projectId: string): void {
  const current = compareChoice(projectId);
  if (current.notice === 'lost') return;
  choices.set(projectId, { ...current, notice: 'lost' });
  listeners.forEach(listener => listener());
}

export function selectPlayerAsset(next: PlayerAssetSelection): void {
  if (selection?.kind !== 'score' && selection?.kind !== 'compare' && selection?.projectId === next.projectId && selection.assetId === next.assetId && selection.label === next.label && selection.record?.id === next.record?.id && selection.record?.kind === next.record?.kind) return;
  selection = Object.freeze({ ...next, ...(next.record ? { record: Object.freeze({ ...next.record }) } : {}) });
  publishScorePlayback(null);
  listeners.forEach(listener => listener());
}

export function selectPlayerScore(next: PlayerScoreSelection): void {
  selection = next;
  publishScorePlayback(null);
  listeners.forEach(listener => listener());
}

export function playerSelection(): PlayerSelection | null { return selection; }
export function selectPlayerCompare(projectId: string, pair: ComparePair, preserveTime = false): void {
  if (preserveTime && selection?.kind === 'compare' && selection.projectId === projectId && selection.pair.a === pair.a && selection.pair.b === pair.b && selection.pair.side === pair.side) return;
  const captured = Object.freeze({ ...pair });
  let notice: CompareChoice['notice'] = null;
  try {
    const stored = JSON.stringify(captured);
    localStorage.setItem(choiceKey(projectId), stored);
    if (localStorage.getItem(choiceKey(projectId)) !== stored) notice = 'storage';
  } catch { notice = 'storage'; }
  choices.set(projectId, { pair: captured, notice });
  selection = { kind: 'compare', projectId, pair: captured, preserveTime, requestId: ++compareRequestId };
  publishScorePlayback(null);
  listeners.forEach(listener => listener());
}

export function acknowledgePlayerVersion(version: Pick<components['schemas']['VersionRead'], 'id' | 'project_id' | 'candidate_id' | 'audio_asset_id' | 'name'>): void {
  if (!selection || selection.kind === 'score' || selection.kind === 'compare' || selection.projectId !== version.project_id || selection.assetId !== version.audio_asset_id || selection.record?.kind !== 'candidate' || selection.record.id !== version.candidate_id) return;
  selectPlayerAsset({ ...selection, label: version.name, record: { kind: 'version', id: version.id } });
}
export function subscribePlayerSelection(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

// The mounted Player owns this clock. Consumers observe it without starting audio.
export function publishScorePlayback(value: ScorePlayback): void {
  playback = value;
  playbackListeners.forEach(listener => listener(value));
}
export function scorePlayback(): ScorePlayback { return playback; }
export function subscribeScorePlayback(listener: (value: ScorePlayback) => void): () => void {
  playbackListeners.add(listener);
  return () => { playbackListeners.delete(listener); };
}
