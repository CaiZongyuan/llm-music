Start a Morning song Project with a warm folk-pop recipe. Get a Candidate you can hear, inspect the score, and decide whether to save it.

## What you will get {#start}

<p>An approximately 35-second FLAC and the ABC score from the same generation. The style, original lyrics, and seed below were verified in a real generation; the home-page MP3 is a compressed copy of that run. Check quality and duration again when rerunning.</p><p>You can start without a Project. Follow <a href="./resources.en.md">preparation</a> to run a ready real Runtime and application API. Fake mode can help you practice the save flow, but its audio is a test tone.</p>

## 1. Describe the sound you want {#style}

<p>This recipe specifies language and genre first, followed by voice, two main instruments, and rhythm. Clear priorities make adjustments easier than a collection of conflicting style words.</p>

**Verified style · style**

```text
English, gentle folk pop, warm clear voice, acoustic guitar and piano, light bass and drums, 96 BPM
```

<p>Keep it unchanged first. Try electronic or quieter arrangements separately in the next chapter. BPM and style words express intent; exact adherence is not guaranteed.</p>

## 2. Give the fragment a small theme {#lyrics}

<p>The example is about morning and companionship. Keep lines short and use Verse and Chorus sections. A 35-second fragment may not sing every line. First listen for natural language and phrasing.</p>

**Original lyrics · lyrics**

<<< ../../services/api/examples/creator/morning-song-lyrics.txt

<p>These original lyrics and the recipe are already in the controlled examples. Keep the original lines and section markers so you can change just one line in the next chapter.</p>

## 3. Generate once and keep this Job {#generate}

<p>Use seed <code>2026192201</code> and keep <code>max_seconds=35</code>. Name the Project Morning song; keep later variations in this Project.</p><p>Open “Music generation” in the formal Web, enter the style, lyrics and seed above, then choose “Generate a music clip”. Follow the <a href="../guides/web-generation.en.md">workspace generation guide</a> to check the Job, listen, inspect the score and choose “Save as a version”. Read the phase when no percentage is available. A quiet period is not a reason to submit again. Expand the supplement below when you need command-line operations.</p>

<details class="creator-supplement"><summary>Supplementary entrypoint: use the existing CLI</summary>

<p>Run from the repository root in a second terminal while the API is running. The example creates the required download directory and uses the controlled lyrics above. This command creates a Project and submits generation using the configured Runtime, and downloads <code>audio.flac</code> and <code>score.abc</code>. It saves no Version. The output directory must not already exist.</p>

```powershell
uv run --project services/api --no-sync python services/api/examples/generate_save.py generate --style "English, gentle folk pop, warm clear voice, acoustic guitar and piano, light bass and drums, 96 BPM" --lyrics-file services/api/examples/creator/morning-song-lyrics.txt --seed 2026192201 --output-dir data/morning-candidate-01
```

The command calls the existing CLI directly with the controlled lyrics above. Consult its complete controlled source below when needed.

<<< ../../services/api/examples/generate_save.py

</details>

## 4. Listen, then inspect the score {#listen}

<ol><li>Choose “Listen to this music” in the Candidate, wait for the bottom player to load it, then choose “Play”. Hear the whole piece first, then check understandable vocals, accompaniment that fits the mood, and an ending without an abrupt break. You can also play the downloaded <code>audio.flac</code>.</li><li>Choose “View score”. Compare melody and rhythm with the audio and note one thing to explore next. You can also open the downloaded <code>score.abc</code> in your own ABC reader.</li><li>Write “what I want to keep” and “what I will change next.” Playable, validated files do not guarantee music you will like.</li></ol><p>This is still a Candidate. Generation supplies audio and ABC. <a href="./reference.en.md">Reference Audio transcription</a> supplies original MIDI, and the <a href="./edit-score.en.md">integrated editor</a> can edit ABC, audition, and export matching MIDI.</p>

## 5. Save explicitly when you like it {#save}

<p>Choose a name that captures intent, such as “Morning · warm folk.” Saving keeps the inputs, outputs, and provenance. Later experiments will not overwrite this audio or score.</p>

<p>After saving a second Version in the same Project, open “Versions”, choose the two pieces in “Version A” and “Version B”, then choose “Use this pair”. Use the bottom player to compare at the same number of seconds and note which better fits your goal. An unsaved Candidate can play on its own; explicitly save it before it appears in the comparison choices. With one Version, you can still listen to it alone. See <a href="./variations.en.md#compare">A/B comparison ideas</a> for the steps and recovery actions.</p>

<p>If you are not satisfied, keep the Candidate and try again. You do not need to save every generation as a Version. Saving the same Candidate, name, and parent again returns the same Version.</p>

<details class="creator-supplement"><summary>Current save entrypoint: Candidate → Version</summary>

<p>Replace placeholders with the actual ids printed in the previous step. This command writes a Version in the same Project.</p>

```powershell
uv run --project services/api --no-sync python services/api/examples/generate_save.py save --project-id <PROJECT_ID> --candidate-id <CANDIDATE_ID> --name "Morning - warm folk"
```

</details>

## If waiting expires, find the same result first {#recovery}

<p>The CLI timeout message includes Project and Job ids. Query those ids with “Read Job” in local Swagger first. Check for a completed result, queue state, or error. Do not rerun generation immediately: the original Job may still be running.</p><p>If the Job is explicitly failed, read error and recovery_required. Resolve the cause first; ask the Runtime operator to check any uncertain execution. Explicitly submit a new Job only when retry is safe. Keep the old Job and Assets.</p>

## Next: the same lyrics, a different mood {#next}

<p>Keep the Project, original lyrics, seed, and the Version you like. <a href="./variations.en.md">Change one input in the next chapter</a> to hear the difference more clearly. For a deliberate melody change, follow <a href="./edit-score.en.md">Score editing and regeneration</a>: change one phrase, audition and select it, then keep a new piece with its source parent Version.</p>
