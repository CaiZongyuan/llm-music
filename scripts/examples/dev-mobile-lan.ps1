param(
  [Parameter(Mandatory = $true)][string]$LanHost,
  [int]$LanPort = 8001
)

# Run from the repository root. Select the actual computer IPv4 yourself.
# This default launch uses isolated CPU Fake Runtime, not model inference.
pnpm dev -- --api-lan-host $LanHost --api-lan-port $LanPort --open
