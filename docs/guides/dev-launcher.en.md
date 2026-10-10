# Open the local workbench with one command

This guide is for maintainers who need to start the local workbench. Ordinary development uses an isolated CPU Fake Runtime. Real generation uses prepared ComfyUI. Once the workbench opens, follow the [Project and Asset guide](web-workspace.en.md) to create a Project and upload reference audio.

## Prerequisites and first start {#start}

Run commands from the repository root. Install Git, Node, pnpm and uv. First run `pnpm install --frozen-lockfile` and `uv sync --project services/api --frozen`. The API has its own `.venv` and `uv.lock`. Fake mode does not install Torch, prepare models or start ComfyUI.

<<< ../../scripts/examples/dev-fake.ps1

The launcher builds the generated API client, starts the separate API and Web, then waits for HTTP health checks. It prints `Web ready: http://127.0.0.1:5173`; `--open` opens this address. Web connects only to FastAPI through its `/api` proxy. In Fake mode, Runtime runs inside the API, giving two service processes. This mode uses CPU fixtures. Generated audio is a 440 Hz test tone and cannot establish music quality.

Default ports are API `8000`, Web `5173`, and native Runtime `8188`. All bind to `127.0.0.1` by default. Use `--api-port 18045 --web-port 18046 --runtime-port 18047` to choose another set of distinct ports. The launcher does not silently choose other ports or connect Web to an unknown service.

## Enable the mobile LAN listener {#mobile-lan}

Check the computer's current LAN interface IPv4, then invoke this example with `-LanHost ACTUAL_IPV4`. `LanPort` defaults to `8001` and must differ from the API, Web and Runtime ports. The launcher binds only this selected address. It does not choose a virtual interface automatically, use a wildcard, or expand ComfyUI or Web listeners.

<<< ../../scripts/examples/dev-mobile-lan.ps1

One API process serves the existing loopback and additional LAN socket, sharing Projects, Assets, Jobs, Candidates, Versions and the queue. The example still uses CPU Fake Runtime. Real music needs the native Runtime preparation below. The session adds `lan_url`; the API configuration signature records `lan_host`, `lan_port` and allowed local Web Origins. Changed bindings, either occupied port or an unproved listener owner refuse startup. Reuse and shutdown check both actual sockets.

Pairing management HTTP is implemented. The production phone creation screens are still being connected under the mobile implementation tickets. On the computer's local API, read the process CSRF with `GET /pairing/owner`, then send `X-Owner-CSRF` to `POST /pairing/challenges`. The response shows the six-digit code once. It lasts 120 seconds and permits five incorrect attempts; creating a window closes the previous one. `DELETE /pairing/challenges/current` closes new pairing. `GET /pairing/devices` reads device summaries; `DELETE /pairing/devices/{device_id}` revokes a device. Browser management requests with Origin must match the actual local API or configured Web Origin. Local CLI calls may omit Origin but still need current CSRF.

The phone first securely saves its UUID and 32-byte random token (64 lowercase hex characters). It then sends `device_id`, `device_name`, `device_token` and `code` to LAN `POST /pairing/claim`. An exact replay restores the original device; a different intent conflicts. The server stores only digests. Anonymous LAN access allows only `GET /connection` and `POST /pairing/claim`. Other HTTP, WebSocket and Asset GET/HEAD/Range requests require `Authorization: Bearer`. Send credentials in headers, never a URL. Revocation closes active WebSockets and rejects later requests while generation continues. Already-sent audio bytes cannot be withdrawn. Existing local business consumers retain their original usage when LAN is disabled.

`device_id` identifies one authorization record. Explicit pairing after revocation needs a fresh UUID and token. An uncertain initial claim must retain and replay the original UUID, token, name and code; do not replace an unknown request with another authorization.

LAN Project creation, Generate and explicit retry also require a durable UUID `Idempotency-Key`. Query the original request after an uncertain response; do not automatically create another Job. See the [request recovery rules](generate-save-api.en.md#request-recovery).

## Data, reuse and stop {#ownership}

Fake application data defaults to `data/dev/fake/application/`; native mode uses `data/dev/comfyui/application/`. Use `--data-dir PATH` for a different persistent directory. Deleting that directory loses its Projects, Assets and Versions. Stopping services does not delete data.

Each start prints a unique `Session receipt` path. The receipt records mode, process PID, creation time, actual command, ports, directories, started services and reused services. Stable service registrations reside under `data/dev/<mode>/launcher/`. Use `--state-dir PATH` to isolate another group. Logs, owner records, stop acknowledgments and final cleanup results remain in the session directory.

The native API reads evidence from the stable `runtime-evidence-<port>.json` inside its launch group. An input receipt filename is provenance: an automatically generated session path or a new filename does not change the same service configuration. The launcher preserves an input copy, verifies the actual Runtime, environment, models and all service configurations, then copies the validated original content to that read location. Original `checked_at` and model verification times stay unchanged. Later evidence cannot overwrite older sessions' input copies. Fresh evidence for the same configuration and Runtime can update an existing API's read source; reused processes remain owned by their original session.

Starting again with the same configuration checks the registration, actual PID/creation time, command, working directory and local listener identity, then checks health. Matching services print `Reusing` and belong to the previous session. Different configuration, unreadable identity or an unknown port holder refuses reuse.

Press Ctrl+C to stop services started by this session. Another terminal can run the printed `pnpm dev -- --stop-session "full/session/path/session.json"`. API and Web receive a session-specific stop signal and shut down normally. Reused services continue running; their original owner stops them. Shutdown is bounded. When required, the launcher terminates only its still-matching recorded child processes and records them in `forced_processes`. Native Runtime also records `forced_pids`; forced termination does not count as graceful shutdown.

## Use real ComfyUI {#native}

Only the GPU resource owner starts native Runtime. Follow the [Runtime preparation guide](runtime-doctor.en.md) to prepare the separate `runtime/comfyui/.venv`, pinned sources and models. With no existing Runtime, run `pnpm dev -- --mode comfyui --open` to start three independent services: Runtime uv, API uv and Web pnpm. The existing Doctor runs before Runtime starts. After model checks pass, the launcher collects an owner receipt for its new listener; the API then verifies actual readiness. The launcher does not synchronize the Runtime environment or download models.

For an existing Runtime, use this controlled example. When invoking the PowerShell script, supply the actual `RuntimeProject` directory containing `.venv`/`uv.lock`, upstream `RuntimeRoot` containing `main.py`, `ModelsRoot`, `RuntimeStateRoot`, and actual listener PID. These paths can identify a prepared service in another worktree of this repository. `RuntimePort` defaults to `8188`.

<<< ../../scripts/examples/dev-native-reuse.ps1

The collector verifies the process, source revisions, model SHA256 and file fingerprints. The launcher rechecks the receipt, directories and listener/state arguments, preserving original timestamps. The default lifetime is 300 seconds. Stale or mismatched evidence refuses startup; old model status cannot remain ready. A reused Runtime belongs to its original owner and is not interrupted on exit.

A subsequent start without `--runtime-evidence` can reuse only the launch group's still-current evidence. Once it expires, use the example above to collect genuinely new evidence. Copying or rereading an old file does not renew its time. A different Runtime process, directory, environment or application data configuration refuses reuse; its original owner restarts the corresponding API for the new configuration.

API and Runtime use separate uv projects and environments. The launcher checks that the current Runtime environment matches its own `uv.lock` and records the lock SHA256. It also verifies the actual listener's launch interpreter path, PID/creation time and command. Windows listeners often expose a base Python shared by separate environments. In that case, a still-live immediate venv redirector must prove that the configured environment's interpreter launched the same command. A new configuration probe, common base Python or distant ancestor cannot replace this origin. Unproved origin refuses reuse while preserving the service; the launcher does not infer the live process's `sys.prefix`.

LF/CRLF differences between Git checkouts are normalized only when comparing the four registered configuration text files for compatibility. Files are not rewritten. Actual raw-byte `uv.lock` SHA256, installed-environment synchronization, process origin, models and source checks remain independent. Changed dependencies or configuration values still refuse reuse.

First run `pnpm dev -- --inspect-runtime-origin ACTUAL_PID --runtime-project PREPARED_RUNTIME_PROJECT_PATH` to inspect this origin alone. This command checks launch paths, process identity and the current lock. It does not read models, connect to Runtime HTTP or establish inference readiness. A complete start still needs the fresh collector receipt above.

## Recover a failed start {#recover}

| Output | Recovery |
| --- | --- |
| Port unknown / differently configured | Use unused ports, or ask the existing owner to stop its service. Deleting a registration does not make an unknown process belong to this project. |
| JS dependencies missing / client build failed | Install locked pnpm dependencies, run `pnpm --filter @llm-music/api-client build` separately to see the error, then retry. |
| Environment not prepared / uv environment differs | Run frozen `uv sync` for the corresponding API or Runtime project. They must not share `.venv`. |
| Native source/models not prepared / Doctor NOT READY | Follow Runtime preparation to check sources, environment, GPU and models. The launcher does not download or repair weights. |
| Native owner/model evidence refused / Runtime not ready | Collect a fresh matching receipt using the actual listener PID. Check models and directories; do not edit `checked_at`. |
| Runtime environment origin differs / unproved | Select the actual launch environment, or ask the original owner for a still-verifiable origin. Preserve its service; a common base Python does not imply a common environment. |
| Existing API native binding differs / unproved | Preserve the existing API and check its recorded Runtime origin. Its original owner restarts the API for the verified new Runtime configuration. |
| Service startup failed / health wait expired | Read `api.log`, `web.log` or `runtime.log` in the session directory, repair the cause, then retry. Services started by this session are cleaned up; reused services remain. |
| startup.lock is held | Wait for the other launcher to finish startup. Preserve/remove a stale lock only after reading it and confirming that its recorded PID/creation time is no longer live. |

`--timeout` limits service startup and health waits to 1–300 seconds; the default is 180 seconds. Dependency checks and SDK build have separate bounds before service startup. `pnpm test:launcher` runs actual CPU CLI/HTTP lifecycle checks. The [verification record](../verification/dev-launcher.md) separates CPU results from real target-machine acceptance.
