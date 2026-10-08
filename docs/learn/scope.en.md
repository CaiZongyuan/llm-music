Start with implemented short-fragment workflows. Later capabilities have their own stages; tutorials do not turn plans into available buttons.

## Available now {#now}

| Your task | Actual scope |
| --- | --- |
| Generate from style and lyrics | Current 35-second profile; audio and ABC form a Candidate, then an explicitly saved Version. |
| Transcribe Reference Audio | 16-second PCM16 WAV: mono24k or stereo48k; a Score, ABC, and MIDI. |
| Generate from a selected Score | [Edit and regenerate](edit-score.en.md#regenerate): check and independently save/select native two-voice ABC in the Web, then generate a Candidate with style and lyrics. Explicit save retains its source parent. The [API](../guides/generate-save-api.en.md#selected-score) supports the same operation. |
| Edit and audition a Score | The [ABC editor](edit-score.en.md) offers notation, matching MIDI audition/export and independent Score saving. Previous Versions and Assets retain their original content. |
| Melody/full Score Cover | [Reference→inspect/select→new style](cover.en.md): first16 seconds of an existing Version or uploaded T16 Reference, retaining transcription/edit lineage and true parent; explicitly choose to omit or retain written chords. Completion creates a Candidate before explicit save. |
| Try another direction | Create a new Generate in the same Project, vary style, lyrics, or seed, and download results to hear one at a time. |
| Keep and find results | Application ids read original Assets, completed outputs, and saved Versions. HTTP reads Jobs, WS can observe phases, and uncertain operations require checking first. |

## Coming with later product stages {#later}

<p>The formal Web provides Project assets, Job monitoring, Reference Audio transcription, ABC editing, MIDI audition/export, independent Score saving, generation from selected notation, persistent playback and explicit derived Version saving. The interface supports Chinese/English and light/dark modes. Melody/full Cover retains inspectable origins and intermediate Scores. Integrated A/B comparison is not delivered. Current short examples do not establish long-song support, arbitrary audio profiles, or transcription accuracy for arbitrary music.</p><p>This site reads static documentation and plays an existing MP3, isolated from business writes. Create music in the running local Web or the corresponding API.</p>

## Finish one small piece first {#next}

<p><a href="./first-music.en.md">Make your first music with the verified recipe →</a></p>
