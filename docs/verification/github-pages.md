# GitHub Pages delivery and recovery

This maintenance record is outside `docs/site.json` and is not a public chapter. The public site uses the already approved creator tutorials and secondary API/configuration guides. Publication does not add product Web functionality.

## Pipeline and provenance

`.github/workflows/documentation.yml` keeps the existing locked, CPU-only Windows build:

```text
exact checkout commit
  -> pnpm docs:check (generate, behavior checks, Astro types)
  -> pnpm docs:build (generate, Astro build, final HTML checks)
  -> require committed sources at that checkout commit
  -> retain documentation-<commit>
  -> on main: package that same apps/docs/dist as github-pages
  -> dependent deploy job: read Pages settings, verify URL, deploy github-pages
```

The deployment job does not check out source or rebuild. A failed build, source mismatch, working-copy receipt, artifact upload, or URL check prevents deployment. Pull requests and other branches have read-only checks and cannot upload the Pages artifact or run the deployment job. Only `push` and `workflow_dispatch` on `refs/heads/main` can publish. Workflow and Pages deployment concurrency do not cancel an in-progress deployment.

All actions are pinned to full commits. Only the deployment job receives `pages: write` and `id-token: write`; checkout does not persist credentials. The upload action supports Windows and pins its nested upload action. The API environment is the independent locked `services/api` uv project; reference export uses fake Runtime metadata and rejects application-data creation. No ComfyUI environment, model, CUDA dependency, or GPU connection is needed.

The existing artifact checker verifies registered pages, bilingual navigation, links, anchors, resources, source metadata, and `/llm-music/`. `pages-provenance.mjs` additionally requires that the displayed source commit equals the event's checkout commit and that sources are committed. Main's deployment summary records that commit, the immutable Pages artifact ID, expected URL, deployment output URL, and deployment-step outcome. A deployment success is distinct from the browser verification below.

## Repository setup

Read the current settings before changing them:

```powershell
gh api repos/CaiZongyuan/llm-music/pages
gh api repos/CaiZongyuan/llm-music/environments
```

At implementation preparation, the repository was public with default branch `main` and `has_pages: false`; the authenticated account reported repository admin access. The Pages endpoint returned HTTP 404, and no repository environments were listed. No site has been enabled or deployed by this preparation. These observations do not establish current settings after a maintainer changes them.

The integration owner enables **Settings → Pages → Build and deployment → Source → GitHub Actions**. The existing custom workflow is sufficient; do not create a second build workflow or publish the raw `docs/` folder from a branch. The equivalent initial API operation is:

```powershell
gh api --method POST repos/CaiZongyuan/llm-music/pages -f build_type=workflow
gh api repos/CaiZongyuan/llm-music/pages --jq '{build_type,html_url,status}'
```

Use `PUT` with `build_type=workflow` only if a readback shows an existing site with a different publishing source. The workflow's `configure-pages` uses `enablement: false` and will report a missing site rather than modifying repository settings. No additional secret or personal access token is needed by the workflow. Account permissions and repository Actions policy must allow GitHub's pinned Pages actions and the deployment job's scoped token permissions.

The deployment targets the `github-pages` environment; GitHub can create it when the workflow runs. The integration owner should read any existing protection rules and restrict allowed deployment branches to `main`. Preserve existing required reviewers and other protection rules, if present. A waiting approval or blocked branch is an actual deployment prerequisite, not a successful release.

The configured Pages URL must equal `https://caizongyuan.github.io/llm-music/`, as derived from `docs/site.json`. A custom domain or repository rename needs a coordinated site/base change and fresh artifact verification.

## Integration and online verification

After independent review and required final-head CI, the integration owner merges the candidate, reads back the actual merge commit, and observes the resulting main documentation run. A pull request's successful build and test-merge SHA are not evidence of a main deployment.

Read the main run and its artifacts using its actual numeric run ID:

```powershell
gh run view RUN_ID --repo CaiZongyuan/llm-music --json headSha,status,conclusion,jobs,url
gh api repos/CaiZongyuan/llm-music/actions/runs/RUN_ID/artifacts --jq '.artifacts[] | {id,name,digest,expired}'
gh api repos/CaiZongyuan/llm-music/deployments?environment=github-pages --jq '.[] | {id,sha,environment,created_at}'
```

Confirm that the `github-pages` artifact ID matches the deployment summary and belongs to that run/head. Preserve the artifact API digest when available. Preserve the deployment record/status and environment URL. The Pages deployment uses this run's uploaded artifact, rather than an artifact from a separate rebuilding workflow.

In a real browser at the public address, verify:

1. `/llm-music/` opens the Chinese overview. A creator tutorial and its next chapter load under this base, with visible text and working static assets.
2. The chapter's language control opens the equivalent English page and returns to Chinese. Follow a displayed source link to the same commit on GitHub.
3. Search for an existing chapter, open a result, and confirm that its destination preserves the base and selected language. Verify an unmatched search's empty state.
4. Change the theme and confirm readable content after navigation. Read the visible source commit and the `music-source-commit` metadata; both must match the main run's `headSha`. `music-source-workspace` must be `false`.
5. Record checked URLs, browser/viewport, chapter and language results, source-link result, search/theme results, screenshots or equivalent readable evidence, and the observed commit alongside the run/artifact/deployment IDs. Keep actual browser results separate from CPU build evidence.

Online delivery remains pending until those observations exist. A localhost preview or HTTP download alone cannot replace the required browser behavior verification.

## Failure and recovery

| Observation | Recovery |
| --- | --- |
| Generation, behavior, type, link, anchor, asset, or base check fails | Fix the owning source on a reviewed branch and rerun the same checks. No failed build artifact is published. |
| Source receipt differs from the event commit or says working copy | Rebuild a clean checkout of the intended commit; do not bypass the provenance check or relabel an older artifact. |
| `configure-pages` returns 404 | Read repository Pages settings, enable GitHub Actions publishing, read back `build_type` and URL, then rerun the failed deployment job if its verified artifact is still available. |
| Pages token/Actions policy denies deployment, or the environment is waiting/blocked | Record the failing job and exact permission/protection prerequisite. The integration owner fixes the specific setting or obtains the required approval, then reruns the failed job. |
| Configured URL differs from the checked URL | Resolve the repository URL/site/base mismatch before deploying. Rebuild and verify if the intended base changes. |
| Artifact expires before recovery | Dispatch the workflow on current `main`, which regenerates, checks, builds, and uploads a new verified artifact. Record the new run/head/artifact correspondence. |
| Deployment succeeds but the public page is unavailable or shows an earlier commit | Keep the issue open. Read deployment status, retry browser readback after publication propagation, and retain both observed versions. Do not substitute a local preview for the live result. |
| Published content needs correction | Revert or fix it through a reviewed main change and let this pipeline deploy the newly checked commit; preserve the previous and replacement deployment records. |

For an unexpired artifact in the same run, rerun only the failed deployment job using its actual job ID. For a new build of current main, dispatch the existing workflow:

```powershell
gh run rerun RUN_ID --job JOB_ID --repo CaiZongyuan/llm-music
gh workflow run documentation.yml --ref main --repo CaiZongyuan/llm-music
```

Do not report issue #30 complete from this runbook or from local checks. Report the actual CI, deployment, and browser results, including any remaining blocker. Setup, deployment, integration, and issue closure belong to the integration owner.

## Primary references

- [GitHub: custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [GitHub: publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [GitHub: Pages REST API](https://docs.github.com/en/rest/pages/pages)
- [configure-pages pinned action contract](https://github.com/actions/configure-pages/blob/983d7736d9b0ae728b81ab479565c72886d7745b/action.yml)
- [upload-pages-artifact pinned action contract](https://github.com/actions/upload-pages-artifact/blob/7b1f4a764d45c48632c6b24a0339c27f5614fb0b/action.yml)
- [deploy-pages pinned action contract](https://github.com/actions/deploy-pages/blob/368f82528645a54fb793d4d04e342629a3f51346/action.yml)
