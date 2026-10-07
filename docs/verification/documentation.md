# #28 Documentation foundation verification

The approved preview is `documentation-v1` at `9ae306cae070df46da28c0dacceb21ced6356f6e`, based on integrated source `236eee2ec2b7fc0ca66b53ebea5c679dec736190`. The user explicitly answered “认可，继续正式文档实现（推荐）”. The preview is retained unchanged, with the actual answer and formal comparison in [the UI record](../ui/28-documentation-preview.md).

## Implemented boundary

Twelve registered Markdown bodies form six paired chapters. `docs/site.json` owns stable ids, body paths, publish paths, titles, groups, locale mapping and reciprocal previous/next links. The generator reads six complete controlled PowerShell examples, rejects repository escapes including filesystem links, converts registered document links to same-language routes, and converts source links to the actual Git commit. No unregistered process report becomes a public chapter.

Astro 7.3.6 and Starlight 0.42.5 share the existing pnpm root and lock. Node 24.18.0, pnpm 11.22.0 and TypeScript 5.9.3 match the existing JS baseline. The Browser workspace importer and its direct versions are unchanged; its strict TypeScript entrypoint passed after installation. No API or Runtime production implementation was changed. Only the new source examples call existing Runtime CLI operations, with explicit failure propagation and successful-readiness receipt protection.

## Actual checks

- `pnpm docs:dev` generated sources and served the real Starlight site on an owned localhost port.
- `pnpm docs:check` exercised ten independent checks and reported zero Astro errors, warnings or hints. Cases cover registration/language/navigation failures, complete source inclusion and same-language links, literal code examples, filesystem escape rejection, repository directory aliases, artifact link/anchor/base/publication failures, wrong code-control locale, and PowerShell recovery behavior.
- PowerShell examples executed against an isolated fake `uv` function. Failure preserved an earlier readiness receipt. Successful fake output alone replaced it. All other examples propagated nonzero results. These are CPU logic checks, not GPU evidence.
- `pnpm docs:build` produced twelve chapters plus three landing redirects and Starlight's generic 404. It checked 475 internal references, stable anchors, assets, search registrations, deployment base `/llm-music/`, source metadata, Markdown render inputs and code-control language. In a clean committed build, every cited source must exist in the displayed commit.
- Real Chromium exercised navigation, same-section language switching, theme persistence after refresh, search loading/empty/failure/retry, MIDI result navigation, missing-page recovery and command copying. All six English code controls were read from actual DOM. Copying displayed `Copied!`. Root independently compared the formal layout with the approved preview and supplied the initial English-control defect.

The initial Starlight title configuration used route locale keys rather than language-code keys and was repaired. The artifact check found a missing favicon, now versioned. English code controls inherited the default Chinese strings; explicit paired resource values repair the fallback, and render-input hashing prevents stale Markdown after config/translation changes. A temporary locale callback was disproved and removed. Initial failures and corrected browser selectors remain in the owned scratch evidence.

The first hosted documentation run, [37593287219](https://github.com/CaiZongyuan/llm-music/actions/runs/37593287219), found two path-resolution failures on Windows temporary-root aliases. An independent repository-root junction reproduced the same incorrect source links before repair. The loader now resolves the repository root once before chapter registration and relative paths; the regression passes without relaxing source-boundary rejection or language-link assertions. The original hosted failure remains retained. Hosted Browser and Runtime Doctor checks on that candidate succeeded.

Independent Spec review at `e327a3e` found that occupied-port recovery changed Doctor/start while the transcription example still used 8188. All four controlled connection scripts now validate a `-Port` parameter (1–65535, default 8188), pass it to Doctor/save/start, and derive transcription `--base-url` from it. The paired public chapters describe the complete 8189 recovery, including its second terminal. One owned CPU capture executes those same four scripts in sequence: both default 8188 and selected 8189 reach the matching launch and transcription arguments, and transcription reads the receipt saved by the preceding check. Ports 0 and 65536 invoke no uv command and preserve the prior receipt. The port regressions failed before repair, then passed; no native service or GPU request was used. An initial test-harness receipt string had PowerShell extended properties and was converted to a plain string before verification.

Starlight emits its normal missing-custom-404 notice. Its generic 404 canonical/alternate metadata uses unavailable translated 404 paths, so only those metadata references are excluded from link validation. Actual generic-404 navigation and assets remain checked. The generic 404 uses the default Chinese language and can return to the overview via the site title. Static landing redirects require navigation to settle before browser interactions.

## Evidence and limits

Owned records are under `.scratch/p1-development/28-documentation/` in the issue worktree: source checks, browser receipts, preserved initial failures, cache archive and screenshots. Final source commit, build output and source-footer readback are pinned in the PR handoff after commit. Generated pages, caches, search JSON and dist are ignored by Git.

The new site reuses accepted P0 Runtime execution evidence and unchanged CLI inputs. It does not run Doctor, download models, restart the retained Runtime or submit GPU inference. No new benchmark, transcription-accuracy or music-quality claim is made. The shared GPU and Runtime8188 remain Root-owned.

The bounded simplification removed a disproved locale callback and temporary logging. Source validation, artifact inspection and the public search component retain separate responsibilities. No additional useful removal was found inside this candidate. Formal FastAPI tutorial/reference belongs to #29; actual GitHub Pages publication belongs to #30. This ticket reports a local checked build, with no deployment claim.
