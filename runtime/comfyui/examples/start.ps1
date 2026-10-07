param([ValidateRange(1, 65535)][int]$Port = 8188)

# Run from the repository root. Keep this terminal open; press Ctrl+C to stop.
uv run --project runtime/comfyui --no-sync python runtime/comfyui/manage.py start --port $Port
if ($LASTEXITCODE -ne 0) { throw "Runtime stopped with an error. Inspect the startup checks and service log." }
