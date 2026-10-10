# Local application API

From the repository root:

```powershell
uv sync --project services/api --locked --python 3.12.13
uv run --project services/api --no-sync music-api serve --data-dir data/application --port 8000
```

Project and PCM WAV Reference Audio are available at local Swagger `/docs`. This independent uv project owns its own environment/lock and requires no Torch/CUDA or running ComfyUI.

See [the complete guide](../../docs/guides/api-project-audio.en.md) for HTTP examples, persistent storage, policy settings and failure recovery; [verification](../../docs/verification/api-project-audio.md) records actual evidence and limits.

For an explicitly selected active computer IPv4, add `--lan-host ACTUAL_IPV4 --lan-port 8001` to `music-api serve`. One lifespan serves precise loopback and LAN sockets. LAN requires revocable device authorization; anonymous access is limited to connection information and pairing claim. The local owner controls pairing with the current process CSRF token. See [LAN startup and pairing](../../docs/guides/dev-launcher.en.md#mobile-lan) for credentials, revocation, custom Origins and process ownership.
