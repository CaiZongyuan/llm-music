# Verify serial queue, history, and queued cancellation

This P0 tool submits four pinned Workflow requests, deletes one exact pending item, then reconciles queue, history, execution times, and actual artifacts. It creates no product API/Web and requires no Canvas.

## Run the complete verification

Work from the repository root. Complete [Doctor](runtime-doctor.en.md), [API transcription](runtime-transcription.en.md), and [API generation](api-generation.en.md) first. Retain the real pre-start Doctor JSON and keep pinned Runtime running. The current GPU resource owner alone submits and cancels. The initial queue must be empty.

```powershell
uv run --project runtime/comfyui --no-sync python runtime/comfyui/p0/queue_history.py run --doctor-report data/runtime-readiness.json --output-dir data/p0/queue-history/run-01
```

The output directory must be new or empty. Defaults are `http://127.0.0.1:8188`, a `--timeout 1800` second confirmation window, and a `--poll-interval 0.2` second queue/history interval. Each sleep is capped by the remaining confirmation time; a large poll interval cannot extend that window. The tool does not sync dependencies, download models, restart Runtime, or retry submissions automatically.

| Order | Request | Input condition |
| --- | --- | --- |
| A | Generate | Existing style/lyrics, seed `2026101701`, other verified settings unchanged. |
| B | Transcribe | Polarity variant of the original CC0 16-second WAV; ASR disabled, downloads off. |
| C | Generate | Seed `2026101702`; the exact queued deletion target. |
| D | Generate | Seed `2026101703`; demonstrates successful work after cancellation. |

Generation reuses the existing 30–40 second Workflow, Score parser, and complete audio decoder. Transcription reuses ABC/MIDI export and the public reader. Runtime prompt ids and separate client ids are persisted in `run-map.json`, updated immediately after each submission. Final history must match the saved id, client id, and graph.

[queue_fixture.py](../../runtime/comfyui/p0/queue_fixture.py) multiplies every original PCM sample by `-1`, retaining rhythm, pitch, and duration while recording this changed input condition. WAV SHA256 is `877fcbe4179be5f893d547c2947fd212ae50de97cde2724eead2474c5ad6f69f`. Pinned `track_of → edits.audio_mark` hashes float32 waveform bytes and sample rate before feature extraction. Sage uses that recording key for its result cache, so this different sample hash avoids the earlier original-recording cache. New seeds/polarity are declared input changes, not a performance comparison.

## Determine success

The tool only sends `POST /queue {"delete":[C's exact prompt id]}`. It first checks C's current run/client ownership, pending state, and absent history. In the pinned version this endpoint only deletes pending entries, returns empty `200`, and does not interrupt running work.

`200` is not proof of deletion. The tool reads queue/history afterward. A now-running target, history entry, or still-pending target remains an honest outcome and cannot be called queued cancellation. The complete verification also waits for A/B/D termination and a final empty queue, then checks that C has no history before setting `never_started_proven=true`. Multiple running items or foreign requests prevent successful verification.

A/B/D must have positive durations and ordered, nonoverlapping A→B→D intervals. Artifacts must pass original Score parsing, MIDI reading, or complete audio decoding. A core inference cache hit cannot count as fresh inference. Success exits `0` with `verified=true` in `report.json`. `p0_passed` remains `false`; running cancellation and consecutive repeat/cleanup checks are later acceptance work.

Main evidence is `run-map.json`, `queue-events.jsonl`, `cancellation.json` (the deletion-time snapshot), and `report.json` (final proof). A/B/C/D folders retain submitted requests; survivors retain full history and valid artifacts. The receipt retains Source/Model/Workflow revisions, source/request hashes, new seed/audio conditions, and execution intervals. Root separately retains continuous PID and same-run logs to establish first GPU work and that the queued target never executed.

The plugin also retains an independent eight-result Sage cache; `keep_model_loaded=false` does not clear it. Repeating this tool with the same seeds/polarity does not automatically mean fresh GPU work. Public history does not expose Sage's result cache, so first-condition progress and GPU logs remain actual acceptance evidence. This tool has no continuous resource sampler and cannot claim peak VRAM/RAM or a performance improvement.

The target GPU completed A→B→D on candidate `027ea57`, with nonoverlapping execution intervals of 57.589, 7.868, and 56.719 seconds. C was deleted only while pending; final queue was empty and C had no history. A/D produced approximately 34.998667-second, 48 kHz stereo FLAC and 87/108 Score notes; B produced 32 ABC notes and 60 MIDI notes. Logs establish actual CUDA work for the new seed/polarity conditions and continuous Runtime PID identity. Subjective listening is deferred and full P0 remains unpassed; see the verification record for the exact scope.

## Recover within a bound

Failure exits `1` and preserves mappings and collected evidence. Argument/directory conflicts exit `2`. After timeout or disconnect, accepted requests may still be running. Do not rerun the complete demo and duplicate submissions.

If the saved target is still pending, use the separate recovery entrypoint:

```powershell
uv run --project runtime/comfyui --no-sync python runtime/comfyui/p0/queue_history.py cancel-queued --run-map data/p0/queue-history/run-01/run-map.json --target C --output-dir data/p0/queue-history/cancel-check-01
```

This still checks ownership and only performs exact pending deletion. An observed pending removal exits `0` with `never_started_proven=false`; it does not replace final proof. Running/completed/unknown-owner targets produce honest no-op or failure. The tool never escalates to `/interrupt`, `/api/jobs/.../cancel`, queue clear, or history clear. The owner inspects saved ids and actual service state before choosing to wait or use the later ownership-protected running-cancel flow.

Run public behavior checks without a GPU:

```powershell
uv run --no-project --python 3.12.13 python -m unittest discover -s runtime/comfyui/tests -v
```

Fake HTTP proves control logic, not actual GPU queue acceptance. The [verification record](../verification/runtime-queue-history.md) separates executed checks from pending results.
