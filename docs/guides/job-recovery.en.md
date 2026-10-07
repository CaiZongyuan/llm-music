# Recover the original Job after API restart {#job-recovery}

Use the original Project and Job ids to recover queued, running, or completed work. This is the P1 HTTP/Swagger flow. API startup checks original Runtime work. It does not submit inference again or upload Reference Audio again.

## Prerequisites and launch {#start}

Submit a Job with [Generate and save](generate-save-api.en.md) or [Transcription](api-transcription.en.md). Keep the Project and Job ids from its response. The service owner stops and restarts the API with the same data directory, Runtime mode, and original Runtime address. Back up the complete application data directory first. Keep SQLite, Asset files, and private task records together.

Run from the repository root. Stop the existing service first. Replace the port with the actual service port.

```powershell
uv sync --project services/api --locked --python 3.12.13
$env:MUSIC_API_RUNTIME_MODE = "comfyui"
$env:MUSIC_API_RUNTIME_URL = "http://127.0.0.1:8188"
$env:MUSIC_API_RUNTIME_EVIDENCE_PATH = "data/runtime/current-receipt.json"
uv run --project services/api --no-sync music-api serve --data-dir data/application-comfyui --port 8000
```

Replace the receipt and directory with the original service paths. Current readiness receipts govern new Jobs. Recovery of accepted work uses its persisted original Workflow, inputs, Runtime address, and graph proof. An expired receipt does not revoke existing output. Use separate data directories for fake and comfyui. The ordinary fake fixture loses its in-memory work when its process exits, so work not yet imported reaches bounded failure. Completed application results remain readable.

## Read the same Job {#read-job}

In another terminal, run from the repository root. Replace both ids with the saved values:

```powershell
uv run --project services/api --no-sync python services/api/examples/job_recovery.py wait --project-id <PROJECT_ID> --job-id <JOB_ID> --wait-seconds 330
```

The example only calls `GET /projects/{project_id}/jobs/{job_id}`. It waits through a temporary API disconnect. When its wait expires, it exits and leaves the original Job intact. Use `inspect` for one immediate read. Do not submit Generate or Transcribe again to recover a result.

| Public state | Behavior |
| --- | --- |
| queued / running | Confirmed original work remains under observation. `progress` only contains measured values; otherwise it is null. |
| queued / running with recovery_required=true | Original ownership or state is temporarily unconfirmed. Read the reason and recovery advice in `error`; retain this Job. |
| completed | The whole result set has been validated and imported. Repeated reads and restarts do not create another copy. |
| failed / cancelled | The original terminal state remains. Recovery cannot change it to completed. |

On success, add `--output-dir data/recovered-job-01` to download existing Audio, ABC, or MIDI. The directory must not exist. These are application Asset downloads, not Runtime file reads. A Generate Candidate still needs an explicit Version save with [Generate and save](generate-save-api.en.md). Recovery does not overwrite existing Versions, snapshots, or Assets.

## When confirmation fails {#uncertainty}

A differing graph, attempt, client, handle, or output binding prevents incorrect ownership. Duplicate mappings, missing history, and an unreachable Runtime also prevent confirmation. An old Job with only an opaque handle and no complete original proof does not acquire an invented graph or run automatically. Upgrades retain existing data and terminal states. An old active Job can end as `failed/runtime_unavailable`.

The default confirmation window is 300 seconds with at most 30 confirmation reads. Polling starts at 1 second and grows to 10 seconds. These values come from `MUSIC_API_RECOVERY_CONFIRMATION_WINDOW_SECONDS`, `MUSIC_API_RECOVERY_MAX_ATTEMPTS`, `MUSIC_API_RECOVERY_POLL_INTERVAL_SECONDS`, and `MUSIC_API_RECOVERY_MAX_POLL_INTERVAL_SECONDS`. Seconds must be positive and finite; the attempt limit must be a positive integer. `MUSIC_API_RUNTIME_TIMEOUT_SECONDS` also bounds every read.

The first window starts after the worker obtains startup recovery metadata and admits the group of Jobs. Jobs in that group without an existing window start together. Reads, events, polling, and API restarts cannot reset a saved window or count. After a transient cursor commit acknowledgement or readback failure, the worker reads committed state again on its next sweep and retains the spent budget and original proof. Exhaustion produces `failed/runtime_unavailable` while retaining original inputs, provenance, mapping, and reason. A confirmed running Job can keep running beyond the confirmation window. A later startup first performs one bounded original-proof check; an unsuccessful check still obeys the original budget. The confirmation window is separate from generation duration.

After restoring Runtime access or application files, read the original Job first. To explicitly retry, run:

```powershell
uv run --project services/api --no-sync python services/api/examples/job_recovery.py retry --project-id <PROJECT_ID> --job-id <JOB_ID>
```

This makes one `POST .../retry`. Success returns `202` and a new Job id. The new Job checks current readiness and Workflow and records `retry_of_job_id`; the original Job stays intact. `409 retry_unconfirmed` means original native work has no confirmed safe terminal outcome. Retain evidence and ask the Runtime owner to check it before another submission. `409 job_not_retryable` means the Job is active or completed. If the retry response is lost, read the Project Job list; do not automatically repeat the POST.

The complete example is version-controlled source:

<<< ../../services/api/examples/job_recovery.py

See the [maintenance record](../verification/job-recovery.md) for actual validation. The GPU owner separately verifies interrupted G35 recovery and fresh T16 transcription. CPU fixtures cannot prove model inference quality.
