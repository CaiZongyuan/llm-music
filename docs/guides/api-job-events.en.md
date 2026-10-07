# Subscribe to Job events and recover through HTTP

Application WebSocket provides live Job snapshots. HTTP is the durable state source: after event loss, keep querying the same application Job id. This is the P1 API flow; P2 delivers the formal Web Monitor.

## Observe Morning song

Start the independent API from the repository root. Use a separate fake data directory. It produces identified CPU fixtures, not real inference performance or music quality.

```powershell
uv sync --project services/api --locked --python 3.12.13
$env:MUSIC_API_RUNTIME_MODE = "fake"
uv run --project services/api --no-sync music-api serve --data-dir data/application-events-fake --port 8000
```

Create a Morning song application Job through the [transcription guide](api-transcription.en.md) or [generation guide](generate-save-api.en.md). Retain its Project and Job ids. In another terminal, replace the placeholders and use a new output file:

```powershell
uv run --project services/api --no-sync python services/api/examples/watch_job.py --project-id <PROJECT_ID> --job-id <JOB_ID> --output data/job-events/first.json
```

The example prints received status/phase/progress and saves the original domain events plus final HTTP Job. If the Job already finished, its first snapshot is the durable terminal state. The example reads the same Job without creating, retrying or cancelling work or modifying Assets.

Complete source:

<<< ../../services/api/examples/watch_job.py

## Use the event contract

Connect `WS /projects/{project_id}/jobs/{job_id}/events`. Each JSON contains `type="job.updated"`, a live `sequence`, and `job`. The Job shares the Pydantic JobRead returned by `GET /projects/{project_id}/jobs/{job_id}`: application ids, five states, domain phase, progress, results and recovery errors. Runtime prompt/node ids and raw captions stay out of messages. Wrong Project or Job references deny the WebSocket with close code 4404.

`cancel_requested` and `recovery_required` also come from the same durable Job. A queued/running cancellation intent still needs confirmation. After a lost intent-commit acknowledgement, events can report the persisted intent and recovery flag. Read the same Job, then explicitly recover through the [cancel/retry guide](api-cancel-retry.en.md). Only confirmed cancellation sends a cancelled terminal snapshot.

The connection subscribes before reading a fresh persisted snapshot. Buffered older events cannot replace a newer snapshot with queued. Sequence orders the current live channel; it is not a permanent event cursor. Reconnect starts with a new durable snapshot and resets old live sequence tracking. HTTP recovers missed terminal state. Slow clients may skip intermediate snapshots; terminal recovery does not depend on replay.

Only sourced phases are shown. Pinned plugin captions can confirm loading_model, transcribing, planning_score, generating_semantic, synthesizing or decoding_audio; unconfirmed phase stays null. Phases have no fixed percentages and need not be monotonic. ComfyUI node bars contain heuristic shares and token ceilings, so current Transcribe/Generate never convert those bars into Job fractions. Only reliable finite 0–1 readings for the whole Job can become progress; otherwise it stays null.

After confirming native completion, the application durably records `running/saving`, then validates, imports and associates the whole output set. Completed follows those steps. Cancelled/failed/completed states remain stable. Duplicate, out-of-order or late native hints cannot directly complete a Job or repeat import. Native WS loss still permits owned HTTP queue/history queries.

## Reproduce disconnect recovery

Use a new output file for the same Job and deliberately disconnect after its initial snapshot:

```powershell
uv run --project services/api --no-sync python services/api/examples/watch_job.py --project-id <PROJECT_ID> --job-id <JOB_ID> --disconnect-after-first --output data/job-events/disconnected.json
```

Inspect `websocket_outcome` and `http_job`. If work remains active, continue GET using the same Job id. A timeout ends this observation window and does not authorize automatic resubmission. A failed Job retains error/recovery instructions; incomplete outputs cannot become a successful result. Download original files through application Asset ids in the completed result.

Each WebSocket observes one Job in its owning Project and closes normally after its terminal snapshot. Client disconnect does not cancel inference. A separate recovery issue delivers active-job reconciliation after API restart; this slice does not promise resumed active execution. Only the GPU owner validates real Runtime with [fresh source receipts](../reference/runtime-evidence.en.md) and a separate data directory. See [the Job event verification record](../verification/api-job-events.md).
