Submit original short music to SheetSage2. Get parseable ABC and readable MIDI through Runtime APIs, without opening ComfyUI Canvas.

## Before you start {#before}

<p>First <a href="./doctor.en.md">save the Doctor receipt and launch Runtime</a>. Run from a second terminal at the repository root. The current GPU resource owner must run this command with an empty Runtime queue.</p>

Use exactly the same port as Doctor, receipt saving, and launch. All four complete examples default to 8188. If you selected 8189, run `& ./runtime/comfyui/examples/transcribe.ps1 -Port 8189`. The script passes that port as the transcription CLI's `--base-url` and does not fall back to the default address.

## Run the first transcription {#run}

Use this complete example in your own prepared environment.

<<< ../../runtime/comfyui/examples/transcribe.ps1

<p>The output directory must be new or empty. By default, the tool generates original 16-second, 48 kHz, stereo, 16-bit PCM instrumental audio. The input uses CC0-1.0.</p><p>This command uploads audio, submits GPU inference, and writes files. The documentation's copy button only copies the command. It does not run it.</p>

## Check your result {#verify}

<p>Success exits <code>0</code>. Open the output directory and check <code>status=completed</code> and <code>verified=true</code> in <code>receipt.json</code>.</p>

<table><thead><tr><th scope="col">File</th><th scope="col">Purpose</th></tr></thead><tbody><tr><td>reference.wav</td><td>Default fixed input and content hash.</td></tr><tr><td>request.json / history.json</td><td>Submitted request and complete Runtime result.</td></tr><tr><td>score.abc / score.mid</td><td>Artifacts validated by complete parsing, MIDI export, and nonempty note readback.</td></tr><tr><td>receipt.json</td><td>Input/output hashes, revisions, settings, and parser evidence.</td></tr></tbody></table>

<p>The tool parses complete ABC, exports MIDI, uploads it again, and reads its notes. HTTP 200 or a file alone cannot mean success.</p>

## Recover from one failure {#failure}

<p>If the command exits <code>2</code> because the output directory is not empty, retain the existing results and choose a new directory. Do not delete old evidence to resubmit.</p><p>If the default 1800-second timeout expires, the request may still be running. Check its saved request, history, and queue first. The owner decides whether to wait or cancel.</p>

## Capabilities and limits {#limits}

<p>The fixed short instrumental sample validates the pipeline and file validity. It does not establish accuracy for vocals or arbitrary music. SheetSage2 weights use CC-BY-NC-4.0, recorded separately from the input's CC0 license.</p><p>Diagnostic input accepts only nonsilent, untruncated 16-bit mono/stereo PCM WAV lasting 0.05–30 seconds. This input budget is not an accuracy guarantee.</p><p>Repeating identical audio can hit the plugin's independent cache. Public history alone cannot prove fresh GPU inference. The owner retains first-execution logs and GPU facts.</p><p>This tool verifies one Runtime path and keeps <code>p0_passed=false</code>. Full P0 acceptance also covers generation, queueing, cancellation, continuous Jobs, and cleanup.</p>
