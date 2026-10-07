# Use the generated TypeScript API client {#api-client}

This is a secondary guide for maintainers and client developers. Music creation tutorials remain the main documentation entry. The current client uses FastAPI to create Projects, upload Reference Audio, track Jobs, inspect Candidates and explicitly save Versions. It does not connect to ComfyUI.

## Prepare the independent environment {#prepare}

Run from the repository root. Use Node 24.18.0, pnpm 11.22.0, uv 0.11.28 and Python 3.12.13. FastAPI and Runtime retain separate environments and lockfiles.

```powershell
pnpm install --frozen-lockfile
uv sync --project services/api --locked --python 3.12.13
pnpm client:check
pnpm --filter @llm-music/api-client build
```

`client:check` runs `music-api openapi` in two isolated directories, compares the generated output with the versioned [schema.ts](../../packages/api-client/src/schema.ts), then checks TypeScript. Export does not create an application database, start Runtime or read models. A failed generation prints the retained temporary evidence directory. After changing the Pydantic contract, run `pnpm client:generate`, commit and review its generated diff.

## Get an inspectable result {#first-result}

First start an isolated fake API in one terminal:

```powershell
$env:MUSIC_API_RUNTIME_MODE = "fake"
uv run --project services/api --no-sync music-api serve --data-dir data/client-example-fake --port 8000
```

In another terminal run the complete [generate-and-save example](../../packages/api-client/examples/generate-save.ts):

```powershell
node packages/api-client/dist/examples/generate-save.js --base-url http://127.0.0.1:8000 --expect-mode fake --output-dir data/client-example-output-01
```

The example creates a Project, submits Generate once, reads the Candidate and Score, downloads audio and ABC, checks SHA256 and byte counts, then explicitly selects this Candidate and saves one Version. The terminal returns actual application ids. The new output directory retains `receipt.json`, `song.flac` and `score.abc`. Fake audio is a test tone; it does not demonstrate music quality or real inference. The command refuses to overwrite an existing output directory.

Real Runtime first requires [application diagnostics](api-runtime-diagnostics.en.md) and a separate real data directory. Only the GPU resource owner performs real inference. The example's `--expect-mode comfyui` requires the connected FastAPI to report that mode and readiness. This option does not start Runtime or refresh readiness receipts.

<<< ../../packages/api-client/examples/generate-save.ts

## Requests and results {#requests}

The [client entry](../../packages/api-client/src/index.ts) only provides typed `createMusicClient`, `jobEventsUrl` and aliases from the generated schema. Project, Asset, Job, Candidate, Version and diagnostic types come from `components`; HTTP paths and methods come from `paths`.

| Operation | Transport and checks |
| --- | --- |
| Upload | `POST /projects/{project_id}/assets`; generated `file` is a Blob. Use a native File and FormData with this request's `bodySerializer`; let fetch set the boundary instead of writing Content-Type. |
| Transcribe | Current support is 16-second PCM16 mono24k or stereo48k. Successful upload does not prove support for arbitrary 600-second inference. After completion, read the Score, ABC and MIDI application ids returned by the Job. |
| Download | Use `parseAs: 'arrayBuffer'` or `'blob'`. Success MIME can be WAV, FLAC, ABC or MIDI. Check byte count and SHA256 against Asset metadata. Failed responses still return typed JSON `error`. |
| Cancel and retry | Both POSTs have no body. Cancel may return 202 intent or 200 terminal state; keep reading the original Job. Explicit retry returns 202 and a new Job. The client never retries automatically. |
| Save | A Candidate does not automatically become a Version. The first explicit save returns 201; repeating a save for that Candidate returns 200 and the existing Version id. |
| Error | Read `response.status` and `error.error.code/message/recovery`. Error codes are open strings. A network failure throws a transport error instead of fabricating a domain 503. |

The current server accepts JSON integer `seed` from 0 through 2^63−1. JavaScript Number can represent only 0 through `Number.MAX_SAFE_INTEGER` (2^53−1) exactly. Client callers must choose a nonnegative safe integer; the example uses `2026192201`. This release has no string-seed contract and does not promise exact JSON numbers above the safe range.

## Recover lost events and failures {#recovery}

`jobEventsUrl(baseUrl, projectId, jobId)` derives the URL from the registered WebSocket route and preserves an application deployment prefix. FastAPI's OpenAPI `x-websockets` describes this channel and its Pydantic `JobEventRead` payload. Generated TypeScript types do not validate arbitrary WebSocket JSON. Clients that face an untrusted service still need runtime validation at that boundary.

A connection first receives a persisted Job snapshot; later messages use `job.updated`. `sequence` orders events in the current process and is not a durable replay cursor. After losing a connection, first `GET /projects/{project_id}/jobs/{job_id}`, then reconnect. A terminal connection sends the same durable result and closes. A missing Job or a Job in another Project is rejected during upgrade; its current HTTP status is 403.

On example failure, retain the Project/Job ids in the receipt and read the original Job. Correct invalid inputs; restore readiness when Runtime is unavailable; inspect the original task after a wait or connection failure. POSTs are never sent again automatically, which prevents duplicate generation. Completed data remains readable after API restart. Active Job recovery remains governed by [the #25 recovery delivery](https://github.com/CaiZongyuan/llm-music/issues/25) and its stage evidence.

## Verify without a GPU {#cpu-checks}

```powershell
pnpm test:client
```

This command compiles a real Node consumer and sends native fetch, FormData and WebSocket requests to production FastAPI on an isolated port. The inherited Fake Runtime only controls completion, failure and cancellation timing. It does not replace business HTTP routes. Checks cover both loops, queue/current Job, file hashes, explicit 201/200 save, cancel/retry, 404/409/422/503, disconnect recovery and completed data reopen. Tests own their API processes and data and never connect to the retained Runtime 8188.

Default evidence is under `packages/api-client/.artifacts/`. Set `MUSIC_CLIENT_ARTIFACTS` for an isolated directory. Each run retains the port, actual API leaf PID, creation time, process logs and stop receipt. Completed data remains after a graceful API stop. This CPU result cannot replace P1 real GPU smoke. The P1 gate still waits for actual integration and all stage acceptance.
