# Run from the repository root before starting Runtime. Saves only a successful check.
$runtimeReadiness = uv run --project runtime/comfyui --no-sync python runtime/comfyui/manage.py doctor --json
if ($LASTEXITCODE -ne 0) { throw "Doctor failed. An existing successful receipt was not overwritten." }
New-Item -ItemType Directory -Force -Path data | Out-Null
$runtimeReadiness | Out-File -Encoding utf8 data/runtime-readiness.json
