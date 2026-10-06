# P0 Runtime actual report

On 2026-10-07, Root accepted all eight actual P0 Runtime checks for the fixed target profile: 16-second transcription inputs and 35-second generation budgets on the retained RTX 3070 Ti Laptop Runtime. The measured memory acceptance covers native Torch active blocks and finite resident-memory release/recovery observations. The original varying RSS vectors and unresolved private-memory delta remain reported. Final independent review, final-head CI and actual PR integration still determine the PM's final P0 gate; the harness and matching assessment retain `p0_passed=false`.

This is the maintenance record for [the production plan](../production.md). Product FastAPI and Web are outside this P0 delivery. [The repeat/cleanup record](runtime-repeat-cleanup.md) contains detailed timing, raw window validation and the follow-up memory assessment. Public instructions are provided in paired [Chinese](../guides/runtime-repeat-cleanup.md) and [English](../guides/runtime-repeat-cleanup.en.md) guides.

## Target and pins

| Component | Actual verified baseline |
| --- | --- |
| Host / GPU | Windows; NVIDIA GeForce RTX 3070 Ti Laptop GPU, nominal 8192 MiB; CUDA addressable 8,589,410,304 bytes (8191.5 MiB). |
| Driver / CUDA | NVIDIA 610.62; Torch CUDA 13.0. |
| Python / Torch | CPython 3.12.13; Torch 2.10.0+cu130. |
| Torch native source | `449b1768410104d3ed79d3bcfe4ba1d65c7f22c0`. |
| ComfyUI | `7a5dad695fe1cae25efcb2550530fb20ef68da3d`, reporting 0.39.0. |
| YuE2 plugin | `fc78df9dfb214f396aa281f5b03519cefff5b00a`. |
| Models revision | `Comfy-Org/YuE2` at `2f76ca75e6ee094169de899cc7fc99d6887e2196`. |
| Retained Runtime | Owned PID 50752; creation identity retained across the actual checks and memory extension. Local HTTP at port 8188. |
| Generate profile | BF16 backbone, offload on, low_vram false, keep_model_loaded false, cot full, sdpa, standard VAE in FP32, downloads off, no additional ASR/Writer/LoRA path. |
| Transcribe profile | SheetSage2 BF16; original CC0 stereo 48 kHz PCM16 media, ASR/downloads off, no pre-edited Score. |

[Runtime configuration](../../runtime/comfyui/runtime.json) and [the model registry](../../runtime/comfyui/models.json) retain the authoritative pins and component/license facts. Doctor verified both complete model hashes:

| Weight | Bytes | SHA256 |
| --- | ---: | --- |
| YuE2-3B BF16 + standard VAE | 7,799,983,228 | `33765adbf9813c9a50318218760b2fd819a319862460a04884607581961c6fee` |
| SheetSage2 BF16 | 1,386,868,122 | `5fd960ce3df281e3f3a889d174584d88f96247711480cf96377b12d7e8b6adc5` |

Doctor's twelve readiness checks passed: actual CUDA/BF16 work, native node registration/lazy imports/resampling, source pins, full model hashes, disk and startup-port ownership. Raw capacity bytes remain recorded; nearest-MiB comparison with half units rounded up accepts the nominal 8 GiB device. Readiness is a prerequisite, separate from the eight Runtime cases below.

## Actual case acceptance

| Required case | Root's scoped result | Actual evidence |
| --- | --- | --- |
| Transcription | Passed | #15 fresh SheetSage2 execution: complete ABC with 32 parsed notes and readable MIDI with 60 notes from the 16-second original input. |
| Generation | Passed | #16 uncached direct Generate: valid 96-note Score and fully decoded 34.998667-second stereo FLAC. No baseline OOM or fallback run. |
| Queue | Passed | #17 owned mixed A/B/C/D queue; surviving native A/B/D execution intervals are serial and non-overlapping. |
| Queued cancellation | Passed | #17 exact owned pending C disappears after deletion, never gains terminal history, and surviving work completes with final queue idle. Empty acknowledgement alone is not the proof. |
| Running cancellation | Passed | #18 fresh attributable score-token work is interrupted; the same target's native history and normalized Job record confirm cancellation. Successful B survives two stale-A native-false probes. |
| History / output recovery | Passed | #17 terminal histories retain saved prompt/client/graph ownership and recover validated Audio/Score/MIDI artifacts. |
| Ten continuous jobs | Passed within measured fixed-profile scope | #19 T1/G1…T5/G5 all fresh and valid in one process; 502 ordered samples and 24 stored item windows agree with final raw slices. Matching Root assessment includes the bounded memory diagnostics below. |
| Cleanup / continued operation | Passed | #19 one `/free` after the ten jobs, exact uncached G5 replay with unchanged core/ancestors/bindings except SaveAudio prefix, then a new Sage T6 with reload and valid outputs. No zero-memory claim. |

Original ten-job run ID is `4e8f774399f44590b28286c7b87a216d`; frozen execution source is `caff91c8a633ddd21611369c20e1c08ea5769d91`. There was no restart, retry or inter-item free. The two cleanup witnesses and later diagnostics do not replace any of the ten jobs. Later process-error, prepared-input and final-window fixes preserve the actual normal-path inputs/settings/workload; Root accepts reuse of the original evidence. The final explanation-only follow-up preserves all field names and numeric formulas.

## Timing and resources

| Workload | Native execution seconds | Actual denominator seconds | Processing factor / RTF |
| --- | ---: | ---: | ---: |
| #15 transcription | 10.321 | 16 | 0.645063 |
| #16 baseline generation | 54.678 | 34.998667 | 1.562288 |
| #19 original T1–T5 | 6.731–7.822 | 16 | 0.420688–0.488875 |
| #19 original G1–G5 | 55.895–83.101 | 34.998667 | 1.597061–2.374405 |
| #19 exact G5 cleanup replay | 85.185 | 34.998667 | 2.433950 |
| #19 new T6 cleanup witness | 7.820 | 16 | 0.488750 |

Native execution_start→execution_success includes Workflow overhead/saving nodes. Transcription divides by actual input duration; generation divides by every-frame decoded output duration. Model hash preflight and client artifact validation are separate from these native timing windows. Rounded plugin stage readings are available, but exclusive model-load time is unavailable. The different seeds/inputs and retained session/cache conditions do not establish a performance improvement or speed regression.

| Original #19 continuous sampler | Observed value and scope |
| --- | --- |
| Coverage | 502 ordered rows over 483.125 seconds; configured interval 1 second, largest observed gap 3.156 seconds; no sampler errors. |
| CUDA whole-device used peak | 6,319,243,264 bytes; reconstructed as total−(Comfy free−Torch free), includes other GPU consumers. |
| Comfy unavailability proxy peak | 6,195,888,712 bytes; excludes unused Torch reservation. |
| Torch active allocator peak | 4,842,701,384 bytes; selected Runtime native active blocks, including awaiting-free. |
| Runtime RSS peak | 10,464,862,208 bytes; selected PID resident working set. |
| Whole-host used RAM peak | 33,665,449,984 bytes; includes all host consumers. |
| Per-item windows | All 24 active/idle slices match final raw rows; every original item idle contains four samples. |
| Retained files | Declared Runtime-state metadata records 12 files before and 35 after; requests, inputs, outputs, songs and evidence are preserved. |

The legacy `runtime_torch_allocator_allocated_bytes` field actually reconstructs pinned native `active_bytes.all.current`: `torch_vram_total - torch_vram_free = reserved - (reserved - active)`. Its name/value formula remains compatible. It is not strictly `memory_allocated()`, total CUDA context memory or WDDM process GPU residency. Sampled peaks are lower bounds. Whole-device, Comfy proxy, Torch active, Runtime RSS and whole-host RAM values have different scopes and must not be summed or substituted for one another.

## Bounded memory interpretation

Original G idle active values rose by exactly 17,039,360 bytes per full Generate, reaching 171,442,176 after G5 and 188,481,536 after the exact G5 replay. Ordinary `/free` did not remove this GPU component. The pinned cuBLAS stream/handle workspace is W=8,519,680 bytes; the observed full path visits two warmup streams. Native pooled streams cycle through 32 keys. Root's separate 40-step correct BF16 probe demonstrates W increments and reuse of stream handles 1–8 at steps 33–40, with a settled probe plateau of 272,695,296 bytes including its 65,536-byte input matrices.

Root then ran seven additional full uncached music generations using new declared seeds in the same Runtime. Settled active values are 205,520,896 / 222,560,256 / 239,599,616 / 256,638,976 / 273,678,336 / 273,678,336 / 273,678,336 bytes. Jobs G6 and G7 each have three equal readings roughly one second apart and add zero. No eighth job ran. The empirical music plateau is 32W+1 MiB=261 MiB. It supports bounded workspace retention in this observed pinned path, without asserting a total-device cap or inspection of every live workspace holder.

The original different-seed Generate RSS endpoints remain 2,378,936,320→2,394,492,928 bytes; extension RSS also varies. They are not relabelled constant or fully attributed. One later public free releases 13,500,416 RSS/USS bytes, close to the current 13,439,488-byte CPU output waveform. Exact matching-input G7 replay returns RSS to 2,414,497,792 and USS to 2,141,159,424 bytes, each 8,192 bytes above the matching pre-free G7 endpoint. The same replay's private committed-memory delta is +1,933,312 bytes and remains unexplained. All CPU holders, arbitrary input shapes, private-heap plateaus and indefinite leak freedom are outside the measured claim.

Root's matching `19-memory-assessment.json` accepts the fixed-profile measured Torch active and resident release/recovery checks. Its `unexplained_growth=false` concerns that accepted scope; the private-memory delta and individual earlier CPU holders remain unresolved. Independent Spec supports that narrow interpretation; the author Advisor confirms the GPU plateau, CPU release and matched resident recovery while reserving the earlier different-input RSS attribution. `19-reviewed-report/runtime-report.json` records all eight cases passed and keeps `p0_passed=false` pending final integration.

## Evidence, checks and limits

Receipts are retained under `.scratch/p0-development/`. The maintenance records describe each command, source candidate, public API behavior, actual artifacts and verification limits:

| Evidence group | Retained receipts / maintenance entry |
| --- | --- |
| Preparation / Doctor | `14-real/doctor.json`, service receipts; [Doctor record](runtime-doctor.md). |
| Transcription | `15-real/command-receipt.json`, `run-01/receipt.json`, request/history/ABC/MIDI; [transcription record](runtime-transcription.md). |
| Baseline Generate | `16-real/command-receipt.json`, `baseline/report.json`, all 53 memory samples, raw stages/audio/Score; [generation record](api-generation.md). |
| Queue / pending cancellation / history | `17-real/summary.json`, `run-01/report.json`, mappings/history/artifacts; [queue record](runtime-queue-history.md). |
| Running cancellation | `18-real/summary.json`, `run-01/report.json`, native cancel/history/Job readback, protected-file hashes; [cancellation record](runtime-running-cancel.md). |
| Continuous jobs / original cleanup | `19-real/command-receipt.json`, `summary.json`, `run-01/report.json`, 502 raw rows and all item receipts; [repeat record](runtime-repeat-cleanup.md). |
| Bounded memory diagnostics | `19-workspace-probe.py/json`, `19-extension/receipt.json`, `summary.json`, `19-final-public-free.json`, `19-ram-replay/`, `19-memory-after-ram-replay.json`. |
| Assessment / eight-case report | `19-memory-assessment.json`, `19-memory-consultation.md`, `19-ram-delta-assessment.md`, `19-reviewed-report/runtime-report.json/md`, benchmark and known-limits reports. |

The repaired #19 implementation passes all 64 CPU tests in 107.368 seconds using the isolated managed Python 3.12.13 entrypoint. Its three new public regressions were red before repair and green afterward. Those CPU providers do not replace real GPU evidence. Compilation, paired local links, unchanged 87-package lock/config/model registry and diff checks pass. The final follow-up changes documentation and one metric-scope string; final review and hosted 64-test CI on the final candidate remain Root-owned.

Subjective listening is deferred, so successful decoding/nonzero signal does not establish musical quality or pitch accuracy. Long songs, arbitrary audio/Score shapes, indefinite operation and private committed-memory stability were not tested. WDDM per-process GPU residency is unavailable. Device/host samples include other consumers; extension device/host peaks may overlap the recorded accidental GPU-venv CPU-test capability probe, while selected Runtime settled active counters retain their scope. That interpreter-selection error is preserved in `19-final-full-runtime-venv.json/txt` and `19-runtime-venv-test-audit.json`; worker/probe PIDs and actual UTC process boundaries are unknown. The original ten-plus-two series finished before that probe. No server cold-start benchmark, universal leak freedom, performance improvement, formal product API/Web, Astro/browser check or Pages publication is claimed.
