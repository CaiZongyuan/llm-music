# Issue #40 — ABC editing and independent Score saving

Baseline: `677718bfaa19542244e899b1b751522ac5f846bd`. Owner branch:
`p3/40-score-editor`, worktree `.worktrees/40-score-editor`. The implementation
reuses the user-approved #39 interaction and existing Workspace/Player.
GenerateFromScore's formal Web submission belongs to #42.

## Public behavior and changed contracts

The ABC draft is separate from saved originals. abcjs renders the checked
text and exports its MIDI; an independent SMF decoder synthesizes those
same notes into a simple local PCM audition. That audition uses the existing
single persistent Player. Current valid checks alone enable audition,
export and explicit selection. Invalid or unsupported text stays editable;
retained notation is identified as older, and an initially absent notation
is never described as a previous valid result.

`POST /projects/{project_id}/scores/validate` checks the pinned native
two-voice dialect on the CPU. `POST /projects/{project_id}/scores` stores
exact original ABC in a new immutable Asset/Score without an inference
Job, Candidate or Version. Its `save_id` replays the same Project, source,
parent and ABC hash as the same Score; conflicting intent returns 409.
The route reserves the SQLite writer before its first Project/source read.
Lost acknowledgement retains files and exposes the recoverable Score id.
Browser retries retain the original save id and submitted snapshot, even
when the user continues editing.

Migration 0007 makes Score.job_id nullable and adds immutable source Score
and editing parent references. Existing fields/files remain unchanged;
old Score responses gain null lineage fields. The real reader guards
producer-Job queries and reads this Score's own ABC Asset. GenerateFromScore
accepts a Version owning its source or the source's explicitly retained
editing parent, keeping the actual newly saved source id in Job inputs.
Pydantic/OpenAPI remains the contract source; the client is regenerated.

## Verification entrypoints and evidence

Prepare the locked pnpm workspace and independent CPU API uv environment.
The browser fixture builds the actual production Web with its three HTML
entrypoints, starts isolated loopback HTTP/WS proxies and fresh SQLite/files,
and records owned API/Web identities and graceful teardown receipts.
It does not reuse existing services or submit GPU work.

```powershell
uv sync --project services/api --frozen
pnpm install --frozen-lockfile
uv run --project services/api --frozen --no-sync python -m pytest services/api/tests/test_score_editing.py -q
pnpm web:check
pnpm test:browser:check
pnpm --filter @llm-music/browser-tests exec playwright test --config score.playwright.config.ts
pnpm client:check
pnpm test:client
pnpm docs:check
pnpm docs:build
```

The first public save test failed with POST scores 405; after implementation,
save → actual reopen → generation using the new Score id and old parent →
explicit Version save passed with original bytes unchanged. The first
browser test failed because there was no editor and the nullable producer
was requested as an unfilled Job placeholder. It passed after the editor
and reader guard were installed. Raw author evidence is retained under
`.scratch/40-score-editor/`; the independent browser Developer's runs and
source hashes are under `.scratch/40-browser-tests/` in this worktree.

The focused API regression run passed 49 cases in 58.55 seconds: edited
Score/save/reopen, invalid input, storage failure, save-intent replay,
concurrent first save, lost commit acknowledgement, selected generation,
generation/Version behavior, transcription, legacy upgrade and contract
reads. Later ownership-collision coverage separately checks inference,
foreign-Project and different-source save-id collisions without changing
old metadata or bytes. Strict mypy passes 53 production files. Two isolated
OpenAPI exports agree with the generated client; all six Node HTTP/FormData/
WebSocket consumer cases pass.

A real archived 677 process populates the shipped 0006 schema with Generate,
Transcribe, selected generation, Candidates and parent-linked Versions.
Current startup upgrades it, reads every old public record and Asset byte,
saves an independent edit and performs another actual reopen. The existing
0005 upgrade regression also remains covered; no database is restamped.
An additional final run of the 0006 case stopped after old-history reads
because its baseline Uvicorn process did not acknowledge graceful shutdown
within the existing ten-second budget. The failed log remains retained;
timeouts and skip rules were not changed.
The stopped baseline PID/listener were checked absent. The isolated rerun
of that unchanged migration case passed in 8.83 seconds, completing current
coverage of all nine edited-Score cases alongside the eight that had passed.

The independent browser musical oracle downloads complete SMF bytes,
asserts all 22 note pitches and literal onset times, decodes actual audition
Blob WAVs as mono PCM16/16 kHz/10.2 seconds and measures the C4 → G4 first
tone change. It also checks one audio element and continuing media time
across Lyrics/Versions, publicly saved ABC/readback and unchanged originals.
These are real browser/application facts with CPU fixtures, not model
inference or generated-song quality evidence.
The independent final browser run passes all ten cases in 37.9 seconds,
including both languages/themes, 390 px geometry, empty/example save and
reopen, native validation/network/late-check recovery, exact MIDI/WAV music,
lost save response with dirty edits, notation bundle retry, native Blob
resource failure recovery and old Version/Asset preservation. Web and
browser strict checks pass; owned API/Web teardown is graceful and their
PIDs/listeners are absent. Ready-state screenshots are captured separately
after the reloaded notation check finishes; prior loading screenshots remain.

A real compiled abcjs download failure exposed native ESM failure caching:
retrying the same import could not restore notation. The editor now lazily
loads the pinned self-contained browser bundle and retries with a fresh
address after failed loading. Text and current-action guards survive the
failure. A lost HTTP save response also exposed generic error wording;
the notice now explicitly restores the same captured save snapshot.
The browser tests retain both failures and verify recovery through public
actions. Literal final-newline and repeated-label fixture corrections did
not weaken musical or persistence assertions.

Paired creative tutorials cover melody edits, rests, tempo, listening,
independent saving and recovery. The example text is shared with the
production empty-state example. Documentation checks pass 15 groups with
zero Astro errors; the static artifact has 62 HTML pages and 4469 checked
references. A first source include used unsupported `.abc`; it was changed
to the supported `.txt` source, without widening the generator.

## Bounded simplification and handoff

The pass covers all owned committed/uncommitted/new sources and immediate
Score, Asset, Job, Version, client and Player consumers. It removes the
superseded read-only Notation component, shares one example source with
tutorials and removes a redundant second SQLite writer reservation.
It retains native validation, immutable draft/submission snapshots,
file/commit compensation, idempotent save, nullable producer guards,
existing Job HTTP/WS recovery and one audio owner. It introduces no second
Runtime, mock product page, dependency or hand-written API schema.

`features/scores/drafts.ts` exposes `selectedScore(projectId)` and its
subscription for #42. Only explicitly chosen saved ABC with a current
successful check is ready; changes or rechecking invalidate readiness while
the older saved selection remains inspectable. #42 should use its actual
source Score id and retained parent, and freeze the submission again.
Unsaved draft text remains in this page session across tabs; reload reads
the opened Score's saved original.

Root owns final non-author Standards/Spec review, registered final-head CI,
browser comparison with #39, integration/publication and the separate real
GPU gate. Shared 8188 and the owned #39 preview 18072 were not changed.
Swagger recording was not used.
