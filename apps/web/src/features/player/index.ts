export type PlayerAssetSelection = { kind?: 'asset'; projectId: string; assetId: string; label: string };
export type PlayerScoreSelection = { kind: 'score'; projectId: string; id: string; label: string; revision: number; abcSha256: string; blob: Blob; durationSeconds: number };
export type PlayerSelection = PlayerAssetSelection | PlayerScoreSelection;
export type ScorePlayback = { projectId: string; abcSha256: string; time: number; playing: boolean } | null;

// Local selection intent only. Asset metadata and bytes remain owned by Query/API.
let selection: PlayerSelection | null = null;
const listeners = new Set<() => void>();
let playback: ScorePlayback = null;
const playbackListeners = new Set<(value: ScorePlayback) => void>();

export function selectPlayerAsset(next: PlayerAssetSelection): void {
  if (selection?.kind !== 'score' && selection?.projectId === next.projectId && selection.assetId === next.assetId) return;
  selection = next;
  publishScorePlayback(null);
  listeners.forEach(listener => listener());
}

export function selectPlayerScore(next: PlayerScoreSelection): void {
  selection = next;
  publishScorePlayback(null);
  listeners.forEach(listener => listener());
}

export function playerSelection(): PlayerSelection | null { return selection; }
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
