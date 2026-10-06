# Verify running cancellation and subsequent inference

This P0 command cancels one exactly owned Generate request through the pinned Runtime API, then verifies a subsequent successful Generate request. Product API/Web development has not started.

## Run the full check

Work from the repository root. Complete [Doctor](runtime-doctor.en.md), [transcription](runtime-transcription.en.md), [generation](api-generation.en.md) and [queue verification](runtime-queue-history.en.md) first. Retain the ready Doctor JSON and keep the same pinned Runtime running. The GPU resource owner must own submission and cancellation exclusively. The initial queue must be idle.

`--runtime-log` points to stderr currently written by that Runtime. Replace the example log and prior artifact paths. The command only reads these files.

```powershell
uv run --project runtime/comfyui --no-sync python runtime/comfyui/p0/running_cancel.py run --doctor-report data/runtime-readiness.json --runtime-log data/runtime/comfyui/server.stderr --preserve-artifact data/p0/generate/run-01/audio.flac --output-dir data/p0/running-cancel/run-01
```

The output directory must be absent or empty. Repeat `--preserve-artifact` to compare existing audio/Score SHA256 hashes. Defaults are local `http://127.0.0.1:8188`, `--timeout 1800` seconds per confirmation window and `--poll-interval 0.2` seconds. Each sleep is bounded by the remaining window; HTTP requests retain the existing client's connection timeout. The tool does not install dependencies, download models, restart Runtime or retry submissions.

| Order | Conditions and evidence |
| --- | --- |
| A | Existing style/lyrics, 35-second budget and inference settings; seed `2026101801`. Capture stderr file identity and end byte offset before submission. |
| Cancel A | Wait for a new `Writing the score` marker. Before and after reading it, A must be the sole running item, its prompt/client/graph must match this saved run, and no work may be pending. B has not been submitted. |
| B | Submit only after A has confirmed cancelled history and the queue is idle; seed `2026101802`. While B runs, call native cancel twice for terminal A. Both must return `cancelled=false`. |
| Final | B has successful history, positive execution time, valid Score and fully decodable 30–40 second audio. The final queue is idle and declared prior artifacts retain their hashes. |

The new seeds are declared input changes that distinguish earlier requests, not performance comparisons. `run-map.json` persists separate run/client/prompt/graph identities immediately after each successful submission. Each request is written first to `request.json`; a lost submission response leaves an attempt record and must not cause a blind resubmission.

## Confirm terminal cancellation

The tool sends only `POST /api/jobs/{exact owned prompt id}/cancel {}`. The pinned Runtime matches the current id and dispatches interrupt under the queue mutex. If the queue switches between the client's snapshot and request, this native match cannot interrupt another id. The tool never calls global `/interrupt`, clear queue or clear history.

Native `cancelled=true` means dispatch only. `terminal_confirmed=true` requires matching prompt/client/graph history, `status_str=error`, an `execution_interrupted` event for that exact target, and `GET /api/jobs/{id}` returning its `status=cancelled`. Actual interrupted history may have `completed=false`. Ordinary `execution_error` remains failed; success after a late dispatch remains completed; missing terminal history remains unconfirmed.

The phase log contains no prompt id. Attribution therefore requires an exclusive single worker, owned A before/after snapshots and bytes appended during this run. Old markers do not trigger. Rotation, identity changes or detected truncation reject attribution without rereading offset 0. Failure stops the check without substituting a fixed delay or global interrupt. The resource owner must also retain Runtime PID and log provenance continuity.

A successful full check exits `0` with `verified=true` in `report.json`. `p0_passed` always remains `false`; repeated jobs and cleanup still need later acceptance. The receipt retains native replies, history, queue, log byte range, source/model/Workflow hashes, B artifacts and point-in-time `/system_stats` snapshots. These snapshots do not establish peaks, per-process GPU usage or complete GPU memory release. Actual GPU work, loader cleanup and subsequent inference require same-run logs and actual execution records.

The target GPU completed this check on frozen candidate `58d62ab` with exit `0`. A was cancelled after a new score-token marker, with a native execution interval of 5.108 seconds. Its history had `error`, `completed=false` and its own `execution_interrupted`; the Job query confirmed cancelled. The ordinary terminal guard sent no write. Both native calls targeting old A while B ran returned false, and B then succeeded. B's execution interval was 52.776 seconds, producing 99 Score notes and a 34.998667-second, 48 kHz stereo FLAC. All 1,679,936 frames decoded; audio SHA256 was `270d1a460ed5424b87735f8ee9b1f2ea85bd483dcbd7e6ea0a4414fddf69439c`. Five declared prior files retained their hashes, including the original Runtime output and previous verification copies/MIDI. The final queue was idle; Runtime PID, creation identity and source remained continuous.

Logs show loader `unloaded` and `Processing interrupted`. Native Torch usage snapshots fell from 4,728,805,616 bytes at the score stage to 3,000,510,600 bytes after cancellation and before B, then to 86,245,376 bytes after B. Device usage at those points was 6,115,819,520 → 4,438,097,920 → 1,720,188,928 bytes. Usage remained high just after cancellation and fell further at the later snapshot; the reason is not established. This does not prove immediate complete release or absence of leaks. #19 covers continuous observation and cleanup. Subjective listening remains deferred and whole P0 has not passed.

## Bounded recovery

Failure exits `1` and retains accepted mappings and evidence. Invalid arguments or directory conflicts exit `2`. After timeout/disconnection, the original request may still be active. Query its saved id before recovery; do not rerun the whole demo.

For an exactly owned target confirmed still running:

```powershell
uv run --project runtime/comfyui --no-sync python runtime/comfyui/p0/running_cancel.py cancel-running --run-map data/p0/running-cancel/run-01/run-map.json --target A --output-dir data/p0/running-cancel/recovery-01
```

Unknown ownership or a mismatched running row rejects the write. Terminal or noncurrent targets cause no write; final history determines the result. Exit `0` for completed/no-op is not cancellation proof: read `status`, `verified` and `terminal_confirmed`. Recovery does not run B or prove subsequent inference or full cleanup.

`observe-score --run-map ... --target A --runtime-log ... --output-dir ...` is a read-only diagnostic. It waits from the log's end at invocation, with the same identity/ownership checks. It ignores earlier markers, submits/cancels nothing and never sets `verified=true`.

Public behavior checks without GPU:

```powershell
uv run --no-project --python 3.12.13 python -m unittest discover -s runtime/comfyui/tests -v
```

Fake HTTP verifies caller cancellation, terminal and log attribution boundaries. It does not prove GPU work, real interruption, resource release or music quality. See the [verification record](../verification/runtime-running-cancel.md) for actual execution status.
