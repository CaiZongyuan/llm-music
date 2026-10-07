# Playwright browser integration verification

Baseline: `6b704862e0c1c3cc74bc84757422763c8a7f8cb5`. Scope: one root pnpm workspace/lock, `tests/browser/`, pinned CPU browser CI, and paired source-referenced guides. Production API routes, Swagger HTML, Runtime, models, user-staged `.gitignore`/`GLOSSARY.md`, and the formal P2 Web are outside the edit scope.

## Actual browser evidence

Windows host: Node `24.18.0`, pnpm `11.22.0`, uv `0.11.28`, independent Python `3.12.13`, Playwright `1.63.0`, and local Swagger `5.33.1`. The API environment contains no Torch. All business reads and writes went through actual Chromium Swagger forms, Execute, and Download file; only the two pinned Swagger vendor assets were fulfilled locally, and the external favicon was cancelled. The fixture asserts both local vendor assets were used and no page exception occurred.

The first Project/422 oracle passed in 8.1 seconds. The complete Candidate/Version journey subsequently passed in 26.9 seconds. After simplification, `pnpm test:browser --repeat-each=2` passed twice in 54.2 seconds against one owned API, proving repeat runs can create independent Projects without a database reset. Both successful repetitions retained WebM recordings through the explicit `PLAYWRIGHT_RECORD_VIDEO=on` option.

After adding the reserved-port guard, `MUSIC_BROWSER_PORT=8188` with `--list` rejected configuration before server startup. A final normal browser run on the resulting sources passed in 28.9 seconds; its owned API PID `52576` and port `12538` also closed gracefully.

Each repetition verified real Project creation/read, `422 invalid_request` for empty Project and Generate intent, Generate `202`, completed application Job, the owning Candidate and Score, generated Audio metadata, a Swagger download with matching SHA256/byte count and FLAC signature, no saved Version before explicit intent, first save `201`, identical save `200` with the exact same Version, a one-Version list, and equal Version readback after page reload. The audio is the existing original CPU test tone; these facts do not prove GPU inference, music quality, a formal product page, or real Workbench E2E.

The final repeated-run API owned PID `35460`, loopback port `12186`, and data directory `.artifacts/25dd1660-5b0a-4c2e-a790-fe30b556890c/application/`. Its log records `Application shutdown complete.` and `stopped.json` acknowledges `graceful: true`. Process/listener absence was checked separately. Data/logs stay in ignored task-owned artifacts for inspection. The reserved Runtime port `8188` is rejected by configuration; no Runtime/GPU operation occurred.

Evidence is retained under `.scratch/p1-development/playwright-developer/`: first/second/third failure trace, screenshots and WebM; an initial recorded success; final stdout, repeated-run recordings/report, ownership/shutdown logs, source hashes and a receipt. Original recordings remain unchanged; compressed PR attachments and their publication belong to the PM.

## Failures and simplification

The three initial browser failures exposed test locator defects: immediate visibility inspection skipped Try it out during expansion; the status locator selected the `Code` header; and parsing the response wrapper included the `Download` control text. Their original evidence is retained. The repaired helpers wait for expanded controls, select the actual live-response status and `pre`, and wait until rendered JSON matches the actual network response.

The bounded pass inspected every task-owned new source/test/configuration and its immediate API consumers against the baseline. It replaced a path-escaping regular expression with Swagger's observed accessible operation toggle, removed redundant object assertions, and made repeated runs assert only their own added Project. It retained explicit fake mode, fresh per-invocation data, no existing-server reuse, graceful shutdown acknowledgement, resource ownership logs, downloaded-content hash checks, and stable explicit Version intent. No handwritten TypeScript domain schema or placeholder product page was added.

## Other checks and remaining boundaries

- Frozen pnpm installation passes with one root lockfile; the indirect Scarf installation telemetry script is explicitly disabled.
- Strict TypeScript passes. Strict mypy passes on the API plus browser launcher: 37 source files. Running mypy on the launcher alone first lacked typed local-package discovery; including the existing API sources resolves that without suppressing import checks.
- The paired guides contain five matching complete source includes, each resolving to a real file inside the repository. Diff whitespace checks pass.
- The pinned Windows CI installs only independent CPU API dependencies and Chromium, checks both languages, runs the browser journey, and uploads failure artifacts for seven days. It triggers for Node/workspace/lock/tests, actual API sources, and consumed Workflow/model/Runtime declarations. Hosted CI and independent review are PM follow-up checks on the frozen commit.

The Playwright UI command is supplied for interactive debugging; the actual validations above used headless Chromium. The online Astro/Starlight site has not yet been delivered, so no navigation, build, Pages publication, or deployed-page claim is made. The future generated client and P2 Web must join this same root pnpm workspace and add their actual consumer journeys.
