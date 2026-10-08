# Formal Score editor review copy

Source: `f5107749e435ef8f909fd0a19172ecafd721ee72`, PR #87.

The silent browser recording shows the actual formal Workspace: edit the
first Ins phrase, inspect timed note highlighting, download current MIDI,
explicitly save an independent Score, keep the sole Player across tabs,
reopen the saved text and switch to English/dark. It uses a separate local
FastAPI/SQLite dataset and CPU native Score validation. Saving adds a Score
and ABC Asset, with no inference Job, Candidate or Version. Original ABC is
unchanged. This is MIDI audition, not a newly generated AI song; the formal
GenerateFromScore browser loop belongs to #42.

The WebM is a software VP9 CRF36 review copy, 1080 × 720, 358454 bytes,
119 decoded frames / 4.72 seconds, SHA256
`5c3b54ca50990a84801a0a4c5d04385fb23572b9888a3b9137f853d6f04b5dbc`.
The original Playwright recording remains local and unchanged. Both images
show the same actual build and root-owned dataset. All browser page errors
were absent; original files and save results were checked through public API.

This evidence-only branch is separate from main. It contains no models,
database, GPU recording or Swagger UI recording.
