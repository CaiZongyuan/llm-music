Continue Morning song. Keep the original recipe and change one dimension. Hear the differences, then save the Candidate you want to keep as a named Version.

## Continue from your first piece {#start}

<p>Keep the first chapter's Project id, original lyrics, style, seed <code>2026192201</code>, and downloaded audio. Listen again and write one question: do I want more space in the arrangement, a lyric line that sings better, or another random starting point?</p><p>These changes generate new short fragments; they do not edit the earlier audio. There is no integrated A/B player yet. Listen one at a time in your own player. The same seed does not guarantee identical bytes across models, environments, or versions.</p>

## 1. Choose a question worth listening for {#recipes}

<p>Select a recipe to see exactly what changes. The first is a verified example. The others are <strong>inspiration recipes that have not been tuned or auditioned</strong>. They illustrate directions to try, not promised results. This only changes the tutorial's example inputs; it generates no music.</p>

<music-input-recipes data-verified="Verified baseline" data-inspiration="Inspiration · not auditioned" data-style-label="Style" data-copied="Inputs copied" data-copy-failed="Automatic copying was blocked. Select the inputs and copy manually.">

<div class="recipe-tabs" role="group" aria-label="Choose an input recipe"><button type="button" data-recipe="baseline" data-value="" data-note="Keep all first-chapter inputs. Listen to the warm voice with guitar and piano, then note one thing to change next." aria-pressed="true">Hear the original recipe</button><button type="button" data-recipe="style" data-value="English, gentle folk pop, warm clear voice, soft piano, restrained drums, 96 BPM" data-note="Change only style to piano-led with restrained drums. Keep lyrics and seed, then listen for the space you want." aria-pressed="false">A lighter piano arrangement</button><button type="button" data-recipe="lyrics" data-value="Morning sunlight finds the window" data-note="Change only the first line. Keep sections, other lyrics, style, and seed. Listen for phrasing and articulation." aria-pressed="false">Try another phrase</button><button type="button" data-recipe="seed" data-value="2026192202" data-note="Change only seed to 2026192202. Keep style and all lyrics, then listen for a melody or structure you prefer." aria-pressed="false">Another random starting point</button></div>

<p data-recipe-status aria-live="polite">Verified baseline</p><p data-recipe-description>Keep all first-chapter inputs. Listen to the warm voice with guitar and piano, then note one thing to change next.</p><p data-recipe-facts></p>

<details class="creator-supplement"><summary>View and copy inputs · JSON</summary>

<<< ../../services/api/examples/creator/morning-song.json

<button type="button" data-copy-recipe>Copy inputs</button><p data-copy-status role="status"></p>

</details>

</music-input-recipes>

<script type="module" src="../../apps/docs/public/creator-recipes.js"></script>

## 2. Listen with a goal {#intent}

| Experiment | Keep first | Listen for |
| --- | --- | --- |
| Change style only | Original lyrics, seed, 35-second setting | Instrument density, voice, and mood; style words are not exact arrangement commands. |
| Change one lyric line | Original style, seed, other lyrics | Natural articulation and phrasing, and a memorable line; it may not appear in the 35-second result. |
| Change seed only | Original style, complete lyrics, 35-second setting | A melody or structure that suits you better in another result; one difference is not a stable rule. |

<p>Hear the whole piece first, then focus on your question. Record a short preference such as “B has clearer vocals; A has a more natural ending.” Keep the original result instead of comparing from memory.</p>

## 3. Try the next Candidate in the same Project {#run}

<p>Update the chosen style, lyrics, or seed and keep the other inputs unchanged. Use a new download directory each time. Submit one new Generate Job and record its Job and Candidate ids. Existing Candidates and Versions stay unchanged.</p>

<details class="creator-supplement"><summary>Current entrypoint: reuse the same Project</summary>

<p>This command demonstrates “change seed only.” Replace the Project id and keep the controlled first-chapter lyrics. It creates a new Job and downloads a new Candidate, without saving a Version. Replace <code>--style</code> for a style experiment. For lyrics, copy the original to your own new UTF-8 file, change one line, and pass the new path with <code>--lyrics-file</code>. Keep the original lyrics and other inputs.</p>

```powershell
uv run --project services/api --no-sync python services/api/examples/generate_save.py generate --project-id <PROJECT_ID> --style "English, gentle folk pop, warm clear voice, acoustic guitar and piano, light bass and drums, 96 BPM" --lyrics-file services/api/examples/creator/morning-song-lyrics.txt --seed 2026192202 --output-dir data/morning-candidate-02
```

**Change style only: a lighter piano arrangement.** Keep the original lyrics and seed, and use a new download directory. This inspiration recipe has not been auditioned.

```powershell
uv run --project services/api --no-sync python services/api/examples/generate_save.py generate --project-id <PROJECT_ID> --style "English, gentle folk pop, warm clear voice, soft piano, restrained drums, 96 BPM" --lyrics-file services/api/examples/creator/morning-song-lyrics.txt --seed 2026192201 --output-dir data/morning-piano-01
```

**Change one lyric line.** The controlled UTF-8 file below replaces only the original first line. This is also an unauditioned experiment. Keep style and seed unchanged.

<<< ../../services/api/examples/creator/morning-sunlight-lyrics.txt

```powershell
uv run --project services/api --no-sync python services/api/examples/generate_save.py generate --project-id <PROJECT_ID> --style "English, gentle folk pop, warm clear voice, acoustic guitar and piano, light bass and drums, 96 BPM" --lyrics-file services/api/examples/creator/morning-sunlight-lyrics.txt --seed 2026192201 --output-dir data/morning-sunlight-01
```

Choose one question and submit one of these commands each time. Use a new directory name if the output directory exists. To try your own lyrics, keep the original example, save your changed full text in your own UTF-8 file, and select it with `--lyrics-file`.

</details>

## 4. Choose the one you want to keep {#save}

<p>Compare downloaded audio and ABC, then choose a Candidate in the same Project. Name the change, such as “Morning · seed 02.” You can use a Version from the first chapter as parent to record the starting point. That relationship is creative provenance, not a local audio edit.</p>

<p>You can leave every Candidate unsaved if none is right yet. Finished generation is not a finished creative choice.</p>

<details class="creator-supplement"><summary>Current save entrypoint: keep the new Candidate as a Version</summary>

<p>Replace the actual Project, Candidate, and saved parent Version ids. Omit <code>--parent-version-id</code> when there is no parent. All ids must belong to this Project.</p>

```powershell
uv run --project services/api --no-sync python services/api/examples/generate_save.py save --project-id <PROJECT_ID> --candidate-id <NEW_CANDIDATE_ID> --name "Morning - seed 02" --parent-version-id <FIRST_VERSION_ID>
```

</details>

## If saving conflicts, read the existing Version first {#recovery}

<p><code>409 version_already_saved</code> means this Candidate was saved with another name or parent. Read the existing Version id in the error and confirm what you already kept. A renamed save does not make the same Candidate a new piece. Generate a new Candidate for a new creative intent.</p><p>If waiting disconnects, query the original Job as in the first chapter to avoid repeated inference. Change one dimension in the next round and keep a clear starting point.</p>

## What could you ask next? {#next}

<ul><li>Make lyrics on the same theme shorter: change one line and listen for more direct expression.</li><li>Use fewer instrument instructions: remove one arrangement request and listen for focus.</li><li>Notice a rhythm in <a href="./reference.en.md">Reference Audio</a>, then describe a new style goal in words.</li></ul><p>These are experiments, not tuned finished recipes. Keep inputs, Jobs, listening notes, and selected Versions so the next session has a clear starting point.</p>
