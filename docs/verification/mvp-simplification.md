# Whole-MVP maintenance survey — #49

This bounded survey covers the integrated current MVP from preimplementation
`38dc7004b421b1ee81173d01b003cb7168f70fcb` to actual PR #94 merge
`7ba8e9d07d608a4ff9f9a56cd9fc242563658970`, treebf50f55909211a9ba9cf70b269f6ec45ee39cb2a,
plus this commit's six-file #49 documentation slice. The exact candidate SHA,
tree and full inventory are retained in Root's source-freeze readback. P5base
4763a55 is a supplementary range, not a substitute for the whole MVP.

The whole candidate inventory contains564 changed paths,55077 insertions and3
deletions. The complete #48 child has25 paths/+1445/−120 relative to07a9539,
including production consumers, the independent17-scene suite and CPU runner,
root/browser/CI/manifest registration and paired guidance. The #49 source
slice owns four paired tutorial files and two maintenance records;
no application/API/Runtime/workflow/dependency or generated source changes.
These counts describe the range; they do not claim every hunk or dependency
implementation received a new audit.

The survey reuses Root's P0, P1, P2, P3 and P4 whole-stage surveys and the
read-only #49 preparation map. It rereads actual completion/consumer chains
and the complete #48 source/registration delta, with its final non-author
review evidence and real product comparison. This survey is not another
independent code-review axis or an additional approval gate.

## Producer and consumer paths retained

| Path | Concrete current consumers and retained obligation |
| --- | --- |
| Runtime pins/models → registry/readiness → four-operation Runtime interface | Doctor, native/Fake adapters, launcher and diagnostics use actual revision/hash/license/environment/model facts. API remains independent of Torch. Current registry registration does not make archived Cover/v1 proof and migration consumers unused. |
| Routes → JobService → immutable original proof/attempt → validated result/import → Candidate → explicit Version | One Job/import worker supports all four operations. File/metadata/terminal publication is coordinated. Uncertain commit retains files, retry never silently rebuilds the original proof, and saved Version inputs/outputs remain immutable. Candidate and Version govern different creator choices. |
| Storage and saved metadata → file-read guards → API downloads/Score/history/Player | Exclusive Asset publication, same-Project ownership and actual readable files remain necessary. Missing Audio/ABC is an error, not empty history or a filtered healthy graph. A smaller read model must not erase error/recovery obligations. |
| Durable Jobs → bounded WS hints → Query HTTP reads and active recovery | Connection-local ordering/coalescing and authoritative HTTP terminal stability serve different consumers. Shared completion handles Assets/Scores/Candidates; it never creates a Version. The Generate page's completed deep-link reopening remains a distinct trigger. |
| ABC draft/check/select/submitted intent → explicit owning-Version branch → saved-only forest | Ordinary Score/Reference parents and explicit branch parents differ. Editor context, immutable selection, unknown ACK and Cover mode epochs change enabled actions; flattening them would recreate observed defects. The forest derives directly from complete API data, without another server store or graph database. |
| Candidate/Version/Reference/MIDI → sole Player → compare/media/Score clock | The existing native element owns time. Captured listening identity is independent of newly completed Candidates. Pair storage contains only per-Project ids/side. Pending seek/play/region intent, loaded receipt, bounded original-URI recovery and failure state have separate observed consumers. Generated audio does not publish exact Score timing. |
| Pydantic/OpenAPI/settings + controlled examples/paired manifest → generated client/docs/navigation/search → validated artifact/Pages | Binary inputs/downloads and WS contracts consume the generated schema. Tutorials import real controlled source; language/chapter relationships share one registry. Production examples and retained isolated previews are active obligations rather than duplicate applications. |
| Independent API/Runtime/Web processes → launcher origin/config/owner proof → scoped stop; browser/SDK fixtures → CI groups | Windows shared base Python is not environment provenance; an actual creator/interpreter binding is required. Stable active evidence slots and original timestamps serve reuse. Fault/hold/restart runners have distinct controls; wholesale merger would spread their failure and cleanup surface. |

The final48 bounded improvement already extracts `stopAtRegionEnd` for the
native-event and SDK-tick consumers. Its current-time decision preserves the
real seek boundary. Further deleting an event path or merging pending/loaded
ownership is not supported by the evidence. Normal31s CPU encoding adopts
the consumed standard4800-frame option; independent complete Python decode
and browser/header facts remain separate verification boundaries.

## Small proposals and decisions

| Classification / owner / evidence | Maintenance effect and strongest reason to retain | Recommendation / validation if later taken |
| --- | --- | --- |
| Behavior-preserving optional browser-receipt publication; browser harness. `tests/browser/run_api.py` directly writes owner/stopped JSON; `teardown.ts` parses while polling. SDK `tests/run_api.py::write_record` and launcher `scripts/dev_process.py::write_json` already use temporary replacement. | A small local atomic writer can remove partially published receipt handling. Duplication is small; no partial-write failure was reproduced and this does not explain an existing CI failure. Precise ownership and graceful evidence remain. | Defer until the next fixture edit; exercise the existing normal/failed owned start-stop and Windows sharing boundary. Do not merge all runners into a general supervisor. |
| Behavior-preserving optional P0 HTTP-peer lifecycle helper; Runtime tests. `test_running_cancel.py:101/161` repeat server/thread start and shutdown/close/join for separate handlers. | A same-file context manager could remove small lifecycle glue. Scenario producers and every public assertion remain independent; current duplication is reliable. | Defer; refresh the original ephemeral-port/cancel/cleanup consumers, without GPU. No new framework or module is needed now. |
| Small observable CLI-error interface change; API examples. `generate_save.py` repeatedly calls raise_for_status while the API provides code/recovery/resource_id; the documented409 recovery requires another read. | A formatter could remove repeated exception prose and recovery workarounds. Stderr/exit is public; successful stdout JSON, nonzero failures, API-redacted detail and no automatic write retries must remain. Existing guidance already recovers. | Defer as an explicit small tooling change. Validate409/503 with ids, non-JSON errors and successful output compatibility; no new issue is published by this survey. |
| Behavior-preserving optional current preview-status prose; docs owner. #39's UI record confirms approval, while its README and historical section still say pending. | A link to one current record can reduce duplicate current-status claims, while retaining original feedback, frozen preview, confirmation and user waiver. No product behavior changes. | Defer; compare exact confirmation/history links when next maintaining that preview. Never ask the user for approval again to clean prose. |
| Retain/defer Generate's page completion effect and P0 artifact-validator extraction | Jobs shared completion covers fresh detail/list/submission, but a cached completed deep-link has a separate consumer. Moving `queue_history.validate_result` to a new module adds source-hash/receipt glue without deleting validation. | Keep unless an affected public consumer proves net duplication or an actual artifact-rule change warrants extraction. There is no deletion quota. |

The four paired tutorial corrections are required content consistency, rather
than an optional reduction: the overview and first-music pages must describe
the delivered Score regeneration, Cover and saved-Version comparison paths.
The draft uses the existing Morning Project, creator listening decisions,
explicit Candidate saving and next-play links. Stable ids/navigation, controlled
examples and technical supplements remain; no second copy of an API contract
or example is added.

## Scope gaps and final update

This is full-range inventory plus targeted chain/consumer inspection and
reused reviews, not a fresh audit of all562 hunks, every historical fixture,
all migrations, vendored parser internals or third-party implementation. The
original unsupported26e916 FLAC and failed index controls are retained;
normal595 encoding success is not a claim that all file/browser seeks work.
One bounded original-seek recovery and explicit0-paused reread retain ownership
and visible failure. Older module-buffer, WS-cancellation and archived-shutdown
root causes remain unknown.

No optional production cleanup was implemented. Root's additional native
owning-Version branch, actual new-music pair and graceful OS API restart
preserved all22 Asset hashes/objects/ReferenceOrigins without another
inference; the exact facts are in the [MVP record](mvp.md). Fresh documentation
checks passed15 source groups/Astro19 clean, and the build checked62
registered pages/66 HTML/4981 references. They do not alter product source or
replace final independent review, applicable CI and actual merge/Pages/browser
readback. The whole-range candidate inventory and zero product-code diff are
read back after this documentation commit; unchanged product evidence remains
bound to actual7ba8e9d/bf50 rather than to an uncommitted documentation checkout.
