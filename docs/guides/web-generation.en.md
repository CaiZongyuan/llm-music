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

To use a deliberate melody edit in the next song, follow the [editing and regeneration tutorial](../learn/edit-score.en.md#regenerate): inspect, audition and save/select a Score, then choose “Generate from selected Score” on its page. That Job retains actual ABC, source Score and parent Version. Generation from style and lyrics alone remains a separate creative operation.

## Explicitly save the result you like {#save}

1. After listening, enter “A walk after rain · warm piano” in “Version name”.
2. Choose “Save as a version”. Success shows “View saved version” and adds this choice to the version list.
3. Open the version to inspect original inputs and results. Refreshing reads the same Version identity and audio. Later generation keeps old versions intact.

“Versions” shows saved parent relationships in the same Project, including several valid independent starting points. Parent links, inputs, origin and “Saved outputs” come from saved snapshots. To branch from an earlier Version, choose “Continue from this version”, explicitly select its Score, then generate from that Score. Choose “Use this version’s inputs” separately to copy style, lyrics and seed. Inspecting or entering a Version preserves existing drafts and creates no Job. New results remain Candidates until you name and explicitly save a child Version.

The application service retains the candidate list. Select a candidate again after refresh. Unsaved Candidates do not belong to version history. The current draft remains only in the open Web. After refresh, restore submitted inputs from a job link or choose “Explore with these inputs” on a candidate. Ordinary Asset and draft MIDI listening choices remain in this Web session. A/B choices can recover as described below; playback position is not retained.

## Compare two saved works {#compare}

1. In “Versions”, use “Choose two saved versions” to select different “Version A” and “Version B”, then choose “Use this pair”. With no second Version, choose “Listen to A only”. Explicitly save a Candidate before comparing it.
2. Wait for the audio, press “Play”, then use “Switch to A” or “Switch to B”. Switching preserves absolute seconds, without proportional or beat alignment. Paused switching stays paused; playing switching continues when the target is ready.
3. Expand “Common listening region”, set times both clips contain and choose “Play region”. It plays once and pauses at the end. A manual seek cancels this bounded playback. Drag or resize waveform region boundaries.
4. Open Score, lyrics and inputs or settings while the player keeps the same audio. Explicitly auditioning another Asset or draft MIDI changes source. “Return to comparison” reopens A/B paused at0.

If a shorter target cannot reach the current second, it stops at its actual end, paused. Returning to the longer work does not resume automatically. After a natural end, explicitly press “Play” to replay from the start. A new pair starts paused at0; set a new region when the previous one does not fit the new common range.

Reloading inside the same Project restores only still-valid Version ids and the A/B side, paused at0, without a region. Reselect saved Versions when choices are unavailable. Storage failure still allows listening now, but reload recovery is not guaranteed. Reread after an audio or Version read failure; restore a missing original Audio/ABC file first. History remains and no music is generated automatically. See the [version variations tutorial](../learn/variations.en.md#compare) for more experiments.

## Continue after failure {#recover}

- GPU memory exhaustion, missing models, workflow failure or cancellation: style, lyrics and seed remain. Restore resources, then explicitly choose “Create a new retry job”, or adjust inputs and generate again. Retry creates a new Job and retains the original job and existing versions.
- Audio cannot play: choose “Reread audio”. If it still fails, download the original file from project assets to inspect it. Candidate and inputs remain.
- Version save fails or its acknowledgement is lost: name and Candidate remain. Choose “Reread saved versions” first to check whether it was saved. If recovery is needed, choose “Save the same version again”. It uses the first name and Candidate; later text edits do not change the recovery intent. Repeated saves of the same Candidate and name return the same Version without duplicate history.
- Candidate or version reads fail: use the corresponding reread action. A read error does not become empty history.

The single continuous player supports Asset listening, saved-Version A/B, seek and bounded regions. The Score page supports ABC editing, MIDI audition/export and generation from selected notation. Saved Versions show their relationships and support explicit continued creation; Cover supports both modes. Long-song generation remains a later stage. See the [workspace guide](web-workspace.en.md#launch) to start the formal Web and independent application service.

