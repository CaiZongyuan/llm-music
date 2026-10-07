param([ValidateRange(1, 65535)][int]$Port = 8188)

# Run from the repository root. A real CUDA check requires the GPU resource owner.
uv run --project runtime/comfyui --no-sync python runtime/comfyui/manage.py doctor --port $Port
if ($LASTEXITCODE -ne 0) { throw "Runtime is not ready. Follow the reported recovery actions before starting." }
