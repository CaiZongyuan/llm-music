import type { createMobileSession } from '../data/session.ts';

export type MediaSelection = Readonly<{ projectId: string; assetId: string; recordId: string; label: string }>;
export type MediaSnapshot = Readonly<{
  selection: MediaSelection | null;
  status: 'idle' | 'authorizing' | 'loading' | 'ready' | 'blocked' | 'error';
  playing: boolean; position: number; duration: number; error: string | null;
  canPlay: boolean; canSeek: boolean; seeking: boolean; ended: boolean;
  verified: Readonly<{ sizeBytes: number; sha256: string }> | null;
}>;
export type MediaSession = Pick<ReturnType<typeof createMobileSession>, 'getSnapshot' | 'subscribe' | 'authorizeMedia' | 'getAsset'>;
export type PlaybackStatus = Readonly<{ loaded: boolean; playing: boolean; position: number; duration: number; ended: boolean; error: string | null }>;
export type Playback = {
  getStatus(): PlaybackStatus;
  subscribe(listener: (status: PlaybackStatus) => void): () => void;
  play(): void; pause(): void; seekTo(seconds: number): Promise<void>; release(): void;
};
export type CachedAudio = { uri: string; sizeBytes: number; sha256: string; remove(): Promise<void> };
export type AudioWriter = { write(bytes: Uint8Array): Promise<void>; finish(): Promise<CachedAudio>; discard(): Promise<void> };
export type MediaOptions = {
  session: MediaSession;
  fetch(request: Request, init: { redirect: 'error' }): Promise<Response>;
  cache: { create(): Promise<AudioWriter>; clear?(): Promise<void> };
  player: { create(uri: string): Playback | Promise<Playback> };
  timeoutMs?: number; authorizationIntervalMs?: number;
};
