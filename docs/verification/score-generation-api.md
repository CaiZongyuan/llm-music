# Issue #41 — selected Score generation

Baseline: `711df508dd0edead070f4345a7b23eb9c6834e77`. The owned branch is
`p3/41-generate-from-score`. This adds the GenerateFromScore application HTTP
operation, versioned registry mapping, source validation and snapshots,
Candidate registration, retained parent on explicit save, migration 0006,
generated client, existing Web reader compatibility and paired API guides.
It does not implement the formal Score editor.

## Contract and native source facts

`POST /projects/{project_id}/jobs/generate-from-score` takes explicit ABC,
style, lyrics, seed, the fixed 35-second profile, an existing same-Project
source Score and an optional same-Project Version that owns that Score.
Job inputs retain original ABC; provenance separately retains effective ABC,
both hashes, transformations and adapter version. Candidate and Version copy
these durable snapshots. No output creates a Version automatically.

The pinned plugin `fc78df9dfb214f396aa281f5b03519cefff5b00a` registers
`YuE2GenerateSong.score_abc` as an optional STRING input. Native capability
readiness checks this input descriptor, not only the node name. The graph
keeps cot=full, transpose=0 and the existing BF16/offload/standard-VAE G35
settings. Business requests contain no node ids.

Pinned `nodes.py:394–459`, `edits.py:112–151`, `phrasing.py:193–196,496–560`
and `generate.py:446–465` establish two native behaviors: an incompatible
words marker discards an edit and replans; a bare tune may be rearranged
around lyrics. Adapter v1 removes only matching internal words marker lines
and adds a neutral section comment to bare native scores. It preserves
musical lines. The original ABC remains independently readable. Comments
are tokenized by inference, so symbolic preservation does not imply identical
audio before and after adaptation.

The unchanged Apache-2.0 native `abc_tools.py` parser is vendored with license,
source notice and a typed public stub. It runs on the CPU API environment,
without Torch, Runtime imports or model loading. It fails closed for
unsupported native tokens, missing groups, incomplete bars and voice grid
errors. Notes are counted across both voices. The real T16 sample with no
Vocal notes and 32 Ins notes remains valid.

Read-only local source probes used the retained real G35 and T16 artifacts.
Both already have section comments and no words marker, so neither needs
adapter comment changes. Removing G35 sections triggers native phrasing;
adding the neutral guard prevents it and the pinned symbolic comparison
retains both voice notes, bar grids and tempo. A CPU capture of the pinned
node and `generate.run` method bodies also rejects any planning or
transposition call and returns effective ABC unchanged for G35, T16, bare
G35 and marked G35. These are source/capture facts, not model execution.
The probe files are retained in the author worktree's
`.scratch/41-source-probe/`.

## Public CPU verification

The initial public red was an absent endpoint (405 instead of the required
422). The immutable-input slice then failed because a generic fake result
returned an unrelated ABC. Both counterexamples were resolved through the
production route and shared Job/import path.

Focused HTTP checks cover invalid native ABC, foreign Score/parent,
parent-to-Score mismatch, unavailable capability without Generate fallback,
queued/running cancellation, explicit retry with the original inputs,
wrong output Score, corrupt FLAC, source metadata override, bare/marked ABC,
and Upload→Transcribe→selected ABC→Candidate. Running input snapshots and
saved original Versions/Assets remain unchanged. The output oracle uses the
frozen effective hash; Runtime result metadata cannot replace the selected
input snapshot.

The native CPU HTTP peer verifies the actual adapter binding, original FLAC
extraction and an active API stop/restart. The accepted request count remains
two (one source Generate and one selected generation); recovery does not
submit again. The application imports playable-format PCM16 stereo 48k FLAC,
then explicitly saves with the submitted parent. This peer is identified
synthetic CPU evidence.

A real process running archived baseline 711 creates Generate, uploaded
Reference Audio, Transcribe, Candidates and two parent-linked Versions on
the shipped 0005 SQLite schema. Current startup upgrades that populated
graph to 0006; public Project/Job/Score/Candidate/Version/Asset metadata and
original bytes are unchanged. It then completes new selected generation,
explicit save and another actual reopen. No migration is restamped.
Parent table recreation disables foreign keys outside BEGIN only for the
upgrade, checks the entire foreign-key graph before commit and restores
enforcement afterward. Earlier migrations are unchanged.

New fake Generate and Transcribe ABC use the native two-voice structure with
the same eight/four note melodies and five/two-second symbolic durations.
Existing stored Assets are not rewritten. Transcription MIDI bytes and the
independent four timed pitch assertions are unchanged. The only old browser
ABC literal and Node consumer note syntax assertion were updated. All six
production-preview transcription browser checks pass, including Chinese/
English, light/dark, notation, native downloads, refresh and failure recovery.
Owned browser API and Web processes have successful graceful stop receipts
under `tests/browser/.artifacts/web-a2e83bfa-3a4d-4386-a143-ebc5c1fa9d8a/`.

The six real Node HTTP/FormData/WS consumer cases pass, including generated
GenerateFromScore types and implicit retention of the source parent on save.
The documented Python `from-score` command downloads an unsaved Candidate
and its `save` command preserves the source parent. Strict mypy passes 51
production/owned-fixture sources. Locked dependencies, reproducible client
export and Web type/build checks pass. Documentation checks pass 15 groups,
Astro reports no errors, and the static artifact contains 60 HTML pages with
4215 checked references. A first documentation build rejected the missing
guide section registration; `docs/site.json` now registers `selected-score`
for both languages.

Final API and affected simplification logs are retained under
`.scratch/41-final-checks/`. Root owns independent final review, final-head
CI, real GPU acceptance, main integration and public Pages readback.

## Bounded simplification and remaining acceptance

The pass inspected the complete owned diff and new parser/workflow/test
files plus Job/import/readiness/Version/client/Web consumers. GenerateFromScore
registers with the existing Job worker and coordinated output transaction;
it adds no second worker, importer or Runtime adapter. It uses the frozen
effective hash instead of rebuilding an old output expectation from current
adapter code. The client test reuses the public Job's ABC id instead of
interpreting nested output metadata. Writer reservation, idempotent save,
lost acknowledgement recovery, cancellation ownership and original proof
reconciliation remain required. No broader refactor was needed.

Real acceptance is still a separate Root-owned action: collect a fresh
official owner receipt, run a CPU API against the retained pinned Runtime
using an isolated data directory, submit a validated edit of the retained
G35 source with its same-Project parent, check original/effective input and
native history binding, decode/download the new FLAC, verify an unsaved
Candidate, explicitly save and reopen it, and compare old Version/Asset
bytes. Use the guide's `from-score` command and the existing native source
preconditions; do not use fake tones or source captures as GPU evidence.
The 35-second profile does not establish long-song quality or performance.

Public guides: [中文](../guides/generate-save-api.md#selected-score) /
[English](../guides/generate-save-api.en.md#selected-score).
