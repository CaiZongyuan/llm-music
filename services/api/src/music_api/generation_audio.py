"""Validate finalized generated FLAC with declared counts and every decoded PCM frame."""

from io import BytesIO

import av
import numpy as np

from music_api.audio import AudioFacts
from music_api.errors import DomainError


def validate_flac(data: bytes, max_seconds: int) -> AudioFacts:
    if len(data) < 42 or data[:4] != b"fLaC" or data[4] & 0x7F != 0 or int.from_bytes(data[5:8], "big") != 34:
        raise DomainError(422, "generated_audio_invalid", "Runtime Audio is not a complete FLAC stream header.",
                          "Keep the failed Job and Runtime output; verify the pinned generation workflow.")
    # RFC9639 section8.2: u20 rate, u3 channels-minus-one, u5 width-minus-one,
    # u36 interchannel sample count. Decoder representation is not encoded width.
    packed = int.from_bytes(data[18:26], "big")
    rate = packed >> 44
    channels = ((packed >> 41) & 7) + 1
    width = ((packed >> 36) & 31) + 1
    expected = packed & ((1 << 36) - 1)
    if expected == 0:
        raise DomainError(422, "generated_audio_unverified", "FLAC declares an unknown total sample count.",
                          "This finalized generation profile requires a declared sample count; retain the legal streaming FLAC for owner verification.")
    if rate != 48000 or channels != 2 or width != 16:
        raise DomainError(422, "generated_audio_profile_mismatch", "Audio layout differs from the verified PCM16 stereo 48 kHz generation profile.",
                          "Verify the selected workflow/profile before accepting this output.")
    count = 0
    try:
        with av.open(BytesIO(data), format="flac", mode="r") as container:
            streams = tuple(container.streams.audio)
            if len(streams) != 1 or len(container.streams) != 1:
                raise ValueError("Expected exactly one audio stream")
            stream = streams[0]
            if stream.codec_context.sample_rate != rate or len(stream.codec_context.layout.channels) != channels:
                raise ValueError("Encoded stream facts are inconsistent")
            for frame in container.decode(stream):
                if frame.sample_rate != rate or len(frame.layout.channels) != channels or frame.samples <= 0:
                    raise ValueError("Decoded frame facts are inconsistent")
                if not np.isfinite(frame.to_ndarray()).all():
                    raise ValueError("Decoded frame has non-finite samples")
                count += frame.samples
    except (av.FFmpegError, OSError, ValueError) as error:
        raise DomainError(422, "generated_audio_invalid", "Runtime Audio cannot be fully decoded.",
                          "Keep the failed Job and its output; inspect generation/decoder logs before retrying.") from error
    if count != expected:
        raise DomainError(422, "generated_audio_incomplete", "Decoded Audio sample count differs from its declared complete stream.",
                          "Retain the incomplete output and inspect the Runtime; do not save it as a Candidate.")
    duration = count / rate
    # The ceiling stops the singing stage; the song may end earlier than requested,
    # so only the upper bound is binding. Auto (0) follows the lyrics up to the model cap.
    ceiling = 362 if max_seconds == 0 else max_seconds + 2
    if not 1 <= duration <= ceiling:
        raise DomainError(422, "generated_audio_profile_mismatch", "Decoded Audio duration is outside the requested generation ceiling.",
                          "Retain this failed output for diagnosis and submit a ceiling that matches the requested clip length.")
    return AudioFacts(duration, channels, rate, width, count)
