# Issue #16 — API generation verification

Baseline: `2ef12de2f101aea3b636a7245ff1d00d41771d03`. Scope: fixed P0 Generate Workflow/input/manifest, independent verification CLI, resource sampling, artifact validation, fake HTTP CLI tests, and paired offline guides. No product API/Web, Canvas workflow, extra models, or shared-client/environment/CI changes.

## Executed developer evidence

Eight generation CLI tests pass on the existing uv-managed Python 3.12.13. Preparation, complete PCM decoding, public Score parser consumption, fixed inputs/settings, HTTP history timing/RTF, provenance, same-run stage log capture, OOM retention and one-variable retry, core-cache rejection, resource scopes, and Runtime identity rejection are covered through public CLI/isolated HTTP behavior.

TDD observations include: missing preparation CLI; absent API execution flags; absent memory reporting; unclassified OOM; missing log capture; wrong Runtime identity incorrectly accepted; an incorrect device-memory proxy; and missing OOM retry support. The memory counterexample has 8 GiB total, Comfy free 3 GiB including 1 GiB unused Torch reservation. Correct CUDA usage is 6 GiB; Comfy's unavailable proxy is 5 GiB. Both are retained, rather than conflated. These are fake facts, not local GPU measurements.

Source/readiness knowledge from issue #14 and the shared public HTTP/Score boundary from integrated issue #15 are reused. Actual API schemas and pinned plugin source establish the four-node graph, standard VAE/embedded tokenizer, defaults, direct GenerateSong pipeline, and log labels. The direct path calls write_score/sing/decode and only records the finished take afterward. This bounded source reading found no hidden result lookup in that path; it is not a universal guarantee for staged Plan/Latents or future repeats.

## Impact and measurement boundaries

New consumers of RuntimeClient are the generation CLI and resource sampler; validate_abc is shared with transcription. Their public contracts are consumed unchanged. The generation manifest owns only its input/output/node mappings. Runtime, plugin, registry, environment, ports, and shared helper files remain under their existing owners. Real requests verify clean pinned Runtime sources and the selected PID before submission; an occupied queue fails without mutation.

RTF uses actual history timestamps and decoded output duration. The reported boundary includes saving nodes; weight-hash preflight and client decode/Score validation are separate. Resource values are sampled, not exact peaks. CUDA available/allocated device view, Comfy availability proxy, Torch allocator subset, host RAM, selected process RSS, and unavailable WDDM per-process GPU residency are named separately. Exclusive model-load time is unavailable; the plugin's rounded loading-and-other total is labeled as such. No weighted progress percentage is claimed.

Cold/repeat labels are caller-declared session conditions. Preflight hashes read model files and may warm filesystem cache. Core DAG cache hits preserve outputs but remove the generation performance claim. No global cache setting or inference variable is changed to manufacture uncached work.

## Bounded simplification

The pass inspected issue-owned source, Workflow files, tests, and immediate shared consumers against the baseline. Resource/log observation remains separate from generation orchestration and the shared HTTP client. No generic benchmark framework or duplicate parser/client was added. Unknown fields remain explicit and existing failure/cache/ownership guards remain intact.

## Actual acceptance pending at source freeze

The developer submitted no real Runtime job and performed no GPU execution, environment synchronization, server control, or model write. Root owns the first strict-serial 35-second baseline. The frozen command must produce decodable 30–40-second audio, inspectable Score, memory/time/source receipts, raw logs, and actual listening observations. Only actual baseline OOM permits changing low_vram alone and keeping both reports. Source/fake evidence does not satisfy this real GPU criterion.

Final full tests, compilation, independent Standards/Spec review, hosted CI, and actual integration are recorded by the PM. Successful generation alone cannot pass the full P0 transcription/queue/cancel/history/repeat/cleanup gate. The online documentation site is not implemented here; no Astro/browser/Pages publication claim is made.
