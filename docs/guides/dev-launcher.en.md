# Open the local workbench with one command

This guide is for maintainers who need to start the local workbench. Ordinary development uses an isolated CPU Fake Runtime. Real generation uses prepared ComfyUI. Once the workbench opens, follow the [Project and Asset guide](web-workspace.en.md) to create a Project and upload reference audio.

## Prerequisites and first start

Run commands from the repository root. Install Git, Node, pnpm and uv. First run `pnpm install --frozen-lockfile` and `uv sync --project services/api --frozen`. The API has its own `.venv` and `uv.lock`. Fake mode does not install Torch, prepare models or start ComfyUI.

<<< ../../scripts/examples/dev-fake.ps1

The launcher builds the generated API client, starts the separate API and Web, then waits for HTTP health checks. It prints `Web ready: http://127.0.0.1:5173`; `--open` opens this address. Web connects only to FastAPI through its `/api` proxy. In Fake mode, Runtime runs inside the API, giving two service processes. This mode uses CPU fixtures. Generated audio is a 440 Hz test tone and cannot establish music quality.

Default ports are API `8000`, Web `5173`, and native Runtime `8188`. All bind to `127.0.0.1`. Use `--api-port 18045 --web-port 18046 --runtime-port 18047` to choose another set of distinct ports. The launcher does not silently choose other ports or connect Web to an unknown service.

## Data, reuse and stop

Fake application data defaults to `data/dev/fake/application/`; native mode uses `data/dev/comfyui/application/`. Use `--data-dir PATH` for a different persistent directory. Deleting that directory loses its Projects, Assets and Versions. Stopping services does not delete data.

Each start prints a unique `Session receipt` path. The receipt records mode, process PID, creation time, actual command, ports, directories, started services and reused services. Stable service registrations reside under `data/dev/<mode>/launcher/`. Use `--state-dir PATH` to isolate another group. Logs, owner records, stop acknowledgments and final cleanup results remain in the session directory.

Starting again with the same configuration checks the registration, actual PID/creation time, command, working directory and local listener identity, then checks health. Matching services print `Reusing` and belong to the previous session. Different configuration, unreadable identity or an unknown port holder refuses reuse.

Press Ctrl+C to stop services started by this session. Another terminal can run the printed `pnpm dev -- --stop-session "full/session/path/session.json"`. API and Web receive a session-specific stop signal and shut down normally. Reused services continue running; their original owner stops them. Shutdown is bounded. When required, the launcher terminates only its still-matching recorded child processes and records them in `forced_processes`. Native Runtime also records `forced_pids`; forced termination does not count as graceful shutdown.

## Use real ComfyUI

Only the GPU resource owner starts native Runtime. Follow the [Runtime preparation guide](runtime-doctor.en.md) to prepare the separate `runtime/comfyui/.venv`, pinned sources and models. With no existing Runtime, run `pnpm dev -- --mode comfyui --open` to start three independent services: Runtime uv, API uv and Web pnpm. The existing Doctor runs before Runtime starts. After model checks pass, the launcher collects an owner receipt for its new listener; the API then verifies actual readiness. The launcher does not synchronize the Runtime environment or download models.

For an existing Runtime, use this controlled example. When invoking the PowerShell script, supply the actual `RuntimeProject` directory containing `.venv`/`uv.lock`, upstream `RuntimeRoot` containing `main.py`, `ModelsRoot`, `RuntimeStateRoot`, and actual listener PID. These paths can identify a prepared service in another worktree of this repository. `RuntimePort` defaults to `8188`.

<<< ../../scripts/examples/dev-native-reuse.ps1

The collector verifies the process, source revisions, model SHA256 and file fingerprints. The launcher rechecks the receipt, directories and listener/state arguments, preserving original timestamps. The default lifetime is 300 seconds. Stale or mismatched evidence refuses startup; old model status cannot remain ready. A reused Runtime belongs to its original owner and is not interrupted on exit. API and Runtime use separate uv projects and environments. Windows venv redirectors expose the base Python path to system process tools; the launcher checks both the configured uv environment and collector identity.

## Recover a failed start

| Output | Recovery |
| --- | --- |
| Port unknown / differently configured | Use unused ports, or ask the existing owner to stop its service. Deleting a registration does not make an unknown process belong to this project. |
| JS dependencies missing / client build failed | Install locked pnpm dependencies, run `pnpm --filter @llm-music/api-client build` separately to see the error, then retry. |
| Environment not prepared / uv environment differs | Run frozen `uv sync` for the corresponding API or Runtime project. They must not share `.venv`. |
| Native source/models not prepared / Doctor NOT READY | Follow Runtime preparation to check sources, environment, GPU and models. The launcher does not download or repair weights. |
| Native owner/model evidence refused / Runtime not ready | Collect a fresh matching receipt using the actual listener PID. Check models and directories; do not edit `checked_at`. |
| Service startup failed / health wait expired | Read `api.log`, `web.log` or `runtime.log` in the session directory, repair the cause, then retry. Services started by this session are cleaned up; reused services remain. |
| startup.lock is held | Wait for the other launcher to finish startup. Preserve/remove a stale lock only after reading it and confirming that its recorded PID/creation time is no longer live. |

`--timeout` limits service startup and health waits to 1–300 seconds; the default is 180 seconds. Dependency checks and SDK build have separate bounds before service startup. `pnpm test:launcher` runs actual CPU CLI/HTTP lifecycle checks. The [verification record](../verification/dev-launcher.md) separates CPU results from real target-machine acceptance.
