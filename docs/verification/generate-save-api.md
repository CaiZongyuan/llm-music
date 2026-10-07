# Issue #22 — Generate / Candidate / explicit Version save

Baseline: `d0f61ab5ff4d453897f51a01708ab999044c6f60`. Scope: the P1 generation HTTP slice, Candidate registration in the shared Job output transaction, explicit Version save/read, migration `0003_generation_versions`, original CPU fake generation fixtures, paired guides, and a runnable HTTP example. No product Web or GPU execution is part of this developer's work.

## Executed CPU evidence

The isolated API Python is 3.12.13 from this worktree's `services/api/.venv`. `find_spec("torch") is None`. Runtime's virtual environment, PID, models, port 8188, and service configuration were not changed. Tests use production `create_app`; there are no test-only router attachments or generation-registration overrides.

The initial HTTP red observation was `404` for an invalid Generate request where the public contract required `422`. The production Generate/Candidate/Version flow now passes the owned HTTP and lifecycle checks. Full API strict mypy passes all 33 currently available source modules. Commands and timed receipts are retained under `.scratch/p1-development/22-developer/`; the final consolidated receipt records the exact final checks.

Coverage exercises complete fake generation into an unsaved Candidate, readable owned Audio/ABC/Score, final result-validation provenance, stable output ids, explicit save, same-intent repeat, conflicting intent, simultaneous public saves, changed-input generations, same-Project branches, cross-Project rejection, save failure before commit, durable commit with lost acknowledgement, and temporarily unavailable independent readback. Consumer import tests show that Candidate, Assets, Score, completed Job, and result refs commit together: precommit failure publishes no Candidate or completed Job and cleans only owned failed output files; durable lost acknowledgement recovers one complete result set.

Two actual CPU API processes are stopped and restarted through Uvicorn's graceful shutdown protocol. Job, Candidate, Version snapshots, Asset facts, and original file bytes remain unchanged. A separate identified fake peer writes actual temporary result files, the API imports them, and those isolated peer files are deleted only after completion. A new CPU API process still reads the same Version and owned files.

The complete documented `services/api/examples/generate_save.py` was executed against an owned disposable CPU API process. Generate exited 0, downloaded Audio/ABC, and left the Version list empty. Explicit save and identical repeat both exited 0 and returned the same Version. Command timestamps, JSON outputs, and server logs are retained in `example-probe/`. These are fake application facts, not real GPU/model quality evidence.

## Audio completeness boundary

The original test fixture is PCM16 FLAC, stereo 48 kHz, 1,679,936 decoded interchannel frames, 34.9986667 seconds. Dropping only the final complete packet still leaves 34.944 seconds and decodes without an FFmpeg exception, but exposes only 1,677,312 frames. Duration, file existence, and exception-free decode would accept this incomplete output. The declared STREAMINFO sample count rejects it before any result publication.

The STREAMINFO layout and zero-count semantics come from [RFC 9639 section 8.2](https://www.rfc-editor.org/rfc/rfc9639#section-8.2). A zero declared count is legal for an unknown-length stream. It is classified as `generated_audio_unverified`, rather than invalid FLAC, because the current finalized G35 profile needs completeness evidence. Encoded PCM width comes from STREAMINFO; a decoder's s16/s32 representation is not the encoded width. This slice accepts only the observed G35 PCM16 profile, so it does not expand the public Asset width contract. Root read the existing real P0 FLAC header and confirmed the same rate, channels, width, and declared count; no GPU rerun was needed for that source fact.

## Change impact and simplification

Generation is a real consumer of the shared InferenceRuntime, Job service, result importer, Asset/Score contract, and Workflow registry. It registers only validation and the Candidate callback; it does not add a second Runtime adapter, Job store, or importer. The importer merges final provenance before calling the Candidate registrar. Registrar metadata joins the importer transaction without committing independently.

Migration 0003 extends the shared 0002 schema with Candidate/Version tables. Shipped migration 0001 is unchanged. The common owner's compatibility suite verifies supported 0001 upgrades; final suite evidence must include the actual current migration head and preserved original Reference Audio, not a manually restamped database.

Save's first SQLite statement obtains the writer slot while selecting a same-Project Candidate and optional already-existing same-Project parent. A durable unique Candidate key resolves simultaneous identical saves. Version copies independent JSON snapshots and adds no file mutation. Creation-only parent links cannot introduce a cycle; there is no general graph engine for hypothetical database corruption.

The bounded simplification pass inspected the owned seven modules, migration, routers, fake provider, HTTP example, and immediate consumers. The fake encoder was moved to one shared fixture provider instead of duplicated between tests and production. Its factory stays lazy, so OpenAPI and idle startup encode no 35-second audio. Late factory imports preserve existing main helper dependencies. Shared explicit registry injection and fake freshness policy remain intact. No generic persistence/ancestry/client framework was introduced.

## Delivery limits

Real G35 generation through the final ComfyUI adapter is a separate serialized GPU-owner validation. This record does not claim it passed or that P1 is accepted. Root owns that execution, independent Standards/Spec review, CI, and actual integration. The independent API environment is CPU-only. No browser/UI preview, Astro build, or GitHub Pages publication is claimed by this API-only slice.

Guides: [中文](../guides/generate-save-api.md) / [English](../guides/generate-save-api.en.md).
