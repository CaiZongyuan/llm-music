# Run from the repository root. Writes model weights and resumable downloads.
uv run --project runtime/comfyui --no-sync python runtime/comfyui/manage.py download-models
if ($LASTEXITCODE -ne 0) { throw "Model preparation failed. Inspect the output before resuming downloads." }
