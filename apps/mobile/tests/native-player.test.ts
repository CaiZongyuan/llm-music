import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

type Driver = { currentStatus: { isLoaded: boolean; playing: boolean; currentTime: number; duration: number; didJustFinish: boolean; playbackState: string };
  pause(): void; remove(): void; release(): void; play(): void; seekTo(seconds: number): Promise<void>;
  addListener(): { remove(): void } };
const sdk: { driver: Driver | null } = { driver: null };
Reflect.set(globalThis, '__mediaSdkTest', sdk);
const hooks = registerHooks({
  resolve: (specifier, context, next) => specifier === 'expo-audio' ? { url: 'media-test:expo-audio', shortCircuit: true } : next(specifier, context),
  load: (url, context, next) => url === 'media-test:expo-audio' ? { format: 'module', shortCircuit: true,
    source: 'const sdk = globalThis.__mediaSdkTest; export const setAudioModeAsync = async () => {}; export const createAudioPlayer = () => sdk.driver;' } : next(url, context),
});
const { createNativePlayback } = await import('../src/media/native-player.ts');
hooks.deregister();
Reflect.deleteProperty(globalThis, '__mediaSdkTest');

for (const failed of ['pause', 'remove', 'release']) {
  test(`native adapter attempts every cleanup step after ${failed} fails and a later release completes the remaining ownership`, async () => {
    const attempts: string[] = [];
    let denied = true;
    const operation = (step: string) => { attempts.push(step); if (denied && step === failed) throw new Error(`SDK ${step} refused`); };
    sdk.driver = {
      currentStatus: { isLoaded: true, playing: false, currentTime: 12, duration: 35, didJustFinish: false, playbackState: 'readyToPlay' },
      pause: () => operation('pause'), remove: () => operation('remove'), release: () => operation('release'),
      play: () => {}, seekTo: async () => {}, addListener: () => ({ remove: () => {} }),
    };
    const playback = await createNativePlayback('file:///owned-cache/original.flac');
    assert.throws(() => playback.release());
    assert.deepEqual(attempts, ['pause', 'remove', 'release']);
    denied = false;
    playback.release();
    if (failed !== 'pause') assert.equal(attempts.filter(step => step === failed).length, 2, 'the failed owning SDK operation is retried');
    const after = attempts.length;
    playback.release();
    assert.equal(attempts.length, after, 'completed native cleanup is idempotent');
  });
}
