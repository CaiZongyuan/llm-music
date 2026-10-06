# API transcription — issue #15 verification

Baseline: `135fc969a0ab24a02652d40b39200f62ffec7cc2` (integrated issue #14). Scope: P0 public Runtime API transcription, fixed lawful Reference Audio, workflow/mappings, ABC/MIDI validation and evidence. No formal FastAPI, product Web or business Asset/Version registration was created.

## Source and contract

ComfyUI remains pinned to `7a5dad695fe1cae25efcb2550530fb20ef68da3d`; YuE2-ComfyUI remains pinned to `fc78df9dfb214f396aa281f5b03519cefff5b00a`. No dependency, environment, model or Runtime server change was made. The registered SheetSage2 file and its full SHA256/revision are consumed from the existing Model Registry and a successful actual Doctor receipt.

The new RuntimeClient public boundary exposes submit, history, wait, JSON GET/POST, scoped file upload and artifact retrieval. It does not retry writes. RuntimeFailure preserves endpoint, HTTP status, readable message and original error details. Real consumers are this transcription CLI and the parallel generation tool for issue #16. The client foundation is frozen in `43d1b440153b2e4242268812c11d98ba84e960ec`; the public Score validator foundation is frozen in `717524e592e6b458e9c371a354faeb585120b544`. The PM coordinates bringing those shared commits into the generation worktree; neither Developer edits the other's owned files.

Transcribe maps one uploaded Reference Audio into a versioned SheetSage2-only graph. ASR is false, downloads are off, no pre-edited Score is supplied, and settings follow the approved BF16/offload/keep-model baseline. Original ABC must pass `/yue2/score/read` without trimming. MIDI is produced by `/yue2/score/midi`, uploaded into this run's input subfolder and read through `/yue2/midi/tracks`. No hidden plugin parser or replacement MIDI parser is imported. Only validated artifacts become `score.abc` and `score.mid`; failure preserves request/history/parser error evidence with `verified=false`.

## Fixed input

The original synthetic instrumental fixture is dedicated to CC0-1.0. Its versioned synthesis defines a 120 BPM melody, bass, chords and percussion. The manifest records 16 seconds, 48 kHz stereo PCM16, 3,072,044 bytes and SHA256 `8cfe7f7dda6d17874bbae291ddcc7b59494de57b242c1b302bc4660537f924a9`. The waveform is generated from source into the evidence directory, checked against that fixed hash and uploaded through the public Runtime interface. No external recording or copied melody is used. SheetSage2's CC-BY-NC-4.0 weights license remains distinct from the input license.

The sample tests workflow execution and exchangeable Score/MIDI. It does not establish pitch accuracy, vocal transcription quality or support for arbitrary recordings. The bounded diagnostic PCM input budget is documented separately from actual model acceptance.

## Executed Developer checks

- Public RuntimeClient tests pass against isolated fake HTTP: rejected prompts with node errors and no automatic retry; preservation of terminal history and artifact bytes; failed model execution with original history details.
- Public Score validator rejects HTTP 200 with empty notes. The independent non-author early parser oracle also checked six real CPU-only `/yue2/score/read` cases, including rests, slash chords, ties, key changes, full model scores, incomplete sections and junk. No GPU, prompt or upload operation was performed for that oracle. Findings are retained at `.scratch/p0-development/15-score-oracle/`.
- Eight transcription CLI cases pass against fake HTTP: invalid PCM input, fixed fixture/hash/license, unavailable Runtime, missing model before writes, failed execution/history preservation, empty Score, a valid ABC/MIDI/provenance path, and rejection of a core execution-cache hit.
- Full affected CPU suite passes: `uv run --no-project --python 3.12.13 python -m unittest discover -s runtime/comfyui/tests -v` ran 24 tests successfully in 19.053 seconds. This includes the unchanged twelve Doctor tests and twelve new client/Score/transcription checks.
- Python compilation, `uv lock --project runtime/comfyui --check`, all three versioned Workflow JSON files, paired-guide local links and diff whitespace checks pass. The 87-package lock is unchanged. Independent Spec review found no must-fix issue and Standards review found no violation on `e0033f534238e2db7a081b186ff631cb6d56ac31`; final documentation/test-only review and hosted CI still require final-head readback.

The CLI tests exercise actual requests to an isolated HTTP server and actual filesystem artifacts. Their responses and GPU metadata are fake. They cannot satisfy issue #15's real target-GPU acceptance or unlock P0. The Developer has performed no GPU submissions, model/environment installation, Runtime start/stop or shared resource changes.

## Metrics and known verification risk

Client wall time and comparable execution_start/execution_success timestamps are recorded with scope. Before/after system_stats are snapshots. Peak VRAM/RAM and individual phase timings are unavailable without an actual sampler; zero is not substituted for missing data.

The pinned SheetSage2 implementation holds an independent eight-result cache keyed by recording/model stamp/listening. `unload()` releases only the model, so `keep_model_loaded=false`, new upload filenames, seed changes or mode changes do not prove fresh GPU execution. The tool rejects public ComfyUI core cache hits and records the plugin result-cache state as unavailable. The PM must attach first-run service progress, GPU and log evidence before claiming actual SheetSage2 execution. Warm output validity does not prove fresh inference.

## Actual target-GPU execution

The PM exclusively owns the live target GPU and retained Runtime at `http://127.0.0.1:8188`. Root executed the frozen `e0033f534238e2db7a081b186ff631cb6d56ac31` CLI with the saved actual Doctor receipt and original fixed input. The command exited `0`, with `status=completed`, `verified=true`, and `p0_passed=false`. Runtime prompt id: `b0110d11-9842-440e-bb39-98768fd04ba6`.

The actual 16-second, 48 kHz stereo input matches the fixed SHA256 above. ABC is 363 bytes with 32 parsed notes, SHA256 `83e068a7e583214c02914ae463dc9d11360d735cb75d5b5b3000d18453b70f1f`. MIDI is 640 bytes with 60 readable notes, SHA256 `3e93dfb2caf5dc13be56be2dc6d9406d08768d638ff56689132f58479ec0c704`. The request, native history, complete Score parser sheet, MIDI reader response and byte hashes are retained at `.scratch/p0-development/15-real/run-01/`. The exact command and source revision are recorded at `15-real/command-receipt.json`.

Native history reports success and an empty `execution_cached.nodes` list. This was the first submission of the fixed recording to the retained Runtime. Root's service log records loading `sheetsage2_bf16.safetensors` on `cuda:0`, listening, writing 128 tokens and completing the transcription. That first-run evidence is retained at `.scratch/p0-development/15-real/service-evidence/first-transcription-log.txt`; it establishes actual SheetSage2 execution on the approved target Runtime rather than relying on cached output validity.

Observed Runtime execution_start-to-execution_success time is 10.321 seconds. Client submission-through-validation wall time is 11.5 seconds. These scopes include overhead; they are not individual model-phase timings. Peak VRAM/RAM and phase timings remain unavailable. The hidden plugin result-cache state is still unobservable through public history, so this first-run result does not turn future repeats into proven fresh inference or a general performance claim.

The final documentation/test-only candidate preserves all production helpers, waveform source, workflow and manifest bytes from the executed revision. It still needs final hosted CI, affected non-author review and actual integration. Full P0 additionally requires generation, queue, cancellation, repeated Jobs and cleanup. `p0_passed` remains false.

No documentation website exists yet. Paired guides and their local source links are supplied, but Astro build, browser navigation and GitHub Pages publication are not claimed.

## Bounded simplification

The pass inspected all issue-owned committed, changed and new files against the fixed baseline, including the two shared foundation commits and the transcription graph's actual HTTP/Score consumers. A redundant deep copy of a freshly parsed per-run graph was removed. The fake Runtime now rejects unknown endpoints, keeping wire-contract mistakes observable. Source/weight/license boundaries, fixed waveform identity, request/history preservation, output validation, no-write-retry semantics, shared client ownership and honest cache/metric limits remain intact. The shared empty-Score diagnostic now says Runtime so it applies equally to Generate. The final optional Standards cleanup reuses the existing fake-server context manager in the rejected-submission test and preserves all assertions. No dependency, probe, environment, CI or retained Runtime source was modified.
