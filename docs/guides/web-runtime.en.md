# Check services, models and Jobs before creating

You have created a [music Project](web-workspace.en.md) for “A walk after the rain.” If generation or reference transcription cannot start, open `/runtime` in the formal Web app to identify the prerequisite that needs recovery. The page reads status through the application service; you do not need the native node canvas.

## Read current readiness {#readiness}

1. Read “Services and creation readiness.” The application and inference services have separate states. Generation and transcription also have separate readiness results.
2. Read “Music models.” Missing, downloading, ready and verification failed describe distinct file verification facts. “Current state unavailable” does not establish readiness.
3. Expand “Observed at” to inspect the original observation time and fact source. Stable model and source verification remains available while actual binding and files match, without a five-minute expiry; original source time stays unchanged. Dynamic observations beyond their finite window show “Observation expired,” retaining values as previous records.
4. Choose “Check again.” This rereads status. It does not create Jobs, download models or change the environment.

The CPU fixture environment is explicitly identified. An available fixture pipeline does not establish real GPU readiness or prove music quality or inference performance.

## Understand device and queue facts {#facts}

“Device observations” shows the GPU name and memory readings actually available to the API. Memory uses GiB and original bytes. Device total, free and used memory include other processes. Torch active and reserved values describe the Runtime process allocator. Expand “More memory readings and scopes” for the remaining readings; do not treat the availability proxy as pure free memory.

The current API does not expose loaded model identities, so “Loaded models” stays unknown. Registered files, verified files and loaded models are distinct facts. Missing driver, CUDA or process memory readings also stay unknown rather than becoming zero.

“Application Job queue” reads persisted active Jobs. Inspect queued and running states and Job identifiers. Select an identifier to return to its Project. Reload reads the same Job from the server. This snapshot does not describe all native GPU occupancy. A recorded running Job identifier is provided only when exactly one running Job is recorded. Native occupancy without a reading stays unknown.

“Runtime versions” shows actual observations. “Revisions and verification sources” lists each model’s registered repository, revision, file, SHA256 and weights license. Registered code revisions describe requirements; they do not establish the current checkout. Weights and code licenses remain separate.

## Recover and continue creating {#recover}

For missing or incomplete models, ask the environment owner to prepare the registered weights and verify the complete files. Preserve invalid files, then check the correct revision and hash. Restore a disconnected inference service first. Retain original verification while the process/listener, source and model files remain unchanged. After a change, restore actual conditions and obtain matching evidence. Saving or rereading a record does not renew its original verification time.

A failed application read shows an error and “Read state again.” It does not become an empty queue or retain an old green readiness state. Restore the connection and check again, then return to “A walk after the rain” with the same Assets and creative goal. Do not submit duplicate Jobs while diagnosing readiness.

## Understand Settings {#settings}

Open `/settings` in the formal Web app. Read the current creation scope first, then consult “Application configuration reference” when needed. Fields, environment variable names, defaults and rules come from the API’s Settings metadata.

**These are declared defaults, rather than the current process configuration.** The launch environment can override them. The current API does not expose effective overrides or configuration writes. This page is read-only and cannot save server configuration. Audio acceptance limits do not mean every audio file supports transcription; creation forms and the server still validate the supported inputs.

Use the common language and light/dark controls at the top of the workbench. Preferences survive navigation and reload. See the [application configuration reference](../reference/settings.en.md) and [Runtime API guide](api-runtime-diagnostics.en.md) for environment details.

<details>
<summary>Isolated browser verification</summary>

Prepare pnpm dependencies and the independent `services/api` uv environment, then run from the repository root:

```powershell
pnpm web:check
pnpm test:browser:check
pnpm --filter @llm-music/browser-tests exec playwright test --config web.playwright.config.ts runtime.web.ts
pnpm --filter @llm-music/browser-tests exec playwright test --config runtime.playwright.config.ts
```

The first group uses production FastAPI and the existing CPU Fake Runtime to cover four language/theme combinations and genuine unknown readings. The second injects explicit CPU source observations at the Runtime seam to cover model states, missing readings, expiration, disconnection, empty/loading views, HTTP recovery and application Job identity. It does not replace production HTTP responses, measure a GPU or perform music inference. Tests own separate ports, data and processes and require graceful shutdown receipts. Real GPU readings are verified separately at the phase gate.

</details>
