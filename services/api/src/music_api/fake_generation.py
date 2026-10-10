"""Lazily create original CPU fixtures; this is never model inference evidence."""

from io import BytesIO
from typing import cast

import av
from av.audio.stream import AudioStream
import numpy as np

from music_api.runtime_types import RuntimeArtifact, RuntimeResult


ABC = (b'X:1\nT:\nM:4/4\nL:1/16\nQ:1/4=96\n'
       b'V: Vocal clef=treble name="Vocal Melody" snm="Vocal"\n'
       b'V: Ins clef=treble name="Ins Melody" snm="Inst."\n'
       b'K:C\n% verse\nV: Vocal\n"C"C4 D4 E4 G4 | G4 E4 D4 C4 |\nV: Ins\nZ2 |\n')


def flac_fixture(max_seconds: int | None = None) -> bytes:
    """Test tone at the requested ceiling. Auto (0/None) renders the pinned 35 s fixture."""
    target = BytesIO()
    rate = 48000
    count = 1679936 if not max_seconds else 1679936 + (int(max_seconds) - 35) * rate
    with av.open(target, mode="w", format="flac") as container:
        stream = container.add_stream("flac", rate=rate)
        if not isinstance(stream, AudioStream):
            raise RuntimeError("CPU FLAC fixture encoder is not an audio stream")
        stream.layout = "stereo"
        stream.codec_context.format = "s16"
        for offset in range(0, count, 4096):
            indices = np.arange(offset, min(count, offset + 4096))
            channel = np.round(8192 * np.sin(2 * np.pi * 440 * indices / rate)).astype(np.int16)
            samples = np.column_stack([channel, channel]).reshape(1, -1)
            frame = av.AudioFrame.from_ndarray(samples, format="s16", layout="stereo")
            frame.sample_rate = rate
            for packet in stream.encode(frame):
                container.mux(packet)
        for packet in stream.encode():
            container.mux(packet)
    return target.getvalue()


def generation_fixture(inputs: dict[str, object] | None = None) -> RuntimeResult:
    requested = int(cast(int, inputs.get("max_seconds", 0))) if inputs else 0
    return RuntimeResult(
        (RuntimeArtifact("abc", ABC, "abc", "text/vnd.abc", "score.abc"),
         RuntimeArtifact("audio", flac_fixture(requested), "flac", "audio/flac", "song.flac")),
        provenance={"runtime_kind": "fake", "validation_scope": "Original complete CPU fixtures; no model inference"},
        score_validation={"valid": True, "note_count": 8, "duration_seconds": 5})
