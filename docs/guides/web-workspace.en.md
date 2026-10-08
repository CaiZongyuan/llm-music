# Keep reference audio in a music project

Create a project in the formal Web, record a creative direction, then add an original WAV. The application service saves your project and assets. After refreshing, you can reopen the same project and read the same original file.

## Start a project {#create}

1. Open the running Web and go to “My projects”.
2. Enter “A walk after rain” as the project name. Record a mood or instrument in “Creative notes”, such as “Keep the bright melody and try warm piano”.
3. Choose “Create and start”. The project workspace opens, and the project appears in the sidebar.

Reopen existing projects from the list. Changing interface language leaves your names and notes unchanged.

## Add and inspect reference audio {#audio}

1. Choose a local PCM WAV in the workspace, then choose “Add to project assets”. Selecting a file alone does not save it.
2. Select the saved file under “Project assets”. Details show its filename, type, duration, channels, sample rate, asset identity and original SHA256.
3. Choose “Download original file” to retrieve the original audio. Refresh, or return to “My projects” and reopen it: the same asset and identity remain.

The currently verified transcription input is16 seconds of PCM16, mono24 kHz or stereo48 kHz. The upload budget is64 MiB/600 seconds; it does not promise inference for longer audio. After uploading, open [Reference transcription](web-transcribe.en.md) to inspect the score and download ABC/MIDI. You can also open [Music generation](web-generation.en.md) to create a Candidate from style and lyrics, listen, then explicitly save a Version. The persistent Player keeps the current audio across workspace navigation.

## Choose language and theme {#preferences}

The top language control offers 中文 and English. The light/dark button changes workspace colors. Navigation and refresh preserve these preferences. Switching keeps entered notes, the selected file and the current project identity. If browser storage is disabled, preferences still work in the current page; refresh may restore the defaults.

## Continue after a failure {#recover}

The application rejects invalid or incomplete WAV files without creating assets. Keep your project, select a valid file and submit again. For a failed read, choose “Read again”. Failed content or metadata reads appear as errors rather than empty projects.

After an unconfirmed save or interrupted connection, read projects/assets before repeating creation or upload. Check saved records first; an asset identity in the error can help identify the original operation. The page never retries writes automatically. An unknown project or page provides a link back to “My projects”.

Project “Jobs” and global “Jobs” read the same saved generation/transcription Jobs and show their five states, phases and an explicit read action. Unknown progress has no percentage. The [Jobs guide](web-jobs.en.md) explains cancellation confirmation, explicit retry and reconnect recovery.

## Local launch and isolated verification {#launch}

Use Node24, the repository's pnpm, uv/Python3.12 and the independent application environment. Prepare from the repository root:

```powershell
pnpm install --frozen-lockfile
uv sync --project services/api --locked --python 3.12.13
```

In the first terminal, start an independent CPU FakeRuntime API. Check that the port is free; writes use this dedicated directory:

```powershell
$env:MUSIC_API_RUNTIME_MODE='fake'
uv run --project services/api --no-sync music-api serve --host 127.0.0.1 --port 18036 --data-dir tests/browser/.artifacts/manual-web/application
```

In the second terminal, start the Web:

```powershell
$env:MUSIC_WEB_API_TARGET='http://127.0.0.1:18036'
pnpm web:dev --port 18035
```

Open <http://127.0.0.1:18035/>. The Web `/api` proxy connects to FastAPI, never ComfyUI. FakeRuntime outputs exercise the application only; they are not real music inference. Press Ctrl+C in each terminal you started to stop your two processes. Do not stop other projects or the shared Runtime. Formal three-process orchestration is a later launch issue.

```powershell
pnpm web:check
pnpm test:browser:install
pnpm test:browser:check
pnpm test:web
pnpm test:web:jobs
pnpm test:web:transcription
pnpm test:web:generation -- generation-recovery.controlled.ts
```

`web:check` builds the generated client, generates file routes, builds the production Web and checks strict types. Product browser tests start their own Fake API and Web, retain failure traces/screenshots and `.artifacts/<run-id>/` process/data receipts, and require graceful shutdown acknowledgements. They have a separate entrypoint from existing Swagger tests and do not record video. Real GPU inference is verified separately. See the [Web source guide](../../apps/web/README.md) for maintenance boundaries.
