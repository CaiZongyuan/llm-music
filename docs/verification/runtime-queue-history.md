# Queue/history — issue #17 verification

Baseline: `706c92aa439652de44132d0e9df4372f741c49af`, after actual #15/#16 integration. Scope: one owned mixed Runtime API queue, exact pending deletion, terminal history and artifact recovery. No formal application API/Web, dependency/environment change, or running-cancel implementation is included.

## Contracts and impact

Runtime remains ComfyUI `7a5dad695fe1cae25efcb2550530fb20ef68da3d` with plugin `fc78df9dfb214f396aa281f5b03519cefff5b00a`. Pinned `/queue` deletion matches only an exact pending prompt id under the queue mutex and returns empty HTTP 200. It cannot interrupt a running task. A queued→running race can therefore make deletion a no-op. The separate native `/api/jobs/{id}/cancel` may interrupt that same now-running id and is reserved for #18; legacy `/interrupt` has a stale-snapshot race and is not used here.

RuntimeClient adds `post_json_bytes`: one JSON write with a raw response body. This preserves the existing JSON GET/POST, submit, history, upload, artifact and no-write-retry contracts used by #15/#16. A public HTTP regression failed before the addition and passes afterward for native empty 200. Actual consumers are queue cancellation plus the existing transcription/generation tools; their CPU coverage is retained.

The run owns A/B/C/D client/prompt mappings, scoped upload/output names and new evidence directories. It rejects foreign queue identities, multiple running entries, zero/non-finite/missing timing intervals, overlapping/out-of-order surviving intervals, core cache hits, failed history, or invalid artifacts. C is only considered never started after exact owned pending deletion, absent readback, successful surviving work, final idle and absent C history. Deletion-time `cancellation.json` remains distinct from final proof in `report.json`.

## Inputs and cache conditions

A/C/D reuse the validated generation graph, original style/lyrics and stable inference settings with declared seeds 2026101701/2026101702/2026101703. C is cancelled before inference. B reuses the validated transcription graph with the original CC0 fixture polarity-inverted sample by sample. Its full WAV SHA256 is `877fcbe4179be5f893d547c2947fd212ae50de97cde2724eead2474c5ad6f69f`; the original is `8cfe7f7dda6d17874bbae291ddcc7b59494de57b242c1b302bc4660537f924a9`.

Source tracing establishes `transcribe.track_of` passes the original float32 waveform to `edits.audio_mark`, which hashes sample bytes and rate before SheetSage features. `_heard` passes that recording mark/model stamp into the eight-result cache. Polarity changes this key despite retaining the musical content. The generator/source hashes and exact changed input condition are retained. This justifies the first new-condition run, not future fresh-inference claims: repeated identical seeds/polarity may hit caches, and public history does not expose Sage's independent cache. Root must retain first-run model/progress/GPU logs and PID continuity. No performance comparison is claimed.

## Developer checks and bounded oracle

Public fake HTTP checks cover complete mixed queue/output recovery, wrong pending ownership with no write, queued→running no-op with no interrupt fallback, empty 200 with no removal, history appearing after delete, overlap, and zero-duration proof rejection. The early independent oracle found zero-duration intervals could wrongly substantiate real work; the public CLI regression failed before `end>start` and passed after the bounded repair. Positive time alone does not prove a cache miss.

Full CPU suite passes: `uv run --no-project --python 3.12.13 python -m unittest discover -s runtime/comfyui/tests -v` ran 41 tests successfully in 38.828 seconds, including unchanged #14/#15/#16 consumers and nine new queue/raw-response checks. Compilation, unchanged 87-package lock consistency, paired-guide local links and diff whitespace checks pass. The independent early six-case oracle confirmed the positive-time repair and no remaining blocker in that bounded scope; its records are `.scratch/p0-development/17-oracle-check.md` and `17-oracle-cases.json`.

All Developer HTTP services and artifacts are fake and isolated. No live submissions, cancellations, GPU computation, model download, environment sync or Runtime start/stop were performed by the Developer.

Spec review subsequently identified an unbounded sleep when polling exceeded the remaining confirmation window. The public CLI regression with `--timeout 1 --poll-interval 3600` failed before repair because the process outlived its bounded guard. Sleep now uses the minimum of the poll interval and remaining deadline, matching the existing RuntimeClient wait convention. The same regression returns a failed receipt with the owned map preserved and no interrupt. This scheduler-wait repair changes no workflow, fixture, seed, cancellation payload or artifact validation used in the actual run.

Affected queue CLI coverage passes after repair: all nine tests, including the new long-poll deadline case. The suite now contains 42 CPU tests; the unchanged 32 earlier consumers and raw-response test retain their passing baseline evidence, with final hosted CI scheduled on the new head. Compilation, paired links and diff checks pass. Standards review of the original eight-file candidate found no must-fix standards, ownership or shared-client compatibility violation.

## Bounded simplification and recovery

The pass retains one CLI and a small deterministic variant producer, with the existing public decoder/Score parser and fixed workflows. It does not add a general scheduler or product Job service. The queued-delete action and never-started proof remain separate. Existing JSON contracts stay intact; mapped output shape errors remain actionable rather than relying on file existence. Normal `uuid` import replaces a dynamic import. Snapshot/history/mapping/provenance and positive-time checks retain their distinct safety obligations.

The repair pass inspected the five-file delta from the actually executed candidate. A single bounded sleep replaces the unbounded sleep, and the fake fixture adds a stalled state to test the public deadline. No new abstraction or deletion was needed. All workload producers, graph bindings, identity checks, raw queued-delete semantics, history/artifact validation and source provenance remain unchanged; actual GPU rerun is not asserted for this later polling/doc candidate.

Partial submissions, timeout or a race preserve the run map and observed evidence. The recovery command only deletes an exactly owned still-pending target. It never clears shared queue/history or interrupts a successor. Root resolves remaining active work through readback; the tool does not submit retries or guess terminal states.

## Actual owned target-GPU execution

Root executed the clean frozen `027ea57b5b44b19f94d2fdec7fe4feb2c240c722` candidate against the owned target Runtime. The command exited 0 with `verified=true`, concurrency 1 and `p0_passed=false`. Native successful intervals were A 57.589 seconds, B 7.868 seconds and D 56.719 seconds, ordered without overlap. Each request/terminal history retained its owned id, client and graph. C was observed pending before exact deletion, absent afterward, with no final history and a final idle queue. Surviving requests completed and their artifacts validated.

| Survivor | Actual validated artifact |
| --- | --- |
| A Generate | 87 Score notes; stereo 48 kHz FLAC, 1,679,936 fully decoded frames, 34.998667 seconds, SHA256 `6550617d49bd3f9e5cecefcf309f1071e0fefa412eec23d14a67eb5a7ef45f21`. |
| B Transcribe | 32 parsed ABC notes and 60 readable MIDI notes; MIDI SHA256 `3e93dfb2caf5dc13be56be2dc6d9406d08768d638ff56689132f58479ec0c704`. |
| D Generate | 108 Score notes; stereo 48 kHz FLAC, 1,679,936 fully decoded frames, 34.998667 seconds, SHA256 `6eec96cac3772a889a294578f76791cada97bb70b2a6b8ac97a4dcf9d07bd8a4`. |

Same-run service logs show GPU generation stages for seeds 2026101701 and 2026101703, plus SheetSage2 loading on cuda:0, listening and token writing for the new polarity recording with no result-reuse message. The owned Runtime PID 50752 and creation identity were unchanged before/after; original candidate source hashes remained unchanged throughout execution. This supplies actual first-condition workload evidence alongside queue/history proof. It does not expose the hidden result-cache state for future repetitions, provide continuous peak VRAM/RAM, or establish a performance improvement. Subjective listening remains deferred.

Receipts are retained at `.scratch/p0-development/17-real/summary.json`, `run-01/report.json`, `command-receipt.json`, and `runtime-stderr.txt`, with per-job requests/history/artifacts and source/log-span hashes. The actual command used a 0.5-second poll interval and 1800-second timeout. The later deadline clamp and test/instrumentation changes preserve these actual workload inputs and core validation contracts; root assesses reuse of this evidence for final integration rather than repeating GPU work without a new concern.

Final affected review, hosted CI and integration remain pending for the repaired candidate. Running cancellation, ten repeated Jobs and cleanup remain later P0 work; `p0_passed=false`. No documentation site/browser/Pages publication is claimed.
