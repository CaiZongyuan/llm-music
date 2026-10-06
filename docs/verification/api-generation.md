# Issue #16 — API generation verification

Baseline: `2ef12de2f101aea3b636a7245ff1d00d41771d03`. Scope: fixed P0 Generate Workflow/input/manifest, independent verification CLI, resource sampling, artifact validation, fake HTTP CLI tests, and paired offline guides. No product API/Web, Canvas workflow, extra models, or shared-client/environment/CI changes.

## Executed developer evidence

Eight generation CLI tests pass on the existing uv-managed Python 3.12.13; the unchanged full repository CLI suite passes all 32 tests in 26.104 seconds. Compilation and staged diff checks pass. Preparation, complete PCM decoding, public Score parser consumption, fixed inputs/settings, HTTP history timing/RTF, provenance, same-run stage log capture, OOM retention and one-variable retry, core-cache rejection, resource scopes, and Runtime identity rejection are covered through public CLI/isolated HTTP behavior.

TDD observations include: missing preparation CLI; absent API execution flags; absent memory reporting; unclassified OOM; missing log capture; wrong Runtime identity incorrectly accepted; an incorrect device-memory proxy; and missing OOM retry support. The memory counterexample has 8 GiB total, Comfy free 3 GiB including 1 GiB unused Torch reservation. Correct CUDA usage is 6 GiB; Comfy's unavailable proxy is 5 GiB. Both are retained, rather than conflated. These are fake facts, not local GPU measurements.

Source/readiness knowledge from issue #14 and the shared public HTTP/Score boundary from integrated issue #15 are reused. Actual API schemas and pinned plugin source establish the four-node graph, standard VAE/embedded tokenizer, defaults, direct GenerateSong pipeline, and log labels. The direct path calls write_score/sing/decode and only records the finished take afterward. This bounded source reading found no hidden result lookup in that path; it is not a universal guarantee for staged Plan/Latents or future repeats.

## Impact and measurement boundaries

New consumers of RuntimeClient are the generation CLI and resource sampler; validate_abc is shared with transcription. Their public contracts are consumed unchanged. The generation manifest owns only its input/output/node mappings. Runtime, plugin, registry, environment, ports, and shared helper files remain under their existing owners. Real requests verify clean pinned Runtime sources and the selected PID before submission; an occupied queue fails without mutation.

RTF uses actual history timestamps and decoded output duration. The reported boundary includes saving nodes; weight-hash preflight and client decode/Score validation are separate. Resource values are sampled, not exact peaks. CUDA available/allocated device view, Comfy availability proxy, Torch allocator subset, host RAM, selected process RSS, and unavailable WDDM per-process GPU residency are named separately. Exclusive model-load time is unavailable; the plugin's rounded loading-and-other total is labeled as such. No weighted progress percentage is claimed.

Cold/repeat labels are caller-declared session conditions. Preflight hashes read model files and may warm filesystem cache. Core DAG cache hits preserve outputs but remove the generation performance claim. No global cache setting or inference variable is changed to manufacture uncached work.

## Bounded simplification

The pass inspected issue-owned source, Workflow files, tests, and immediate shared consumers against the baseline. Resource/log observation remains separate from generation orchestration and the shared HTTP client. No generic benchmark framework or duplicate parser/client was added. Unknown fields remain explicit and existing failure/cache/ownership guards remain intact.

## Actual target-GPU baseline

The PM executed the first strict-serial request on the clean frozen candidate `3b7336450b353e7a18610bb619fb4911acd00d7b`. The developer submitted no real Runtime job and performed no GPU execution, environment synchronization, server control, or model write. The public CLI exited `0` with completed status and `p0_passed=false`.

| Observed result | Value / scope |
| --- | --- |
| Audio | Lossless FLAC, 48 kHz stereo, 2,959,875 bytes; all 1,679,936 frames decoded; 34.9986667 seconds. |
| Audio SHA256 | `2a9969a1c56f99aee4870f3787a4dff9e3eb8bf6b81bf211e0d1ba86ab3cf366`. |
| Score | ABC 787 bytes; public parser accepted complete bars and 96 valid pitched notes. |
| Actual work | history cached_nodes is empty; core_cached=false. Same-run plugin score/performance/acoustic/decode summaries corroborate the direct pipeline. |
| Workflow timing / RTF | 54.678 seconds from execution_start to execution_success; RTF 1.562288087 from the actual decoded duration. Includes saving nodes; excludes weight-hash preflight and client artifact validation. |
| Client windows | Submission→history 55.453 seconds; submission/wait/validation window 58.703 seconds. |
| Rounded plugin stage readings | Score 15.3 s, semantic performance 17.7 s, acoustic 12.0 s, decode 0.9 s. Loading-and-other 6.2 s includes loading, unloading and other work; exclusive model_load remains unavailable. |
| Sampled CUDA whole-device peak | 6,013,059,072 bytes; allocated/available view including other GPU consumers, not WDDM process residency. |
| Sampled Comfy proxy peak | 5,995,527,920 bytes; separately excludes unused Torch reservation. |
| Sampled host RAM / Runtime RSS peaks | Whole-host used RAM 32,421,019,648 bytes; selected PID 50752 resident working set 10,536,738,816 bytes. Host value includes other consumers; client memory is outside the selected-process scope. |
| Sampled Torch allocator subset peak | 4,680,089,328 bytes; excludes non-Torch/context allocations and is not total process GPU resident memory. |
| Sampling limits | 53 samples; configured interval 1 s; largest observed gap 2.813 s; no sampler errors. Peaks remain sampling-limited lower bounds. |
| Inference settings | Baseline BF16/offload=on/low_vram=false/keep_model_loaded=false/cot=full/standard VAE/sdpa/35-second ceiling retained. No OOM and no low_vram fallback run. |

Immutable receipts remain at `.scratch/p0-development/16-real/command-receipt.json` and `baseline/`: report, input/request/manifest, model/source facts, history, full parsed Score, 53 memory samples, raw appended Runtime logs, and original Audio/Score. The report's four tool-helper SHA256 values, input SHA256, Workflow definition and manifest SHA256 exactly match the current frozen files. Runtime/plugin source pins are still `7a5dad695fe1cae25efcb2550530fb20ef68da3d` / `fc78df9dfb214f396aa281f5b03519cefff5b00a`; the generation checkpoint still uses the verified `2f76ca75e6ee094169de899cc7fc99d6887e2196` model revision. This documentation-only follow-up changes no production file, input, Workflow or initial artifact.

The PM separately decoded the whole original file and confirmed finite, non-silent audio: RMS 0.1212529 and absolute peak 0.826416, retained in `16-real/audio-inspection.json`. Original FLAC and audition excerpts are available. The audio-input tool was unsupported, so no subjective/manual quality listening occurred; listening_review correctly remains pending. Numeric inspection does not imply a listening review. Optional quality feedback is not represented as completed or as an extra baseline merge gate.

This is one first-generation sample in an already running Runtime session. The weight SHA read may warm filesystem cache; the observation supports this fixed short workload, not repeat stability, an optimization comparison, long-song quality, or a server cold-start claim. Independent Standards/Spec review reports zero must-fix findings on the frozen source; final-head documentation review, hosted CI and actual integration remain PM readback steps. Full P0 transcription/queue/cancel/history/repeat/cleanup acceptance is still separate. The online documentation site is not implemented here; no Astro/browser/Pages publication claim is made.
