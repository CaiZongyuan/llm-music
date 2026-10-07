After preparation, save the pre-start check and launch a localhost-only Runtime. Doctor readiness and full P0 acceptance are different facts.

## Save the pre-start check {#save}

<p>Run from the repository root. Start only after Doctor exits <code>0</code>. <code>--no-sync</code> prevents the check from downloading dependencies or changing the environment.</p>

<<< ../../runtime/comfyui/examples/save-readiness.ps1

## Launch the local service {#launch}

<<< ../../runtime/comfyui/examples/start.ps1

<p>By default, the service listens only at <code>http://127.0.0.1:8188</code> and does not open Canvas. A selected custom port still listens on localhost only. Keep this terminal running. Press Ctrl+C to stop it.</p><p>Doctor checks a free port. After launch, the transcription tool reuses the saved real successful receipt. Do not fabricate readiness on an occupied port.</p>

## What the check covers {#checks}

<p>Doctor checks actual BF16 CUDA work, the target device, pinned versions, node and inference imports, resampling, full model SHA256, disk, and port.</p><div class="callout"><strong>READY means inference prerequisites are available</strong><p>Doctor does not load all weights or establish music quality. One readiness check does not change its <code>p0_passed=false</code>.</p></div>

## Recover from failure {#recovery}

<table><thead><tr><th scope="col">Result</th><th scope="col">Recovery action</th></tr></thead><tbody><tr><td>Model missing / downloading</td><td>Run download-models. Retained .part bytes resume.</td></tr><tr><td>SHA256 or size mismatch</td><td>Preserve or move the corrupt file, then download again. The command does not overwrite invalid files.</td></tr><tr><td>Port occupied</td><td>Identify its owner. Preserve another owner's service. Select the same free -Port for checks, saving the receipt, launch, and transcription.</td></tr><tr><td>Probe timeout or nonzero exit</td><td>Read last_stage, stdout_tail, and stderr_tail. Resolve that stage, then retry.</td></tr></tbody></table>

All four complete examples accept `-Port`, from 1 to 65535, with default 8188. If you select free port 8189, run `& ./runtime/comfyui/examples/doctor.ps1 -Port 8189`, `& ./runtime/comfyui/examples/save-readiness.ps1 -Port 8189`, and `& ./runtime/comfyui/examples/start.ps1 -Port 8189` from the repository root. Keep the launch terminal running. In a second terminal, run `& ./runtime/comfyui/examples/transcribe.ps1 -Port 8189`. Transcription connects to `http://127.0.0.1:8189`. Omitting the parameter at any step selects default port 8188.

<p><a href="./quickstart.en.md">Return to preparation</a>, or after a successful launch <a href="./transcribe.en.md">run the first transcription</a>.</p>
