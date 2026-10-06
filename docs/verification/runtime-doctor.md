# Runtime Doctor — issue #14 verification

Date: 2026-10-07. Baseline: `38dc7004b421b1ee81173d01b003cb7168f70fcb`. Scope: the independent ComfyUI environment, Model Registry, P0 CLI, GPU-free CLI checks, and paired maintenance guides. No formal application API or Web was created.

## Executed checks

| Check | Observed result | Scope |
| --- | --- | --- |
| `uv lock --project runtime/comfyui` | Resolved 87 packages on uv 0.11.28; pinned CUDA 13.0 Torch/vision/audio Windows CPython 3.12 wheels. | Dependency resolution; no installation or GPU claim. |
| `uv lock --project runtime/comfyui --check` | Passed after the final source simplification. | Lock matches the project manifest. |
| `uv run --no-project --python 3.12.13 python -m unittest discover -s runtime/comfyui/tests -v` | Original 8 tests passed; 12 tests pass after the capacity/process repair. | Public CLI behavior with temporary files, Git repositories, sockets, and fake or missing external Runtime dependencies. Fake evidence. |
| `uv run --no-project --python 3.12.13 python -m compileall -q runtime/comfyui/manage.py runtime/comfyui/probe.py runtime/comfyui/tests` | Passed. | Python compilation; no inference claim. |
| Independent source and readiness-oracle investigation | Exact HF metadata and official wheel listings verified; bounded fake success/failure cases passed after the external-path repair. | Separate non-author evidence; not GPU acceptance. |

Tests cover combined missing GPU/runtime/models, same-size corrupt weights, partial transfers, hash-valid external files that Runtime cannot resolve, occupied ports, wrong/dirty source pins, preservation of existing invalid weights, and configuration errors. The external-file test failed before repair and passed after Doctor required the registered Runtime path to resolve the same file. Independent full-prerequisite fake checks also confirmed external-only files remain not ready, while a linked file at the authoritative path permits synthetic ready with `p0_passed=false`.

Independent source receipts and oracle evidence are retained in the PM workspace at `.scratch/p0-development/sources/`. The source investigation did not install dependencies, download model bytes, execute CUDA, or perform inference.

## Actual preparation and pending readiness

The PM owns heavy dependency/model downloads, the target GPU, and port 8188. Both actual model files are downloaded and match their published byte counts and full SHA256; receipts are retained at `.scratch/p0-development/model-download-receipts.json`. The PM also ran the public `download-models` command against these existing files: both were reused and fully verified, and the command exited `0`.

The frozen environment is installed, and the PM's public `prepare` invocation on `e8b302397611292bd55b3a6d42ab18510122ec99` exited `0`. The first real Doctor timed out after 120 seconds. A later instrumented actual probe completed in 30.828 seconds: Torch 2.10.0+cu130, CUDA 13.0, the target GPU, BF16 matrix multiplication with result `[[2, 2], [2, 2]]`, native custom-node registration, all four lazy imports, and 48→24 kHz resampling passed. This warm observation does not establish the cause of the first timeout. Its stage observations are retained at `.scratch/p0-development/diag/stage-observations.json`.

The subsequent baseline Doctor completed with exit `1`, and its only failed check was the capacity comparison. CUDA reports 8,589,410,304 addressable bytes, or 8191.5 MiB; NVIDIA reports nominal 8192 MiB. The exact-byte threshold incorrectly rejected the target by 512 KiB. The repair retains raw bytes and compares nearest MiB with half units rounded up against the unchanged 8192 MiB target. A public CLI regression with the actual raw value failed before the repair and passes afterward; a 6 GiB case remains rejected.

The probe now emits flushed stage checkpoints. Doctor preserves completed facts and bounded stdout/stderr tails on timeout or nonzero exit. An explicit process-completion check prevents any timeout or nonzero exit from yielding ready, even after every positive checkpoint. Two real subprocess timeout fixtures and a nonzero-exit fixture exercise this behavior without CUDA; all are fake external-library evidence. The timeout remains 120 seconds by default, with only smaller positive configured bounds allowed. The repaired real Doctor and actual server launch remain pending. Existing-file refusal is tested; the downloader's first-transfer HTTP/resumption path has not been exercised by the public command. Full P0 transcription, generation, queue, cancellation, repetition and cleanup remain later tickets; this issue cannot claim that P0 passed.

## Dependency and resource impact

The new consumers are the documented CLI, its subprocess import worker, the launcher, and later P0 Runtime verification. The independent environment keeps CUDA dependencies out of the future application backend. Python 3.12.13 and the official CUDA 13.0 wheels match the pinned ComfyUI recommendation and the available target driver. `torchaudio` is included because SheetSage2 lazily imports it for sample rates other than 24 kHz. Actual tiny BF16 CUDA computation and imports are verified; full-model inference remains subject to later P0 checks. The new stage protocol is owned by Doctor and its worker; no product API consumes it. Process completion remains separate from completed prerequisite facts.

ComfyUI is pinned to `7a5dad695fe1cae25efcb2550530fb20ef68da3d`; YuE2-ComfyUI is pinned to `fc78df9dfb214f396aa281f5b03519cefff5b00a`. The registry uses Comfy-Org/YuE2 revision `2f76ca75e6ee094169de899cc7fc99d6887e2196` and published Git LFS SHA256 for two files totaling 9,186,851,350 bytes. The generation checkpoint includes YuE2, standard VAE, and embedded vocabulary. A separate VAE/tokenizer download is unnecessary for this baseline. Code and weight licenses remain distinct; standalone tokenizer licensing is unspecified.

The launch contract owns only a local foreground ComfyUI process and its selected port. It writes input/output/user/temp state below the selected state root and uses the selected model root exclusively. Root/data and runtime-local ignore files exclude model bytes, partial files, source checkouts and environments without changing the user-staged root ignore file. Worktree callers must pass the PM-owned shared roots explicitly. Only the GPU resource owner runs actual CUDA checks or starts inference.

## Bounded simplification

The pass inspected all issue-owned new files against the baseline. The CLI and subprocess probe retain distinct responsibilities: a broken import or CUDA process cannot prevent other readiness diagnostics. Disk reservation now reads the model checks directly, and a redundant exception subtype was removed. Schema/path validation, full-file hashes, source provenance, failure aggregation, startup gating, and data ownership remain intact. No broad refactor was needed.

The Windows CI workflow runs the public CLI tests with exact Python 3.12.13 and no CUDA packages, model downloads, or project environment sync. The first two runs on candidate `5c3635a0a17eab1fac6352fc1698fad80aac85bf` failed before tests: `actions/setup-python` could not provide Python 3.12.13 x64 on Windows 2025. See [push run](https://github.com/CaiZongyuan/llm-music/actions/runs/37493312995) and [PR run](https://github.com/CaiZongyuan/llm-music/actions/runs/37493313718).

The repair uses verified `astral-sh/setup-uv` v10.2.0 at `c18668ad3cf93ea998bef934396af7bb5c839dc7`, pins the official [uv 0.11.28 release](https://github.com/astral-sh/uv/releases/tag/0.11.28), and explicitly runs `uv python install 3.12.13`. uv lists the Windows x64 Python 3.12.13 build from the official [20260623 standalone provider release](https://github.com/astral-sh/python-build-standalone/releases/tag/20260623); its exact install-only stripped archive exists in that release. This preserves the exact interpreter instead of changing the target to fit another provider.

Both runs on `f7b67dc633c0224455941e63933552fbd20b116e` provisioned Python successfully and executed all eight tests. Seven passed; one test incorrectly required the temporary path's original string spelling. Windows represented the same file as `C:\Users\RUNNER~1\...` and `C:\Users\runneradmin\...`. See [push run](https://github.com/CaiZongyuan/llm-music/actions/runs/37494707468) and [PR run](https://github.com/CaiZongyuan/llm-music/actions/runs/37494710565). The test now checks `Path.samefile` while the temporary file exists. Its assertions that the external model cannot make Runtime ready remain intact; Doctor behavior is unchanged. The targeted local case and full eight-test suite pass. The repaired GitHub head must be observed after publication before CI is reported green.

The path repair at `e8b302397611292bd55b3a6d42ab18510122ec99` passed [hosted CI](https://github.com/CaiZongyuan/llm-music/actions/runs/37495773549). This evidence covers that revision and its eight tests. The later capacity/process candidate needs its own real Doctor, independent review refresh, and hosted twelve-test result on the final head.

There is no documentation site yet, so this change does not claim Astro build, browser navigation, or GitHub Pages publication.
