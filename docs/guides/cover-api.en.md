# Inspectable Cover API

Follow the [creator tutorial](../learn/cover.en.md) to obtain an explicitly selected saved transcription/edit Score. These HTTP routes belong to FastAPI. Generated client types and reference pages share Pydantic/OpenAPI. The API needs no Torch; actual transcription/generation still requires the ready single-GPU Runtime.

## Create Reference from the actual Version {#reference}

`POST /projects/{project_id}/reference-audio/from-version` accepts same-Project source_version_id and stable UUID save_id. First creation returns201 AssetRead; identical replay returns200 and the same Asset. Another source under that id returns409 reference_save_conflict. It extracts the actual Version.audio_asset_id's first16 seconds into768000-frame PCM16 stereo48k WAV. Original FLAC remains; no Job, Candidate or Version is created. There is no arbitrary parent or interval request field.

`GET /projects/{project_id}/assets/{asset_id}/reference-origin` returns source Version, source Audio Asset, original SHA256, start_frame0, frame_count768000, sample_rate48000 and derivation_version1.0.0. Uploaded Reference returnsnull; existing AssetRead shape is unchanged. Foreign Project, missing/corrupt source and changed hash reject conversion.

Submit this Reference id through existing `/transcriptions`. The frozen origin gives its successful Score the true source Version parent. Uploads retain the supported16-second PCM16 profiles and have no parent. Independent Score edits inherit that lineage without relaxing existing GenerateFromScore checks.

## Inspect effective input before submission {#selection}

Save the inspected edit through `/scores` and use its actual new Score id. Cover requires request abc to match that immutable saved file exactly.

CPU-only `POST /projects/{project_id}/cover-inputs/validate` accepts abc and mode="melody" or "full". It creates no persistent object or inference. The response includes original hash, effective_abc/hash, transformations, adapter/parser, mode_transform_version1.0.0, source chord count and warnings. Adaptation removes recognized internal control markers and guards bare sections. Melody omits chords from parsed music lines; full retains written chords. Both retain voices and musical events. Chordless full returns full_without_written_chords: input is legal but has no explicit harmony guidance. Inspect, explicitly select and submit full if desired.

`POST /projects/{project_id}/jobs/cover` takes CoverCreate: Generate/GFS style, lyrics, seed, max_seconds (0–360; 0 follows the lyrics), abc, source_score_id, parent_version_id plus reference_asset_id, mode, effective_abc_sha256 and mode_transform_version. Mode accepts melody/full. Digest/revision must match the inspected effective input; the application does not silently select another input.

The saved Score chain must belong to the same Project, reference that exact Reference and end at its completed Transcribe Job. Parent must be the actual Reference source Version ornull for an upload. An arbitrary same-Project parent is insufficient. After Reference, source Score or draft changes, inspect/select again even if text is identical.

## Run, inspect and explicitly save {#result}

Submission returns202 JobRead/operation Cover. Existing Job HTTP/WS, cancel and retry use the same serial queue. Cover supported_modes in `/runtime/capabilities` is the intersection of observed cot choices and registered modes. Full alone permits explicit full submission; melody alone permits explicit melody submission. No usable mode, an absent chosen mode, stale observations, revision mismatch or missing models reject before scheduling. There is no mode/Generate fallback.

Job/Candidate retains the original request. Provenance freezes actual cot=melody or cot=full matching mode, original/effective ABC/hashes/revisions and the Reference→original transcription→saved edit source chain. New Jobs use Cover registry2.0.0. Shipped1.0.0 definitions and historical snapshots remain; restart uses the original frozen proof. Result Score must match the frozen effective hash. Only complete FLAC decode and application import create a Candidate; explicit `/versions` save retains the submitted parent. Historical records and files remain.

## Failure and unknown acknowledgements {#recover}

- score_invalid / cover_selection_mismatch: keep text, repair, save and inspect/select again. cover_source_mismatch / source_parent_mismatch requires the actual origin chain.
- capability_missing / model_missing: recheck selected mode/resources, without substituting an operation.
- Unknown initial Cover POST acknowledgement: read Project Jobs and actual input. Initial generation has no public idempotency key and cannot be automatically resent.
- failed/cancelled: intermediate Score remains. After confirming safe native terminal ownership, existing `/jobs/{id}/retry` creates a new Job from original mode/source/ABC, without another transcription.
- reference_commit_unconfirmed: read resource_id Asset/origin, or explicitly replay the same save_id/source Version. Precommit failure cannot leave successful metadata without a file.
- Score mismatch, import or inference failure creates no new Candidate/Version. References, intermediates and earlier work remain. Restart reads original frozen proof; it cannot rebuild from a newer registry and resubmit.

Read the [API contract reference](../reference/api.en.md) for complete fields and limits. CPU checks and real GPU acceptance are reported separately; symbolic equality does not establish acoustic note/harmony fidelity.
