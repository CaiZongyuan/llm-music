# #65 — Creator tutorials and usage experiments

API/documentation base: `f02bd5310ea29845f1900a53271e71df30f5169b`. Approved preview: `316d99d89fa1058adf9bdf41b9e7c33cdb32a43b`. User confirmed: “符合，按此更新正式教程（推荐）”. See [the feedback and comparison record](../ui/65-creator-documentation-preview.md).

## Delivered scope

Six paired creator chapters use Markdown as their body source: overview, first 35-second music, Reference Audio transcription, one-input variations, preparation/help, and current capabilities. The old quickstart, Doctor, Runtime transcription, and architecture paths remain unchanged and accessible as secondary resources. Ten registered chapters produce twenty language pages; explicit first-music/variations navigation is reciprocal.

The tutorials cover material selection, current operations, file locations, listening/inspection, one failure recovery, and another creative experiment. Technical operations are expandable supplements. Existing `services/api/examples/generate_save.py` and API production code are unchanged; complete source and controlled lyrics are included rather than copied into a second program.

The real listening copy is 561068 bytes, SHA256 `6c36d74e20f235af77fd60e262ed5533d033c907dc3a3e09aa23ec18b8ca4c4e`. Original FLAC SHA256 is `066f9002c9feef9c5435c952398d982b839e00ada5b4036eaa3092d061eaefbe`. The baseline fixture matches that recorded style, lyrics, seed `2026192201`, and `max_seconds=35`. The lyric experiment changes only the first line in its separate UTF-8 fixture. Other recipes are expressly unauditioned inspiration. No new generation, music-quality guarantee, accuracy claim, or benchmark is made.

The recipe custom element reads the included baseline and displays only local input changes. Clipboard copying is explicit. Public audio, provenance, and script references resolve under `/llm-music/`; ordinary repository source links retain their Git commit. Source paths and paired headings remain checked. Documentation maintenance rules now put creator goals/materials/use/play first, with developer reference secondary.

## Verification

`pnpm install --frozen-lockfile` reused the existing dependency store; package manifests and the shared lock are unchanged. `pnpm docs:check` passed twelve behavior checks and Astro's fifteen files with zero diagnostics. Added checks validate real fixture/music correspondence and local audio/provenance/script link behavior while preserving fixed source URLs. Existing isolated Runtime-example guards remain in the required check; they call fake commands, not live Runtime.

`pnpm docs:build` produced twenty registered language pages, twenty-four HTML files, and passed 929 built references under the deployment base. The final candidate is regenerated after commit so all source metadata and referenced files bind to the actual Git revision. Exact final-head commands/results are retained in Root's `.scratch/p1-development/65-docs-usage/formal/` receipt.

Actual Chromium 150, software rendering, 1440×960 and 390×844: nineteen public result facts passed for creator navigation, language/section/theme reload, four one-dimension input recipes, clipboard feedback, actual native audio playback, search loading/normal/empty/failed recovery, old paths, mobile bounds, static GET isolation, and no uncaught exceptions. The controlled loading barrier delays only the static search fetch and then returns the original server bytes. The failure probe aborts only the generated static index. There are no business HTTP fixtures or writes.

Real API/model evidence is reused from the already delivered generation, transcription, and Job-events proofs; the API and existing CLI are unchanged. Formal Workbench Web, integrated score editing, Cover, GenerateFromScore, an A/B player, and long songs remain outside current usage claims. GitHub Pages publication remains a later verified delivery; local build success is not a deployment claim.

## Simplification and retained failures

A duplicate PowerShell preset launcher was removed in the bounded simplification pass. It repeated the current CLI and introduced temporary lyrics ownership without helping the approved reader flow. Its isolated stub harness hung; only exact owned test process identities were stopped, with no actual uv/API/Runtime subprocess. The failure output/harness remains in owned scratch, and the removed wrapper is not relabelled as verified.

Browser harness fixes retained the native-locator/newline mismatch, URL-valued language choice, and pending-fetch barrier cleanup failure. Corrected harness checks passed against the same product code. Initial source uses working-copy metadata explicitly; final source pin/readback is independently recorded. Source review, exact-head CI, merge and tracker delivery remain Root responsibilities.

Independent review at `f5898ee99ac3ff71d4bfb4330c1332132be7c7a1` reproduced one reader recovery defect with a no-network HTTP MockTransport: the existing CLI raises a 409 without printing the response's Version id. The paired variation recovery paragraphs now route readers through the actual read-only Project Version list, matching `candidate_id` and checking the saved `name`/`parent_version_id`, then reading the returned Version id. CLI/API production code remains unchanged. The original review and counterexample are retained; only this paired text and final source receipt need refresh.
