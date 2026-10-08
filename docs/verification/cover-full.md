# #45 full Cover implementation and CPU evidence

Baseline: actual #44 / PR90 merge
`0834627eaaea4b832fca2f80956d5eced9d11797`.
Owner: `/root/full_cover_developer`, branch `p4/45-cover-full`, isolated worktree
`.worktrees/45-cover-full`. Approved experience and continuation authorization
remain in `docs/ui/43-cover-preview.md`. Root owns final integration and GPU.

## Delivered candidate behavior

The existing white-box Reference -> Transcribe -> Inspect/Edit/save Score ->
explicit effective input -> Cover -> Candidate -> explicit Version path accepts
melody and full. Both preserve Vocal/Ins identity, notes and rhythm. Melody
removes parsed music-line chords; full retains written harmony. Full with no
chords remains legal and returns `full_without_written_chords`, displayed as an
explanation before explicit selection/generation. Neither mode invents chords
or promotes Ins notes into Vocal. Acoustic fidelity is not established here.

Project-scoped mode revisions retain readable inspection/choice while requiring
a fresh explicit choice after every mode change, including switching back to
identical ABC. Late validation cannot replace a newer mode context. Generated
notation/MIDI and Player labels use the inspected mode. Selected mode readiness
uses the observed cot choices: either mode remains usable when the other choice
is absent. No mode or ordinary-generation fallback occurs.

New Cover Jobs use registry2.0.0 and freeze the selected cot in settings. Shipped
Cover/v1 and GenerateFromScore full files remain unchanged. Native mapping still
uses the existing registry/adapter and frozen proof; old active v1 attempts are
not rebuilt after upgrade. Existing SourceOrigin/parent/Score/queue/import/save/
retry/ACK recovery boundaries are reused. No migration or dependency was added.

Generated Pydantic/OpenAPI client types accept both modes; retained v1 melody
submission storage stays readable. Changing draft/style/mode cannot rewrite a
captured body, an unknown ACK intent or historical Job/Candidate/Version. Shared
input readers show actual mode and provenance. Paired creator/API/scope/reference
guides advance both modes, and the previously stale paired Generate API intro
now links to the implemented Web editor and Cover tutorials.

## Change impact and bounded simplification

Inspected the complete owned dirty/new slice from083, including API/request/
capability/provenance consumers, native/Fake preparation, stored proof/result
registration, generated client, UI, paired docs, public tests and new v2 files.
Real consumers remain the existing shared modules; the only new UI state is the
current mode/revision in the retained selection store. The readiness change
requires at least one observed declared mode rather than requiring both. Literal
source/chord oracles and actual native peer observations cover both asymmetries.

The bounded reduce-complexity pass retains distinct draft, inspection, explicit
choice, submitted intent and frozen proof. Reusing the existing selection store
and label helper avoids a new orchestration/store abstraction. Import/rollback,
recovery, migration0008 and source conversion code were inspected and retained.
No additional justified reduction was found. Independent review remains Root's
delivery stage; author inspection is not independent coverage.

## Actual CPU verification

Public full tracer initially failed422 at the melody-only validation contract.
After extension it passed in1.96s: actual saved Version -> derived first16s
Reference -> Transcribe -> saved chorded two-voice Score -> full Candidate ->
explicit true-parent Version. Literal full ABC/chord data, cot=full, workflow2,
original Version/audio and saved source bytes agree. Completion alone does not
add a Version.

The first API/native set passed6 cases in17.95s. Full-only and melody-only enum
observations each accept only the available requested mode; the no-mode generic
readiness case was redTrue and fixed to `capability_missing`. Two CPU native
HTTP/WS peer cases observe the actual compiled cot/effective ABC and recover
the accepted original through API restart without another submission.

A separate actual shipped083 source starts a v1 melody attempt; the new source
recovers it with v1 workflow hashes/settings/effective/source intact, then saves
its Version. This archived-source native peer case passed in7.82s, exactly two
native-shaped submissions total including transcription. It uses tiny CPU
fixtures and owned ports, not protected Runtime8188 or inference weights.

The wider affected API/native/GFS/Score run collected54 cases:53 passed and one
unchanged archived0006 shutdown case failed, in76.55s. All full cases passed,
including chordless full, rest-only Vocal, control-marker adaptation, false input,
hostile metadata/wrong Score, queued/running cancellation and immutable retry.
The failed old API completed its public work and downloads before Windows
Proactor reset/shutdown failed the existing10s graceful exit check. It was the
archived677718 source, before current #45 startup. The existing owner helper
terminated its own child; PID38340/port14812 absence was read back. Absence is
not reported as graceful shutdown. The unchanged legacy case then passed
independently in10.62s. Its batch failure remains recorded; no root cause fix or
timeout change is claimed, and final-head CI remains required.

Strict mypy passed55 source files. The generated client agrees with two CPU
OpenAPI exports and passes its TypeScript check. Formal Web check/build passed.
Docs passed15 source checks and19 Astro files with zero errors/warnings; build
passed66 HTML files and4959 references at working-copy source083. One earlier
affected command named a nonexistent test file and collected no tests; corrected
coverage and that failed invocation are recorded separately.

Raw owned logs are worktree `.scratch/45-evidence/`: full-tracer-red/green,
mode-readiness-red, first-boundaries-green, shipped-v1-native-recovery,
api-affected (no collection), api-affected-final, legacy-old-api-failure,
legacy-0006-isolated, mypy, client-generate/check, web-check and docs-check/build.
Pinned-source preparation is Root `.scratch/p4-development/45-fresh-preparation.md`.

## Remaining delivery

The independent first full browser tracer completed literal full/chord MIDI,
Job/Candidate/audio/source/parent/save/reload checks, then failed the original
zh-CN/dark390 document-width assertion:463px instead of390. Its screenshot,
trace/log/result/resource packet are retained in worktree `.scratch/45-browser-*`.
The author repeated this exact failing path with the tester's read-only geometry
attachment: the64-character effective hash's `<small>` box ended at352px, but
its text reached463.359375px with `overflow-wrap:normal`. Shared input-snapshot
CSS wrapped paragraphs/links/preformatted ABC but omitted this hash element.

The narrow repair adds `<small>` to that existing wrap rule. All64 hash
characters remain visible; no clipping, hiding, viewport, budget or data change
was made. Web build/strict check passes. The unchanged original full tracer and
both cold390 melody language/theme cases passed3/3 in30.423s; the same hash text
now ends at351.609375px, scrollWidth314px inside its314px content box, with
`overflow-wrap:anywhere`. The document retains the original390px predicate.
This is author repair validation, not an independent final full-suite claim.

Red API54852:46758/Web57764:39366 and green API50604:28173/Web62360:22436 have
graceful runner receipts plus independent PID/listener absence readback. Exact
identities are authoritative in `.scratch/45-evidence/overflow-resources.json`;
raw red/green logs, results, geometry and retained red screenshot/trace remain
in that evidence directory. Native/GPU was not called. The shared-reader CSS
delta leaves valid API/native/codec/source/recovery evidence unchanged.

Root's independent browser tester owns only `cover.controlled.ts` and
`cover-fixtures.ts`, preserving the shipped21 cases/held-Origin regressions and
adding bounded full/mode/ACK/failure facts. Primary author has handed off the
exclusive isolated CPU/browser execution window; actual browser results are
pending at this record.

Root owns independent Standards/Spec review, applicable final-head CI, the actual
formal-browser/full Native GPU sample, complete audio decode/Player, true-parent
explicit Version, restart/refresh/old-byte proof, compressed media, final merge
and P4 gate. Reuse the valid #44 melody sample separately. Root may reuse its
actual Reference/saved edited chorded Score without another transcription.
Measured timings/memory require actual scoped receipts; no performance or
acoustic claim is made from these CPU fixtures. Swagger is not recorded.
