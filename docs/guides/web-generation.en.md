# Generate, listen and keep a version in the workspace

Continue with “A walk after rain”. Try a warm piano song, inspect the voice, melody and score, then save the result you like. The formal Web reads and saves through the application service. CPU FakeRuntime returns a labeled test tone and example score.

## Start with a clear direction {#generate}

1. Open “Generate music” in the project workspace. Enter “warm piano, a bright melody and clear vocals” in “Music style”.
2. Write a short lyric in “Lyrics”. Use `[Verse]` and `[Chorus]` to organize sections. Keep seed `2026192201` to record this attempt.
3. Confirm “Ready to create”, then choose “Generate a music clip”. Clip length is fixed at 35 seconds. The seed must be an integer from 0 to 9007199254740991.
4. Follow phases under “Creative job”. Unknown progress shows the phase without an estimated percentage. A completed job produces a playable Candidate. It does not save a Version.

Missing models or unavailable creative resources disable submission. Restore resources, then choose “Check readiness again”. Changing language or theme preserves current input.

## Listen, inspect the score and adjust {#listen}

1. Choose “Listen to this music”, wait for the bottom player to read audio, then choose “Play”.
2. Check whether the melody is clear, the voice follows the lyrics and the beginning and ending are complete. Drag playback position or adjust it with the keyboard.
3. Expand “Listening region”. Enter a start and end within the audio duration, choose “Set region”, then “Play region”. Playback pauses at the end. A region must satisfy `0 ≤ start < end ≤ audio duration`. You can also drag region boundaries on the waveform.
4. Choose “View score” to inspect this generated Score. Music continues in the same player while switching to “Lyrics and inputs” or “Versions”. A generated Score uses its own ABC. The page explicitly indicates when transcription reference audio or MIDI is unavailable.

“Lyrics and inputs” shows the current draft. “Submitted inputs” shows the Candidate snapshot. “Explore with these inputs” copies that snapshot into the draft without changing the original Candidate or Version. Keep lyrics and seed, change only the style, then generate another candidate and compare your listening notes.

## Explicitly save the result you like {#save}

1. After listening, enter “A walk after rain · warm piano” in “Version name”.
2. Choose “Save as a version”. Success shows “View saved version” and adds this choice to the version list.
3. Open the version to inspect original inputs and results. Refreshing reads the same Version identity and audio. Later generation keeps old versions intact.

The application service retains the candidate list. Select a candidate again after refresh. Unsaved Candidates do not belong to version history. The current draft remains only in the open Web. After refresh, restore submitted inputs from a job link or choose “Explore with these inputs” on a candidate. Player selection and playback position also belong to the current Web session; select audio again after refresh.

## Continue after failure {#recover}

- GPU memory exhaustion, missing models, workflow failure or cancellation: style, lyrics and seed remain. Restore resources, then explicitly choose “Create a new retry job”, or adjust inputs and generate again. Retry creates a new Job and retains the original job and existing versions.
- Audio cannot play: choose “Reread audio”. If it still fails, download the original file from project assets to inspect it. Candidate and inputs remain.
- Version save fails or its acknowledgement is lost: name and Candidate remain. Choose “Reread saved versions” first to check whether it was saved. If no record exists, retry with the same name. Repeated saves of the same Candidate and name return the same Version without duplicate history.
- Candidate or version reads fail: use the corresponding reread action. A read error does not become empty history.

The single continuous player supports selection, play, pause, seek and bounded regions. This stage has no score editing, Cover, A/B switch, long-song generation or version graph. See the [workspace guide](web-workspace.en.md#launch) to start the formal Web and independent application service.

