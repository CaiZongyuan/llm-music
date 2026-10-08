Continue the Morning song Project and pick one melody change. Edit a few notes, inspect and audition, then save the Score independently. The simple MIDI tone helps you judge pitch and rhythm; it does not call AI to generate a song.

## 1. Find a starting point {#start}

<p>Choose “Inspect score” from an existing Candidate or Version, or open a record in the Project's scores tab. “Saved original and files” retains the original ABC and downloads. Editing a Version's Score retains that Version as its parent origin.</p><p>If you have no Score, choose “Open example Score”. It is an independent four-bar melody at 96 BPM: 22 notes in Ins, with matching rests in Vocal. Opening it does not save an Asset, submit generation or create a Version.</p>

<details class="creator-supplement"><summary>The complete example ABC</summary>

<<< ../../apps/web/src/features/scores/example.txt

</details>

## 2. Change just one phrase {#edit}

<p>In “ABC draft”, replace <code>C D E F G2 E2</code> in the first Ins bar with <code>G A B c d2 B2</code>. Keep the other notes, headers and Vocal rests. Letters set pitch; following numbers set note length. Lowercase <code>c</code> is an octave above uppercase <code>C</code>.</p><p>Wait for checks, or choose “Update notation”. “Notation and MIDI match the current draft” means this text passed notation and supported-format checks. Generation currently uses Vocal / Ins two-voice ABC; syntax that works in a general ABC tool may be unsupported here.</p>

## 3. Inspect notation, then hear pitch and rhythm {#listen}

<ol><li>Check whether the first phrase moves higher. Compare bar positions to confirm the rhythm stays the same.</li><li>Choose “Audition draft MIDI”. The persistent Player plays a simple tone synthesized from this exact MIDI's notes. Music continues on the Lyrics or Versions tab; later edits do not silently replace the auditioned revision.</li><li>Choose “Export draft MIDI” to inspect it in your own music software. This export comes from the current valid draft. “Download MIDI” below, when available, reads the originally registered file instead.</li></ol><p>Change one detail, then audition again. A simple tone cannot establish the quality of a generated song's vocals or arrangement.</p>

## 4. Save a Score for later use {#save}

<p>Choose “Save and select this Score” when satisfied. The application stores these ABC bytes as a new immutable Score and Asset. It creates no inference Job, Candidate or Version just to save notation. Expand “Score for the next generation” to inspect the actual saved ABC; choose “Open saved Score” and reload to read the same record.</p><p>To select an unchanged existing Score, choose “Select saved Score”; it does not duplicate the file. Further edits show that the draft changed: check and save/select before generating again. You may keep writing during a save; the saved result retains the text captured at the click.</p><p>Unsaved text remains in this page session across workspace tabs. Reload rereads the opened Score's saved original. Saving notation independently and saving an Audio Candidate as a Version are separate creative decisions.</p>

## Continue after invalid input {#recover}

<p>Add <code>?</code> to the melody to inspect a located error and retained text. The current draft cannot be auditioned, exported or selected for save. Any retained notation clearly says it belongs to an older valid draft. Remove <code>?</code> and choose “Update notation” to recover.</p><p>Notation or check-service failures also retain text; restore the connection and update notation. Retry an audition or export failure. After an interrupted save, retry in the error notice to recover the same submitted snapshot. Replaying that intent returns the same Score and preserves older files; saving another edit uses a new intent.</p>

## Another idea: change direction, keep the rhythm {#ideas}

| Your question | Change only | Listen for |
| --- | --- | --- |
| A brighter opening | Pitches in the first bar | Whether the higher register fits the mood. |
| A longer pause | Replace a note with an equal-length `z` in that bar | Whether silence emphasizes the next phrase. Keep the full bar duration. |
| One melody at another speed | Replace `Q:1/4=96` with another integer BPM | Momentum, while keeping pitches and lengths. |

<p>These are auditionable exploration ideas, not promised musical effects. Formal Web generation from a selected Score is still a later delivery. The existing <a href="../guides/generate-save-api.en.md#selected-score">GenerateFromScore API</a> accepts the newly saved Score id and its retained parent Version. New Audio remains a Candidate until you listen and explicitly save a Version. You can also explore <a href="./variations.en.md">style, lyrics and seed</a>.</p>
