# Generate fixed audio through the Runtime API

This guide covers only the independent P0 verification tool. Run commands from the repository root. Only the GPU resource owner runs real requests. First complete [Runtime preparation](runtime-doctor.en.md) and retain a ready Doctor receipt, the owned Runtime PID, and logs. This tool does not start Runtime, download weights, create the product API/Web, or open Canvas.

## Inspect the fixed request first

```powershell
uv run --no-project --python 3.12.13 python runtime/comfyui/p0/generation.py prepare --output-dir data/runtime/p0/generate-prepared
```

Inspect `input.json`, `request.json`, `manifest.json`, and `report.json` in that directory. The fixed input uses original repository lyrics, style, seed `2026100701`, and a 35-second ceiling. Decoded audio must be 30–40 seconds long. `workflows/generate/` contains the versioned API-mode graph, input mapping, and output mapping. Existing output directories are not overwritten.

The baseline is BF16, offload=on, low_vram=false, keep_model_loaded=false, cot=full, standard VAE, and the stable sdpa default. YuE2 uses non-quantized BF16 backbone weights; the standard VAE executes in FP32 under the pinned plugin. download=off and vocals_only=false. No Writer, ASR, LoRA, or other ancillary model path is included.

## Run one real request

Only the GPU owner may fill in these Runtime paths and PID. The model root must be the same root used by the owned Runtime. Repeat the log option to preserve stdout/stderr bytes appended during this request.

```powershell
uv run --project runtime/comfyui --no-sync python runtime/comfyui/p0/generation.py run --output-dir data/runtime/p0/generate-baseline --url http://127.0.0.1:8188 --models-root data/models --runtime-root runtime/comfyui/.upstream/ComfyUI --process-pid <OWNED_RUNTIME_PID> --doctor-report <READY_DOCTOR_JSON> --runtime-log <RUNTIME_STDOUT_LOG> --runtime-log <RUNTIME_STDERR_LOG> --run-kind cold
```

The tool checks full model SHA256, Runtime metadata, source commits, actual node schemas, the PID's Runtime main program, and an empty queue. It sends exactly one `/prompt`, waits for that request's history, exports audio through `/view`, and parses Score through `/yue2/score/read`. Every audio frame must decode, duration must meet the baseline, and ABC must contain complete parsed bars and valid pitched notes. HTTP 200 or file existence alone is insufficient.

Success exits 0. Failure exits 1 and preserves inputs, request, history, logs, and diagnostics in the created output directory. Argument errors exit 2 through argparse. The tool never retries inference automatically or calls `/interrupt`. `p0_passed` always stays false.

Listen to the exported `audio.flac` and inspect `score.abc` and full `score-read.json`. Record actual listening observations. Decoding does not replace listening; listening_review remains pending in the report. See the [maintenance record](../verification/api-generation.md) for evidence and current limits.

## Read resource and timing evidence

- `memory-samples.jsonl` retains UTC timestamps and individual readings. The default interval is one second; `--sample-interval` changes it. The report records the largest observed sample gap. Sampled peaks are observable lower bounds and may miss a peak between samples.
- `/system_stats` provides device readings. Comfy vram_free includes unused Torch reservation. The tool subtracts torch_vram_free to reconstruct CUDA free, then derives whole-device usage. It separately retains the Comfy availability proxy, Torch active allocator subset, whole-host RAM, and selected Runtime PID RSS. Pinned Comfy reports torch_vram_free as reserved−active, so legacy `runtime_torch_allocator_allocated_bytes` reconstructs native `active_bytes.all.current`, including blocks awaiting free, rather than strict `memory_allocated()`. Field names and value formulas remain compatible. Device/host values include other consumers. WDDM process GPU resident memory is explicitly unavailable and is never replaced by a device total.
- RTF is history execution_start→execution_success seconds / fully decoded audio seconds. This includes Workflow saving nodes and is not model-only RTF. Client waiting/validation time is separate. Preflight weight hashing is outside that window and affects filesystem cache conditions.
- A unique same-run plugin summary provides four stage values rounded to 0.1 seconds. “loading and the rest” includes loading, unloading, and other work; exclusive model_load remains unavailable. Missing or ambiguous logs leave stage values unavailable. Weighted progress bars are not treated as real overall percentages.
- `cold` / `repeat` are caller declarations about the current Runtime session, not server cold starts. history execution_cached nodes are retained. A core Generate cache hit preserves outputs but rejects a generation performance claim. keep_model_loaded=false does not disable DAG cache. Identical seed/input repeats must not be assumed to execute new inference.

## Recover from failure

For missing models, mismatched versions/schemas/PID, or a busy queue, restore the pinned environment and owned resources, then use a new output directory. Preserve invalid Audio/Score and the original inputs. Do not hide a failure by changing multiple inference variables. A wait failure may leave the request running; the GPU owner must inspect that request's history/queue before retrying.

Only after an actual baseline OOM may the GPU owner preserve all inputs and retry:

```powershell
uv run --project runtime/comfyui --no-sync python runtime/comfyui/p0/generation.py run --output-dir data/runtime/p0/generate-low-vram --low-vram-after-oom data/runtime/p0/generate-baseline/report.json <THE_SAME_RUNTIME_AND_MEASUREMENT_OPTIONS>
```

This option requires an OOM failure receipt, identical inputs, Workflow, and every baseline setting. low_vram is the only inference change. The original failure is never overwritten. Compare resource/timing values, output hashes, and actual listening facts. Community numbers are not local acceptance evidence.

## Check behavior without a GPU

```powershell
uv run --no-project --python 3.12.13 python -m unittest discover -s runtime/comfyui/tests -p test_generation.py -v
```

Tests use an isolated local fake HTTP service and temporary small files. Fake reports cannot prove real GPU generation or unlock P0.
