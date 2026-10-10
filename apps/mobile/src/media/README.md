# Foreground original-audio controller

M5 owns one active Candidate or Version player for the current mobile authorization session. The UI consumes `MobileMediaProvider` and `useMediaPlayer()`; Root mounts the provider inside `MobileSessionProvider`. Layout, routes, slider drag state and native application configuration belong to their respective owners.

## Public seam

`useMediaPlayer()` returns `{ controller, state }`. `MediaSelection` contains `projectId`, `assetId`, `recordId` and `label`; `recordId` identifies the displayed Candidate or Version without changing the Asset contract.

| Operation | Result |
| --- | --- |
| `select(selection)` | Releases the old source, authorizes, downloads and validates the original FLAC, then creates a paused local player. The promise resolves after actual decoder readiness. |
| `select(null)` | Releases resources and clears the selected record and position. |
| `play()` | Checks authorization before playing. After interruption or failure, explicitly downloads the selected original again and restores the saved position. An ended recording starts again at zero. |
| `pause()` | Supersedes a pending play authorization and pauses the current decoder, preserving its local source and actual position. |
| `seekTo(seconds)` | Checks authorization, clamps a finite target to the actual duration, and awaits the native seek. Local seeking makes no server Range request. |
| `release()` | Cancels download and readiness work, saves the actual position, pauses/releases the player and deletes owned cache files. Failed native cleanup remains owned and is retried; replacement cannot create another player until cleanup succeeds. Selection and position remain available for explicit continuation. |
| `start()` / `suspend()` | Starts cache/session ownership and immediately reconciles the current server identity, or releases resources and unsubscribes. Suspend is resumable for React effect cleanup. |
| `dispose()` | Ends ownership permanently; later select/play actions are rejected. |

The snapshot exposes `selection`, `status`, `playing`, `position`, `duration`, `error`, `canPlay`, `canSeek`, `seeking`, `ended` and `verified`. Status is `idle`, `authorizing`, `loading`, `ready`, `blocked` or `error`. Playback position/duration/loading and completion come from the decoder. The UI retains its drag target while dragging and sends one explicit seek; it must not replace that target with intervening decoder updates.

## Transport and resource ownership

The native adapter calls `expoFetch(request, { redirect: 'error' })` with the M3 lease's Authorization header. RN's Request implementation does not preserve the redirect setting, so the explicit fetch init is required. URLs contain no permanent device token. `expo-audio` receives only a verified `file://` URI; it receives neither a remote URL nor Authorization headers and uses no `downloadFirst` or remote fallback.

The controller streams response chunks into `Paths.cache/shengjian-media-v1`. It checks the Asset identity, FLAC MIME/profile, declared size, `fLaC` signature and independent SHA256 before registering a player. The native cache hashes the completed file with Expo Crypto. A writer transfers cleanup ownership to the finished file; cancellation keeps ownership of unfinished fragments. Failed deletion remains owned for a later release attempt. Startup removes this namespace's leftover `.flac` files without performing a network request or replaying playback.

Selection, authorization, response body, file completion and decoder readiness share a 30-second timeout. Abort also rejects the public operation when an external provider ignores cancellation. Late-created writers/players are cleaned instead of becoming current resources. A revision prevents delayed old cleanup or authorization from replacing a later selection/action.

Play and seek recheck `session.authorizeMedia()`. A foreground authorization check repeats every five seconds while a file exists, including after a terminal Job's observation socket closes. It does not call `session.verify()`, which changes the session epoch. Background, disconnect, revoke or server/device/epoch changes release audio and delete temporary bytes. Returning to the foreground does not recreate or resume a player; an explicit play is required. Changing computers also clears the selected record and position, including when both servers have identical Project/Asset UUIDs. Start and explicit play reconcile identity immediately, so a change made while subscriptions were suspended cannot reinterpret an old record on another computer.

The native release order is pause, remove the SDK's player registration, then release the native object. Each release step is attempted even when an earlier step fails. Remove/release success is recorded separately; a later release retries failed owning steps and skips completed ones. The controller retains a failed native handle or subscription cleanup and reports an error instead of claiming idle cleanup or creating a replacement. This is required because SDK57 can resume a still-registered player after backgrounding despite `shouldPlayInBackground: false`. Decoder errors also release the current source and permit explicit recovery. No offline library, recording or background playback is provided. Web deliberately rejects native cache/player creation rather than supplying a simulated native implementation.

## Verification boundary

`tests/media.test.ts` calls the public controller with the actual M3 session and external HTTP/filesystem/audio providers. It uses the unchanged CPU Fake Runtime FLAC in `tests/fixtures`, with an independently recorded literal digest. These checks cover resource/authorization races and failure recovery; they do not claim to decode audio, reproduce physical storage failures or verify native application configuration.

`tests/native-player.test.ts` loads the actual native adapter with a Node module hook replacing only the external `expo-audio` SDK factory. It verifies pause/remove/release fault handling and retry ownership. The hook is deregistered after import; the SDK fixture is confined to this isolated test process. This is adapter behavior against an external SDK model, not evidence that these faults occurred on a physical native player.

Run from the repository root:

```powershell
pnpm --filter @llm-music/mobile test
pnpm --filter @llm-music/mobile check:test
pnpm mobile:check
pnpm --filter @llm-music/mobile exec expo install --check
```

Native decoding/control, HTTP byte/Range behavior, physical Android, APK configuration and GPU generation have separate evidence in [the M5 verification record](../../../../docs/verification/mobile-audio.md).
