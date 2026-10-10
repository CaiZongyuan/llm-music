# Retrieve ABC and MIDI through an application Job

After uploading Reference Audio into a Project, create a Transcribe Job. The Job becomes completed only after the full ABC/MIDI set is validated, imported into application files and durably associated. Score retains source Asset and Job references. Downloads use application ids and survive removal of Runtime temporary output.

## Complete a CPU example first

From the repository root, install the independent API environment and select explicit fake mode:

```powershell
uv sync --project services/api --locked --python 3.12.13
$env:MUSIC_API_RUNTIME_MODE = "fake"
uv run --project services/api --no-sync music-api serve --data-dir data/application-fake --port 8000
```

Run the original-audio example in the [Project/upload guide](api-project-audio.en.md) and keep its receipt. Its T16 PCM16 mono24k shape passed an additional real input-format check. New work still requires the complete application-path validation; fake results only establish application behavior.

```powershell
$receipt = Get-Content -Raw data/project-upload-example/receipt.json | ConvertFrom-Json
$base = "http://127.0.0.1:8000/projects/$($receipt.project.id)"
$body = @{ reference_asset_id = $receipt.asset.id } | ConvertTo-Json
$job = Invoke-RestMethod "$base/transcriptions" -Method Post -ContentType "application/json" -Body $body
Invoke-RestMethod "$base/jobs/$($job.id)"
```

Submission returns 202 and an application Job. Query that id until completed or explicitly failed. Completed `result` includes `score_id`, `abc_asset_id` and `midi_asset_id`. Read `GET /projects/{project_id}/scores/{score_id}` and download ABC/MIDI through existing Asset content routes. Lists and references enforce the same Project owner.

Public states remain queued, running, completed, failed and cancelled. Phase follows actual observations; progress is null without reliable evidence. Current operations include [cancellation and explicit retry](api-cancel-retry.en.md), [Job events and HTTP recovery](api-job-events.en.md), and [original-Job reconciliation after API restart](job-recovery.en.md). Failures retain inputs and readable error/recovery. Native success alone does not prove imported files.

## Configure the real Runtime

Only the GPU resource owner submits real work. Use a separate real data-dir. Switching a fake directory into real mode fails namespace validation and preserves its data.

```powershell
$env:MUSIC_API_RUNTIME_MODE = "comfyui"
$env:MUSIC_API_RUNTIME_URL = "http://127.0.0.1:8188"
$env:MUSIC_API_RUNTIME_EVIDENCE_PATH = "<FRESH_OWNER_RECEIPT_JSON>"
uv run --project services/api --no-sync music-api serve --data-dir data/application-real --port 8000
```

The owner receipt follows the [CPU evidence-verification contract](../reference/runtime-evidence.en.md). Original SHA256 verification remains valid while the current process, listener, source and model fingerprints match; passing five minutes alone cannot refuse submission. Reading a receipt never renews checked_at. Dynamic native observations use a default 300-second window, configurable through `MUSIC_API_DIAGNOSTICS_MAX_AGE_SECONDS`. An unreachable Runtime, missing nodes, mismatched GPU/version, changed/missing model files or unverified hash/binding still reject submission. The pinned plugin's YUE2_MODELS_ROOT differs from generic Comfy `/models` inventory: a legal empty generic inventory is not a missing-model verdict.

The proven input scope is 16-second PCM16 stereo48k or mono24k. Upload's 64 MiB/600-second budget is storage policy, not inference support for every uploaded duration, width or rate. Other shapes return `422 reference_profile_unsupported`; changed original bytes fail their saved hash check. Native transcription uses the verified SheetSage2 manifest with ASR/downloads disabled. Business requests do not accept node/prompt data.

## Recover from failure and restart

Persist Job/attempt before submission and write native POST once. A lost acknowledgement produces an explicit unconfirmed failure and `recovery_required`; accepted native work may still exist. Inspect the same application Job and owner logs before retrying. Do not automatically resubmit or claim definite non-execution. API startup verifies original work still queued/running without resubmitting inference. Unconfirmed original ownership or state enters bounded recovery; terminal Jobs retain their original state. See the [restart recovery guide](job-recovery.en.md) for steps and limits.

Missing/corrupt ABC or MIDI cannot produce a successful Score or complete result. Validate every required role first, publish owned files exclusively, then associate Assets/Score/completed Job in one SQLite transaction. An error after commit preserves the same ids/files when a fresh read confirms completion. Unknown readback also retains files. Compensate only this attempt's files after acknowledged rollback and confirmed durable absence. No global GC is performed.

Stop/reopen the API with the same mode and data-dir to read completed Job/Score/files by their original ids. Restart checks read those ids rather than creating new work. Startup applies the current application migrations and preserves uploaded content. Back up the whole application data directory first; restore a compatible version or full backup for an unsupported schema. Pydantic/OpenAPI remains the contract source. The [maintenance record](../verification/api-transcription.md) separates CPU and real verification.

```powershell
uv run --project services/api --no-sync python -m pytest services/api/tests -q
uv run --project services/api --no-sync mypy --config-file services/api/pyproject.toml services/api/src/music_api
```
