# Generate and save a song through the application API

Generate playable Audio and an inspectable Score from style, lyrics, and seed. A successful generation creates a Candidate; explicit save creates a Version. This is the P1 HTTP/Swagger flow. Default fake mode uses original CPU fixtures and cannot prove model quality.

## Start the independent API

Run from the repository root. FastAPI owns its uv environment and lockfile and requires no Torch, CUDA, or running ComfyUI.

```powershell
uv sync --project services/api --locked --python 3.12.13
$env:MUSIC_API_RUNTIME_MODE = "fake"
uv run --project services/api --no-sync music-api serve --data-dir data/application-fake --port 8000
```

Open `http://127.0.0.1:8000/docs`. The application saves SQLite and Asset files in the selected directory. Use that same directory after restart. Use separate directories for fake and comfyui; an existing directory cannot change its mode.

## Generate and inspect a Candidate

In another terminal at the repository root, create a UTF-8 lyrics file such as `data/morning-lyrics.txt`:

```text
[Verse]
Morning gathers on the window
Let the quiet carry us home
```

Run the complete example. It creates a Project and submits Generate. Pass `--project-id <PROJECT_ID>` to reuse a Project. Use a new output directory.

```powershell
uv run --project services/api --no-sync python services/api/examples/generate_save.py generate --style "gentle folk pop" --lyrics-file data/morning-lyrics.txt --seed 2026192201 --output-dir data/morning-candidate-01
```

The terminal prints `project_id` and the Candidate. The download directory contains `audio.flac` and `score.abc`. Listen and inspect the Score before choosing to save. Fake Audio is an identified test tone. This command does not create a Version.

The HTTP request is `POST /projects/{project_id}/jobs/generate`. Trimmed style and lyrics must be nonempty and contain at most 1024 and 10000 characters. Seed must be an integer from 0 to `2^63−1`. `max_seconds` supports only 35. Only this short-song profile is verified.

The request returns `202` and an application Job id. Read `GET /projects/{project_id}/jobs/{job_id}`. The five states are queued, running, completed, failed, and cancelled. A successful result contains `candidate_id`, `audio_asset_id`, `abc_asset_id`, and `score_id`. The application marks completed only after Score validation, full FLAC decoding, and whole-output-set import.

List Candidates with `GET /projects/{project_id}/candidates`, or read `/candidates/{candidate_id}`. A Candidate retains inputs, execution settings, Workflow/Runtime provenance, and output facts. G35 currently requires PCM16 FLAC, 48 kHz stereo, 30–40 seconds, and agreement between all decoded frames and the STREAMINFO declaration. Legal streaming FLAC with a zero declared sample count cannot yet be confirmed under this verified profile.

## Explicitly save a Version

Replace placeholders with the preceding output:

```powershell
uv run --project services/api --no-sync python services/api/examples/generate_save.py save --project-id <PROJECT_ID> --candidate-id <CANDIDATE_ID> --name "First morning"
```

This sends `POST /projects/{project_id}/versions`. Add `--parent-version-id <VERSION_ID>` to branch from an existing Version in the same Project. Save copies the Candidate's inputs, provenance, and output snapshot. Later generation preserves earlier snapshots and Assets. Trimmed names must be nonempty and contain at most 200 characters.

First save returns `201`. Repeating the same Candidate, name, and parent returns `200` with the same Version, including concurrent requests. A changed name or parent for a saved Candidate returns `409 version_already_saved` with the existing Version id. Generate another Candidate for a new save intent.

List `GET /projects/{project_id}/versions`, or read `/versions/{version_id}`. Download Audio or ABC through the application Asset `/content` address. Stop and restart the API using the same data directory to read history. Application files do not depend on temporary inference outputs.

## Recover from failures and use real Runtime

- `422 invalid_request`: correct empty inputs, seed, or unsupported fields, then submit.
- Failed Job: read its error and recovery_required and retain that Job. Missing outputs, invalid Score, incomplete FLAC, or unconfirmed outputs cannot create Candidate/Version. Check original work through the [restart recovery guide](job-recovery.en.md). When a new attempt is needed, confirm a safe terminal outcome and explicitly retry using [cancellation and retry](api-cancel-retry.en.md). Inference is not repeated automatically.
- `404 candidate_not_found` / `parent_version_not_found`: choose a Candidate or saved parent from the target Project. Cross-Project references cannot be saved.
- `503 version_commit_unconfirmed`: first query Version using the error's `resource_id`. For a repeat save of a known Version, that id still identifies the existing Version when both acknowledgement and independent readback fail. Read it if present. If absent, restore database access and retry the same Candidate, name, and parent. Unconfirmed saves preserve existing Assets and snapshots.
- `409 asset_unavailable` / `asset_path_invalid`: restore the original application file or backed-up mapping. Runtime paths cannot replace application ids.

The GPU resource owner validates real generation on the fixed Runtime that passed P0. Set `MUSIC_API_RUNTIME_MODE=comfyui` and `MUSIC_API_RUNTIME_EVIDENCE_PATH` to a fresh owner receipt, and use a separate application directory. Collect or refresh the receipt through [Runtime diagnostic evidence sources](../reference/runtime-evidence.en.md); historical Doctor reports cannot replace the current receipt. Reuse [Runtime preparation](runtime-doctor.en.md) and the verified [short-song Workflow](api-generation.en.md). CPU fixture checks do not replace real Runtime acceptance.

The complete HTTP example comes from version-controlled source:

<<< ../../services/api/examples/generate_save.py

Continue with [style, lyrics, and seed ideas](../learn/variations.en.md), or look up the [API contract reference](../reference/api.en.md) and [application configuration](../reference/settings.en.md) when needed. See [the maintenance record](../verification/generate-save-api.md) for actual checks and limits. The documentation site and repository bodies share one source.
