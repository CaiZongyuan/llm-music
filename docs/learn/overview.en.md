Begin with the local Runtime: prepare the environment, check readiness, then turn 16 seconds of Reference Audio into ABC and MIDI. Learn the capabilities that are implemented today.

<div class="hero-actions"><a class="primary-action" href="./quickstart.en.md">Start preparation →</a><a class="secondary-action" href="./transcribe.en.md">View transcription guide</a></div>

<div class="music-flow"><div><strong>Reference Audio</strong><small>16-second original music</small></div><span aria-hidden="true">→</span><div><strong>SheetSage2</strong><small>Local GPU transcription</small></div><span aria-hidden="true">→</span><div><strong>ABC + MIDI</strong><small>Complete file validation</small></div></div>

## Choose your starting point {#choose}

<div class="task-grid"><a class="task-card" href="./quickstart.en.md"><span aria-hidden="true">01</span><strong>Run it for the first time</strong><p>Prepare the pinned environment and models. Get the first Doctor result.</p><small>Open quick start →</small></a><a class="task-card" href="./architecture.en.md"><span aria-hidden="true">02</span><strong>Understand the architecture</strong><p>Learn the boundaries between Project, Job, and Runtime. Find their source.</p><small>Read the architecture →</small></a><a class="task-card" href="./transcribe.en.md"><span aria-hidden="true">03</span><strong>Find a task guide</strong><p>Runtime already ready? Read the transcription steps, outputs, and recovery actions.</p><small>Transcribe and export MIDI →</small></a></div>

## What this version covers {#today}

<p>This site covers P0 Runtime preparation, Doctor, and the first transcription path. Real GPU validation has passed. The site runs no checks and submits no music Jobs.</p><p>The FastAPI core is being delivered in P1. The product Web Workbench starts in P2. Product tutorials will follow implemented stages.</p><p><a href="./scope.en.md">View current scope and later stages →</a></p>

## Your first result {#result}

<p>The transcription tool retains the input, request, and history. It validates the complete ABC, then exports and reads MIDI. A successful receipt contains <code>status=completed</code> and <code>verified=true</code>.</p><p>A file or HTTP 200 alone cannot prove success. A fixed short sample does not establish transcription accuracy for arbitrary music.</p>

