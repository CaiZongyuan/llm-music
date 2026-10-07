# Find a melody you can inspect in reference music

Keep original reference audio in one Project, transcribe it into a read-only score, then download ABC and MIDI. Inspect the melody and rhythm before choosing the next creative step. Transcription does not recognize lyrics or promise automatically accurate notation.

## Choose reference audio

1. Create or open a music project. Open “Reference transcription”.
2. Choose a local WAV, then choose “Add to project assets”. Selecting alone does not upload it. The application rejects invalid WAV files.
3. Choose a saved original under “Choose reference audio”. The current transcription profile is **16 seconds of PCM16, mono24 kHz or stereo48 kHz**. Other valid WAV files can remain project assets, but cannot start transcription within the current verified scope.

The upload budget is64 MiB/600 seconds; it does not establish inference support for longer audio. Start with a clear melody that is easy to listen to repeatedly. Switching language and light/dark mode preserves the current file selection and Project identity.

## Start transcription and inspect its job

1. Check “Transcription readiness”. If the service, models or capabilities are unavailable, restore the environment, then choose “Check readiness again”. Your original asset remains in the Project.
2. Choose “Start transcription”. The page keeps the original reference identity for this job, and the URL saves its Job identity. Submission is never retried automatically.
3. The job shows queued, running, completed, failed or cancelled states. When progress cannot be measured, it shows the phase alone. Choose “Read jobs again” to get a current snapshot.
4. To stop, choose “Request cancellation” and wait for “Cancelled”. An accepted request does not mean the job has stopped. After failure or confirmed cancellation, choose “Create a new retry job” to continue. It preserves the original input in a new Job and keeps the original job record readable.
5. When complete, choose “Inspect score and download MIDI”.

After an interrupted connection or unconfirmed submission, read the job list first and check whether the request already exists before submitting again. Errors preserve your selected reference. Reload returns to the same Project and Job. Select another saved transcription job to inspect its inputs and result.

CPU FakeRuntime displays a fixture-pipeline notice. Its valid score files verify application interaction, rather than real transcription quality.

## Inspect and exchange notation

abcjs draws notation from the saved ABC. “ABC music notation” retains the original text. The page shows the Score identity, producer Job and original reference audio. Check pitch, note lengths and measures, then listen to the original reference to judge whether the result matches what you hear. Listening uses the single Player at the bottom.

Choose “Download MIDI” or “Download ABC” to receive the registered original file through the browser. MIDI comes only from this Score's producer Job, rather than another transcription or generation. A music-generation score has no Reference Audio. If its producer has no MIDI, the page explains this; ABC remains available to inspect and download.

If a file cannot be read, the saved score remains. Restore storage, then choose “Download again”. If notation cannot be displayed, the original ABC and files remain: choose “Display notation again”. For an unknown Score address, choose “Back to project scores” to reopen an existing record.

Scores are currently read-only. Text editing, MIDI playback and generation from a score belong to a later phase. Open the downloaded file in a tool supporting Standard MIDI File to inspect it further.

## Local verification

See the [Web workspace guide](web-workspace.en.md#launch) to prepare and launch the independent CPU application environment. The transcription tests exercise real Chromium, the generated client, FastAPI, isolated SQLite/files and valid FakeRuntime output:

```powershell
pnpm web:check
pnpm test:browser:check
pnpm test:web -- transcription.web.ts
pnpm --filter @llm-music/browser-tests exec playwright test --config transcription.playwright.config.ts
```

Tests cover both languages and themes, upload and source relations, read-only notation, native download bytes and MIDI note events, reload recovery, invalid input and recovery after a real file becomes unavailable. The extra configuration reuses an isolated controlled CPU Fake Runtime to check missing models, an unavailable service, stale observations, cancellation confirmation and explicit retry after failure, using ports18039/18040. Fake and real GPU results are recorded separately; see the [transcription Web verification record](../verification/web-transcription.md).
