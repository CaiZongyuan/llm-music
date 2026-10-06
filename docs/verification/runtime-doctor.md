# Runtime Doctor — issue #14 verification

Date: 2026-10-07. Baseline: `38dc7004b421b1ee81173d01b003cb7168f70fcb`. Scope: the independent ComfyUI environment, Model Registry, P0 CLI, GPU-free CLI checks, and paired maintenance guides. No formal application API or Web was created.

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

## Actual preparation and pending readiness

The PM owns heavy dependency/model downloads, the target GPU, and port 8188. Both actual model files are downloaded and match their published byte counts and full SHA256; receipts are retained at `.scratch/p0-development/model-download-receipts.json`. The PM also ran the public `download-models` command against these existing files: both were reused and fully verified, and the command exited `0`.

Heavy environment synchronization is still in progress. The real GPU Doctor, public `prepare` command, and server launch remain pending. Existing-file refusal is tested; the downloader's first-transfer HTTP/resumption path has not been exercised by the public command. Full P0 transcription, generation, queue, cancellation, repetition and cleanup remain later tickets; this issue cannot claim that P0 passed.

## Dependency and resource impact

The new consumers are the documented CLI, its subprocess import worker, the launcher, and later P0 Runtime verification. The independent environment keeps CUDA dependencies out of the future application backend. Python 3.12.13 and the official CUDA 13.0 wheels match the pinned ComfyUI recommendation and the available target driver. `torchaudio` is included because SheetSage2 lazily imports it for sample rates other than 24 kHz. Actual compatibility remains subject to the CUDA/import checks.

ComfyUI is pinned to `7a5dad695fe1cae25efcb2550530fb20ef68da3d`; YuE2-ComfyUI is pinned to `fc78df9dfb214f396aa281f5b03519cefff5b00a`. The registry uses Comfy-Org/YuE2 revision `2f76ca75e6ee094169de899cc7fc99d6887e2196` and published Git LFS SHA256 for two files totaling 9,186,851,350 bytes. The generation checkpoint includes YuE2, standard VAE, and embedded vocabulary. A separate VAE/tokenizer download is unnecessary for this baseline. Code and weight licenses remain distinct; standalone tokenizer licensing is unspecified.

The launch contract owns only a local foreground ComfyUI process and its selected port. It writes input/output/user/temp state below the selected state root and uses the selected model root exclusively. Root/data and runtime-local ignore files exclude model bytes, partial files, source checkouts and environments without changing the user-staged root ignore file. Worktree callers must pass the PM-owned shared roots explicitly. Only the GPU resource owner runs actual CUDA checks or starts inference.

## Bounded simplification

The pass inspected all issue-owned new files against the baseline. The CLI and subprocess probe retain distinct responsibilities: a broken import or CUDA process cannot prevent other readiness diagnostics. Disk reservation now reads the model checks directly, and a redundant exception subtype was removed. Schema/path validation, full-file hashes, source provenance, failure aggregation, startup gating, and data ownership remain intact. No broad refactor was needed.

The Windows CI workflow runs the same eight CLI tests with exact Python 3.12.13 and no CUDA packages, model downloads, or project environment sync. The first two runs on candidate `5c3635a0a17eab1fac6352fc1698fad80aac85bf` failed before tests: `actions/setup-python` could not provide Python 3.12.13 x64 on Windows 2025. See [push run](https://github.com/CaiZongyuan/llm-music/actions/runs/37493312995) and [PR run](https://github.com/CaiZongyuan/llm-music/actions/runs/37493313718).

The repair uses verified `astral-sh/setup-uv` v10.2.0 at `c18668ad3cf93ea998bef934396af7bb5c839dc7`, pins the official [uv 0.11.28 release](https://github.com/astral-sh/uv/releases/tag/0.11.28), and explicitly runs `uv python install 3.12.13`. uv lists the Windows x64 Python 3.12.13 build from the official [20260623 standalone provider release](https://github.com/astral-sh/python-build-standalone/releases/tag/20260623); its exact install-only stripped archive exists in that release. This preserves the exact interpreter instead of changing the target to fit another provider. The local matching command still passes all eight tests. The repaired GitHub head must be observed after publication before CI is reported green.

There is no documentation site yet, so this change does not claim Astro build, browser navigation, or GitHub Pages publication.
