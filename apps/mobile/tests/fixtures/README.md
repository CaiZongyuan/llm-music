# Original FLAC fixture

`original-35s.flac` is the unchanged output of the isolated FastAPI `d011c2f` / CPU Fake Runtime used for mobile transport preparation on 2026-10-10. It contains a deterministic test tone, not GPU inference or a creator's recording.

- Asset: `805cecaa-c24a-42bd-ab63-801c07a53f17`
- Size: 467,960 bytes
- SHA256: `2e36c3fd44bc2738d02a023c65461e58016b7dd33e1ed98b9fb15d350be27897`
- Profile: FLAC PCM16, stereo, 48 kHz, 34.998666666666665 seconds

The literal SHA256 comes from the independent preparation receipt. Controller tests compare downloaded/cache bytes with this file; decoding and playback remain separate native checks.
