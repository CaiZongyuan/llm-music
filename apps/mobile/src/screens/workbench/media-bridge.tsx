import type { ReactNode } from 'react';
import { useMediaPlayer } from '@/media';
import { WorkbenchPlaybackProvider } from './playback-context';

export function WorkbenchMediaBridge({ children }: { children: ReactNode }) {
  const playback = useMediaPlayer();
  return <WorkbenchPlaybackProvider value={playback}>{children}</WorkbenchPlaybackProvider>;
}
