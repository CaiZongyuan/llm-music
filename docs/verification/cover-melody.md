# #44 melody Cover implementation and evidence

Baseline: actual #43 merge `2c445a51fea92628ea558ddee512b177ab56249f`.
Owner: `/root/cover_developer`, branch `p4/44-cover-melody`.
Approved experience: #43 source23645 and its user confirmation/continuation
authorization recorded in `docs/ui/43-cover-preview.md`.
Full Cover / P4 gate remains #45. Root owns final integration and real GPU work.

## Implemented public behavior

The Project Cover workspace reuses its persistent Player, Chinese/English and
light/dark. It accepts supported uploaded Reference or creates an immutable
first16s PCM16 stereo48k Reference from a saved Version's actual Audio Asset.
A restrictive ReferenceOrigin stores actual source Version/Audio/hash/start0/
768000frames/revision. Existing uploaded references have no origin or parent.
The conversion needs no new dependency, GPU or general transcoder.

Transcribe is an independent Job. Its output Score retains the real Reference
and inherits its true source Version parent. The creator checks/edits notation,
auditions and independently saves a Score. A separate CPU Cover validation
returns the effective chordless ABC, hashes and transform revision; notation/
MIDI and explicit selection precede generation. Reference or source identity
cannot be inferred merely from equal ABC text.

CoverCreate is a domain operation on the existing worker/import/recovery seam.
It requires exact immutable saved ABC, same-Project Reference/transcription/
edit chain, actual parent and reviewed effective hash/revision. Frozen inputs
retain original/effective ABC and the real source chain. Pinned native
`strip_chords(...,keep_voice='both')` omits music-line chords while retaining
both voice events; exact words-marker/bare-section adaptation remains.
Vocal rests with sounding Ins are valid and do not imply voice promotion.

The versioned Cover registry maps native cot=melody and score_abc. Readiness
retains actual native enum choices; absent melody cannot fall back to full or
ordinary Generate. Original Generate/GFS full graph files remain unchanged.
Runtime result ABC must match frozen effective input; Runtime metadata cannot
override frozen source/settings. Output Score carries source/reference/parent.
Successful result is a Candidate, and only explicit save creates a Version.

Failure/cancel preserves prior intermediate Scores. Explicit terminal retry
creates a fresh Job with original mode/source/ABC and no new Transcribe.
Reference save uses stable intent id/replay and retained files after unknown
commit ACK. Browser generation retains unknown initial POST through same-tab
reload and requires explicit Job readback; no public generation idempotency
key or automatic resubmission is claimed. Existing Candidate save semantics
preserve first name and parent.

## Change impact and source scope

- Migration0008 widens only the Job operation check and adds ReferenceOrigin;
  existing Score lineage columns suffice. Named existing checks, FK/unique
  constraints and populated history are retained. Old migrations are unchanged.
- Operation/Job/event/diagnostic schemas, registries, phases/captions,
  Fake/native preparation, result registration and generated SDK agree on Cover.
  Capabilities expose only observed/declaratively supported modes.
- The shared ABC editor gets one generation slot rather than a second editor;
  monitor accepts Cover, shared input readers show original/effective/source,
  and one Player/Job/Candidate/Version path serves all operations.
- Paired creator/API guides and registered chapters advance melody usage;
  reference/scope pages retain correct support limits and exact Cover tab labels.
  General FLAC uploads, arbitrary segments, automatic lyric recognition,
  full Cover and acoustic-fidelity promises are outside this delivered slice.

Bounded simplification covered the committed source slice16a5237 plus all
owned dirty/new API, workflow, client, Web, docs, tests and fixture paths. It
retained distinct inspection/choice/submission intents and compensation/proof
boundaries; no further justified abstraction or deletion was found.

## Actual author and boundary verification

First public source tracer was red404 before implementation. Its final
independent expected PCM uses time-varying, distinct left/right input samples;
public downloaded WAV equals all768000 first-source stereo frames, with exact
origin fields, replay200, inherited Transcribe/edit parent, reopen and unchanged
Version/audio bytes. Early non-author16a5237 seam inspection accepted this
oracle; it was not a fresh execution by that reader.

Forty focused API cases passed in43.06s, covering new Cover/Reference cases and
unchanged GFS, Score editing and native GFS consumers. This includes enum-only
melody removal while full GFS stays available; false Reference/Score/ABC/hash/
parent/full/foreign rejection without a Job; before/after Reference ACK failure;
hostile metadata, wrong ABC import, queued/running cancel and explicit retry.
Strict mypy passed56 source files. These are CPU results, not inference quality.

Two separate public process cases passed in16.58s: an archived actual shipped
2c445/0007 API creates Generate, Transcribe, saved edits, GFS and branched
Versions before genuine migration; all old records/download bytes remain equal,
new Cover works and reopen retains it. An independently owned CPU native-shape
HTTP/WS peer observes actual cot=melody/effective ABC, then API restart recovers
the active original request without a second submit. Original shutdown/
signature/time budgets are unchanged; protected Runtime8188 was not called.

The production Web built successfully. Common strict TypeScript initially found
one optional supported_modes read; the guarded mode check was corrected and
strict passed. Two browser-test preparation type errors (typed Blob upload and
optional captured save id) were delegated to the independent test owner;
no product contract was weakened. Two CPU OpenAPI exports and checked-in
generated client agree. Docs checks passed15 source groups and19 Astro files
with zero errors/warnings; the final label-corrected build passed66 HTML files
and4955 references at working-copy source16a5237.

## Independent controlled browser verification

The fresh independent tester owns only `cover.controlled.ts` and
`cover-fixtures.ts`; primary owns runner/config and Root common command/CI.
Production assets and actual FastAPI HTTP/WS/SQLite/files passed the first
meaningful Version→Reference→Transcribe→edit→effective melody→Candidate→
explicit child Version/reload/old-byte tracer in15.0s. The first wider run
stopped on a test-only strict locator: shared input snapshots now expose both
selected edit and original transcription links. Literal href/Score-id oracles
were clarified; original failure and focused five-case results are retained.

The final registered suite actually collects20 cases (the original21 estimate
was corrected): all20 passed in152.61263s, zero skipped/unexpected/flaky/errors,
with unchanged budgets and retries0. It covers typed source conversion/origin,
rest-only Vocal and literal22-note effective MIDI, exact source and async
selection ownership, hostile result metadata, three initial ACK shapes,
observed enum-only rejection with old full GFS success, frozen cancellation/
retry, OOM/wrong Score/import failure, first Reference/Version intent recovery,
actual continuous sole Player, both languages/themes and cold390px routes.
These are CPU fixture results, not inference/audio-quality evidence.

All four owned test runs returned graceful API/Web receipts and independent
absence readback. Final API28760:26876/Web55468:45838 both stopped; protected
8188 was untouched. Raw JSON/logs/resources and the50-file tested-source
manifest remain in worktree `.scratch/44-browser-*`. Both test paths and the
UI author are STOP-WRITE before unified source freeze. No additional product
fix was needed after the initial static selection/reader coordination.

## CI recovery query repair and affected evidence

At registered source0a047fe, the push Web run passed but the PR Web run failed
the original Reference recovery case (19 passed/1 failed). Captured recovery
validation returned the correct Origin200, while a separate mounted Origin
query was aborted and left permanently Reading. It was not the historical
ERR_NO_BUFFER_SPACE failure. Both Cover reference recovery and shared local
Reference upload cancelled the Assets-list *prefix*, including that child
Origin query, then invalidated only the exact list.

The original recovery test now deterministically holds the displayed Origin's
real200 response while independent recovery validation succeeds. A second
public upload consumer holds an existing derived Reference's Origin while a
new WAV upload updates the list. Both reached the unchanged original missing
Origin attribute assertion on0a, each with10000ms and retries0. Inline schedule
facts show actual200 reads followed by ERR_ABORTED. The two producer changes
only add exact:true to list cancellation, preserving stale-list protection
and unrelated child observations. Both public cases then passed in13.396259s,
with200 reads/no child failures; Web/browser strict checks pass. The original
CI trace remains; local diagnostic red screenshots/trace were overwritten by
the following default output directory, while structured errors and inline
gate facts remain preserved. No repeat was used to fill that history.

Red API50100:21670/Web60260:50281 and green API40148:49381/Web39156:29446 have
graceful receipts and independent absence readback. The bounded simplification
review retains the existing two producers and one public gate helper; no new
cache abstraction or budget change is needed. API, migration, registry, adapter,
inputs and native execution are unchanged, so valid prior evidence is reused;
required final-head complete CI remains Root-owned.

## Actual Root native acceptance and remaining delivery

Root completed real browser→API→protected Native GPU acceptance at0a047fe:
separate Transcribe6.404s and Cover35.236s, both uncached, actual cot=melody and
effective hash7134abbde2bb8130b8bd574c9a44ea910cb963281e458bab1eae25cb86fc488e.
Reference PCM equals the actual source's first768000 frames. Generated FLAC
fully decodes34.9986667s/stereo48k. Explicit Version
`32689856-a811-441a-81d8-b9abc9d55468` retains source parent
`cc4298f6-33e2-4e9c-9cdd-66700f83a683`.
Actual API8360→63196 restart preserves17 Asset bytes, all records/origin/edit,
with no resubmission or persistent write on reload. These read-back receipts
are Root `.scratch/p4-development/44-real/{browser-gate,native-verification,
restart-verification}.json`. Recorder title/autoplay precondition failures
remain separately recorded and are not this CI query defect. All real owned
API/Web services stopped gracefully; protected8188 remains. The narrow UI
cancellation repair does not invalidate native/PCM/input/parent/restart facts.

Root still owns affected non-author Standards/Spec review, applicable final-head
CI, compressed media and actual merge/main/issue delivery. Symbolic native
acceptance does not prove acoustic melody/harmony accuracy. Swagger is not
recorded. No local full API/GPU or unchanged browser suite was repeated for
these two query filters.
