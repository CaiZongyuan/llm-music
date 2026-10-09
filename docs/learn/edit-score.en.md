Continue the Morning song Project and pick one melody change. Edit a few notes, inspect and audition, save/select the Score independently, then try another style. The simple MIDI tone helps you judge pitch and rhythm; song generation is a separate creative Job below.

## 1. Find a starting point {#start}

<p>Choose “Inspect score” from an existing Candidate or Version, or open a record in the Project's scores tab. “Saved original and files” retains the original ABC and downloads. To start from a particular saved Version, choose its “Continue from this version” action. Ordinary Score viewing retains the Score's existing origin.</p><p>If you have no Score, choose “Open example Score”. It is an independent four-bar melody at 96 BPM: 22 notes in Ins, with matching rests in Vocal. Opening it does not save an Asset, submit generation or create a Version.</p>

<details class="creator-supplement"><summary>The complete example ABC</summary>

<<< ../../apps/web/src/features/scores/example.txt

</details>

## 2. Change just one phrase {#edit}

<p>In “ABC draft”, replace <code>C D E F G2 E2</code> in the first Ins bar with <code>G A B c d2 B2</code>. Keep the other notes, headers and Vocal rests. Letters set pitch; following numbers set note length. Lowercase <code>c</code> is an octave above uppercase <code>C</code>.</p><p>Wait for checks, or choose “Update notation”. “Notation and MIDI match the current draft” means this text passed notation and supported-format checks. Generation currently uses Vocal / Ins two-voice ABC; syntax that works in a general ABC tool may be unsupported here.</p>

## 3. Inspect notation, then hear pitch and rhythm {#listen}

<ol><li>Check whether the first phrase moves higher. Compare bar positions to confirm the rhythm stays the same.</li><li>Choose “Audition draft MIDI”. The persistent Player plays a simple tone synthesized from this exact MIDI's notes. Music continues on the Lyrics or Versions tab; later edits do not silently replace the auditioned revision.</li><li>Choose “Export draft MIDI” to inspect it in your own music software. This export comes from the current valid draft. “Download MIDI” below, when available, reads the originally registered file instead.</li></ol><p>Change one detail, then audition again. A simple tone cannot establish the quality of a generated song's vocals or arrangement.</p>

## 4. Save a Score for later use {#save}

<p>Choose “Save and select this Score” when satisfied. The application stores these ABC bytes as a new immutable Score and Asset. It creates no inference Job, Candidate or Version just to save notation. Expand “Score for the next generation” to inspect the actual saved ABC; choose “Open saved Score” and reload to read the same record.</p><p>To select an unchanged existing Score, choose “Select saved Score”; it does not duplicate the file. Further edits show that the draft changed: check and save/select before generating again. You may keep writing during a save; the saved result retains the text captured at the click.</p><p>Unsaved text remains in this page session across workspace tabs. Reload rereads the opened Score's saved original. Saving notation independently and saving an Audio Candidate as a Version are separate creative decisions.</p>

## 5. Try another style with this phrase {#regenerate}

1. Under “Regenerate from selected Score”, keep Morning song's lyrics and seed. Change only “Music style” to a lighter piano arrangement. Clip length keeps the 35-second ceiling from the previous step.
2. Confirm “The saved Score matches this valid draft” and generation readiness, then choose “Generate from selected Score”. The Job's “Submitted inputs” retains the actual ABC, selected source Score and source parent Version.
3. You can keep editing while the Job runs. Later changes do not replace submitted notation; check and save/select again before another generation. Wait for cancellation confirmation. Explicit retry creates a new Job with the failed Job's inputs.
4. The new result is a Candidate. Choose “Listen to this music” and inspect the voice, melody, rhythm and ending in the bottom Player. The simple MIDI audition and generated song serve different listening tasks. Music continues in the same Player on Lyrics and Versions.
5. If satisfied, enter a name such as “Morning · higher opening”, then choose “Save as a version”. Open it to inspect submitted ABC and parent. Reopen the original Version to confirm its Score and Audio remain. You can leave an unsatisfying Candidate unsaved.

To start another direction from a saved Version, open it in “Versions” and choose “Continue from this version”. The page shows that starting point; existing ABC, style, lyrics and seed drafts remain. To copy the saved style, lyrics and seed, explicitly choose “Use this version’s inputs”, then inspect and save/select the current Score. The new GFS Job and explicitly saved child Version use this starting point. The original Score and earlier origin records remain unchanged.

The ordinary Score entry retains its existing origin. In particular, a Cover output Score may retain an earlier Reference Audio origin; use the explicit Version entry above to branch from the saved Cover Version. An independent example or a Score without an owning Version may have no parent. Completing a Job never adds version history automatically.

## Continue after invalid input or interruption {#recover}

<p>Add <code>?</code> to the melody to inspect a located error and retained text. The current draft cannot be auditioned, exported or selected for save. Any retained notation clearly says it belongs to an older valid draft. Remove <code>?</code> and choose “Update notation” to recover.</p><p>Notation or check-service failures also retain text; restore the connection and update notation. Retry an audition or export failure. After an interrupted save, retry in the error notice to recover the same submitted snapshot. Replaying that intent returns the same Score and preserves older files; saving another edit uses a new intent.</p>

- Generation submission acknowledgement is interrupted: the captured inputs remain. Choose “Read project jobs”, then open the corresponding Job and inspect actual ABC and origin. Generation is never sent again automatically. Reloading the same tab still asks you to check the unconfirmed submission. Decide on another explicit attempt only after checking.
- Inference fails or is cancelled: correct the cause, then choose “Create a new retry job” on the original Job. It creates a new Job with the original submitted snapshot. Current drafts and earlier results remain.
- Version save acknowledgement is interrupted: choose “Reread saved versions” first. If retry is needed, “Save the same version again” retains the first name and Candidate. Later name edits do not change this recovery, and repeating the save does not add another Version.

Job links reread submitted inputs and results. Unsaved notation belongs only to the current page session; reload still reads the opened Score's saved original. Check and explicitly select it again before a new generation.

## Another idea: change direction, keep the rhythm {#ideas}

| Your question | Change only | Listen for |
| --- | --- | --- |
| A brighter opening | Pitches in the first bar | Whether the higher register fits the mood. |
| A longer pause | Replace a note with an equal-length `z` in that bar | Whether silence emphasizes the next phrase. Keep the full bar duration. |
| One melody at another speed | Replace `Q:1/4=96` with another integer BPM | Momentum, while keeping pitches and lengths. |

<p>These are auditionable exploration ideas, not promised musical effects. Change one detail, generate from the explicitly selected Score, and record your listening judgment. For scripts, see the <a href="../guides/generate-save-api.en.md#selected-score">GenerateFromScore API</a>. You can also explore <a href="./variations.en.md">style, lyrics and seed</a>. New Audio always remains a Candidate until you choose to save a Version.</p>
