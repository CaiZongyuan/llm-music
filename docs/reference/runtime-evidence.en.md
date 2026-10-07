# Runtime diagnostic evidence sources

The application API environment does not run Doctor, import Torch/CUDA or rehash large weights. The Runtime adapter reads current public endpoints; the local owner supplies a separate read-only verification receipt. The Pydantic schema of [RuntimeReceipt](../../services/api/src/music_api/runtime_evidence.py) defines the receipt input.

## Collect a reviewable receipt

Collect facts on the Runtime host. Use the configured loopback URL, its current listener PID and the same model root as the Runtime. Do not promote a historical Doctor `ready=true` into current proof.

From the repository root, the owner runs this command in the independent CPU API environment. Supply the actual listener PID, rather than a uv/venv launcher PID.

```powershell
uv run --project services/api --no-sync python -m music_api.runtime_evidence collect --runtime-url http://127.0.0.1:8188 --pid <ACTUAL_OWNED_LISTENER_PID> --output data/runtime-evidence/current.json
```

The command submits no inference, calls no CUDA and changes no weights. It rehashes complete files and verifies current binding and clean source; success exits 0. Missing, downloading or invalid weights produce explicit receipt states and exit 1. Identity, permission, source or file-change-during-hash failures exit 1 and retain the prior receipt. Refreshing the same output first saves `current.previous.<old-source-UTC-time>.json`, then atomically replaces the current receipt. API requests only read this receipt and cheap current checks; they never run this command automatically.

1. Identify the actual listener PID for that URL port. Read process creation time, executable and the selected `main.py` entrypoint; read only `YUE2_MODELS_ROOT`. Do not store or output full command lines or environment.
2. Read the actual Runtime and plugin checkout revisions and confirm no tracked changes. [runtime.json](../../runtime/comfyui/runtime.json) supplies licenses and expected revisions; [models.json](../../runtime/comfyui/models.json) supplies weight revisions, sizes, SHA256 values and licenses.
3. Resolve each registered model in the actual Runtime layout. Save its resolved path, size and `mtime_ns` before hashing, calculate the full-file SHA256, then read the fingerprint again. Both fingerprints must agree.
4. Set each model's `checked_at` to this hash completion time in UTC; set the top-level time to collection completion. Retain the actual source description. Reading or saving the JSON again does not renew these source timestamps.
5. Store the schema-validated receipt in an owner-managed location separate from the application database and Assets. The application only reads it; the owner explicitly handles model writes or replacements.

| Field | Content |
| --- | --- |
| `schema_version`, `mode`, `runtime_url`, `source`, `checked_at` | Version 1, `comfyui`, actual loopback endpoint, source, timezone-aware source time |
| `runtime_root`, `models_root`, `runtime_revision`, `plugin_revision` | Actual checkout, model layout and source revisions |
| `process` | `pid`, `create_time`, `executable`, `entrypoint`; no full argv/env |
| `models[]` | Registered id, `missing/downloading/ready/invalid`, revision, time, actual hash/size and file fingerprint |
| `models[].fingerprint` | `resolved_path`, `size_bytes`, `mtime_ns` |

## Current authorization and historical facts

Freshness is an explicit configuration policy with a default 300-second window. Receipt read time differs from source time. A newly saved file with an old source time remains stale. Future time, a foreign URL, a different Runtime mode/revision, a reused PID, inaccessible identity or a changed model fingerprint cannot prove current readiness.

Current health, nodes and actual model layout can veto old ready. `/models/{folder}` lists generic ComfyUI filenames only; it does not prove loaded state or valid SHA256. The pinned YuE2 plugin uses a separate `YUE2_MODELS_ROOT`, so an empty generic list does not prove these models are missing. Inventory absence may apply only where the registry explicitly maps a model to that inventory. Current YuE2/SheetSage2 readiness uses local binding, actual layout and source verification within the configured window. Unchanged stat fingerprints never become permanent cryptographic proof. Keep the last verified hash and source time as historical diagnostics when current authorization is refused.

## Read metrics

Pinned ComfyUI `/system_stats` supplies versions, Runtime-reported system RAM, device fields and Torch allocator fields. It supplies no PID or loaded-model inventory. [Pinned server.py](https://github.com/Comfy-Org/ComfyUI/blob/7a5dad695fe1cae25efcb2550530fb20ef68da3d/server.py) defines the payload; [model_management.py](https://github.com/Comfy-Org/ComfyUI/blob/7a5dad695fe1cae25efcb2550530fb20ef68da3d/comfy/model_management.py) defines counter meanings.

For CUDA, `vram_free` includes reusable Torch reservation; `torch_vram_total` is reserved and `torch_vram_free` is reserved−active. Active comes from `active_bytes.all.current`; do not label it strict `memory_allocated()`. Report device, system RAM and process scopes separately. Unobservable loaded models, process GPU resident memory, driver or CUDA versions remain unavailable; do not replace them with device totals or filenames.

API-only fake peers verify source and failure behavior. The Runtime owner verifies actual facts separately. Neither establishes music quality, a performance promise or full phase acceptance.
