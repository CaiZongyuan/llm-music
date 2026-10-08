# Actual Score editing and generation loop

Source: `18d10ca00ab18a74b24501f026fb2ce5b7dfb488`, PR #88.

The first recording shows the formal Web editing the first sounding Ins pitch
from E5 to G5, explicitly saving/selecting its immutable Score and submitting
one GenerateFromScore request. The draft then changes while inference uses
the original frozen input. This was a real native GPU attempt: its core was
not cached, execution took 41.762 seconds, and the complete stereo 48 kHz
FLAC decodes to 34.998667 seconds. The actual native score input matches the
frozen effective ABC; options retain `cot=full`, `transpose=0`.

The second recording continues that same completed result through actual
playback and explicit Version save. The previous recording's verification
script selected audio but omitted the persistent Player's separate Play
action; its failed assertion remains local. No inference was repeated.
The new Version retains the previously saved #41 Version as its parent,
forming V1 → V41 → V42. Seven original Assets are unchanged. A subsequent
graceful API process restart and fresh browser reload restored every record
and all ten Asset hashes without any new POST.

- `generation.webm`: silent VP9 CRF40, 1080 × 720, 51.52 s, 852313 bytes
  (original 2500651 bytes); SHA256
  `95651de6a2e2416e262343318b601514798602ab406863a64f580b7cec8b5919`.
- `playback-save.webm`: silent compressed VP8, 1080 × 720, 2.96 s,
  337081 bytes; SHA256
  `bbf16d2ef1b1c5ea93f5af193c50e2ffdce9d07e5fbea55d7f8a324b32f4d773`.
- `web-selected-score.mp3`: actual new generated music, stereo 48 kHz,
  128 kbps, 34.998667 s, 561068 bytes; SHA256
  `6d500db26665b7be9d46e19a9ed5590166489015ececd160a94c2ac7517df0b9`.

All review copies decode completely; originals remain local and unchanged.
This establishes actual submission, output, playback and persistence, without
claiming melody accuracy or subjective music quality. The retained Runtime
8188 was borrowed and never stopped. This evidence-only branch does not add
models, database or media to main. Swagger UI was not recorded.
