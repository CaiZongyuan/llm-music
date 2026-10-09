# Current MVP acceptance — #49

This maintenance record covers the two creative loops in the approved current
MVP. The implemented baseline is actual PR #94 merge
`7ba8e9d07d608a4ff9f9a56cd9fc242563658970`, tree
`bf50f55909211a9ba9cf70b269f6ec45ee39cb2a`. Issue #48 closed after that merge.
Root verified the new native branch, music comparison and actual API process
restart at that product source. Final documentation-candidate validation and
Root's review/CI/integration/Pages readback are recorded separately below.
No pending delivery fact is counted as a pass.

## Scope and source identity

The supported client is the local Web workbench. FastAPI owns Project, Asset,
Score, Job, Candidate and Version data; ComfyUI remains the inference Runtime.
The creator works through the Web/FastAPI boundary, without a Canvas, model
movement, manual Runtime-output import or node knowledge. Electron, mobile,
advanced DAW editing and P6/P7 remain outside this MVP.

The #49 Developer owns paired overview/first-music corrections and this
maintenance/simplification record. Product API, Web, Runtime, workflows,
generated contracts, dependency locks and navigation registrations are
unchanged. Public text advances the existing Morning song tutorial: inspect
and audition a Candidate, explicitly save a Version, then compare saved work
or continue from an earlier Version. Existing chapter ids and locale paths
remain stable. This maintenance record is not a registered public chapter.

Root uses a separate clean checkout of the delivered product baseline for
real acceptance. The documentation worktree must not become an uncommitted
product-source input. At the final candidate, record the exact product source
and final documentation source and verify that the intervening change is
documentation only before reusing product evidence.

## Reused real creative loops

These are existing Root executions and their original artifacts. They are not
new runs by this document's author. Their API/Runtime/import/save contracts are
unchanged in the delivered P5 branch/compare implementation.

| Creative loop | Actual result and source |
| --- | --- |
| Style/lyrics → Generate → listen/inspect → explicit Version | The [P2 assembled workbench](p2-creative-integration.md) created Project `a0ac0436-53d0-455f-b535-0636f4eefa9a`, real Generate Job `8d7ecc40-de04-44f4-80a2-a52af72d5498` and explicit Version `1cf81ec0-4871-4c56-9a57-ac1725d22019`. The original 35-second native generation was uncached; the single audio element continued across Workspace tabs, original FLAC/ABC downloads matched registered Assets and reload restored the same saved Version. |
| Inspect/edit/select Score → GFS → new audio → explicit derived Version | P3 source `18d10ca00ab18a74b24501f026fb2ce5b7dfb488`, integrated merge `8fe1ed0c6c1f8016861a45e80f91351bc3bd2450`, used selected ABC hash `c25bbfead5e851f9114fb754b7b8ed0f67aac11ac4c39227c3b0dcde85415923`. Job `10410a02-c360-4a92-b034-9669bebca0e1`/native prompt `369ecb8c-270b-4438-be9f-1f914cb7cd4d` completed an uncached core execution in41.762 seconds. Explicit Version `cc4298f6-33e2-4e9c-9cdd-66700f83a683` retained parent `46dac6ce-bbc5-4316-b2a5-b63a76523d0a`; its fully decoded34.998667s stereo48k FLAC hash is `b53e707b6a72518ad8dd1f8f61b303143228a9445fcf37f7b2c3bef95ed5fdeb`. See [Score generation](score-generation-web.md) and Root's retained42-real receipts. |
| Upload Reference → Transcribe → inspect/edit → melody/full Cover → explicit Versions | The same Project's P4 Reference `5855dc17-b06f-4242-b940-6af1c0f81530` produced fresh Transcribe Job `8edad40d-f7ed-4452-b0ea-e783e079107f`, native prompt `dd2cab0a-187e-430a-8004-cbf13badbf56`, uncached6.404s. Original edited ABC hash `12f7bb97f433f57dc1cd0ad71817885afb0cf92ca4d3959080725958d68f90e6` was inspected before either Cover. Melody Job `8384bb29-7303-4776-bb39-ef7d6eee3da2` and full Job `3561feb9-e0a9-44f1-8629-8f9d28702dfb` used actual cot melody/full and produced complete34.998667s stereo48k music. Explicit Versions `32689856-a811-441a-81d8-b9abc9d55468` and `94909afa-ba1a-459b-89f6-d586ad6c08e3` are siblings under parentcc4298f6, in the same Project, with the same Reference/transcription/original ABC. See [melody](cover-melody.md), [full](cover-full.md) and Root's `p4-real-samples.json`. |

The earlier P2 browser transcription reused the native recording cache. The
separate P1 and P4 fresh inference receipts supply model-execution evidence;
the cached browser run is not relabelled fresh. The original P3 recorder
omitted Play after selecting audio; its later continuation played and saved
the same completed Job, without another inference. Both failed setup and
successful continuation remain retained.

P4 melody/full differ in style and seed. They are creative examples, not a
controlled quality or mode-performance comparison. Complete media and native
provenance do not prove exact acoustic fidelity.

## Delivered P5 behavior and final-source evidence

[Saved Version branches](version-branches.md) use the API's existing same-Project
parent and immutable-save contract. An explicit branch verifies that the
chosen Version owns the source Score; it does not substitute the Score's
earlier Reference/editing parent. Ordinary Score/Cover origins keep their
meaning. Candidate completion does not add history. The saved-only forest,
inputs, outputs and parent links read persistent API data.

Root's #47 actual CPU API process restart62076→26584 preserved94 Asset hashes,
27 Versions and39 Jobs across10 Projects, with no business POST. Its production
browser replay verifies ordinary → invalid origin → ordinary Back/Forward and
the same four saved nodes. This proves HTTP/storage/browser recovery, not
native branch inference.

[Version comparison](version-compare.md) extends the existing sole audio
element. It stores only per-Project saved Version ids and active A/B side;
Query/API retain metadata and bytes. A/B keeps absolute seconds, uses the
target's native end, preserves one common one-shot region and follows the
latest load/pause/seek intent. Reload restores valid choices at0 paused,
without playback position or region. Missing files/read failures remain
errors and have explicit recovery. An explicit audio reread starts at0 paused
and creates no Job.

Root supplied exact final source `8a47f94c9791cf1966f8d56045ec5e8e885ec319`
evidence: all eight applicable CI runs succeeded, both workspace/music groups
passed in both Web runs, and the complete17 comparison cases ran in both music
jobs, taking approximately2.5/2.7 minutes. The actual merge has the samebf50
tree. Local history remains complete16 with11 passes/5 failures plus affected
checks; no later complete17 local rerun is claimed.

The normal31s CPU FLAC uses a consumed standard encoder `frame_size=4800`,
310 packets/1,488,000 PCM16 stereo48k frames and hash
`5951549add804f77098922bcc86f9f1f21e5806281890ccd4087ee04c52e5875`.
Independent native controls verify30.8, End31, natural end and explicit replay
from0. This is a real CPU tone through production Generate/Candidate/explicit
Version contracts. It is neither native music nor the31s #46 preview WAV crop.

The earlier valid31s FLAC hash26e916c7854f1a924b5ca9e8b90f66fa6acd95d8dba4e79fed49ea1c99171f2c
still has an unsupported tail seek in this Chromium profile. It remains the
17th real-error/latest-side/reread control; both failed index variants remain
retained. Adopting the regular4800 fixture does not claim the original file or
the underlying Chromium cause was repaired.

Root separately used actual original P4 music in the product at8a/bf50:
full949's unchanged SHA6279e9c5… recovered an explicit34.8 seek, reached the
native34.998667 end paused, then explicitly replayed from0.294017. Melody/full
pair switching, both2–4s regions ending at native4 paused, reload0 paused,
zero POSTs/page errors and unchanged20 Asset hashes passed. The silent
[compressed product recording](https://github.com/CaiZongyuan/llm-music/pull/94#issuecomment-6071038681)
is separate from the actual music. These two original clips are both about35s;
the different-length boundary is the independent real31s CPU fixture evidence.

## New #49 Root acceptance

Root executed the additional owning-Version branch in the separate clean
`49-real-acceptance` checkout at7ba8e9d/bf50. Saved full Version
`94909afa-ba1a-459b-89f6-d586ad6c08e3` owns Score
`96869c2b-c9af-48c0-8df6-9425cd99d80b`, which still retains earlier parent
`cc4298f6-33e2-4e9c-9cdd-66700f83a683`. Through the real UI, Root inspected,
exported/auditioned MIDI and explicitly selected its original accepted blank-T
ABC. This execution added no new musical edit: the earlier P3/P4 real edit
evidence is reused for that unchanged behavior.

| Additional final-product seam | Actual observation |
| --- | --- |
| One GFS with the chosen full Version as parent | Job `cc23487a-fce6-4ef9-b754-4b6af5654851`, original native prompt `547ef40c-bfdb-4e56-ad81-b0950de264bb`, full cot/35s/seed2026490001. The explicitly selected input and verified branch context use source Score `96869c2b-c9af-48c0-8df6-9425cd99d80b` and freeze chosen parent949. The frozen request/proof, public Job, Candidate `ec43bc42-36e8-4ec8-a547-1146fa796b12` and explicit new Version `abfbe710-1c14-4325-9ab1-99bdd471ccba` all retain parent949. The persisted original Score's `parent_version_id` remainscc; ReferenceOrigin is not forged into this GFS branch. |
| Original proof and complete new music | Frozen proof SHA `89315c64ec07f2e7e79a25389af4c755c1c8ea38c7e0177b1a03302ccaea2179`; effective ABC SHA `e21093391e9e9cfca95b077be1ef0ee2aa6e24fa021fc2a99b88e33abc75196e` matches the actual native graph. The core is uncached,37.694s execution including workflow overhead. Complete1,679,936 PCM16 stereo48k frames decode to34.9986667s with finite nonzero samples. Actual audio SHA `b61c09f103ec1cfa9db07ca700213b204cbcaa410587e8e36cd62c22c935b0f7` matches the Candidate and listening Blob. No peak-VRAM, acoustic-quality or performance comparison is asserted. |
| Candidate first, explicit child save, immutable old work | Inference created a Candidate before the creator's save. One explicit save added the named child of949. Old20 Asset bytes, all previous records and ReferenceOrigins remain equal. The resulting dataset has22 Assets,12 Scores,8 Jobs and6 Versions. The browser's only inference POST is this GFS; other writes are Score validation and explicit Version save. No new Transcribe, ordinary Generate or Cover is submitted. |
| Old full949 versus actual new child | A is949 and B isabf. PausedA12→B12 retains absolute seconds; playingB→A continues the same position. Native Blob hashes identify the actual saved Audio on each side. The same audio element continues across Lyrics and Score navigation. Each common2–4 region stops at native4 paused. Reload restores activeB at0 paused with region0/0, and comparison records zero POSTs. |
| Actual OS API restart and cold-browser recovery | Exact owned API59112/birth1791502731.7410994/direct parent52124 stops gracefully, then API58848/birth1791503054.4951103/direct parent36780 starts on the same data/Asset directory. All22 hashes and saved HTTP objects/ReferenceOrigins compare equal. A cold browser restores B0 paused with originalb61c09… bytes; reload stays0 paused without the transient region, explicit Play advances to0.303745, and zero POSTs are recorded. Runtime50752 is unchanged. |

Authoritative Root receipts are retained in
`.scratch/p5-development/49-real/{branch-gate,compare-gate,restart-gate,native-verification,before-planned-restart}.json`,
alongside submitted inputs, original history/proof, source/tree, actual
producer identities, raw recordings and Asset snapshots.

The first comparison recording reached reload but its helper queried a
spinbutton inside a closed details panel. That failure and its raw take remain
in `compare-first-failed-gate.json`. Opening the real summary fixes the helper;
the subsequent read-only comparison succeeds on the same saved music, without
another inference. The initial Web startup before the API listener was ready
was also a prerequisite rejection. Root waited for the verified owned listener
before starting Web. Neither setup failure is relabelled a product defect or
silently erased.

## Existing recovery coverage and bounded simplification

The [P0 report](p0-runtime-report.md) retains the real target-machine profile,
Doctor, queue, queued/running cancellation, repeated work and finite cleanup
observations. [P1](p1-gate.md), [Job events](api-job-events.md),
[cancel/retry](api-cancel-retry.md), [reconciliation](job-recovery.md), the
existing browser suites and the P2/P3/P4 records cover immutable attempts,
unknown acknowledgements, explicit new retries, authoritative disconnected
HTTP recovery, damaged outputs, failed saves, original bytes and restart.
Final P5 changes affect branch context and media choice/loading; they do not
change the Runtime/model/workflow/import/save contracts. Reuse is scoped to
those unchanged contracts and the final-head consumer checks.

The [whole-MVP maintenance survey](mvp-simplification.md) uses preimplementation
base38dc7004b421b1ee81173d01b003cb7168f70fcb through the delivered P5 tree and
the final49 documentation slice, with P5base4763a55 as a supplementary delta.
It traces actual producers/consumers and reuses the stage surveys; it does not
claim a new555-hunk audit. Optional fixture/receipt/example-prose reductions
remain deferred. No new issue, dependency, abstraction or deletion is needed
for this documentation change.

## Source validation and remaining delivery

The source-only four-page correction passed patch application and whitespace
checks. Static source navigation verified54 local links/anchors, preserved
existing chapter headings and registered locale pairing, and confirmed that
the maintenance records are not public chapters. The fresh independent
environment installed locked538 pnpm packages and41 API uv packages.

Fresh `pnpm docs:check` passed15 source/example/reference checks and Astro19
files with0 errors/warnings/hints. Fresh `pnpm docs:build` passed62 registered
pages,66 HTML files and4981 references under `/llm-music/`. The local artifact
honestly identifies7ba8e9d with`workingCopy:true`, because the paired text was
not committed when generated. It is local validation, not Pages publication.
The final clean source artifact is validated by the candidate/main workflow.

Real browser content/language/theme/navigation readback, the final candidate's
independent Standards/Spec review, required final-head CI, actual #49
merge/tracker and Pages artifact/source readback remain Root's delivery steps.
The public documentation address is <https://caizongyuan.github.io/llm-music/>;
a site URL alone is not a new deployment or browser verification result.
The current root-owned status and final publication are recorded on
[issue #49](https://github.com/CaiZongyuan/llm-music/issues/49).

The verified product app is at <http://127.0.0.1:18113/> through owned API18112,
with the same Project and new saved branch. Root retains these processes for
the user and performs a final readiness/address readback after source checks
and media publication. This earlier usable-address observation is not the
final fresh-readiness claim. Owner evidence has a300-second freshness budget;
reading or copying it never renews timestamps. A new generation requires
genuine matching collector evidence; saved audio reads do not imply current
inference readiness.

Root records final source/run/artifact/deployment correspondence, live
process identities and exact stop commands in the #49 delivery readback.
Temporary browser/recording resources are reconciled with matching identities
and graceful receipts; any retained API/Web owner is explicitly reported.
The retained Runtime127.0.0.1:8188 / PID50752 /
birth1791306524.2399251 / direct parent38748 stays Root-owned. No source
specification #1–#13 is closed by #49; P6/P7 remain the future route.

## Known limits

- Earlier Windows/Chromium startup-module `ERR_NO_BUFFER_SPACE`, a first
  TestClient WebSocket-context exit `CancelledError`, and an archived-source
  Proactor shutdown failure remain distinct unknown-cause observations.
  Later successful checks do not establish a root-cause repair. No timeout
  widening, swallowed exception or skipped scenario is introduced here.
- Original FLAC tail compatibility is scoped to the observed file/browser.
  The Player's one owned seek reload and explicit0-paused reread preserve
  original bytes; unsupported repeated seeks remain visible errors.
- Sampled GPU/host counters and finite memory recovery are not measured peak
  VRAM, indefinite leak freedom or long-song support. Musical preference and
  transcription/acoustic accuracy remain separate from readable media.
- Native evidence, CPU tones, browser storage/process facts and CI are
  reported separately. Recording stays in the actual product; Swagger is not
  recorded. No pending work is relabelled completed to finish this document.
