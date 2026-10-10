import { createAudioPlayer, setAudioModeAsync, type AudioStatus } from 'expo-audio';

import type { Playback, PlaybackStatus } from './types';

export async function createNativePlayback(uri: string): Promise<Playback> {
  if (!uri.startsWith('file://')) throw new Error('Playback requires a local source');
  await setAudioModeAsync({ allowsRecording: false, allowsBackgroundRecording: false, shouldPlayInBackground: false,
    playsInSilentMode: true, interruptionMode: 'doNotMix' });
  const player = createAudioPlayer({ uri }, { updateInterval: 250, downloadFirst: false, keepAudioSessionActive: false });
  let released = false;
  let removed = false;
  let retiring = false;
  let failure: string | null = null;
  function status(value: AudioStatus): PlaybackStatus {
    if (value.error) failure = value.error;
    return { loaded: value.isLoaded, playing: value.playing, position: value.currentTime, duration: value.duration,
      ended: value.didJustFinish || value.playbackState === 'ended', error: failure };
  }
  return {
    getStatus: () => status(player.currentStatus),
    subscribe: listener => {
      const subscription = player.addListener('playbackStatusUpdate', value => { if (!retiring) listener(status(value)); });
      return () => subscription.remove();
    },
    play: () => player.play(),
    pause: () => { if (!released) player.pause(); },
    seekTo: seconds => player.seekTo(seconds),
    release: () => {
      if (removed && released) return;
      retiring = true;
      const failures: unknown[] = [];
      if (!released) { try { player.pause(); } catch (error) { failures.push(error); } }
      if (!removed) { try { player.remove(); removed = true; } catch (error) { failures.push(error); } }
      if (!released) { try { player.release(); released = true; } catch (error) { failures.push(error); } }
      if (failures.length) throw failures[0];
    },
  };
}
