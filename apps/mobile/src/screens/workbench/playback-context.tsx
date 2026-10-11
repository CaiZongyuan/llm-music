import { createContext, use, type ReactNode } from 'react';

// UI adapter for the M5 public controller. Root mounts it inside MobileMediaProvider.
export type PlaybackSelection = Readonly<{ projectId: string; assetId: string; recordId: string; label: string }>;
export type WorkbenchPlayback = {
  state: Readonly<{ selection: PlaybackSelection | null; status: 'idle' | 'authorizing' | 'loading' | 'ready' | 'blocked' | 'error';
    playing: boolean; position: number; duration: number; error: string | null; canPlay: boolean; canSeek: boolean; seeking: boolean; ended: boolean }>;
  controller: {
    select(selection: PlaybackSelection | null): void | Promise<unknown>;
    play(): void | Promise<unknown>; pause(): void | Promise<unknown>; seekTo(seconds: number): void | Promise<unknown>;
  };
};
const Context = createContext<WorkbenchPlayback | null>(null);
export function WorkbenchPlaybackProvider({ value, children }: { value: WorkbenchPlayback; children: ReactNode }) {
  return <Context value={value}>{children}</Context>;
}
export const useWorkbenchPlayback = () => use(Context);
