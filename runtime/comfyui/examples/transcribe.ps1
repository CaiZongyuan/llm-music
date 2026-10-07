param([ValidateRange(1, 65535)][int]$Port = 8188)

# Run from the repository root in a second terminal. The GPU owner must use an empty queue.
uv run --project runtime/comfyui --no-sync python runtime/comfyui/p0/transcribe.py --readiness-report data/runtime-readiness.json --output-dir data/p0/transcription/run-01 --base-url "http://127.0.0.1:$Port"
if ($LASTEXITCODE -ne 0) { throw "Transcription did not succeed. Retain the request and receipt; inspect the result before retrying." }
