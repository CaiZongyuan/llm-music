# Generate and verify the Runtime documentation site

Work from the repository root. Use Node.js 24.18.0 and pnpm 11.22.0. This guide is verified on Windows x64; PowerShell runs the isolated example checks. FastAPI and ComfyUI environments are not used for documentation generation. These commands run no Doctor checks, download no weights, and submit no GPU requests.

## Get a browsable site

```powershell
pnpm install --frozen-lockfile
pnpm docs:dev
```

Open <http://127.0.0.1:18029/llm-music/zh-cn/overview/>. The service listens on localhost only. Press Ctrl+C to stop your own process. Keep Runtime's port 8188 free. If 18029 is occupied, run `pnpm docs:dev --port 18030`. After changing body sources or the manifest, restart this entrypoint to regenerate content.

Documentation offers three task entrypoints: first run, architecture, and task guides. Chinese and English share chapter and section ids. Switching language retains the chapter and section. Search reads locally generated chapter content only. Readers can retry failed searches while the current page remains readable.

## Change the sources

1. Read the [documentation maintenance rules](../agents/documentation.md).
2. Edit paired `.md` and `.en.md` bodies under `docs/learn/`. Do not add generated frontmatter.
3. Register the stable id, type, group, localized titles, body sources, and publish path in the [chapter manifest](../site.json). Both languages share one path. Register implemented scope only.
4. Use matching stable section ids, such as `## Prepare the models {#models}`. Previous and next chapters must be declared and reciprocal. Undeclared links never create automatic chapter chains.
5. Keep teaching code in complete versioned source files. Include a file with `<<< ../../runtime/comfyui/examples/doctor.ps1`. The generator reads the entire file and adds its source link at a fixed commit.

Relative documentation links to registered chapters become same-language internal URLs. Other repository files become GitHub links at the source commit. Source includes and repository links resolve actual paths and reject paths or filesystem links that leave the repository.

`apps/docs/src/content/docs/`, `.generated/`, `.astro/`, `dist/`, and the search index are generated and ignored by Git. Edit the owning source and regenerate rather than changing generated pages.

## Check and build

```powershell
pnpm docs:check
pnpm docs:build
pnpm --filter @llm-music/docs preview
```

`docs:check` validates the manifest, sources, language pairs, sections, navigation, and code includes. It exercises independent failure cases and PowerShell examples with an isolated fake provider, then checks Astro types. `docs:build` regenerates and builds the static site. It checks final pages, internal links, anchors, assets, search registrations, and the `/llm-music/` deployment base. The check retains Starlight's generic 404 canonical/alternate metadata convention; actual navigation and assets on that page are still checked.

A complete build after commit shows the actual Git commit and body source. Referenced files are checked against that commit. When relevant source edits are uncommitted, pages explicitly say “working copy”; that artifact does not mean the version is published. GitHub Actions checks the exact head and retains the static artifact.

Missing translations, duplicate paths, nonreciprocal navigation, missing sources, or references outside the repository fail generation. Existing generated pages are not replaced when source checks fail. Repair the owning source and retry. For broken built anchors or assets, repair the body, configuration, or component and rerun `docs:build`.

## Verification scope

This delivery provides the P0 Runtime documentation foundation. Actual GPU results reuse accepted P0 transcription and continuous-run evidence. New example exit-code and receipt protection are exercised with an isolated fake command provider. There is no new music inference, GPU benchmark, or music-quality claim.

The complete FastAPI tutorial and generated reference belong to #29. Actual GitHub Pages publication belongs to #30. This ticket provides local builds and the `/llm-music/` path. Without deployment evidence, it does not claim a live publication. The product Web app still starts in P2.
