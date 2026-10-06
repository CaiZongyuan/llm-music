# Runtime Doctor — issue #14 verification

Date: 2026-10-06. Baseline: `38dc7004b421b1ee81173d01b003cb7168f70fcb`. Scope: the independent ComfyUI environment, Model Registry, P0 CLI, GPU-free CLI checks, and paired maintenance guides. No formal application API or Web was created.

## Executed checks

| Check | Observed result | Scope |
| --- | --- | --- |
| `uv lock --project runtime/comfyui` | Resolved 87 packages on uv 0.11.28; pinned CUDA 13.0 Torch/vision/audio Windows CPython 3.12 wheels. | Dependency resolution; no installation or GPU claim. |
| `uv lock --project runtime/comfyui --check` | Passed after the final source simplification. | Lock matches the project manifest. |
| `uv run --no-project --python 3.12.13 python -m unittest discover -s runtime/comfyui/tests -v` | 8 tests passed. | Public CLI behavior with temporary files, Git repositories, sockets, and missing external Runtime dependencies. Fake evidence. |
| `uv run --no-project --python 3.12.13 python -m compileall -q runtime/comfyui/manage.py runtime/comfyui/probe.py runtime/comfyui/tests` | Passed. | Python compilation; no inference claim. |
| Independent source and readiness-oracle investigation | Exact HF metadata and official wheel listings verified; bounded fake success/failure cases passed after the external-path repair. | Separate non-author evidence; not GPU acceptance. |

Tests cover combined missing GPU/runtime/models, same-size corrupt weights, partial transfers, hash-valid external files that Runtime cannot resolve, occupied ports, wrong/dirty source pins, preservation of existing invalid weights, and configuration errors. The external-file test failed before repair and passed after Doctor required the registered Runtime path to resolve the same file. Independent full-prerequisite fake checks also confirmed external-only files remain not ready, while a linked file at the authoritative path permits synthetic ready with `p0_passed=false`.

Independent source receipts and oracle evidence are retained in the PM workspace at `.scratch/p0-development/sources/`. The source investigation did not install dependencies, download model bytes, execute CUDA, or perform inference.

## Actual readiness still pending at candidate freeze

The PM owns heavy dependency/model downloads, the target GPU, and port 8188. At this source freeze, the Developer has not executed the real GPU Doctor or server launch. Their results must be added after actual execution. Full P0 transcription, generation, queue, cancellation, repetition and cleanup remain later tickets; this issue cannot claim that P0 passed.

The public `prepare` and `download-models` commands have not yet been run against the final real installation by the Developer. Existing-file refusal is tested; live HTTP transfer/resumption and the actual server launch still require PM execution. A completed source checkout or HF metadata response does not prove downloaded weights are ready.

## Dependency and resource impact

The new consumers are the documented CLI, its subprocess import worker, the launcher, and later P0 Runtime verification. The independent environment keeps CUDA dependencies out of the future application backend. Python 3.12.13 and the official CUDA 13.0 wheels match the pinned ComfyUI recommendation and the available target driver. `torchaudio` is included because SheetSage2 lazily imports it for sample rates other than 24 kHz. Actual compatibility remains subject to the CUDA/import checks.

ComfyUI is pinned to `7a5dad695fe1cae25efcb2550530fb20ef68da3d`; YuE2-ComfyUI is pinned to `fc78df9dfb214f396aa281f5b03519cefff5b00a`. The registry uses Comfy-Org/YuE2 revision `2f76ca75e6ee094169de899cc7fc99d6887e2196` and published Git LFS SHA256 for two files totaling 9,186,851,350 bytes. The generation checkpoint includes YuE2, standard VAE, and embedded vocabulary. A separate VAE/tokenizer download is unnecessary for this baseline. Code and weight licenses remain distinct; standalone tokenizer licensing is unspecified.

The launch contract owns only a local foreground ComfyUI process and its selected port. It writes input/output/user/temp state below the selected state root and uses the selected model root exclusively. Root/data and runtime-local ignore files exclude model bytes, partial files, source checkouts and environments without changing the user-staged root ignore file. Worktree callers must pass the PM-owned shared roots explicitly. Only the GPU resource owner runs actual CUDA checks or starts inference.

## Bounded simplification

The pass inspected all issue-owned new files against the baseline. The CLI and subprocess probe retain distinct responsibilities: a broken import or CUDA process cannot prevent other readiness diagnostics. Disk reservation now reads the model checks directly, and a redundant exception subtype was removed. Schema/path validation, full-file hashes, source provenance, failure aggregation, startup gating, and data ownership remain intact. No broad refactor was needed.

The Windows CI workflow runs the same eight CLI tests with exact Python 3.12.13 and no CUDA packages, model downloads, or uv environment sync. Its actual GitHub run is pending publication. There is no documentation site yet, so this change does not claim Astro build, browser navigation, or GitHub Pages publication.
