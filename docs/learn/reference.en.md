Prepare 16 seconds of Reference Audio and get ABC and MIDI. Check the score against the original, finding phrases to study and differences that need attention.

## 1. Choose material you can hear clearly {#choose}

<p>Choose your own short instrumental fragment or licensed material. A clear lead melody with a less crowded background can make inspection easier. This is input-selection advice, not an accuracy guarantee.</p><p>The current real path verifies and accepts only <strong>exactly 16 seconds of PCM16 WAV</strong>: mono at 24 kHz or stereo at 48 kHz. Export one supported format with your existing audio tool and keep the original. Note one clear pitch movement or rhythm in the source for later comparison.</p><p>The 64 MiB / 600-second upload budget is a storage limit, not transcription support for those lengths. This operation does not recognize lyrics or automatically create a Cover.</p>

## 2. Upload to the Project, then transcribe once {#transcribe}

<p>Continue in the Morning song Project and upload the file as Reference Audio. Record its Asset id, submit one Transcribe Job, and keep its Job id. When completed, you get a Score, ABC, and MIDI. The original Reference Audio stays unchanged.</p><p>Use existing local Swagger for the actual steps. Expand the instructions below; the documentation page uploads no files.</p>

<details class="creator-supplement"><summary>Current entrypoint: the complete local Swagger path</summary>

<ol><li>Open the running application API's <code>http://127.0.0.1:8000/docs</code>. Use a ready real Runtime for model work; fake mode returns identified test results.</li><li>Reuse your Project id. If starting here, send <code>{"name":"Morning song"}</code> to <code>POST /projects</code> and record the returned id.</li><li>In <code>POST /projects/{project_id}/assets</code>, enter that Project id and choose the WAV in <code>file</code>. Submit and record the returned Asset id.</li><li>Use the JSON below in <code>POST /projects/{project_id}/transcriptions</code>, replacing the placeholder. Submit once and record the returned Job id.</li><li>Read the same Job with <code>GET /projects/{project_id}/jobs/{job_id}</code> until completed or explicitly failed. A completed result includes <code>score_id</code>, <code>abc_asset_id</code>, and <code>midi_asset_id</code>.</li><li>Read score information with <code>GET /projects/{project_id}/scores/{score_id}</code>, then download ABC and MIDI separately through <code>GET /projects/{project_id}/assets/{asset_id}/content</code>. Keep them in your Morning song folder.</li></ol>

```json
{
  "reference_asset_id": "<REFERENCE_ASSET_ID>"
}
```

</details>

## 3. Compare by listening, not just file existence {#inspect}

<ol><li>Play the original Reference Audio and listen again to the phrase you noted.</li><li>Read the ABC text or use your own ABC reader to inspect bars, meter, and pitch. Open MIDI in your existing MIDI player or music software.</li><li>Compare melodic movement and rhythm with the original. Note where a phrase differs. A downloadable score is not necessarily an exact transcription.</li></ol><p>The application validates complete files and imports the Score. That does not establish accuracy for arbitrary music. There is no integrated editor yet. You can study and edit downloads in your own tools; generating from an edited score in the application is not delivered.</p>

## If the format is rejected, fix export settings {#recovery}

<p><code>422 reference_profile_unsupported</code> means the audio profile is outside the current range. Check exactly 16 seconds, 16-bit integer PCM WAV, and supported channels and sample rate. Renaming an extension cannot change encoding. Export a supported file and upload it as new Reference Audio.</p><p>If submission acknowledgement is uncertain or waiting disconnects, query the known Job first. Repeated uploads or submissions are not recovery. Download the same completed result, or retain an explicitly failed error and follow its recovery guidance.</p>

## Next idea: use the reference as a listening question {#next}

<p>Note one feature of the fragment: a sparser rhythm, a smoother melody, or the contour of a phrase. Turn that observation into a clear goal for your next style input. You cannot yet send this Score directly into generation or perform Cover.</p><p><a href="./variations.en.md">Try changes to style and lyrics →</a></p>
