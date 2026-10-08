Continue in the Morning song Project. Give the beginning of a saved Version, or your own16-second reference, another style. Inspect the Score first, then decide what to generate and what to keep.

## 1. Choose a reference excerpt, not a whole song {#reference}

Open “Cover” in the Project. Choose existing Reference Audio, or select a saved Version with audio and save its **first16 seconds** as a new Reference. The application extracts PCM16 stereo48k WAV from that Version's actual audio Asset. The original stays unchanged. The origin retains source Version, source Audio Asset, starting frame, frame count and original file hash.

Local uploads still require exactly16-second PCM16 WAV: mono24k or stereo48k. Uploaded references have no source parent. Naming a Version cannot establish an upload's origin; an unchanged35-second generated clip is not a supported transcription input.

Listen to the reference and note one clear pitch or rhythm to check against transcription.

## 2. Transcribe and retain an inspectable intermediate {#inspect}

Check transcription readiness and submit one Transcribe Job. Its completed Score has ABC, notation and MIDI linked to the original Reference. A Version-derived Reference gives the transcription Score its true source Version parent; saved edits inherit it.

Inspect the melodic movement and rhythm. Transcription does not recognize lyrics or promise every note is accurate. Vocal may contain only rests while Ins has notes. Both modes retain both lines; neither promotes the instrumental line into a sung vocal line.

## 3. Edit and save the original, then select effective mode input {#select}

1. Change one phrase in ABC, update notation and audition draft MIDI. Invalid text remains; previous notation is labelled stale.
2. Save and select this Score. This creates an immutable Score/Asset, without an inference Job or Version.
3. Choose melody or full, inspect effective ABC and explicitly select it. Melody omits music-line chord symbols; full retains written chords as harmony guidance. Both retain voices, notes, rhythm, meter, tempo and voice names. The original Score stays saved; effective input has its own audition.
4. When full has no written chords, the page explains that explicit harmony guidance is absent. You may still select and generate full. Switching mode does not invent chords. Edit written harmony or return to a retained chorded Score to add guidance.
5. After changing mode or Reference, obtaining another transcription Score or editing further, check and select again. The old choice remains readable. Switching back or using identical ABC still requires a new explicit choice.

The new style guides accompaniment. Melody/full describe symbolic conditioning and the native instruction; neither guarantees recording timbre, singer identity, accompaniment or exact generated notes. Readiness checks the chosen mode. An unavailable mode does not disable another observed available mode, and the application never switches automatically. Existing GenerateFromScore keeps its established full profile.

## 4. Change only style and listen to a new interpretation {#generate}

Keep Morning song's lyrics and seed, then try gentle piano or clear folk guitar. Check the chosen mode's readiness and explicitly generate. Transcription and generation are separate Jobs, with your inspection between them.

Submission freezes Reference, transcription origin, saved edit, original/effective ABC, mode, style, lyrics and settings. Keep editing while waiting; later changes do not enter the old Job. The result is a Candidate. Use the persistent Player to inspect melody, rhythm, accompaniment and the ending. Playback continues across Lyrics and Versions.

Name and save a Version when satisfied. A Version-derived Reference retains its actual source Version parent; an upload has no parent. Inspect submitted inputs and the source chain, then reopen the previous Version to confirm its Score and audio remain. Job completion alone does not add history.

## Recover using the retained Score {#recover}

- Transcription failure or cancellation retains Reference, previous intermediate Score and saved edits. Read the current Job before explicitly retrying.
- Unavailable mode or models requires restoring and rechecking readiness. The application does not substitute another mode or ordinary Generate; valid notation remains. Choosing another available mode requires inspecting and selecting its input again.
- Generation OOM, failure or confirmed cancellation retains intermediates and the original attempt. Explicit retry creates a new Job from frozen input, without another transcription.
- Unknown submission acknowledgement requires reading Project Jobs and their actual input before another decision. Generation is never automatically sent again. Reload reads persisted records; unsaved draft text must restart from the saved Score.
- Unknown Reference or Version save acknowledgement requires reading the same save id/result and explicitly recovering the same intent. Later source/name edits do not change that recovery.

## Next idea: keep the phrase and study accompaniment {#ideas}

Use the same saved Score, lyrics, style and seed, and explicitly select melody and full in separate attempts. Inspect the effective ABC's chord difference, then listen to each Candidate. Note rhythmic density, melodic clarity, harmony and the ending before keeping useful Versions. Neither attempt needs another transcription; later mode/style changes do not rewrite earlier results. The current profile creates35-second clips; it does not prove long-song or arbitrary-reference quality.

Use the [Cover API guide](../guides/cover-api.en.md) when you need scripts. Modes come from the [pinned plugin](https://github.com/pytraveler/YuE2-ComfyUI/blob/fc78df9dfb214f396aa281f5b03519cefff5b00a/yue2_comfy/transcribe.py). CPU fixtures verify operations and files, rather than real GPU music.
