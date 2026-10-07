"""Original CPU FLAC fixture for fake operation evidence only, never GPU quality."""

from io import BytesIO

import av
from music_api.fake_generation import ABC, flac_fixture
from music_api.runtime_types import RuntimeArtifact, RuntimeResult


def flac_reference() -> bytes:
    return flac_fixture()


def unknown_count(data: bytes) -> bytes:
    packed = int.from_bytes(data[18:26], "big") & ~((1 << 36) - 1)
    return data[:18] + packed.to_bytes(8, "big") + data[26:]


def truncated_tail(data: bytes) -> bytes:
    """Drop only the final complete packet; preserve the original declared sample count."""
    with av.open(BytesIO(data), mode="r", format="flac") as container:
        offsets = [packet.pos for packet in container.demux(container.streams.audio[0]) if packet.size > 0]
    return data[:offsets[-1]]


def generated_result(audio: bytes | None) -> RuntimeResult:
    artifacts = [RuntimeArtifact("abc", ABC, "abc", "text/vnd.abc", "score.abc")]
    if audio is not None:
        artifacts.append(RuntimeArtifact("audio", audio, "flac", "audio/flac", "song.flac"))
    return RuntimeResult(tuple(artifacts), provenance={"runtime_kind": "fake", "validation_scope": "Original complete CPU fixtures; no model inference"},
                         score_validation={"valid": True, "note_count": 8, "duration_seconds": 5})
