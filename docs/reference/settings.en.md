Look up application API environment variables, defaults, and validation constraints. The fields below come directly from the real Settings JSON Schema. Generation does not read your environment values or connect to Runtime. This page does not configure ComfyUI or model environments.

## Choose an independent application data directory {#usage}

Run from the repository root. See the [client guide](../guides/api-client.en.md#prepare) for Node, pnpm, uv, and the independent API environment. This optional example starts only an isolated fake application API for practicing business operations. Fake mode does not produce model music.

```powershell
$env:MUSIC_API_RUNTIME_MODE = "fake"
$env:MUSIC_API_DATA_DIR = "data/reference-example-fake"
uv run --project services/api --no-sync music-api serve --port 8000
```

Check `runtime.mode` at `/health` before creating a Project. Local data remains after you stop your own API process. The documentation does not write runtime variables. If a directory belongs to another mode, choose a fresh directory; do not switch fake Projects to real mode. Real mode requires a separate directory and fresh owner receipt; follow the [diagnostics guide](../guides/api-runtime-diagnostics.en.md). See [generation and saving](../guides/generate-save-api.en.md) and [restart recovery](../guides/job-recovery.en.md) for complete operations and failure recovery.

## Read the metadata {#source}

The source of truth is [application Settings](../../services/api/src/music_api/config.py). The generator reuses the field and environment variable mapping from [Settings metadata](../../services/api/src/music_api/diagnostics_routes.py). `${REPOSITORY}` means the current checkout root. The generator derives this portable token from the actual Path default and does not publish a machine's absolute path. JSON blocks preserve types, defaults, allowed values, and numerical boundaries. A missing default stays unspecified.

`app.sqlite` and `assets/` under `data_dir` are the application storage paths derived by Settings. Upload byte/duration budgets do not establish supported model duration; see [current capabilities](../learn/scope.en.md). Reading configuration does not renew Runtime diagnostic evidence. Invalid field values prevent API startup. Fix the variable and restart your own process. Explicit launch arguments can override environment values, including `--data-dir`.

<<< @settings
