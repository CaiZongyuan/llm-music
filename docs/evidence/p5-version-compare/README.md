# Real saved music comparison

[Compressed frontend recording](version-compare.webm). The recording is silent; listen to the existing [melody sample](https://github.com/CaiZongyuan/llm-music/pull/90#issuecomment-6062661400) and [full sample](https://github.com/CaiZongyuan/llm-music/pull/91#issuecomment-6064728281) separately. No Swagger recording.

Actual production Web at source `8a47f94c9791cf1966f8d56045ec5e8e885ec319`, tree `bf50f55909211a9ba9cf70b269f6ec45ee39cb2a`, used the real saved P4 melody/full Versions in one Project. It retained absolute seconds across A/B, one native audio element through Lyrics navigation, a common2–4-second region on both sides, and valid pair/side at0paused after reload. Twenty original Asset hashes, all saved HTTP records and ReferenceOrigins stayed equal, with zero business POSTs or new GPU inference.

The original full FLAC `6279e9c581cf0a9a8c0b04bbea47e41d7e221a6f68275a68599d5df64422cd4e` previously failed in a plain native player on End34.9→Left34.8. The formal workbench recovered34.8 with the same original Blob/hash, then naturally ended at34.998667 paused and explicitly replayed from0.294017 while playing. This supports the implemented bounded same-byte recovery; it does not identify or repair the underlying Chromium demuxer.

Both original music clips are about35 seconds. The actual31-second clamp/end/replay boundary is separately tested with genuine1488000-frame stereo48k PCM16 CPU FLACs. The standard4800-frame encoding is a normal test profile; the original default encoding remains an explicit error/recovery fixture. The two music samples have different styles/seeds and are creative examples, not a controlled mode-quality or performance comparison.

The original779928-byte browser WebM remains local unchanged. This299711-byte VP9 software review copy has278 fully decoded1080×720 frames, last-frame time11.08 seconds and SHA256 `4707cadd922fe0cd922a6ea4f500a9571a9bb64d9871c045ea559a6aee5d397b`. This evidence branch contains review copies; main retains source and verification rather than generated media.
