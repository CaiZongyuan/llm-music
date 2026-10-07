# Web foundation verification — #32

Baseline: `b3ea84154f0e8062e508db5ab661d99ea4cb7845`. The user accepted the retained `e2029719eab0e02d2e198f48fdd0f9e21ff360d6` layout/flows and required Chinese/English and light/dark modes. This candidate implements formal Library/Project/Asset behavior and the initial shared Job boundary. Issue closure and integration remain Root decisions.

## Actual results

| Boundary | Result and scope |
| --- | --- |
| Fresh workspace | `pnpm install --frozen-lockfile` passes. React19.3, Vite8.3, Router1.170/compatible plugin1.168 and Query5.104 are pinned. `web:check` first builds the existing generated SDK, generates file routes, builds Web and passes strict TypeScript. Browser TypeScript passes. |
| Four visual modes | Real Chromium tests passed zh-CN/en × light/dark create→upload→native original-file download→reload/reopen. Names/notes/file selection survive preference changes; locale/theme and route persist after reload. Assertions read actual FastAPI Project/Asset ids and compare downloaded SHA256/size with the retained 16-second original WAV. |
| Independent creator consumer | Root independently created Project `bea5e30f-17a8-466f-bdd1-f31f051305a8`, uploaded Asset `a897143d-cae1-4ad4-9d47-0348547b4893`, and checked English/dark then Chinese/light after reload. The original768044 bytes and SHA256 `3e750dc33cd6e99672c8987346dccd8578f8986b03496252261ef3c7a7285a0a` match the source fixture. Root-owned screenshots and facts remain in `.scratch/p2-development/32-foundation/`. |
| Failure/recovery | Focused actual Chromium test passes: invalid WAV→422 and no Asset; corrected WAV→saved Asset; intercepted failed GET→read again while preserving selected file; held GET→visible loading→recovery; missing Project/global route→Library;390px navigation and no horizontal overflow. |
| Shared Job first consumer | Actual generated client/CPU FakeRuntime POST through the exported Web hook returns202. A stale GET captured before submission is held, then released; A retains the returned Job while B remains empty. HTTP refresh and actual page reload retain the same Job id with one persisted submission. The dev test consumer verifies runtime.mode=fake before allowing a submit and is excluded from production build inputs. |
| Stable affected refresh | After list-cache completion and bounded simplification, the Chinese/light creator test and shared Job consumer passed again. Other locale/theme behavior and independent evidence were reused because their source/inputs were unchanged. These are matrix plus focused results, not a claim that all six tests ran together at the final source. The new Web CI runs the complete suite on the pinned candidate. |
| Docs | `docs:check`:15 tests pass, Astro0 errors/warnings. `docs:build` verifies46 registered bilingual pages,50 HTML files and3333 references. A pre-existing missing404-content warning is retained. No publication is claimed by these local checks. |

The browser harness runs production `create_app` with CPU FakeRuntime and an independent uv application environment. Each run gets its own direct-child `tests/browser/.artifacts/web-<id>/application` database/files and two loopback ports. API and Web shutdown acknowledgements are required and observed. The author demo at18035/18036 is a separate owned Fake environment; Root's Runtime8188 and closed preview18032 were not used. Browser recording is off, and the existing Swagger test entrypoint remains separate.

## Repairs and valid evidence reuse

The first product run failed before exercising flows because Playwright reloaded the config in workers and regenerated ports. The config now preserves actual API/Web identities in worker environment variables and allocates ordinary HTTP ports. Failure screenshots/traces and owned API shutdown evidence were retained. The next run passed four creator cases and the shared Job case; the loading assertion failed because three legitimate parallel status regions made an unscoped selector ambiguous. A focused recovery run passed after selecting one visible loading region.

The early empty fixed footer could cover a low-viewport create button. It is now a normal footer reserved outside the route outlet for #35's single Player, with scroll spacing. Project UUID is in an optional record disclosure. CSS was formatted and obsolete positioning removed; no new store, translation framework, duplicated subscription system or placeholder feature package was introduced.

## Impact and handoff

API/Pydantic schemas, generated SDK source, Python locks, database migrations and Runtime code are unchanged. The root pnpm graph adds Web and a browser-test SDK consumer. All576 old package identities and integrity hashes remain;637 total packages are locked. Existing docs optional peer bindings now include supports-color/jiti supplied by the added tooling; unchanged docs behavior passed generation/type/build checks. The SDK importer remains exactly unchanged.

`apps/web/README.md` records fixed feature imports, route/theme/word ownership and the shared Job writer handoff to #33. #34/#35 consume this same boundary after actual foundation integration; their complete acceptance waits for #33's Monitor. The initial Job UI reads HTTP with explicit refresh. It does not claim full cancellation/retry/WS reconnection, transcription, generation/listening/Version flow, or real music inference. No full API/GPU suite was repeated; existing unchanged stage evidence remains separate.
