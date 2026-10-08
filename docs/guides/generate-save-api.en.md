# Generate and save a song through the application API

Generate playable Audio and an inspectable Score from style, lyrics, and seed, or pass explicitly selected ABC to GenerateFromScore. A successful generation creates a Candidate; explicit save creates a Version. This is an optional API guide; scores in the formal Web remain read-only. Default fake mode uses original CPU fixtures and cannot prove model quality.

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

## Generate from a selected Score {#selected-score}

Keep the same Morning song Project. Download ABC from a generated or transcribed Score, copy it to a new file, and change one note. Retain the native `Vocal` / `Ins` two-voice header, complete bars and meter. General ABC that renders in a browser is not necessarily supported by the pinned inference plugin. Compare the [minimal native ABC](../../workflows/generate-from-score/v1/example.abc). This operation accepts only the plugin's two-voice dialect, with notes in at least one voice. A transcription with rests throughout Vocal and melody in Ins is also supported.

For example, change `D4` to `F4` in a downloaded Score and save it as `data/morning-selected.abc`. Inspect and listen to the Score, then explicitly select this file. This command reuses the Project and source Score to create a new Audio Candidate:

```powershell
uv run --project services/api --no-sync python services/api/examples/generate_save.py from-score --project-id <PROJECT_ID> --source-score-id <SOURCE_SCORE_ID> --abc-file data/morning-selected.abc --parent-version-id <SOURCE_VERSION_ID> --style "gentle folk pop" --lyrics-file data/morning-lyrics.txt --seed 2026410001 --output-dir data/morning-score-candidate-01
```

`SOURCE_SCORE_ID` comes from the original Candidate's `score_id` or the transcription Job result. When starting from a saved Version, `SOURCE_VERSION_ID` must be the same-Project Version that owns this Score. Omit `--parent-version-id` when starting only from a transcribed Score. The command preserves the original Score, Assets and Version, and does not save a new Version automatically. Listen to the new `audio.flac` and judge whether the melody edit and style are worth keeping.

The request is `POST /projects/{project_id}/jobs/generate-from-score`. It contains `abc`, `source_score_id`, optional `parent_version_id`, and Generate's style, lyrics, seed and `max_seconds=35`. ABC has a 100000-character limit. Source Score and parent must belong to this Project. Invalid or unsupported ABC is rejected before a Job is created. A missing capability is rejected explicitly; the operation cannot fall back to ordinary Generate.

Job and Candidate `inputs.abc` retain the request text. `provenance.selected_score` records its hash, `effective_abc`, the effective input hash, transformations and adapter version. The pinned plugin replans when an internal `%yue2-words` marker does not match, and rearranges bare scores without section comments. Version 1 removes matching internal markers and adds a neutral section comment to bare scores, preserving notes, bars, meter, tempo, voices and chords. Existing generated and transcribed scores with sections need no such conversion. The record distinguishes the original and actual inference text. It does not promise identical audio before and after comment processing.

Editing the local file after queueing or running cannot change the submitted Job. For another edit, select valid ABC again and explicitly submit a new Job. The output Score must equal the effective submitted text. Audio still receives complete FLAC validation. Failed output cannot become a Candidate or Version.

## Explicitly save a Version

A GenerateFromScore Candidate retains its submitted source parent. Omit parent on save and the application still uses that parent. An explicitly different parent returns `409 source_parent_mismatch`. Inspect ABC and parent in the new Version, then read the original Version again to verify that both creative results remain.

Replace placeholders with the preceding output:

```powershell
uv run --project services/api --no-sync python services/api/examples/generate_save.py save --project-id <PROJECT_ID> --candidate-id <CANDIDATE_ID> --name "First morning"
```

This sends `POST /projects/{project_id}/versions`. Add `--parent-version-id <VERSION_ID>` to branch from an existing Version in the same Project. Save copies the Candidate's inputs, provenance, and output snapshot. Later generation preserves earlier snapshots and Assets. Trimmed names must be nonempty and contain at most 200 characters.

First save returns `201`. Repeating the same Candidate, name, and parent returns `200` with the same Version, including concurrent requests. A changed name or parent for a saved Candidate returns `409 version_already_saved` with the existing Version id. Generate another Candidate for a new save intent.

List `GET /projects/{project_id}/versions`, or read `/versions/{version_id}`. Download Audio or ABC through the application Asset `/content` address. Stop and restart the API using the same data directory to read history. Application files do not depend on temporary inference outputs.

## Recover from failures and use real Runtime

- `422 invalid_request`: correct empty inputs, seed, or unsupported fields, then submit.
- `422 score_invalid`: retain the edit file, correct the native header, notes or incomplete bars, then select it again. Rendering general ABC does not replace native inference validation.
- `503 capability_missing`, `404 score_not_found` / `parent_version_not_found`, `409 source_parent_mismatch`: check current capability and select related sources from this Project. `score_result_mismatch` means Runtime output replaced the selected Score. Retain the failed Job and snapshot, check the mapping, then explicitly retry.
- Failed Job: read its error and recovery_required and retain that Job. Missing outputs, invalid Score, incomplete FLAC, or unconfirmed outputs cannot create Candidate/Version. Check original work through the [restart recovery guide](job-recovery.en.md). When a new attempt is needed, confirm a safe terminal outcome and explicitly retry using [cancellation and retry](api-cancel-retry.en.md). Inference is not repeated automatically.
- `404 candidate_not_found` / `parent_version_not_found`: choose a Candidate or saved parent from the target Project. Cross-Project references cannot be saved.
- `503 version_commit_unconfirmed`: first query Version using the error's `resource_id`. For a repeat save of a known Version, that id still identifies the existing Version when both acknowledgement and independent readback fail. Read it if present. If absent, restore database access and retry the same Candidate, name, and parent. Unconfirmed saves preserve existing Assets and snapshots.
- `409 asset_unavailable` / `asset_path_invalid`: restore the original application file or backed-up mapping. Runtime paths cannot replace application ids.

The GPU resource owner validates real generation on the fixed Runtime that passed P0. Set `MUSIC_API_RUNTIME_MODE=comfyui` and `MUSIC_API_RUNTIME_EVIDENCE_PATH` to a fresh owner receipt, and use a separate application directory. Collect or refresh the receipt through [Runtime diagnostic evidence sources](../reference/runtime-evidence.en.md); historical Doctor reports cannot replace the current receipt. Reuse [Runtime preparation](runtime-doctor.en.md) and the verified [short-song Workflow](api-generation.en.md). CPU fixture checks do not replace real Runtime acceptance.

The complete HTTP example comes from version-controlled source:

<<< ../../services/api/examples/generate_save.py

Continue with [style, lyrics, and seed ideas](../learn/variations.en.md), or look up the [API contract reference](../reference/api.en.md) and [application configuration](../reference/settings.en.md) when needed. See [the maintenance record](../verification/generate-save-api.md) for actual checks and limits. The documentation site and repository bodies share one source.
