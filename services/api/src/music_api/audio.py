"""Validate all PCM WAV frames using CPU standard-library decoding."""

from dataclasses import dataclass
from pathlib import Path
import wave

from music_api.errors import DomainError


@dataclass(frozen=True)
class AudioFacts:
    duration_seconds: float
    channels: int
    sample_rate: int
    sample_width_bits: int | None
    decoded_frames: int


def inspect_wav(path: Path, max_seconds: float) -> AudioFacts:
    try:
        with wave.open(str(path), "rb") as reader:
            channels, width, rate, expected = reader.getnchannels(), reader.getsampwidth(), reader.getframerate(), reader.getnframes()
            if channels not in (1, 2) or width not in (1, 2, 3, 4) or not 8000 <= rate <= 192000 or expected <= 0:
                raise ValueError("Unsupported PCM layout")
            duration = expected / rate
            if duration > max_seconds:
                raise DomainError(413, "audio_duration_exceeded", "Audio exceeds the configured duration budget.",
                                  "Use a shorter reference or ask the owner to configure the upload budget.")
            frames = 0
            while chunk := reader.readframes(16384):
                if len(chunk) % (channels * width):
                    raise ValueError("Partial PCM frame")
                frames += len(chunk) // (channels * width)
            if frames != expected:
                raise ValueError("Truncated PCM body")
            return AudioFacts(duration, channels, rate, width * 8, frames)
    except (wave.Error, EOFError, ValueError) as error:
        raise DomainError(422, "invalid_audio", "Content is not a complete supported PCM WAV audio file.",
                          "Upload nonempty mono/stereo PCM WAV, 8–32 bit integer samples, 8–192 kHz.") from error
