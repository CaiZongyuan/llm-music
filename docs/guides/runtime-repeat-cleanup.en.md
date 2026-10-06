# Continuous runs, cleanup, and the P0 report

This fixed P0 protocol runs ten Transcribe/Generate items in one Runtime, records actual artifacts and continuous resource samples, then sends `/free` once and verifies both models remain usable. It creates no product API/Web and never unlocks P1 automatically.

## Freeze the inputs first

From the repository root, complete [Doctor](runtime-doctor.en.md), [transcription](runtime-transcription.en.md), [generation](api-generation.en.md), [queue](runtime-queue-history.en.md), and [running cancellation](runtime-running-cancel.en.md). Retain their actual receipts and the same process. Only the GPU resource owner runs real requests. Do not restart, free, clear cache/history, or retry between the ten items.

```powershell
uv run --no-project --python 3.12.13 python runtime/comfyui/p0/repeat_cleanup.py prepare --ledger-root .scratch/p0-development --output-dir data/p0/repeat/prepared-01
```

prepare creates CPU fixtures and `plan.json` without Runtime writes. Order is T1/G1…T5/G5, followed by G5-after-free and T6-after-free. Six original CC0 16-second, 48 kHz stereo PCM16 inputs shift only the melody by +1…+6 semitones. Chords, bass, percussion, timing, and budget remain fixed. WAV SHA256, actual decoded float32 hash, and expected native `yue2_track` are registered together. A new filename/header cannot bypass cache.

G1…G5 use the verified style/lyrics with seeds 2026190101…2026190105. Preparation and execution both check the actual history ledger; used seeds/track marks cannot count as fresh work. Settings remain BF16, offload on, low_vram false, keep_model_loaded false, cot full, sdpa, standard VAE, 35-second budget, and downloads off. Source, graph IDs/bindings, manifests, and inputs cannot be changed afterward.

## Run the fixed series

Replace the example PID with the owner's actual Runtime PID. `--runtime-main` and stderr must belong to it. Output must be empty. In an isolated worktree, pass absolute paths to root-owned resources.

```powershell
uv run --project runtime/comfyui --no-sync python runtime/comfyui/p0/repeat_cleanup.py run --prepared data/p0/repeat/prepared-01 --doctor-report data/runtime-readiness.json --runtime-log data/runtime/comfyui/server.stderr --process-pid 12345 --runtime-main runtime/comfyui/.upstream/ComfyUI/main.py --ledger-root .scratch/p0-development --prior-root .scratch/p0-development --state-root data/runtime/comfyui --output-dir data/p0/repeat/run-01
```

Check PID and create_time before/after each item. Submit the next item only after terminal history, complete ABC/MIDI/audio validation, and the same idle window. Persist maps, requests, history, input/output hashes, and log spans per item. OOM, crash, timeout, unknown ownership, PID replacement, cache hits, missing reload/phase logs, or invalid artifacts stop new submissions and retain the failure. The tool does not retry, change settings to complete the count, or cancel active work automatically.

One series sampler continuously covers initial idle, submission, history, validation, identical inter-item idles, one cleanup, and both witnesses. Defaults are a 1-second sample interval and 2-second idle; explicit bounds must be positive. Slice each active/idle window from the same monotonic origin, retaining counts, gaps, sampled peaks/min/last. Empty windows cannot inherit series peaks. Background and boundary sampling share a lock that serializes timestamp, append, and complete JSONL writes.

Device values reconstruct CUDA whole-device total−free by removing unused Torch reservation from Comfy free. They include other GPU consumers and are not WDDM process residency. Torch allocator, Runtime RSS, and whole-host RAM are separate. Sampled peaks are lower bounds. T processing factor divides by its 16-second input; G RTF divides by fully decoded actual audio duration. Exclusive phase/model-load times stay unavailable where unobservable and are not derived from percentages.

## Prove cleanup

After ten successful items and idle queue, send `POST /free {unload_models:true,free_memory:true}` only once. Empty 200 is ACK only. Continue sampling and bounded idle, then replay the actual G5 graph with identical core, every ancestor, node IDs, seed, settings, and bindings. Change only SaveAudio prefix. Cached core, missing load/stages, or invalid media leaves cleanup unverified; do not retry or change the seed. A new T6 also requires a new Sage mark, reload/Listening/Writing, and valid ABC/MIDI.

Do not delete weights, Runtime upload/output/user songs, or evidence. Retain before/after file metadata for the declared state root. Cleanup concerns working memory and DAG reset, not zero memory or every cache disappearing. The reason #18's high post-cancel usage fell later remains unknown; unload logs cannot prove immediate full release.

## Report and decide

Retain `report.json`, `resource-samples.jsonl`, item folders, `runtime-report.json/md`, `benchmark.md`, and `known-limitations.md`. Report eight required cases separately as passed/failed/unverified; old 15–18 evidence does not count toward these ten items. Fake evidence cannot become actual acceptance, and the tool always sets `p0_passed=false`.

Ten successes alone cannot prove stability. `trend_review` retains raw idle vectors by T/G without invented thresholds. Unexplained sustained growth stays unverified. Root assesses raw data, gaps, identifiable bounded retention, and post-cleanup state. `report --run-dir ... --output-dir ... --prior-root ... --assessment ...` records a matching run id with status/rationale/evidence/unexplained_growth. Missing required windows or unexplained_growth other than false cannot promote passed. Root decides the gate after actual validation, review, CI, and integration. Deferred subjective listening creates no new gate.

After failure, inspect persisted prompt/client mapping, queue/history, and logs first. Use existing exact ownership recovery commands; do not rerun the whole series or clear shared work. Files remain retained, and accepted work may still be running.

```powershell
uv run --no-project --python 3.12.13 python -m unittest discover -s runtime/comfyui/tests -v
```

CPU/fake HTTP checks only prove tool logic. The [verification record](../verification/runtime-repeat-cleanup.md) states current evidence limits.
