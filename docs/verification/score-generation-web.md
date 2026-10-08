# #42 — Selected Score regeneration in the Web

Base: actual #40 merge `3b9f46742bd0095c8941854b8452030fff7383ee`.
Owner: `p3/42-score-generation`, `.worktrees/42-score-generation`.
The implementation reuses the explicitly approved #39 experience, Chinese and
English, light and dark, and the existing single persistent Player.

## Public behavior

The Score page generates only from an explicitly selected saved Score whose
current draft passed notation/MIDI and native CPU checks. The click freezes
actual ABC, saved source Score id, retained parent, style, lyrics and seed.
Later edits do not change the submitted Job. The existing HTTP/WS monitor
handles recovery, cancellation and explicit terminal retry with a new Job id.
The task and Candidate/Version readers show the actual submitted ABC and
source parent separately from current drafts.

Completion produces a Candidate. Audio plays in the same persistent Player;
explicit save creates a Version with the Candidate's submitted parent.
The save freezes its first name/Candidate. Recovery reuses that intent even
when the name textbox changes. Existing Version and Asset bytes are retained.

The first generation POST has no public idempotency key. The UI captures its
intent before sending and retains unknown acknowledgement through same-tab
reload. It requires explicit project Job readback and selection, and never
automatically sends a second generation request. It does not infer unique
ownership from approximately matching inputs. Choosing another attempt after
readback is a new explicit decision. Version save has the existing API's
Candidate/name/parent replay semantics and can recover the same Version.

## Changes and compatibility

No production API schema, migration, Runtime, workflow, dependency or generated
client changed. The API already supports independently saved Score ids and
their retained editing parents. Selection publication now belongs to the
currently mounted editor instance. A late save still fills the durable Query
cache, but cannot replace a different or remounted editor's explicit choice.

Candidate and Version input readers use the generated Generate/GFS union.
Their shared ABC stylesheet also loads on a cold Version route; saved ids and
ABC wrap at the existing 390px narrow Web size without clipping content.
Score-specific rendering/playback remains in the existing editor. Generation
readiness uses GenerateFromScore's fresh capability rather than Generate's.

## Author and independent browser evidence

All browser paths use real production assets, real FastAPI HTTP/WS, isolated
SQLite/files and complete public Asset reads, with explicitly identified CPU
fixtures. They do not prove model output quality or the real GPU P3 gate.

- The author's late A save → select B → release A tracer first failed with A's
  actual ABC/source id in the GFS POST while B remained visible. After editor
  ownership guards, the same POST and public Job contained literal B ABC and
  B's saved id: one passed in 9.0 seconds. Earlier missing-form and exact-label
  preparation failures are separately retained.
- Independent frozen Version save first reached a durable save with dropped
  HTTP acknowledgement, then failed because same-intent recovery was absent.
  After repair, POST201 → lost acknowledgement → POST200 retained the first
  name/Candidate and original parent, with exactly two durable Versions.
- The independent fourteen-case batch had ten passes and four failures.
  Two product failures were cold Version/expanded ABC overflow at 390px
  (English449px, Chinese437px). Two oracle failures were an unscoped Job
  locator matching the original producer Job and a redundant select click
  after restoring an already explicitly selected ABC.
- After the shared-style repair and bounded oracle corrections, only the four
  affected cases reran: four passed in 30.4 seconds, with both cold Version
  pages exactly390px. The other ten meaningful green facts are reused; there
  was no second full fourteen-case final-head run. Budgets, assertions, retries
  and skip behavior were retained. Final candidate CI is Root's delivery step.

Coverage includes literal edited ABC/saved id/non-null parent in POST and public
Job/Candidate/Version; generated output Score; native audio time/playback and
one continuing Player across tabs; explicit parent save/reload; old ABC/audio
hashes; all four language/theme combinations; held submit while editing;
empty/unselected/checking/invalid/dirty input; seed/style rejection; missing
capability/recheck; cancellation and explicit retry; OOM with earlier Candidate;
durable initial POST loss/reload/readback; no-Job unknown POST with an explicit
new decision; and durable/precommit Version save failures with dirty names.
The main #40 independent musical oracle and its literal notes/onsets are reused.

The existing Generate save-failure consumer was updated only to choose the
explicit same-Version recovery action. Its unchanged precommit failure, lost
durable acknowledgement, single Version, damaged media recovery and reload
assertions pass: one case in 9.1 seconds. This verifies the shared Candidate
save behavior for the previously delivered Generate operation as well.

Raw author facts are in `.scratch/42-tracer-*`; independent facts and final
test hashes are in `.scratch/42-browser-tests/handoff.md`. The tester froze only
`score-generation.controlled.ts` and `score-generation-fixtures.ts` before the
unified commit. Browser strict and Web strict pass. The final focused API
PID49780/port31975 and Web PID8720/port27445 have graceful receipts and were
independently absent afterward. All previous owned runs also stopped; protected
8188 and approved preview18072 were not changed. Swagger was not recorded.

## Entrypoints and remaining delivery

```powershell
pnpm web:check
pnpm test:browser:check
pnpm --filter @llm-music/api-client build
pnpm --filter @llm-music/browser-tests exec playwright test --config score-generation.playwright.config.ts
pnpm docs:check
pnpm docs:build
```

Paired creator tutorials now continue edit → select → regenerate → listen →
explicit derived Version, with recovery and one-variable music experiments.
The chapter manifest includes the regeneration anchor; no new public chapter
or development-first navigation was introduced.
Documentation checks pass all fifteen source groups and nineteen Astro files
with zero errors/warnings; the build checks sixty-two HTML files and 4485
references. This local artifact is explicitly a working-copy build based on
3b9; final committed Pages publication remains Root-owned.

The bounded simplification pass covered all owned new/modified files and their
Score, Job, Candidate, Version, generated-contract and Player consumers. It
keeps one API/import/monitor/Player path and one shared ABC stylesheet. The
small persisted submission intent is needed for the observed unknown-ACK
boundary; it does not copy server Jobs into a second long-lived store. No
additional abstraction or dependency was warranted.

Root owns common pnpm/CI registration, final non-author Standards/Spec review,
final-head CI, approved-preview comparison, the fresh real browser→API→GPU
35-second P3 gate, media publication, restart/refresh/old-graph evidence and
actual integration. Historical #41 real native evidence is valid for that API
attempt and is not reported as this Web gate. #42 remains open until Root
verifies actual delivery.
