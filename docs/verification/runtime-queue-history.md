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

All Developer HTTP services and artifacts are fake and isolated. No live submissions, cancellations, GPU computation, model download, environment sync or Runtime start/stop were performed by the Developer. Independent final review and actual #17 acceptance remain root-owned and pending.

## Bounded simplification and recovery

The pass retains one CLI and a small deterministic variant producer, with the existing public decoder/Score parser and fixed workflows. It does not add a general scheduler or product Job service. The queued-delete action and never-started proof remain separate. Existing JSON contracts stay intact; mapped output shape errors remain actionable rather than relying on file existence. Normal `uuid` import replaces a dynamic import. Snapshot/history/mapping/provenance and positive-time checks retain their distinct safety obligations.

Partial submissions, timeout or a race preserve the run map and observed evidence. The recovery command only deletes an exactly owned still-pending target. It never clears shared queue/history or interrupts a successor. Root resolves remaining active work through readback; the tool does not submit retries or guess terminal states.

## Pending actual acceptance

Root must execute the clean frozen candidate against the owned idle target Runtime, retain first new-seed/variant GPU progress, continuous PID, exact queue/history/cancel states and fully validated A/B/D artifacts. At source freeze, only fake HTTP and primary-source contracts have been proved. Running cancellation, ten repeated Jobs and cleanup remain later P0 work; `p0_passed=false`. No documentation site/browser/Pages publication is claimed.
