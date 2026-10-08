export type PlayerAssetSelection = { kind?: 'asset'; projectId: string; assetId: string; label: string };
export type PlayerScoreSelection = { kind: 'score'; projectId: string; id: string; label: string; revision: number; blob: Blob; durationSeconds: number };
export type PlayerSelection = PlayerAssetSelection | PlayerScoreSelection;

// Local selection intent only. Asset metadata and bytes remain owned by Query/API.
let selection: PlayerSelection | null = null;
const listeners = new Set<() => void>();

export function selectPlayerAsset(next: PlayerAssetSelection): void {
  if (selection?.kind !== 'score' && selection?.projectId === next.projectId && selection.assetId === next.assetId) return;
  selection = next;
  listeners.forEach(listener => listener());
}

export function selectPlayerScore(next: PlayerScoreSelection): void {
  selection = next;
  listeners.forEach(listener => listener());
}

export function playerSelection(): PlayerSelection | null { return selection; }
export function subscribePlayerSelection(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
