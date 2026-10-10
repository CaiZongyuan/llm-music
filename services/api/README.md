# Local application API

From the repository root:

```powershell
uv sync --project services/api --locked --python 3.12.13
uv run --project services/api --no-sync music-api serve --data-dir data/application --port 8000
```

Project and PCM WAV Reference Audio are available at local Swagger `/docs`. This independent uv project owns its own environment/lock and requires no Torch/CUDA or running ComfyUI.

See [the complete guide](../../docs/guides/api-project-audio.en.md) for HTTP examples, persistent storage, policy settings and failure recovery; [verification](../../docs/verification/api-project-audio.md) records actual evidence and limits.

For an explicitly selected active computer IPv4, add `--lan-host ACTUAL_IPV4 --lan-port 8001` to `music-api serve`. One lifespan serves precise loopback and direct LAN sockets. `GET /connection` returns the stable server ID, `access_method: "direct"` and configured `lan_address`; HTTP, WebSocket and original audio access use no pairing code or device credential. LAN create/generate/retry writes retain their UUID `Idempotency-Key` and frozen request recovery. Historical pairing routes remain compatibility endpoints and are unused by direct connection.

Native owner/model receipts retain their original verification timestamps. They remain valid while the actual process, pinned source and model-file fingerprints match; each readiness request rechecks those facts and current native health without periodically hashing weights. Changed or missing weights and different processes still block native work. Live health/node/GPU observations retain their freshness window.
