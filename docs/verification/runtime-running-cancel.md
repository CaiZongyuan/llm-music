# P0 running cancellation verification

Issue [#18](https://github.com/CaiZongyuan/llm-music/issues/18), starting revision `0c814cc3a1574de327c58f3a29bf7f24364ec258`. The task owns `running_cancel.py`, its public CLI tests, paired guides and this record. It leaves shared client, workflows, manifests, environment, models and CI unchanged. Actual target-GPU execution and independent review remain pending at this candidate checkpoint; `p0_passed=false`.

## Contract and impact

The new CLI consumes the existing RuntimeClient, native queue/history/jobs API, Generate workflow and public Score/audio validators. It preserves their contracts. Saved run/client/prompt/graph mapping protects ownership. Only exact native `/api/jobs/{id}/cancel` writes occur; no legacy interrupt or shared clear operation. Terminal/history queries determine the actual result independently of dispatch.

Primary-source preparation already established that the pinned native cancellation route matches/signals under the same queue mutex used by get/task_done, and that a signal sent before execute resets interrupt can be lost. The score marker comes after that reset inside actual generation. This candidate captures file identity/offset before A submission and requires exclusive owned A before and after reading new bytes. B is absent until A terminal confirmation. The ordinary terminal guard sends no write. Two separate, deliberately controlled native stale-A probes expect false while B is current. Successful B history/artifacts then prove the successor survived those probes in the observed run.

Root also traced pinned `generate.py` `_counter`/`_band` and the vendor sampler: `Writing the score` originates from the ABC `on_token` callback after prefill and token generation, with the seen-token counter incremented first. A new attributable marker therefore represents at least one actual token even when Console rounds the displayed percentage to `0%`. No invented percentage threshold or fixed sleep is needed.

## CPU checks

The first CLI case failed because the new command did not exist, then passed after implementation. Phase observation cases failed before that command existed, then passed with byte-offset/identity guards. Ten isolated public CLI/HTTP cases cover native `completed=false` interruption, dispatch without history, ordinary error, late success, native-false queue switch, foreign ownership, terminal repeat/no-write, old marker, replacement log and full A-cancel→B-success with preserved prior output. These receipts are fake evidence and cannot establish GPU or resource conclusions.

The full fake run retains the saved requests/map, sees a new marker rather than the old one, confirms A cancellation, sends B only afterward, receives two false native stale-A dispatch replies, validates B's Score and all WAV frames, ends idle and preserves the prior bytes. It never promotes a dispatch to cancellation proof or calls global interrupt.

The complete 52-test CPU suite passed in 50.671 seconds with the isolated Python 3.12 interpreter. Affected source/test compilation, paired guide links and diff checks passed. No GPU request, live Runtime mutation, dependency sync, model write or server operation was performed by the Developer. Hosted CI and formal independent review are parent-owned next checks.

## Bounded simplification and remaining evidence

The pass keeps one P0 command module and reuses existing validators/client rather than adding a scheduler or product adapter. Mapping/history ownership, byte continuity, terminal classification and controlled native probes retain different safety obligations. No worthwhile broader simplification or shared-contract change was found. Poll sleeps use the remaining deadline; network calls retain the existing client's timeout. Point `/system_stats` snapshots are explicitly not peaks or per-process GPU/RAM measurements.

Root owns the single real GPU run, exact Runtime PID continuity, source hashes and same-run stderr evidence. Actual cleanup, post-cancel resource facts, repeated native false probes, B's valid audio/Score and preservation of declared prior artifacts must be recorded from that execution. If A finishes successfully or no terminal confirmation arrives, this candidate stops before B rather than claiming cancellation. Mapping and submission-attempt evidence remain available for bounded recovery without blind resubmission. Continuous repeated Jobs/cleanup belong to #19; subjective music assessment and whole-P0 acceptance are not claimed here.
