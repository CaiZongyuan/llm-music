# Query Runtime and model diagnostics through the application API

Use local FastAPI to read backend/runtime health, operation prerequisites, Model Registry, sourced metrics and application Job queues. Start with the [Morning song Project and reference upload](api-project-audio.en.md). Project and Reference Audio creation, reads and downloads remain in the independent CPU API when the Runtime is disconnected or weight verification is unavailable.

## Get the first diagnostic snapshot

Work from the repository root with the independent API uv project. Default `fake` mode provides identified CPU result fixtures. Use a separate data directory and `comfyui` mode for the actual Runtime.

```powershell
uv sync --project services/api --locked --python 3.12.13
$env:MUSIC_API_RUNTIME_MODE = "comfyui"
$env:MUSIC_API_RUNTIME_URL = "http://127.0.0.1:8188"
$env:MUSIC_API_RUNTIME_EVIDENCE_PATH = "D:/OWNER/runtime-evidence/current.json"
uv run --project services/api --no-sync music-api serve --data-dir data/application-comfy --port 8000
```

Supply the owner's actual receipt path. The API can start without a Runtime or receipt; diagnostics report not ready explicitly. The default bind is `127.0.0.1`. Open `http://127.0.0.1:8000/docs`, or run the complete read-only example in a second terminal:

```powershell
uv run --project services/api --no-sync python services/api/examples/runtime_diagnostics.py --output data/diagnostics/first.json
```

The output file must not exist. The example reads five public endpoints and saves the responses without creating a Project/Job or submitting inference. Full source: [runtime_diagnostics.py](../../services/api/examples/runtime_diagnostics.py). Each request has its own snapshot; the five responses do not share an atomic sampling moment.

<<< ../../services/api/examples/runtime_diagnostics.py

## Read state and sources

| Endpoint | Current result |
| --- | --- |
| `GET /health` | Backend HTTP process version/time; Runtime reachability, readiness from current capabilities, binding state and recovery reasons |
| `GET /runtime/capabilities` | Each Transcribe/Generate `ready`, required models, source/time, reasons and actions; submission uses the same Runtime predicate |
| `GET /runtime/models` | Expected revision/hash/size, provider, repository, components, weight license/source; current state and last observed hash/time; separate code registry license facts |
| `GET /runtime/diagnostics` | Time/freshness for each source, GPU name, versions, memory scopes in bytes, loaded models, generic filename inventory and application queue |
| `GET /settings/metadata` | Actual Pydantic Settings JSON schema, defaults, descriptions, constraints and generated environment names; no current environment values |

Backend `ready` means this application HTTP process is responding. Runtime `ready` means at least one operation meets current prerequisites; submission still checks the selected operation, inputs and the same predicate. It does not replace actual Job completion, output import and readback verification.

Each `observation` retains its source `observed_at`, `age_seconds`, `freshness` and current `max_age_seconds`. Top-level `checked_at` is this diagnostic time; it does not renew old hash, node or metric timestamps. Verified model and source facts that still match the actual binding/files use `max_age_seconds: null`; elapsed time alone does not invalidate them. Dynamic observations beyond their finite window retain historical values with `availability=unavailable`. Missing data stays `null`; an actually observed zero can remain available.

Dynamic health, node, GPU and memory observations use a default 300-second window. Set a positive `MUSIC_API_DIAGNOSTICS_MAX_AGE_SECONDS` to change it. This window does not expire an owner verification receipt that still matches the current process, listener, source and model fingerprints; model verification older than five minutes alone cannot refuse creation. Current HTTP failure, missing GPU/nodes/models, invalid hash, changed fingerprints and mismatched/inaccessible actual process binding still deny readiness.

## Verify models and metrics

The Runtime owner uses the [CPU receipt collection command](../reference/runtime-evidence.en.md) to verify the actual listener PID/create time, selected entrypoint, model root, clean source pins and full weight SHA256. API requests read the receipt and check current identity/cheap fingerprints. Unchanged conditions retain the original verification without scheduled weight hashing. After a change, restore actual files/binding and obtain matching evidence. Preserve the real verification time.

Generic `/models` lists ComfyUI filenames only. The pinned YuE2 plugin uses a separate `YUE2_MODELS_ROOT`; empty generic inventory can coexist with ready weights. Inventory proves neither hash nor loaded state. Model Registry reuses pinned facts from [models.json](../../runtime/comfyui/models.json) and [runtime.json](../../runtime/comfyui/runtime.json): the YuE2 checkpoint contains standard VAE and tokenizer; weight CC-BY-NC-4.0 and Runtime/plugin code licenses stay separate, while standalone tokenizer licensing remains unspecified.

Memory fields declare scope and bytes. CUDA device values include every process; the Comfy availability proxy includes reusable Torch reservation. `runtime_torch_active_bytes` reconstructs `active_bytes.all.current`, including awaiting-free blocks, rather than strict `memory_allocated()`. System RAM retains its Runtime/platform/cgroup scope. Process RSS/GPU resident memory, loaded models and driver/CUDA versions stay unavailable when the current source does not provide them. The [source reference](../reference/runtime-evidence.en.md) links pinned implementation facts.

`application_queue` comes from a current SQLite query; Job row timestamps remain their last recorded write times. `recorded_running_job` identifies a single last-recorded running application Job, with stale source refusing current confirmation. Native occupancy is unobserved by the current adapter and stays unavailable. Jobs use application ids; prompt/node ids and full argv/env do not enter diagnostic output.

## Recover from one failure

If Morning song's capability reports `runtime_unavailable`, retain its original Asset id. Have the Runtime owner restore the local service, then reread health/capabilities. The original audio remains downloadable through Project Asset content.

For `missing/downloading/invalid/unavailable` models, read `reasons` and the last hash/time. The owner restores registered files, permissions or clean pins, runs the collector for new actual evidence, then refreshes. Transcription submission uses the same condition to return a non-success recovery response; rejection does not secretly send native `/prompt`. Developer tracebacks remain in logs.

Read-only diagnostics return HTTP 200 state data when the Runtime is not ready. Unreadable application metadata uses the shared `503 metadata_unavailable`; invalid request fields use `422 invalid_request`. Report operational success and actual GPU/music results separately. See the [maintenance record](../verification/api-runtime-diagnostics.md) for validation scope.
