# Cancel and explicitly retry an application Job

Cancel a Project's Job, then choose whether to create a new retry. Application ids are the entrypoint; inputs, failure history and saved Versions remain available. This is the P1 HTTP/Swagger flow. Fake fixtures do not prove actual GPU cancellation or music quality.

## Prepare a Job

Start the independent CPU API from the repository root:

```powershell
uv sync --project services/api --locked --python 3.12.13
$env:MUSIC_API_RUNTIME_MODE = "fake"
uv run --project services/api --no-sync music-api serve --data-dir data/application-fake --port 8000
```

Create a Morning song Job through the [transcription guide](api-transcription.en.md) or [generate/save guide](generate-save-api.en.md). Keep its Project and Job ids. Fake Jobs finish quickly; cancelling a completed Job returns its original completed result. Use a separate data directory for the actual Runtime, with the GPU resource owner controlling cancellation experiments. Swagger is at `http://127.0.0.1:8000/docs`.

Inspect the Job in a second terminal. Replace placeholders with application ids:

```powershell
uv run --project services/api --no-sync python services/api/examples/cancel_retry.py inspect --project-id <PROJECT_ID> --job-id <JOB_ID>
```

## Request cancellation and read its outcome

```powershell
uv run --project services/api --no-sync python services/api/examples/cancel_retry.py cancel --project-id <PROJECT_ID> --job-id <JOB_ID> --wait-seconds 180 --output data/diagnostics/cancel-01.json
```

This calls `POST /projects/{project_id}/jobs/{job_id}/cancel` without a request body. `200` means a confirmed terminal state or a terminal no-op; `202` means it remains queued/running. Read `GET /projects/{project_id}/jobs/{job_id}` afterward.

`cancel_requested=true` records an application request, not a cancelled outcome. Confirmed cancellation sets status to cancelled, error.code to cancelled, and leaves result empty. A running dispatch acknowledgement is not terminal proof; queued removal has separate confirmation. If execution finishes before cancellation, the application still validates/imports the complete result and reports completed. Cancellation during saving does not fabricate cancelled. Repeating a terminal cancellation preserves its original result.

After a lost cancellation-intent commit acknowledgement, read the same Job. A queued/running Job with cancel_requested=true still needs outcome confirmation and reports recovery_required=true. Intent does not prove Runtime dispatch. An explicit repeated cancel again checks ownership and safely targets the same native request; it never becomes a global interrupt.

Cancellation targets only a Job in the same Project. An application-pending Job can be cancelled before dispatch. The application refuses destructive actions when the Runtime mapping, client or graph differs. Original Reference Audio, other work, Candidates and saved Versions remain available.

## Explicitly create one new retry Job

Send one request for a failed or cancelled Job:

```powershell
uv run --project services/api --no-sync python services/api/examples/cancel_retry.py retry --project-id <PROJECT_ID> --job-id <JOB_ID> --wait-seconds 180 --output data/diagnostics/retry-01.json
```

This calls `/retry` on the same Job address without a body. Success returns `202` with a new Job id and a new actual attempt identity. The new Job retains creative inputs, rechecks current Runtime readiness, and records current registry provenance plus `retry_of_job_id`. The original Job's inputs, error and provenance remain unchanged. Read/download through the new Job's application references. A generation retry still creates a Candidate, which requires explicit save to become a Version.

A retry creates new work and has no automatic client-intent deduplication key. After a failed request or lost response, read `GET /projects/{project_id}/jobs` and use `provenance.retry_of_job_id` to find existing retry records before sending another retry. The example sends one operation request; waiting only reads state.

## Recover from a failure

| Response or error | Action |
| --- | --- |
| `404 job_not_found` / `422 invalid_request` | Correct the Project, Job id or parameters. Cross-Project operations are refused. |
| `409 cancellation_not_dispatched` | The pending target began running during removal. Read its current state, then explicitly request cancellation again. No automatic global interrupt follows. |
| `409 cancellation_ownership_unverified` / `cancellation_unconfirmed` | Retain the original Job/mapping and restore ownership or confirm its outcome. Avoid another potentially duplicate inference. |
| `503 runtime_unavailable` | Cancellation acknowledgement was disconnected. Read recovery_required and the same Job; native work may exist. |
| `409 job_not_retryable` / `retry_unconfirmed` | Wait for or confirm the original attempt's safe terminal state. Completed Jobs cannot retry; uncertain accepted work is not resubmitted blindly. |
| `runtime_out_of_memory` / `model_missing` / `workflow_invalid` | Restore the verified memory profile, registered model or Workflow, then check current readiness. |
| `transcription_failed` / `generation_failed` | Retain original inputs and the failed Job; inspect development logs before explicitly creating another attempt. |

Current cancellation/retry uses the running API's known mappings. An uncertain request without its verifiable original graph still refuses retry. Active Job reconciliation across restart is delivered in a later lifecycle issue. Completed history/files remain readable after restart. Developer exception details stay in structured logs; public errors give domain causes and recovery actions.

Pre-upgrade pending records have no durable dispatch-start evidence and may already have been accepted. Upgrade to 0004 conservatively marks them unconfirmed with recovery instructions. It does not fabricate cancelled or create an unverified retry. Existing failed errors, inputs and provenance are retained.

The complete runnable example comes from version-controlled source:

<<< ../../services/api/examples/cancel_retry.py

See the [maintenance record](../verification/api-cancel-retry.md) for actual validation, shared-module impact and delivery limits.
