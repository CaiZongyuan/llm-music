FastAPI owns domain objects. ComfyUI runs inference. Direct calls in Runtime tutorials validate the environment. Product clients work through FastAPI.

## One explicit request path {#boundary}

<div class="music-flow"><div><strong>Web</strong><small>Product client in P2</small></div><span aria-hidden="true">→</span><div><strong>FastAPI</strong><small>Application Backend</small></div><span aria-hidden="true">→</span><div><strong>Runtime</strong><small>ComfyUI / YuE2</small></div></div>

<p>The product Web app connects only to FastAPI. The Runtime Adapter translates native execution events into application Job states. Clients do not depend on ComfyUI node or prompt ids.</p>

## Creative objects {#objects}

<table><thead><tr><th scope="col">Object</th><th scope="col">Meaning</th></tr></thead><tbody><tr><td>Project</td><td>Organizes a song, cover, or music experiment.</td></tr><tr><td>Asset</td><td>An actual file that can be referenced independently.</td></tr><tr><td>Score</td><td>A music representation that can be inspected and edited.</td></tr><tr><td>Job</td><td>One trackable transcription or generation request.</td></tr><tr><td>Candidate</td><td>A result that can be heard and inspected, but is not saved yet.</td></tr><tr><td>Version</td><td>A meaningful creative change explicitly saved by its creator.</td></tr></tbody></table>

## Who owns saved results {#ownership}

<p>Runtime output is validated and imported before it becomes an application-owned Asset. A Candidate becomes a Version only when the creator explicitly saves it.</p><p>FastAPI and ComfyUI use independent uv projects, environments, and locks. Normal API and documentation builds do not load GPU models.</p>

## Return to practice {#practice}

<p>For your first real result, start with <a href="./quickstart.en.md">environment preparation</a>. If Runtime is ready, open the <a href="./transcribe.en.md">transcription guide</a>.</p>

