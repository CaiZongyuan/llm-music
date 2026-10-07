# P1 application and generated client acceptance

Issue [#27](https://github.com/CaiZongyuan/llm-music/issues/27), PR [#68](https://github.com/CaiZongyuan/llm-music/pull/68). This maintenance record joins actual application, client, browser and GPU evidence. It is not a published creator tutorial. Creator tasks and varied music use remain the main documentation direction; API guides and this evidence are secondary resources. Guide/reference registration is #29's scope.

## Source and delivery boundary

- Integrated application prerequisite: actual main `97d5a4413301646d704dc6ffd5c40d3784ed7bb2`, the merge of #25/PR66 candidate `16841026cf290b8ba42041644291f62b6b9ea131`. #25 is actually closed; #26 was already delivered. Parent specifications remain open and unchanged.
- Original SDK source: `f24ba08e7888167d6a6440d1b18c9443f93d0e19`, tree `182b2c355fbc68c44f89ed6f49b41fd849a37737`. Its two independent review axes reported zero findings; all eight hosted API/browser/docs/client runs passed.
- Combined source: `cdf359081b713d21126f8f03b04dd14bf41d3e86`, produced by merging actual main into the clean SDK branch. After this commit the owned changes only update the paired secondary guide links and this maintenance record. Final frozen revision, byte hashes, review pins, CI and integration are recorded under `.scratch/p1-development/27-client-development/` and the Root delivery ledger. A source hash does not substitute for execution evidence.

The final P1 acceptance decision belongs to Root after the combined candidate's independent refresh, required hosted CI and actual merge/issue closure. The evidence below is complete for the stated checks; this document alone does not perform those final delivery actions. Formal product Web remains P2.

## Public entrypoints

Run from the repository root with Node 24.18.0, pnpm 11.22.0, uv 0.11.28 and independent Python 3.12.13. The pinned API environment has no Torch; ComfyUI keeps its own uv environment and process.

| Entry | Actual behavior |
| --- | --- |
| `uv sync --project services/api --locked --python 3.12.13` | Installs the independent CPU application environment. |
| `uv run --project services/api --no-sync music-api serve --data-dir <OWNED_DATA_DIR> --port <ISOLATED_PORT>` | Starts the loopback FastAPI application. Default Runtime mode is labelled `fake`; real mode uses a separate data namespace and current owner readiness evidence. |
| `/docs`, `/openapi.json` | Local Swagger operations and Pydantic-derived HTTP contract, including the registered WS discovery/payload. |
| `POST /projects`, multipart `POST /projects/{project_id}/assets`, `POST /projects/{project_id}/transcriptions` | Project → supported Reference Audio → Transcribe Job. Read Job result ids, Score and owned ABC/MIDI content through FastAPI. |
| `POST /projects/{project_id}/jobs/generate`, Candidate/Score reads, `POST /projects/{project_id}/versions` | Generate → inspectable Audio/Score Candidate → explicit Version. First save201, identical save200. No automatic Version is created. |
| `GET /health`, `/runtime/capabilities`, `/runtime/models`, `/runtime/diagnostics`, `/settings/metadata` | Backend/current Runtime readiness, registry/source facts, application queue/current ids and sourced diagnostics. Persisted active Jobs do not claim native occupancy. Unknown readings remain unavailable/null. |
| `GET /projects/{project_id}/jobs/{job_id}`, scoped `/events` WS | Durable recovery source and live `job.updated` snapshots. Reconnect starts from current persisted state; sequence is not a durable replay cursor. |
| Bodyless Job `/cancel`, `/retry` POSTs | Cancel intent/confirmed terminal outcome, and one explicit new Job after safe terminal ownership. No automatic inference retry. |
| `pnpm client:generate`, `pnpm client:check`, `pnpm test:client` | CPU Pydantic→OpenAPI→generated TypeScript, two-export reproducibility/strict types and native Node public consumers. |

The complete [typed client example](../../packages/api-client/examples/generate-save.ts) and paired [client guide](../guides/api-client.md) / [English](../guides/api-client.en.md) record launch directories, output effects and recovery. Existing [Project/Audio](../guides/api-project-audio.md), [Generate/save](../guides/generate-save-api.md), [events](../guides/api-job-events.md), [cancel/retry](../guides/api-cancel-retry.md), [diagnostics](../guides/api-runtime-diagnostics.md) and [Job recovery](../guides/job-recovery.md) guides remain the complete operation sources.

## CPU client and schema evidence

The SDK calls the production FastAPI application using actual Node fetch, FormData and WebSocket. It inherits the existing FakeInferenceRuntime; fixture files only control completion, cancellation and failure timing. No business HTTP route is mocked, no second Runtime Protocol is defined, and no service connects to the retained Runtime 8188.

All five native Node cases pass after actual #25 integration. They verify:

- A fresh Project, original 16-second mono24k PCM16 multipart upload and matching Reference SHA256; queued Transcribe produces same-Project Score/ABC/MIDI ids and readable files.
- Generate produces fully readable FLAC and Score/ABC, unsaved Candidate, explicit Version201/repeat200 and exact persisted references. The two-loop Project has five Assets, two Scores, two Jobs and one selected Version.
- Actual queue/current summaries identify the held running Generate and queued Transcribe. Each deliberately loses its completion event, reads terminal HTTP, then reconnects to the identical full Job snapshot. Bytes match MIME, size and SHA; completed-data reopen preserves objects and files.
- Queued cancellation, running 202 intent→confirmed cancellation, failed Generate, explicit new retries, unchanged originals, zero-byte cancel/retry requests, 404/409/422/503 typed errors, failed binary JSON and foreign-Project WS upgrade 403. The complete source-referenced example also executes against this CPU API.
- The actual Windows leaf process/launcher relationship, creation time and owned argv; wrong creation time refuses cleanup while HTTP remains live, then a separately verified owned CPU leaf stops. Ordinary API processes acknowledge graceful shutdown. No owned CPU process is retained.

Three export cases verify CPU CLI and HTTP equality without creating export data, all four implemented binary MIME values, bodyless operations and save statuses, and refusal of an unequal registered event schema. Two isolated current exports reproduce the unchanged checked-in TypeScript byte-for-byte after newline normalization. Strict mypy passes 47 production/fixture files; strict TypeScript passes. Pydantic is the type source: the SDK exports aliases, typed transport and route-derived WS URLs without copied domain models.

The single root pnpm lock retains the three original importers and all 551 existing package metadata entry / 552 snapshots; only the reachable client graph is added. API and ComfyUI locks remain independent. Source-phase docs validation checked 20 registered pages / 24 HTML / 931 references, fifteen Astro files with no diagnostics, and both new maintained guides via an isolated in-memory manifest. That manifest does not alter published navigation. These unchanged boundaries are reused; final hosted docs/browser/client/API checks bind the combined candidate.

## Migration and restart refresh

#25 appends `0005_job_recovery` private proof/cursor columns and changes the Runtime prepare/observe/recover seam. HTTP/WS Pydantic models, the SDK schema, app composition and dependency locks otherwise remain equal to the original SDK source. The inherited client fixture automatically consumes the real parent prepare/observe and proof-aware recovery methods; all five Node cases pass without fixture bypasses or schema regeneration.

A stopped actual f24 SDK 0004 dataset is copied into an isolated owned snapshot, then backed up for the current API. The public native Node consumer reopens the upgraded data twice: full Project/Jobs/Candidate/Version objects, all five Asset records/hashes and terminal HTTP/WS snapshots are identical to the original f24 receipt. No new POST/inference operation is sent. The original current files remain byte-identical across the corrected preparation; the copied database reaches 0005.

Evidence: `27-client-development/sdk-upgrade-{preparation,consumer}.json` and the owned API receipts. An initial helper preservation assertion stopped before API launch because opening the original SQLite with a read/write handle did not preserve its bookkeeping bytes. Exact changed filenames were not recorded, so that failed attempt does not claim original byte preservation. `sdk-upgrade-preparation-failure.md` records the correction to copy-before-open; the failed clone is retained separately. The independent public-object/file-hash comparison supplies compatibility evidence.

Original active native recovery, unknown/non-renewing budgets, original graph/handle/input binding, legacy opaque active mappings and supported old migrations retain the already reviewed #25 coverage. Its final hosted Application API suite passed 164 cases at 168. The final combined PR suite adds the three exporter cases and remains a required final-head gate. The whole API suite is not repeated locally after the focused consumer refresh.

## Reused real GPU evidence

Root's immutable source `3e58498ef38c9abb9e721212a781cc5e68c3f17c` ran against the pinned actual RTX 3070 Ti Laptop 8GB ComfyUI/YuE2/SheetSage2 environment. Source archive SHA is `4e8c1d1c41a2ee45a7307a4b9390b958a0995b1e38b37b8717756ac57ffd7a59`. Evidence is `25-real/completion.json` and `run-3e-fresh2/receipt.json`.

| Real result | Observed facts |
| --- | --- |
| G35 Job `fd8bc46b-569b-472c-9409-8ade2956759e` | API stops while its original native work is running. Restart restores the same Job/attempt/full graph, then imports complete Score/ABC/Audio/Candidate. FLAC fully decodes 1679936 frames/34.9986667 seconds, SHA `037320dfd2e40f95c0b9da431443d2e9030c1c081167c2a54d0ae3e6e4ce093f`. |
| Selected Version `44d41629-aaee-4582-b5a6-38f4d8e8f983` | First explicit save201, same save200. Another API reopen preserves its ids/files and the earlier #24 Version/Assets. |
| Fresh T16 Job `04ab1b67-c936-4261-9af6-2a616e522a34` | Actual ABC/MIDI with 38 notes, exact original input/upload/proof/history binding and application file ownership. Original input SHA is `b66d912b186aedf623f5f09607b6271bc6877081a4794d4b84d539b9cb988f2c`. The sole serial native attempt appends Listening/Writing with no reuse caption and no cached core. |
| Resource cleanup | All three owned APIs stop gracefully and listeners disappear. The protected native Runtime retains its identity and empty queue. An expired initial owner receipt fails before any submission; its rejection remains retained, then official recollection precedes the one fresh execution. |

Root also verified the extracted actual CRLF production/workflow/config/lock bytes of final #25 candidate 168 against the executed 3e archive: 60 selected files are identical; final archive SHA is `bae14603e46a343c907239c148d2fbfafee5b03a1d60348b5e16f2759cfff4e0`. #25's remaining fixture/maintenance changes are independently refreshed. Its actual merge 97d and final successful API/browser CI are recorded separately. The #27 delta changes OpenAPI discovery/media descriptions and the client/workspace/CI/docs; it leaves the Runtime adapter, worker, import/validation, workflow and inference settings unchanged. These real results therefore remain valid for that unchanged inference/storage boundary, while the generated contract and client consumption are separately execution-checked.

Earlier real cancellation/explicit retry, Job HTTP/WS disconnect recovery and sourced diagnostics remain scoped evidence in [cancel/retry](api-cancel-retry.md), [events](api-job-events.md) and [diagnostics](api-runtime-diagnostics.md). The genuine browser Swagger flow, reload/save semantics and recording preference are documented in [browser verification](browser-tests.md); actual f24 hosted browser runs pass, and final combined browser CI is still required. No Swagger recording is produced for this delivery.

## Limits and final acceptance

CPU fake audio is a labelled test tone. Real FLAC decoding and ABC/MIDI validation prove the tested artifacts and ownership, not transcription accuracy for arbitrary music, a new performance comparison, or a new subjective listening review. The restart evidence stops only FastAPI; it does not claim recovery after native Runtime process restart. Existing source receipts retain their real timestamps; copied evidence is not made fresh.

Current Generate is 35 seconds, style≤1024 and lyrics≤10000. T16 inference support is the verified 16-second PCM16 mono24k/stereo48k profile; storage 600-second / 64MiB limits do not imply broader inference support. JavaScript seed callers must stay within safe nonnegative integers through 2^53−1, despite the server's 63-bit range. Generated WS types do not validate arbitrary untrusted JSON. Unknown phase/progress remains null; there is no sixth public Job status.

Formal Workbench Web, score editing, GenerateFromScore/Cover and built-in A/B/long-song workflows are later stages. After final independent review, all required final-head CI and Root's actual PR68 integration/closure, the P1 gate can unlock formal P2. Root records the actual merged revision and outcome; this developer does not merge or close the ticket.
