# Create a Project and persist reference audio

The local application API now creates, lists and reads Projects, and uploads, lists, reads and downloads their Reference Audio. The application owns durable files; the same ids remain readable after an API restart. This first P1 path uses an independent CPU environment.

## Get the first result

Work from the repository root. Install Python 3.12.13 and the independent application dependencies, then start the API:

```powershell
uv sync --project services/api --locked --python 3.12.13
uv run --project services/api --no-sync music-api serve --data-dir data/application --port 8000
```

The default bind is `127.0.0.1`. Open `http://127.0.0.1:8000/docs` for Swagger; `/openapi.json` is the current contract. In a second terminal, run the complete example:

```powershell
uv run --project services/api --no-sync python services/api/examples/project_upload.py --output-dir data/project-upload-example
```

The example directory must be absent. The example creates an original CC0 16-second, 24 kHz mono PCM WAV, creates the **Morning song** Project, uploads the file, downloads it and compares every byte. Output is `reference.wav`, `downloaded.wav` and `receipt.json`; ids are saved immediately after each create/upload response. It writes actual Project/Asset data to the running API. Complete source: [project_upload.py](../../services/api/examples/project_upload.py).

Read metadata using the receipt's ids:

```powershell
$receipt = Get-Content -Raw data/project-upload-example/receipt.json | ConvertFrom-Json
Invoke-RestMethod "http://127.0.0.1:8000/projects/$($receipt.project.id)"
Invoke-RestMethod "http://127.0.0.1:8000/projects/$($receipt.project.id)/assets/$($receipt.asset.id)"
```

Stop the API and reopen it with the same launch command and `--data-dir`. These queries and `/projects/{project_id}/assets/{asset_id}/content` must return the original objects and audio. Do not rerun the whole example to check restart; that would create another Project/Asset.

## Current HTTP contract

| Operation | Route | Result |
| --- | --- | --- |
| Create Project | `POST /projects`, JSON `name` and optional `description` | `201`, application UUID, name, description and UTC creation time. |
| List/read Project | `GET /projects`; `GET /projects/{project_id}` | `200`. |
| Upload Reference Audio | `POST /projects/{project_id}/assets`, multipart `file` | `201`, Asset UUID and actual audio facts. |
| List/read Asset | `GET /projects/{project_id}/assets`; its `/{asset_id}` | `200`, metadata owned by the same Project. |
| Download original | `GET /projects/{project_id}/assets/{asset_id}/content` | `200 audio/wav`, original uploaded bytes. |

Project names are trimmed and have 1–200 characters; descriptions have at most 2000. Asset metadata contains `kind=reference_audio`, actual `format=wav`/`media_type=audio/wav`, the original name's filename portion, size/SHA256, duration/channel/rate/sample-width and creation time. Filename/MIME does not determine actual format or storage path. The application exposes its ids, not filesystem locations.

Current support is nonempty, complete mono/stereo PCM WAV: 8-, 16-, 24- or 32-bit integer samples at 8–192 kHz. The tool reads all PCM frames and rejects truncated or unsupported content. Default policy is 64 MiB per file and 600 seconds of audio; these are application upload budgets, not verified model duration capabilities. The full multipart request has an additional 64 KiB framing/field allowance, including requests without Content-Length. Set `MUSIC_API_MAX_UPLOAD_BYTES` and `MUSIC_API_MAX_AUDIO_SECONDS` before startup to change policy; both must be finite and positive.

The application creates `--data-dir/app.sqlite` and `--data-dir/assets/`. SQLAlchemy 2/Alembic own metadata and SQLite WAL transactions; original files stay in application storage. The default data-dir is repository `data/`, or `MUSIC_API_DATA_DIR`; the CLI argument takes precedence. Keep the same configuration and back up database and Asset files together. Clearing Runtime temporary source files does not affect successful imports. The upload path still preserves original content. See the [application transcription guide](api-transcription.en.md) for Job/Score, and the [generation and saving guide](generate-save-api.en.md) to inspect a Candidate and explicitly save a Version. Current operations use the application API; the product Web app is delivered in P2.

## Failure and recovery

Errors return `{ "error": { "code", "message", "recovery", "resource_id" } }`. Development paths and exception details are retained in service logs.

| Condition | Response and action |
| --- | --- |
| Invalid parameters/broken audio | `422 invalid_request` or `invalid_audio`; correct parameters or export a supported complete PCM WAV. |
| Budget exceeded | `413 upload_too_large` or `audio_duration_exceeded`; use smaller/shorter audio or have the owner explicitly change policy. |
| Missing Project/Asset or cross-Project reference | `404 project_not_found` / `asset_not_found`; choose an Asset from that Project. |
| Missing/incomplete prior file or invalid mapping/path | `409 asset_unavailable` / `asset_path_invalid`; restore original file/metadata from backup. Listing also reports unreadable stored content explicitly. |
| File write or confirmed uncommitted metadata failure | `503 asset_write_failed` / `asset_persistence_failed`; restore application storage/database access, then retry explicitly. |
| Denied file read or unavailable metadata | `503 asset_storage_unavailable` / `metadata_unavailable`; have the owner restore read permissions or database access, then query the original id. |
| Unconfirmed commit acknowledgement/result | `503 asset_commit_unconfirmed`; retain the file and query the same Project's `resource_id` and content before retrying. |
| Failed file compensation | `503 storage_cleanup_failed`; query the id first, retain logs and have the owner recover this attempt's isolated files. |

Files and database do not share an atomic transaction. Each upload uses private staging, complete validation, exclusive new-file creation, fsync and metadata commit. Delete this attempt's final only after confirmed rollback and a fresh connection establishes no durable row. Retain files if committed or uncertain. The tool never overwrites an older Asset or performs global deletion/GC. A process crash before commit can leave an unregistered file; retain it and reconcile logs instead of deleting the storage directory.

Initial startup applies the current application migrations to an empty database; explicit SQLite transactions cover DDL too. After a migration failure, repair the underlying cause and start again. Back up the whole application data directory before upgrading. Repeated startup preserves data; see the [restart recovery guide](job-recovery.en.md) for active Jobs. Unsupported schema revisions fail startup/migration while preserving files; restore a compatible version or full backup rather than stamping past migrations.

## Independent checks and contract export

```powershell
uv run --project services/api --no-sync python -m pytest services/api/tests -q
uv run --project services/api --no-sync mypy --config-file services/api/pyproject.toml services/api/src/music_api
uv run --project services/api --no-sync music-api openapi --output data/api-openapi.json
```

OpenAPI is exported from Pydantic without initializing storage, database, models or Runtime. `music-api migrate --data-dir data/application` upgrades the currently supported schema separately. Tests use isolated temporary SQLite/storage and real API subprocesses to verify persistence and compensation. See the [verification record](../verification/api-project-audio.md).
