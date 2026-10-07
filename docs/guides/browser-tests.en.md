# Run browser integration tests

Use real Chromium to operate the existing FastAPI Swagger `/docs` and verify Project, input errors, Generate, Candidate, Audio/Score, and explicit Version saving. These tests cover the P1 API documentation as a browser consumer. The formal music Workbench Web is developed in P2; these tests do not establish real Web + ComfyUI end-to-end acceptance.

## Install and run

Prepare Node `24.18.0`, pnpm `11.22.0`, and uv `0.11.28`. Run from the repository root. The first installation needs network access to download pinned dependencies, Python `3.12.13`, and Chromium.

```powershell
pnpm install --frozen-lockfile
uv sync --project services/api --locked --python 3.12.13
pnpm test:browser:install
pnpm test:browser:check
pnpm test:browser
```

Success prints `1 passed`. The test uses Swagger `Try it out`, forms, `Execute`, and `Download file` to perform real HTTP: create and read a Project, display a real `422 invalid_request`, generate a Candidate, inspect Score, download Audio and check SHA256, check the empty Version list, and explicitly save. The first save returns `201`; the identical save returns `200` with the same Version. The test reloads the page and reads that Version again.

The API uses its independent `services/api` uv environment. Each run selects an available loopback port and creates a new `tests/browser/.artifacts/<RUN_ID>/application/` directory. SQLite and files are real writes owned only by this CPU test run. Runtime is explicitly `fake`; the audio is an original CPU test tone. The test does not connect to ComfyUI or load models. Chromium uses `--disable-gpu`.

The existing `/docs` HTML and OpenAPI stay unchanged. Only Swagger CDN JS/CSS requests are fulfilled with the pinned local `swagger-ui-dist` files, and the external favicon request is cancelled. All business HTTP reaches the real API. Recheck browser actions and these static resource paths when upgrading FastAPI or Swagger.

## Inspect a failure and recover

After a failure, inspect `tests/browser/playwright-report/index.html`. Swagger tests retain failure screenshots and traces in `tests/browser/test-results/`. Following user feedback, they always disable video, even with `PLAYWRIGHT_RECORD_VIDEO=on`. GitHub Actions retains failure artifacts for seven days and generates or uploads no new Swagger recording. API ownership and shutdown facts remain in `.artifacts/<RUN_ID>/owner.json`, `api.log`, and `stopped.json`; `graceful: true` records completed application shutdown.

```powershell
pnpm --filter @llm-music/browser-tests exec playwright show-report
pnpm --filter @llm-music/browser-tests exec playwright show-trace test-results/<TEST_RESULT_DIR>/trace.zip
```

Replace `<TEST_RESULT_DIR>` with the actual failure directory name. If Chromium is missing, rerun `pnpm test:browser:install`. If API dependencies are missing, rerun locked `uv sync`. For form locator or assertion failures, inspect the trace first. Each rerun gets a new data directory; preserve the original failure evidence. An occupied port fails rather than reusing an existing service. Do not stop someone else's service.

At completion, the test requests graceful shutdown of its own API and waits for acknowledgement. Data and logs remain for failure inspection and are not deleted automatically. After checking `stopped.json`, you can remove that specific `<RUN_ID>` directory. Screenshots, videos, databases, Node modules, and Python environments do not enter Git.

## Interactive debugging and traces

```powershell
pnpm test:browser:ui
```

This opens the Playwright test interface. To retain one successful trace, including automatic screenshots, run:

```powershell
pnpm test:browser --trace on
```

The trace is `tests/browser/test-results/<TEST_RESULT_DIR>/trace.zip`. Previously delivered Swagger recordings remain historical evidence. The general harness keeps `PLAYWRIGHT_RECORD_VIDEO=on` available for future formal Web tests; major visible workflows can use a separate compressed WebM when needed, and actual generated music auditions use separate compressed copies. The current Swagger suite records no video. A downloaded CPU test tone is not real music generation evidence.

This repository uses one root pnpm workspace and lockfile. Future TypeScript client and P2 Web packages join that workspace. P2 journeys need tests of real product pages; renaming Swagger tests does not establish product Web acceptance.

Complete, version-controlled test and launch sources:

<<< ../../tests/browser/playwright.config.ts

<<< ../../tests/browser/run_api.py

<<< ../../tests/browser/teardown.ts

<<< ../../tests/browser/swagger.ts

<<< ../../tests/browser/swagger.spec.ts

See the [maintenance record](../verification/browser-tests.md) for actual verification and limits. The online documentation site is not delivered yet; read the repository documents directly.
