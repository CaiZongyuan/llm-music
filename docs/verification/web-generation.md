# Web generation author verification

Issue [#35](https://github.com/CaiZongyuan/llm-music/issues/35), SPEC-008 / SPEC-011. Author feature source pin: `22d7c4381cf4a20417f2aaddf970242b235c9225` (2026-10-08). The author checkout consumes #33's unified Monitor, #34's actual read-only Score route, and Root's pinned dependencies, shared readiness and navigation. It follows the approved #31 layout/flows plus Chinese/English and light/dark preferences. The closed prototype service18032 was not restarted.

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
| Generation inputs | Chinese/English × light/dark forms keep submitted text while preferences change. Unsafe integer seeds are rejected before any Job POST. The API records35seconds and the exact input snapshot. |
| Candidate/Version | A completed Job yields a readable Audio/Score Candidate while Version history remains empty. UI save returns201; repeating the same public save intent returns200 and the same id. Refresh reads that Version. A second Candidate does not alter the prior Version or audio SHA256. |
| Cached consumers | Previously opened empty Asset/Score lists show the generated outputs before refresh. The feature invalidates their exported Query list keys when observing the completed result. Root coordinates the Monitor's corresponding result invalidation across other mounted pages. |
| Sole Player | Real Chromium plays the original CPU FLAC with native duration34.998667seconds. Current time advances across language/theme changes and Lyrics, Versions, Score and completed Monitor-result navigation. One native audio element remains mounted outside the route outlet. |
| Seek/regions | Native keyboard seek reaches the start and end. Out-of-bounds regions are rejected; a0.2–0.9second region actually plays and pauses at0.9. Region controls fit390px after Root's shared tab-wrap fix. |
| Original download | The actual native browser download finishes without error. The generated FLAC bytes match the API Asset SHA256, including after persisted Version reload. |
| Domain failures | OOM, missing model, invalid workflow and generation failure preserve editable style/lyrics/seed and create no Candidate/Version. Cancellation reaches the confirmed cancelled state; explicit retry creates a different Job with retry provenance. Missing readiness disables submission. |
| Save/media recovery | A precommit save failure preserves Candidate/name. A lost acknowledgement after durable commit is recovered by explicit reread to one Version. A damaged owned FLAC produces a playback error; restoring bytes and rereading makes playback usable again. |

The final combined author run had five passes and one test-helper timing failure: the helper inspected the previous visible Candidate before the second submission's navigation completed. Its final implementation waits for a different persisted Candidate id. Only that affected Chinese/dark case was rerun, and it passed. Feature source and the other five cases' behavior were unchanged. `web:check`, production `web:build` and browser strict type checks passed.

An earlier run caught the new shared navigation's narrow-screen overflow (`scrollWidth660` at390px). Root added `.tabs { flex-wrap: wrap; }`; the affected final recovery case passed with width390. The original failure log/geometry remain; its original trace was overwritten by Playwright's output cleanup and is not claimed as retained. The later Candidate-wait failure trace/screenshot were copied before rerunning. Final logs, manual process identity facts and author events are held in Root's owned `.scratch/p2-development/35-generation/` and `actor35-events.jsonl`.

## Limits and handoff

The generated CPU output is a440Hz test tone with a legal example ABC. It proves application, media and persistence behavior; it does not prove music quality, new GPU inference or correspondence between a real song and planned notes. This author did not use Runtime8188 or shared GPU resources.

Complete #35 acceptance still requires the unified Monitor's actual main integration, independent review/CI, and Root-owned real Web→FastAPI→GPU generation, listening and explicit Version saving. The paired creator guides are [Chinese](../guides/web-generation.md) / [English](../guides/web-generation.en.md); Root owns their shared chapter registration and final documentation build. Current drafts and player position remain local UI state; saved Candidate, Job, Score, Asset and Version snapshots remain API/Query state. No score editing, Cover, A/B controls, long-song controls or version graph was added.

The bounded complexity pass retained the Candidate/Version distinction and all recovery paths. It removed a second Job polling observer, reused #34's Score view, read the existing theme variables for the waveform, and serialized non-cancellable audio decoding so obsolete selections cannot publish waveform/region state.
