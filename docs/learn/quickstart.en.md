Run from the repository root. Get Runtime READY, then continue to launch and transcription.

## Before you start {#prerequisites}

<ul><li>Windows x64, RTX 3070 Ti Laptop, nominal 8 GiB VRAM.</li><li>Git, uv, and a working NVIDIA driver are installed.</li><li>About 9.19 GB of model downloads. Doctor also requires 10 GiB working space.</li><li>An independent Python 3.12.13 Runtime environment.</li></ul><div class="callout"><strong>Run only in your prepared environment</strong><p>These commands prepare source and download dependencies and models. The current resource owner must serialize real GPU requests.</p></div>

## 1. Prepare the pinned environment {#prepare}

<p>This command clones the pinned Runtime and custom nodes, then installs locked dependencies. Existing checkouts must match the pinned commits and have no tracked edits.</p>

<<< ../../runtime/comfyui/examples/prepare.ps1

## 2. Prepare the models {#models}

<p>Weights are saved in <code>data/models/</code>. YuE2 and SheetSage2 weights use CC-BY-NC-4.0. Code licenses are recorded separately.</p>

<<< ../../runtime/comfyui/examples/download-models.ps1

## 3. Get the readiness result {#ready}

<<< ../../runtime/comfyui/examples/doctor.ps1

<p>Success prints <code>Runtime READY</code> and exits <code>0</code>. Failure prints <code>Runtime NOT READY</code>, exits <code>1</code>, and gives recovery actions for each check.</p><p>If a model download was interrupted, rerun <code>download-models</code> to resume it. A <code>.part</code> file is not ready.</p>

## Next step {#next-step}

<p>Read Doctor's limits. Then save the pre-start receipt, launch the local service, and transcribe.</p><p><a href="./doctor.en.md">Check and launch Runtime →</a></p>
