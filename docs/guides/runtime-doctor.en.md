# Prepare and check the P0 Runtime

Run these commands from the repository root. This guide targets Windows x64 and an RTX 3070 Ti Laptop with 8 GiB VRAM. You need Git, uv, and a working NVIDIA driver. Runtime uses an independent Python 3.12.13 environment. It does not install FastAPI or the product Web app.

## Get the first check result

Prepare the pinned source and environment. This command clones Runtime and the custom nodes, then downloads dependencies declared in uv.lock. Existing checkouts must match the pinned commits and have no tracked changes. The command preserves local edits.

```powershell
uv run --no-project --python 3.12.13 python runtime/comfyui/manage.py prepare
```

Prepare the models. This command downloads about 9.19 GB of weights into `data/models/`. The weights use CC-BY-NC-4.0. See the [Model Registry](../../runtime/comfyui/models.json) for sources, revisions, byte counts, and SHA256. Code licenses are recorded separately in the [Runtime configuration](../../runtime/comfyui/runtime.json). The standalone license of the embedded tokenizer is unspecified; do not infer it from the weight license.

```powershell
uv run --project runtime/comfyui --no-sync python runtime/comfyui/manage.py download-models
```

Run one readiness command. `--no-sync` prevents the check from downloading dependencies or changing the environment.

```powershell
uv run --project runtime/comfyui --no-sync python runtime/comfyui/manage.py doctor
```

Success prints `Runtime READY` and exits with code `0`. Failure prints `Runtime NOT READY`, gives recovery steps for each failure, and exits with code `1`. Invalid configuration or arguments exit with code `2`. An interrupted command exits with code `130`. Add `--json` for timestamped checks, version facts, model states, and recovery steps. `ready` means that inference prerequisites are available. `p0_passed` stays `false`: later tickets must verify real GPU transcription, generation, queueing, cancellation, repeated Jobs, and cleanup.

## Use existing legal local weights

Doctor does not download or move files. Override the model root or select an existing file for one model:

```powershell
uv run --project runtime/comfyui --no-sync python runtime/comfyui/manage.py doctor --models-root D:/MusicModels --model-path yue2-bf16=D:/MusicModels/renamed-yue2.safetensors --json
```

`--model-path` can verify a file's hash separately. If the registered Runtime relative path cannot access the same file, the check still fails and cannot produce `Runtime READY`. Use the registered relative path inside `--models-root`, or create a filesystem link there to the original file. Then rerun without `--model-path`. The start command rejects `--model-path` to prevent a mismatch between verification and loading. The plugin searches a valid `YUE2_MODELS_ROOT` exclusively. Verify the same root before launch.

## Recover from failure

| Result | Next step |
| --- | --- |
| NVIDIA query fails or target GPU is absent | Install the driver. Confirm that `nvidia-smi` lists the target GPU, then rerun Doctor. |
| Torch CUDA, BF16, or pinned version fails | Run `uv sync --project runtime/comfyui --frozen`, retry in that environment, and inspect the device facts and import traceback in JSON. |
| Runtime revision differs or tracked files changed | Preserve local edits, then restore a clean checkout at the configured commit. `prepare` does not reset existing files. |
| Required nodes or lazy inference imports fail | Inspect the traceback and restore pinned dependencies and plugin source. A working node entrypoint does not prove that modeling imports work. |
| Model is missing or downloading | Run `download-models`. Interrupted bytes remain in `.part`; rerunning resumes the transfer. A `.part` file is never ready. |
| Model has invalid size or SHA256 | Preserve or move the corrupt file, then download again. The command does not overwrite an invalid model. Equal size still requires a full-file SHA256 match. |
| Disk space is insufficient | Free space on the model volume. Doctor requires 10 GiB working space plus download space for models that are not ready. |
| Port is occupied | Stop its owner, or use the same unused `--port` for Doctor and `start`. A running service makes this pre-start Doctor fail. |

## Start the local Runtime

```powershell
uv run --project runtime/comfyui --no-sync python runtime/comfyui/manage.py start
```

The command reruns Doctor before launch. The service listens only at `http://127.0.0.1:8188` and does not open Canvas. Press Ctrl+C to stop it. Only the pinned YuE2 custom-node package is allowed. Input, output, user data, and temporary files live in `data/runtime/comfyui/`. Models, virtual environments, upstream checkouts, download state, and Runtime data stay out of Git. Use `start --state-root PATH` to change the Runtime data root. Pass the corresponding options when changing the port or model root.

In an isolated worktree, use `--models-root D:/Projects/Backend/llm-music/data/models --state-root D:/Projects/Backend/llm-music/data/runtime/comfyui` to select shared data managed by the PM. Only the GPU resource owner starts Runtime or runs real CUDA checks. Tickets must not run inference concurrently.

## Pins and verification

The independent [uv.lock](../../runtime/comfyui/uv.lock) pins all dependencies. Torch, torchvision, and torchaudio use CUDA 13.0 Windows CPython 3.12 wheels, matching the pinned ComfyUI recommendation. Actual CUDA execution still verifies local driver compatibility. An explicit official PyPI index prevents a stale mirror from changing resolution. SheetSage2 needs `torchaudio` to resample inputs other than 24 kHz.

Doctor separately checks NVIDIA metadata, actual BF16 CUDA matrix multiplication, the target device, Python/Torch/CUDA, clean source commits, native ComfyUI node loading, lazy YuE2/VAE/tokenizer/SheetSage2 imports, 48→24 kHz resampling, full-file model SHA256, disk space, and the local port. It does not load all model weights or establish music quality. The YuE2 BF16 checkpoint includes the standard VAE and tokenizer. No separate VAE or `qwen.tiktoken` download is required. This preparation path does not cover `vae=legacy`.

Run the public CLI behavior checks without a GPU:

```powershell
uv run --no-project --python 3.12.13 python -m unittest discover -s runtime/comfyui/tests -v
```

Tests use temporary files and temporary external Runtimes. They provide fake logic evidence and cannot unlock P0. See the [implementation verification record](../verification/runtime-doctor.md) for actual environment results and remaining limits.
