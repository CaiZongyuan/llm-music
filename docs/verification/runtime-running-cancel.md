# P0 running cancellation verification

Issue [#18](https://github.com/CaiZongyuan/llm-music/issues/18), starting revision `0c814cc3a1574de327c58f3a29bf7f24364ec258`. The task owns `running_cancel.py`, its public CLI tests, paired guides and this record. It leaves shared client, workflows, manifests, environment, models and CI unchanged. Root completed the actual target-GPU check on frozen source `58d62abbb41d50805f65175a7be8b62d799ff5dc`; formal independent review and hosted CI remain pending. `p0_passed=false`.

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

If A finishes successfully or no terminal confirmation arrives, this candidate stops before B rather than claiming cancellation. Mapping and submission-attempt evidence remain available for bounded recovery without blind resubmission. Continuous repeated Jobs/cleanup belong to #19; subjective music assessment and whole-P0 acceptance are not claimed here.

## Actual owned target-GPU execution

Root ran frozen source `58d62abbb41d50805f65175a7be8b62d799ff5dc` once from 2026-10-06 20:18:45.713 UTC to 20:19:46.745 UTC, with the owned installed interpreter, `--timeout 1800`, `--poll-interval 0.5` and five protected files. The command exited `0` with `verified=true` and `p0_passed=false`. Runtime PID `50752` and its creation identity were unchanged. Source hashes were unchanged across execution; `running_cancel.py` SHA256 was `00be4a31449cf83557ab35244aa09e3754b5e7fe564d5be9eae6af7f1bfd33a8`.

A's exact owned prompt was `f8d98e91-a90f-4202-90c7-03860882de34`. The new same-run score marker was observed after at least one token following prefill, despite the rounded `0%` display. A's native execution_start→execution_interrupted interval was 5.108 seconds. Dispatch was true; history retained `status_str=error`, `completed=false` and the same target's `execution_interrupted`. The normalized Job query confirmed `status=cancelled`, and the queue became idle before B submission. The ordinary terminal cancellation guard recorded `terminal_no_write` with no write.

B's exact owned prompt was `c5dc3a51-1924-44ad-b645-036128bc2886`. While B was the current owned request, two controlled native calls targeted terminal A only. Both returned `cancelled=false`, and after each call B remained current. B then reached successful history and the final queue was idle. Its execution interval was 52.776 seconds. Public Score parsing found 99 notes; PyAV decoded every frame and checked finite samples in the 48 kHz stereo FLAC: 1,679,936 frames, 34.998666666666665 seconds, 3,088,509 bytes and SHA256 `270d1a460ed5424b87735f8ee9b1f2ea85bd483dcbd7e6ea0a4414fddf69439c`. Same-run logs record actual CUDA generation for seed `2026101802`; subjective listening is pending.

All five declared prior files retained their before/after hashes:

| Protected prior files | SHA256 |
| --- | --- |
| #16 baseline FLAC copy and original Runtime output FLAC, two files | `2a9969a1c56f99aee4870f3787a4dff9e3eb8bf6b81bf211e0d1ba86ab3cf366` |
| #17 A FLAC copy | `6550617d49bd3f9e5cecefcf309f1071e0fefa412eec23d14a67eb5a7ef45f21` |
| #17 B Score MIDI | `3e93dfb2caf5dc13be56be2dc6d9406d08768d638ff56689132f58479ec0c704` |
| #17 D FLAC copy | `6eec96cac3772a889a294578f76791cada97bb70b2a6b8ac97a4dcf9d07bd8a4` |

The cancellation log records loader `unloaded`, `Processing interrupted` and prompt execution in 5.11 seconds. These observations and the successful successor establish the observed cleanup/recovery path. They do not prove immediate complete memory release or absence of leaks. Raw native point snapshots show the later fall:

| Point | Native Torch usage bytes | Device VRAM usage bytes | Host RAM usage bytes |
| --- | ---: | ---: | ---: |
| Before run | 60,686,336 | 1,686,634,496 | 23,930,187,776 |
| Score marker, before cancel | 4,728,805,616 | 6,115,819,520 | 29,115,166,720 |
| After cancel, before B | 3,000,510,600 | 4,438,097,920 | 28,715,171,840 |
| After B | 86,245,376 | 1,720,188,928 | 24,082,837,504 |

Usage remained high at the immediate post-cancel point and fell further after B. The cause of that delayed fall is not established. These are `/system_stats` point readings, not continuous peaks or per-process GPU/host attribution. #19 retains continuous repetition and cleanup as the next discriminating check; no additional GPU diagnosis is claimed here.

Evidence is retained in `.scratch/p0-development/18-real/summary.json`, `command-receipt.json`, `run-01/report.json`, per-job requests/history/artifacts and same-run logs. Root stderr evidence spans bytes 99,676–131,091 of the same source file, SHA256 `68719d803529eef38bb0d81f5fe3160ca77d67a5129e490ed3e828368cea2f65`. This update changes documents only and reuses the frozen implementation's actual GPU and 52-test CPU evidence. Final review, hosted CI and integration are parent-owned; no documentation site/browser/Pages publication is claimed.
