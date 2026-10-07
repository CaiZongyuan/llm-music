export type PlayerSelection = { projectId: string; assetId: string; label: string };

// Local selection intent only. Asset metadata and bytes remain owned by Query/API.
let selection: PlayerSelection | null = null;
const listeners = new Set<() => void>();

export function selectPlayerAsset(next: PlayerSelection): void {
  if (selection?.projectId === next.projectId && selection.assetId === next.assetId) return;
  selection = next;
  listeners.forEach(listener => listener());
}

export function playerSelection(): PlayerSelection | null { return selection; }
export function subscribePlayerSelection(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
