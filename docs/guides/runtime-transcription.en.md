# Transcribe through Runtime API and export MIDI

This P0 tool submits fixed Reference Audio to SheetSage2 and saves parseable ABC plus readable MIDI. It uses public Runtime APIs, requires no ComfyUI Canvas, and creates no product FastAPI or Web app.

## Prerequisites

Work from the repository root. Follow the [Runtime Doctor guide](runtime-doctor.en.md) to prepare pinned source, dependencies, and models. Save a successful pre-start Doctor JSON, then start Runtime:

```powershell
uv run --project runtime/comfyui --no-sync python runtime/comfyui/manage.py doctor --json | Out-File -Encoding utf8 data/runtime-readiness.json
uv run --project runtime/comfyui --no-sync python runtime/comfyui/manage.py start
```

Start only after Doctor exits `0`. Doctor checks the free port, so reuse the saved real successful receipt after starting the service. The tool accepts UTF-8 JSON, including a PowerShell BOM, as either raw Doctor output or the PM's `report` envelope. The current GPU resource owner runs real GPU requests and serializes them with other inference work.

## Get ABC and MIDI

Leave Runtime running and use another terminal:

```powershell
uv run --project runtime/comfyui --no-sync python runtime/comfyui/p0/transcribe.py --readiness-report data/runtime-readiness.json --output-dir data/p0/transcription/run-01
```

`--output-dir` must be new or empty. The tool preserves existing evidence. By default, it generates an original 16-second, 48 kHz, stereo, 16-bit PCM instrumental WAV. This fixed input uses CC0-1.0. The [fixture manifest](../../runtime/comfyui/workflows/transcribe-sheetsage2/v1/fixture.json) records its source, version, and SHA256. The [generator](../../runtime/comfyui/p0/reference_fixture.py) defines its notes, chords, and synthesis.

The tool checks readiness pins, current service versions, required nodes, and an empty queue. It uploads WAV through public `/upload/image`, then submits the [fixed Workflow](../../runtime/comfyui/workflows/transcribe-sheetsage2/v1/workflow.json). This endpoint retains the `image` form field but the pinned version accepts audio and MIDI bytes. Transcription uses `mode=full`, `listen=the whole song`, and `device=cuda:0`. ASR is disabled and `download=off`; no speech or writer model is downloaded. Settings and [input/output mappings](../../runtime/comfyui/workflows/transcribe-sheetsage2/v1/manifest.json) remain recorded.

Success exits `0`, with `status=completed` and `verified=true` in the receipt. Main artifacts:

- `reference.wav`: default fixed input. With `--input`, the original file and its hash are retained without copying it.
- `request.json`: the submitted prompt and client id.
- `history.json`: the complete public Runtime history result.
- `score.abc` and `score.mid`: saved as successful artifacts only after every validation passes.
- `receipt.json`: input/output hashes, licenses, Runtime/plugin/model/workflow revisions, settings, parser evidence, and measurement scope.

The tool parses raw ABC through `/yue2/score/read` and rejects empty Scores or trimmed incomplete sections. It then exports through `/yue2/score/midi`, uploads the MIDI, and reads the actual file and nonempty notes through `/yue2/midi/tracks`. HTTP `200` or file existence alone cannot mean success.

## Scope and measurements

This tool verifies one Runtime API transcription and artifact exchange. `p0_passed` stays `false`. Full P0 still needs real Generate, queue, cancel, repeat, and cleanup evidence.

The fixed instrumental sample checks the pipeline and file validity. It does not establish accuracy for vocals or arbitrary music. SheetSage2 weights use CC-BY-NC-4.0, recorded separately from the input fixture's CC0 license. The diagnostic input boundary is readable, nonsilent, untruncated 16-bit mono/stereo PCM WAV lasting 0.05–30 seconds. This is the tool's input budget, not an accuracy claim for every admitted recording.

The receipt records client wall time from submission through validation, available Runtime execution timestamps, and before/after `/system_stats` snapshots. Without continuous sampling, peak VRAM/RAM and individual phase times are explicitly `unavailable`.

A ComfyUI `execution_cached` hit on the transcription node fails this check. The plugin also holds an independent eight-result transcription cache; `keep_model_loaded=false` releases the model but retains those results. Public history does not expose that cache state. Root must retain first-execution service progress, GPU facts, and logs. Repeating identical audio cannot be treated as fresh GPU inference automatically. The tool does not cancel a running request or restart shared Runtime.

## Recover from failure

Failure exits `1` with `verified=false`; submitted requests and failed history remain available. Argument parsing or directory conflicts exit `2`. Failed checks do not register successful ABC/MIDI. A `candidate.mid` may remain as an unverified diagnostic file.

| Diagnostic | Recovery |
| --- | --- |
| Invalid, silent, or truncated PCM WAV | Use the default fixed fixture. Check input bytes and hash first. |
| Readiness does not verify target pins or SheetSage2 hash | The resource owner restores pinned source/models and obtains a new real pre-start Doctor receipt. |
| Runtime is unavailable or versions/nodes differ | Check address, pinned service, and logs. Default address: `http://127.0.0.1:8188`. |
| Queue is nonempty | Wait for the owner to finish current work. Do not submit competing requests. |
| History reports missing models, OOM, or execution failure | Read `history.json`, `failure-response.json`, and service logs. Repair the cause and retry in a new output directory. |
| `--timeout` expires (default 1800 seconds) | The request may still be running. Inspect its saved prompt id, history, and queue. The owner decides whether to cancel or wait. |
| Score/MIDI is empty, invalid, or incomplete | Retain request, history, and parser response. Inspect the model result; do not mark candidate files successful. |

Run reproducible GPU-free checks:

```powershell
uv run --no-project --python 3.12.13 python -m unittest discover -s runtime/comfyui/tests -v
```

These tests use isolated fake HTTP services and cannot unlock P0. See the [transcription verification record](../verification/runtime-transcription.md) for actual execution status.
