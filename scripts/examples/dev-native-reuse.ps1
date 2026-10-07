param(
    [Parameter(Mandatory = $true)][string]$RuntimeProject,
    [Parameter(Mandatory = $true)][string]$RuntimeRoot,
    [Parameter(Mandatory = $true)][string]$ModelsRoot,
    [Parameter(Mandatory = $true)][string]$RuntimeStateRoot,
    [Parameter(Mandatory = $true)][int]$RuntimePid,
    [int]$RuntimePort = 8188
)
# Run from the repository root. The GPU owner supplies the actual live listener PID.
$runtimeReceipt = Join-Path (Get-Location) ("data/dev/comfyui/owner-" + [guid]::NewGuid().ToString("N") + ".json")
uv run --project services/api --frozen --no-sync python -m music_api.runtime_evidence collect --runtime-url "http://127.0.0.1:$RuntimePort" --pid $RuntimePid --output $runtimeReceipt
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
pnpm dev -- --mode comfyui --runtime-port $RuntimePort --runtime-project $RuntimeProject --runtime-root $RuntimeRoot --models-root $ModelsRoot --runtime-state-root $RuntimeStateRoot --runtime-evidence $runtimeReceipt --open
exit $LASTEXITCODE
