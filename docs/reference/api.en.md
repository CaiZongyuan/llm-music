Look up HTTP parameters, responses, errors, and the Job event message schema for advanced operations. The contract blocks and TypeScript client read the same FastAPI / Pydantic OpenAPI export. Generation does not connect to Runtime.

## Start with a usage guide {#usage}

- [Generate, inspect a Candidate, and explicitly save a Version](../guides/generate-save-api.en.md)
- [Transcribe Reference Audio and export ABC/MIDI](../guides/api-transcription.en.md)
- [TypeScript client and the complete controlled example](../guides/api-client.en.md)
- [Job events and HTTP recovery](../guides/api-job-events.en.md)

Replace Project, Asset, Job, Candidate, and Version ids with values returned by the application. The contract below specifies download media types, multipart input, required values, and validation constraints. Each `$ref` points to the schema index. Use the exported response structure for errors. Business error codes are open strings; see the relevant guide for usage and recovery.

## Sources and capability boundaries {#source}

The [export entrypoint](../../services/api/src/music_api/cli.py) and [HTTP/event contract](../../services/api/src/music_api/contracts.py) are the sources of truth. The [configuration reference](settings.en.md) describes upload budgets and Runtime modes; file budgets do not establish inference duration. See [current capabilities](../learn/scope.en.md) for creative operations and stage limits. This reference does not send requests, save Versions, or renew diagnostic evidence.

<<< @openapi
