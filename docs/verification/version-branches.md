# #47 — Saved Version branches

Base: actual #46 / PR #92 merge `9535b0c68c4d2b044bfccce0f2fc6ea4476cbb78`.
Owner: `/root/version_branch_developer`, `p5/47-version-branches`,
`.worktrees/47-version-branches`.
[Claim](https://github.com/CaiZongyuan/llm-music/issues/47#issuecomment-6066687708).
The implementation reuses the final #46 experience and corrections; the
existing user waiver in `docs/ui/43-cover-preview.md` removes another
confirmation wait.

## Public behavior and compatibility

Versions are read through the existing persistent API. Only explicitly saved
Version records enter the relationship view. Multiple independent roots are
valid. A missing parent, duplicate identity, foreign Project or cycle produces
a relationship error, without inventing roots or edges. A failed Version read
is distinct from empty history, including when an original Audio or ABC file
is unavailable. Existing readable-output validation remains.

List and detail actions can continue from an earlier Version, using that
Version's output Score. The `branchVersionId` search intent is read back through
the Version API and must match the Project and owning Score. Only this explicit
entry overrides an inherited Score parent. Ordinary Score viewing and Cover's
Reference origin rules remain. Invalid or unreadable origins preserve the
draft and block a new selection/submission until recovery.

ABC drafts remain scoped to Project/Score. Entering a branch never selects the
Score automatically; an editor-instance selection context qualifies the next
GFS choice while retaining earlier snapshots for inspection. “Use this
version’s inputs” is a separate action that copies style, lyrics and seed into
the existing Project draft. It does not replace ABC, generate, save or change
the original Version. Submitted GFS bodies and Candidate save intents remain
frozen. Job navigation retains the explicit branch search intent.

Detail reads submitted inputs, provenance and output snapshots from the saved
Version. Parent links use actual names and identities. The existing single
Player remains outside the route outlet; no A/B behavior is implemented here.
Reload reads durable objects, while unsaved drafts and Score selection remain
local UI state and must be checked and selected again.

There is no API schema, client contract, dependency, Runtime or migration
change. The existing API accepts an owning Version parent or a retained
editing parent. New nodes reference existing same-Project parents and old
Versions cannot be reparented through a public update operation; this preserves
acyclic append-only history without a graph database.

## Early discriminating evidence

The independent first tracer created V1 → saved full Cover V2, whose output
Score S2 still retained V1 as its Reference parent. On the original editor
rule, the explicit V2 action produced HTTP202 with correct S2 but parent V1.
The one-case red failed on this exact public body comparison in 9.1 seconds.
Trace, screenshot, request body and pinned source are retained in Root's owned
`.scratch/p5-development/47-browser/first-red-*`.

The minimal fix proved HTTP202/Job parent V2, correct S2, preserved branch
search during Job navigation, Candidate exclusion and explicitly saved child
parent V2. That entire run still failed in 20.7 seconds on the next assertion:
the held detail implementation had not yet rendered its named parent link.
That incomplete result is retained as `first-fix-incomplete-*`; it is not a full
passing tracer. The complete collection retained the original assertion.

The independent complete eight-case collection then produced **7 passes and
1 harness failure**, retries0. The original full tracer passed in10.7 seconds,
including the named parent, reload, original snapshots/bytes and ReferenceOrigin.
The failed same-Score race clicked a global Branch locator while lazy navigation
still displayed the previous forest. It matched three real links before the
second save or GFS was reached. The test owner corrected only the actual
Version-detail identity wait and scoped Branch action in that case and the
related draft case. Both affected cases passed in29.9 seconds against unchanged
app source. This is seven first-collection passes plus two affected passes,
covering all eight cases; it is not an all-eight final local rerun claim.

The repaired same-Score case held an ordinary edited Score's real201 response
with parentV1, entered the explicit V2 branch with unchanged ABC/current inputs,
saved and selected a second edit with parentV2, then released the older ACK.
The accepted202 GFS body retained the second Score, edited ABC and V2. Other
cases prove malformed complete HTTP relations, cold saved input/output/parent
reads, draft preservation and explicit reuse, normal versus invalid origins
(including false/numeric search), failed/cancelled Jobs, immutable save recovery,
real Audio/ABC file loss with whole-list409 and explicit recovery, and one actual
Player in EN/light desktop and CN/dark390px. Malformed HTTP payloads are boundary
fixtures, not claims that the persistent API accepted corrupt graph records.

Root's `.scratch/p5-development/47-browser/handoff.md`, `affected-receipt.json`
and original run artifacts retain exact inputs, failed assertions, source/test
hashes and cleanup. All four API/Web runs stopped gracefully, no owned listeners
remained, and app source drift was0. The browser evidence uses CPU FakeRuntime
tones and proves UI/HTTP/file behavior, not new GPU inference or music quality.

Author checks: isolated frozen pnpm install, separate locked API uv
environment, Web strict/build checks, and two public API branch cases passed.
The API cases cover direct owning Score and independently saved edit, a
separate root, unsaved Candidate exclusion, same-intent save, wrong save-parent
rejection, earlier Version/Score/ReferenceOrigin snapshots and original Asset
bytes after application reopening. They reopen TestClient/application state;
they do not claim an actual API process restart or GPU inference.

After the independent browser handoff, `pnpm docs:check` passed all15 source
tests and Astro checked19 files with0 errors/warnings/hints. It generated62
paired pages from168 repository sources. `pnpm docs:build` passed in9.09 seconds,
building66 HTML pages and checking4,959 references and the `/llm-music/` base.
The build emitted its existing missing404 content-entry warning while the
artifact check passed. Both outputs identify9535b0c plus working-copy changes;
this is local source validation, not a final committed Pages publication.

## Bounded simplification and validation scope

The independent Standards review found a P2 context-key collision on candidate
`386fa29c8627c5c76cba487cc75bd63991a853fc`; Spec reported0 other findings.
Root reproduced it through the same Score's public related-Job link and actual
history Back/Forward, with no POST or product-data write. An ordinary selected
Score had generation enabled; invalid-empty branch intent blocked it; returning
to ordinary displayed a valid selected Score and disabled selection, while
generation stayed disabled. The proper three-state red is retained in
`.scratch/p5-development/47-root/context-history-red.json`; an earlier script
iteration error is kept separately.

The repair gives ordinary and explicit Version contexts separate key namespaces
at the SavedScore owner. The redundant outer ScoreReader key is removed. This
remounts the editor at the context boundary while retaining ABC in the existing
Project/Score draft. Ordinary selection can consistently republish after fresh
validation, invalid context remains blocked, and each explicit branch still
uses a fresh editor-instance choice. The original history probe, type/build
checks and affected branch/late-ACK regressions are pending Root execution;
this source change alone is not a passing browser claim.

The source pass covers all issue-owned changed and new app, API-test and paired
documentation paths, with immediate Query/draft/Score/Player consumers. The
forest derives a Map and iterative traversal from the complete Query response;
it has no second server-state store or recursive cycle risk. Explicit input
reuse shares one button/event operation, parent details reuse the existing
reader, and ordinary Score selection keeps its existing context. No additional
worthwhile behavior-preserving deletion was found in this scope. Required
ownership, frozen intent, recovery and validation remain.

Root owns the new test command/config and shared CI registration. Web CI keeps
each existing behavior suite once across separate `workspace` and `music` matrix
groups; common install/contract/type prerequisites run in both isolated groups.
It retains fail-fast disabled, distinct artifacts and unchanged case
deadlines/retries and 20-minute job budgets. Both final-head Web groups must
pass; one green group is incomplete evidence. This is execution scheduling,
not a measured performance claim.

Public checks use isolated CPU application/storage and actual Chromium/native
media. Root separately verifies the saved forest, bytes and ReferenceOrigin
after an actual isolated API process restart, with no automatic POST. That
process/browser acceptance, required final-head CI, existing consumer checks and
independent Standards + Spec review remain separate delivery evidence; neither
the two TestClient reopen cases nor the browser collection above substitutes
for process restart. No pending check is counted as passing, and ordinary CI
does not prove model quality.

```powershell
pnpm web:check
pnpm test:browser:check
pnpm test:web:version-branches
uv run --project services/api --frozen --no-sync python -m pytest services/api/tests/test_version_branches.py -q
pnpm docs:check
pnpm docs:build
```

Root coordinates final validation, independent review, final-head CI and
actual integration; #48 remains blocked until #47 actually delivers. Protected
Native8188 / PID50752 / birth1791306524.2399251 / parent38748 is solely Root's
resource and was not changed by this author. Owned bootstrap/test environments
remain in the isolated worktree; this author retains no server or browser.
