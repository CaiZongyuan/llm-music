Creator tutorials focus on results. Consult preparation, Doctor, API, and development material here when you need it. Existing guides remain accessible.

## Prepare the actual entrypoint first {#prepare}

<p>If you or your operator already maintain a ready local environment, continue directly to creator tutorials. For first use, prepare the Runtime, models, and application API. You need Git, uv, and a supported NVIDIA GPU. Existing guides provide complete commands, pinned versions, and recovery steps.</p><p>Real mode uses a separate application data directory and a fresh owner receipt. Do not switch a fake Project directory into real mode. Fake is for practicing application behavior and produces no model music.</p>

- [Environment, models, Doctor, and Runtime launch](../guides/runtime-doctor.en.md)
- [Local Web launch, Projects and Reference Audio](../guides/web-workspace.en.md#launch)
- [Start the local workbench with one command](../guides/dev-launcher.en.md)
- [Application API launch and generate/save operations](../guides/generate-save-api.en.md)
- [Real Runtime diagnostic receipts and refresh](../reference/runtime-evidence.en.md)

## Find help for the task that failed {#help}

- [Upload formats, budgets, and Asset recovery](../guides/api-project-audio.en.md)
- [Web Job cancellation, explicit retry and reconnect recovery](../guides/web-jobs.en.md)
- [Transcription profiles and ABC/MIDI results](../guides/api-transcription.en.md)
- [Cancellation, explicit retry, and errors](../guides/api-cancel-retry.en.md)
- [Live phases and the same Job after disconnect](../guides/api-job-events.en.md)
- [Runtime and model readiness](../guides/api-runtime-diagnostics.en.md)

## For development or deeper control {#advanced}

<p>Current Swagger is at <code>/docs</code> on your running application address. <code>/openapi.json</code> is the API contract. Source and architecture material support integration and maintenance; they are not required chapters in the creator tutorial. Links below are pinned to the current API baseline.</p>

- [Architecture and domain boundaries](architecture.en.md)
- [Source: existing generate/save CLI](../../services/api/examples/generate_save.py)
- [Source: public generation and save parameters](../../services/api/src/music_api/generation_schemas.py)
- [Running and maintaining the docs site](../guides/documentation.en.md)

## Return to your creative task {#back}

<p><a href="./first-music.en.md">Make your first music →</a> · <a href="./reference.en.md">Start with Reference Audio →</a> · <a href="./variations.en.md">Explore an idea →</a></p>

## Complete existing CLI source {#cli-source}

<details class="creator-supplement"><summary>Optional: inspect the generate/save tool</summary>

<<< ../../services/api/examples/generate_save.py

</details>
