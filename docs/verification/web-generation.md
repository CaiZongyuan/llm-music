# Web generation author verification

Issue [#35](https://github.com/CaiZongyuan/llm-music/issues/35), SPEC-008 / SPEC-011. Author feature source pin: `22d7c4381cf4a20417f2aaddf970242b235c9225` (2026-10-08). The author checkout consumes #33's unified Monitor, #34's actual read-only Score route, and Root's pinned dependencies, shared readiness and navigation. It follows the approved #31 layout/flows plus Chinese/English and light/dark preferences. The closed prototype service on port 18032 was not restarted.

## Repeatable checks

From the repository root:

```powershell
pnpm web:check
pnpm web:build
pnpm test:browser:check
pnpm --filter @llm-music/browser-tests exec playwright test --config generation.playwright.config.ts
```

The ordinary four locale/theme cases in `web-generation.web.ts` also run through `pnpm test:web`. The two fault cases in `generation-recovery.controlled.ts` use a separate owned CPU Runtime entrypoint. It injects Runtime observations and Version commit failures while retaining the production FastAPI routes, SQLite, storage and generated HTTP client. No business HTTP response is mocked. All test servers own new isolated `.artifacts/<run-id>/` directories, loopback ports and acknowledged stop files. CPU fixtures have no Torch or GPU model dependency.

## Observed behavior

| Public boundary | Evidence |
| --- | --- |
| Generation inputs | Chinese/English × light/dark forms keep submitted text while preferences change. Unsafe integer seeds are rejected before any Job POST. The API records 35 seconds and the exact input snapshot. |
| Candidate/Version | A completed Job yields a readable Audio/Score Candidate while Version history remains empty. UI save returns 201; repeating the same public save intent returns 200 and the same id. Refresh reads that Version. A second Candidate does not alter the prior Version or audio SHA256. |
| Cached consumers | Previously opened empty Asset/Score lists show the generated outputs before refresh. The feature invalidates their exported Query list keys when observing the completed result. Root coordinates the Monitor's corresponding result invalidation across other mounted pages. |
| Sole Player | Real Chromium plays the original CPU FLAC with native duration 34.998667 seconds. Current time advances across language/theme changes and Lyrics, Versions, Score and completed Monitor-result navigation. One native audio element remains mounted outside the route outlet. |
| Seek/regions | Native keyboard seek reaches the start and end. Out-of-bounds regions are rejected; a0.2–0.9second region actually plays and pauses at 0.9 seconds. Region controls fit 390 px after Root's shared tab-wrap fix. |
| Original download | The actual native browser download finishes without error. The generated FLAC bytes match the API Asset SHA256, including after persisted Version reload. |
| Domain failures | OOM, missing model, invalid workflow and generation failure preserve editable style/lyrics/seed and create no Candidate/Version. Cancellation reaches the confirmed cancelled state; explicit retry creates a different Job with retry provenance. Missing readiness disables submission. |
| Save/media recovery | A precommit save failure preserves Candidate/name. A lost acknowledgement after durable commit is recovered by explicit reread to one Version. A damaged owned FLAC produces a playback error; restoring bytes and rereading makes playback usable again. |

The final combined author run had five passes and one test-helper timing failure: the helper inspected the previous visible Candidate before the second submission's navigation completed. Its final implementation waits for a different persisted Candidate id. Only that affected Chinese/dark case was rerun, and it passed. Feature source and the other five cases' behavior were unchanged. `web:check`, production `web:build` and browser strict type checks passed.

An earlier run caught the new shared navigation's narrow-screen overflow (`scrollWidth = 660` at 390 px). Root added `.tabs { flex-wrap: wrap; }`; the affected final recovery case passed with width 390. The original failure log/geometry remain; its original trace was overwritten by Playwright's output cleanup and is not claimed as retained. The later Candidate-wait failure trace/screenshot were copied before rerunning. Final logs, manual process identity facts and author events are held in Root's owned `.scratch/p2-development/35-generation/` and `actor35-events.jsonl`.

## Limits and handoff

The generated CPU output is a 440 Hz test tone with a legal example ABC. It proves application, media and persistence behavior; it does not prove music quality, new GPU inference or correspondence between a real song and planned notes. This author did not use Runtime port 8188 or shared GPU resources.

Complete #35 acceptance still requires the unified Monitor's actual main integration, independent review/CI, and Root-owned real Web→FastAPI→GPU generation, listening and explicit Version saving. The paired creator guides are [Chinese](../guides/web-generation.md) / [English](../guides/web-generation.en.md); Root owns their shared chapter registration and final documentation build. Current drafts and player position remain local UI state; saved Candidate, Job, Score, Asset and Version snapshots remain API/Query state. No score editing, Cover, A/B controls, long-song controls or version graph was added.

The bounded complexity pass retained the Candidate/Version distinction and all recovery paths. It removed a second Job polling observer, reused #34's Score view, read the existing theme variables for the waveform, and serialized non-cancellable audio decoding so obsolete selections cannot publish waveform/region state.

## Saved-Version refresh diagnosis (2026-10-08)

CI run `37721641825` failed the English/light refresh assertion. Its retained trace shows the correct Version detail URL and `section[data-version-id]` already rendered before reload. The reload document returned 200, but Chromium reported `net::ERR_NO_BUFFER_SPACE` while loading the eager `/src/routes/projects.$projectId.index.tsx` module. The page stayed at an empty `#root` and sent no subsequent business API request. This evidence rules out a missing selected-Version readiness condition for that failure; waiting for the same URL or identity cannot be claimed as its repair.

At source `8411aa6ca8f9efe83a4b1ccd3e708e8a409438b0`, the unchanged public `pnpm test:web -- web-generation.web.ts` passed all four locale/theme cases. A temporary probe using the same public fixture waited for the saved Version URL and identity, then aborted only that eager module during reload. It reproduced the original missing-Version-element assertion while the public Version API still returned the original record. Allowing that module request through passed the same probe. The injected error was `net::ERR_FAILED`; this demonstrates the same bootstrap dependency failure, without claiming to reproduce the exact Windows buffer condition or repair it.

The original failure, probe source, red trace, red/green logs, baseline results, and facts are retained in Root's `.scratch/p2-development/38-browser-refresh/` alongside the original `.scratch/p2-development/38-ci-841-artifacts/`. All three owned CPU API/Web fixture pairs acknowledged graceful shutdown. The diagnostic test was removed after capture. Existing refresh, identity, original-byte and prior-Version assertions remain intact; this diagnosis adds no production UI or test timeout change.

The shared `tests/browser/run_web.mjs` fixture now uses Vite's public production build and preview APIs. Each fresh owned run creates its own `web-dist` directory with `emptyOutDir: false`; an existing build directory is rejected. The existing loopback FastAPI HTTP/WebSocket proxy, strict port and CPU owner checks remain the configuration source. Web owner and graceful-stop receipts record `mode`, `build_dir` and the built `index.html` SHA256. The normal launcher keeps its separate dev-server entrypoint.

The unchanged four locale/theme generation cases passed with this fixture, including actual playback, explicit save, refresh, downloads and prior-Version byte/identity assertions. Captured browser documents matched the built entry SHA256; module requests used `/assets/` and the Job WebSocket proxy upgraded successfully. This removes the dev-module bootstrap graph from these tests. It does not establish the underlying Windows buffer condition or promise that compiled assets can never have transport failures. Shared recovery/Monitor/transcription/Runtime/gate consumers still require their corresponding verification at integration.

The fixture build also includes the existing `/test/consumer.html` and `/test/job-results.html` browser consumers. They execute the public shared hooks in the same compiled environment; the ordinary product build remains independent. An initial build omitted the first consumer and its existing isolation assertion failed; compiling its HTML entry made that unchanged assertion pass. The retained failed run is `production-web-consumers.log` in the same evidence directory. The unchanged generation recovery cases also passed: the original `wavesurfer` interception blocked the compiled asset, and explicit retry loaded that asset with `player_retry=1` before actual playback resumed.
