# Generate and verify the Music Workbench documentation site

Work from the repository root. Use Node.js 24.18.0, pnpm 11.22.0, uv 0.11.28, and Python 3.12.13. This guide is verified on Windows x64; PowerShell runs the isolated example checks. API references use the independent FastAPI environment for CPU contract export. The ComfyUI environment is not used. These commands run no Doctor checks, download no weights, and submit no GPU requests.

## Get a browsable site

```powershell
pnpm install --frozen-lockfile
uv sync --project services/api --locked --python 3.12.13
pnpm docs:dev
```

Open <http://127.0.0.1:18029/llm-music/zh-cn/overview/>. The service listens on localhost only. Press Ctrl+C to stop your own process. Keep Runtime's port 8188 free. If 18029 is occupied, run `pnpm docs:dev --port 18030`. After changing body sources or the manifest, restart this entrypoint to regenerate content.

The main entrypoints serve music creators: first music, Reference Audio transcription, and style/lyrics/seed experiments. Preparation, Doctor, API, architecture, and development remain secondary resources. Existing chapter paths stay accessible. Chinese and English share chapter and section ids. Switching language retains the chapter and section. Search reads locally generated chapter content only. Readers can retry failed searches while the current page remains readable.

## Change the sources

1. Read the [documentation maintenance rules](../agents/documentation.md).
2. Edit paired `.md` and `.en.md` bodies under `docs/learn/`, `docs/guides/`, or `docs/reference/`. Do not add generated frontmatter.
3. Register the stable id, type, group, localized titles, body sources, and publish path in the [chapter manifest](../site.json). Both languages share one path. Register implemented scope only.
4. Use matching stable section ids, such as `## Prepare the models {#models}`. Previous and next chapters must be declared and reciprocal. Undeclared links never create automatic chapter chains.
5. Keep teaching code in complete versioned source files. Include a file with `<<< ../../runtime/comfyui/examples/doctor.ps1`. The generator reads the entire file and adds its source link at a fixed commit.

Register an API reference with `generated: "openapi"` and include `<<< @openapi` in its body. It reads the same `music-api openapi` export as the client. Register configuration with `generated: "settings"` and `<<< @settings`; the generator calls the existing Settings metadata function without reading effective configuration. Contract JSON stays in `.generated/` for checks. Do not hand-maintain fields, defaults, or constraints. If the independent API environment is missing, run the locked synchronization above and retry.

Register maintained guides directly. Manifest `sectionIds` assign stable ids in body section order, and the page title replaces the first H1. A section count change fails generation; update the manifest and paired bodies when adding a section. Chapters without `sectionIds` retain explicit `{#id}` markers. Tutorials, ideas, and technical resources still use one manifest, same-language links, and fixed source versions.

Relative documentation links to registered chapters become same-language internal URLs. Referenced static assets in `apps/docs/public/` become internal URLs with the deployment base. Other repository files become GitHub links at the source commit. Source includes and repository links resolve actual paths and reject paths or filesystem links that leave the repository. Images, existing music, provenance JSON, and read-only interaction scripts retain their actual source paths.

`apps/docs/src/content/docs/`, `.generated/`, `.astro/`, `dist/`, and the search index are generated and ignored by Git. Edit the owning source and regenerate rather than changing generated pages.

## Check and build

```powershell
pnpm docs:check
pnpm docs:build
pnpm --filter @llm-music/docs preview
```

`docs:check` validates the manifest, sources, language pairs, sections, navigation, and code includes. It exercises independent failure cases and PowerShell examples with an isolated fake provider, then checks Astro types. `docs:build` regenerates and builds the static site. It checks final pages, internal links, anchors, assets, search registrations, and the `/llm-music/` deployment base. The check retains Starlight's generic 404 canonical/alternate metadata convention; actual navigation and assets on that page are still checked.

The four complete Runtime connection examples accept the same `-Port`, defaulting to 8188. After choosing free port 8189, pass `-Port 8189` to Doctor, receipt saving, launch, and transcription in the second terminal. Transcription uses `--base-url http://127.0.0.1:8189`. Isolated checks execute these controlled scripts in sequence and confirm that transcription reads the saved receipt. Invalid ports are rejected before invoking uv. The paired Doctor and transcription chapters give the recovery steps.

A complete build after commit shows the actual Git commit and body source. Referenced files are checked against that commit. When relevant source edits are uncommitted, pages explicitly say “working copy”; that artifact does not mean the version is published. GitHub Actions checks the exact head and retains the static artifact.

Missing translations, duplicate paths, nonreciprocal navigation, missing sources, or references outside the repository fail generation. Existing generated pages are not replaced when source checks fail. Repair the owning source and retry. For broken built anchors or assets, repair the body, configuration, or component and rerun `docs:build`.

## Verification scope

This delivery provides the P0 Runtime documentation foundation. Actual GPU results reuse accepted P0 transcription and continuous-run evidence. New example exit-code and receipt protection are exercised with an isolated fake command provider. There is no new music inference, GPU benchmark, or music-quality claim.

Creator tutorials use delivered P1 generation, transcription, and explicit saving. The home-page MP3 and first recipe match a verified real 35-second piece. Other ideas are untuned, unauditioned experiments. Operations use the existing application CLI and controlled UTF-8 lyrics directly; complete source is expandable on demand. Documentation pages stay read-only. CPU checks verify recipe/lyrics/listening-copy correspondence and local static asset paths without contacting the application API or Runtime.

Creator tutorials and secondary API/configuration references cover delivered P1 capabilities. Reference generation, language pairing, source includes, and artifact checks start no application service, create no business database, and connect to no Runtime. Actual GitHub Pages publication belongs to #30; without deployment evidence, do not claim a live publication. The product Web app starts in P2.
