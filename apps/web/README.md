# Web foundation

React/TypeScript/Vite with TanStack file routes and Query. `pnpm web:dev`, `web:check` and `web:build` build the existing OpenAPI client first; no generated DTO is handwritten. The Vite plugin generates the ignored route tree before checking types. Both dev and preview proxy same-origin `/api` HTTP/WS to `MUSIC_WEB_API_TARGET` (default localhost8000 FastAPI). Serve the application through this proxy; a bare static host does not provide `/api`.

User operations: [Chinese](../../docs/guides/web-workspace.md) / [English](../../docs/guides/web-workspace.en.md). Public browser checks: `pnpm test:web`. The existing Swagger suite keeps `pnpm test:browser`; product tests use a separate `.web.ts` match and two owned loopback CPU servers. `test/consumer.html` is a narrow test consumer and is not an input of the production build.

## Ownership and stable imports

- #32 initially owns toolchain, shell, Query client, Library/Project/Asset, preferences and the shared Job boundary. Root integrates root importer/lock updates; feature owners request dependencies through this single owner.
- After #32 integrates, #33 is the only writer of `src/features/jobs/`. #34/#35 import `jobKeys`, `projectJobsOptions`, `jobOptions`, `cacheSubmittedJob`, `useSubmitGenerate`, `useSubmitTranscription`, `JobStatus`, `JobState`, `ProjectJobs` and generated `JobRead` from `features/jobs/index`. Query keys always include explicit Project/Job ids. Submission hooks cache the returned full server snapshot and cancel an older in-flight read; they never retry a POST automatically. The initial components read HTTP and offer explicit refresh. #33 adds the unified WS/HTTP Monitor and final recovery/cancel/retry behavior.
- #34 owns its Transcribe/Score routes and components; it reuses `features/assets/ReferenceAssets`, `assetsOptions`, `assetOptions` and `readAssetContent`. #35 owns Generate/Candidate/Version and Player. Neither creates another long-lived server store or Job subscription system. #34/#35 source work may proceed in parallel after foundation integration; complete acceptance waits for #33's actual Monitor integration.
- `routes/projects.$projectId.tsx` is the Project layout. Add file routes beneath `/projects/$projectId` in each feature's own files. Route generation is derived; do not edit `routeTree.gen.ts`. New top-level navigation or shell changes go through the foundation owner. `AppShell` mounts `#persistent-player` outside `<Outlet>`; #35 replaces this footer with the single continuous Player and accepts selection intents from other features. No audio element exists in the initial foundation.

## Language and theme

`features/preferences/Preferences.tsx` owns `Locale`, `Theme`, `PreferencesProvider`, `usePreferences`, `defineMessages`, `useMessages`. Each feature owns `features/<name>/messages.ts`, using `defineMessages(chinese, english)`; the English dictionary must contain the same keys. Import this local dictionary into your component rather than editing a shared global word list. User names, notes and filenames remain unchanged. Preference changes re-render mounted forms without replacing their identity.

Only `music.locale.v1` and `music.theme.v1` are stored in localStorage. Both reads and writes tolerate disabled storage. The HTML bootstrap applies the saved theme/language before React loads. Theme colors live in `styles.css` CSS variables; use `--surface`, `--soft`, `--text`, `--muted`, `--line`, `--accent`, `--accent-text`, `--error`, `--error-bg` for both themes. Keep main text contrast at least4.5:1 and retain visible keyboard focus/reduced-motion behavior. Saved Project/Asset/Job data lives only on the API and in Query, not localStorage.

## Scope of evidence

The Web tests call the generated client through real Chromium and production FastAPI with isolated CPU FakeRuntime. They verify persistent ids, metadata and downloaded original bytes; they do not prove music inference, transcription accuracy or complete #33–35 behavior. See [verification](../../docs/verification/web-foundation.md). Real Runtime8188/GPU is Root-owned and never a test proxy target.
