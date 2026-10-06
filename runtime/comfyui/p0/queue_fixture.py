"""A declared polarity variant of the original CC0 Reference Audio."""

from array import array
import hashlib
from pathlib import Path
import sys
import wave

if __package__:
    from .reference_fixture import write_reference
else:
    from reference_fixture import write_reference


def write_queue_reference(directory):
    directory = Path(directory)
    original = write_reference(directory / "reference-original.wav")
    target = directory / "reference-polarity.wav"
    with wave.open(str(original), "rb") as reader:
        parameters = reader.getparams()
        pcm = array("h")
        pcm.frombytes(reader.readframes(reader.getnframes()))
    if sys.byteorder != "little":
        pcm.byteswap()
    inverted = array("h", (-sample for sample in pcm))
    if sys.byteorder != "little":
        inverted.byteswap()
    with wave.open(str(target), "wb") as writer:
        writer.setparams(parameters)
        writer.writeframes(inverted.tobytes())
    return target, dict(id="queue-history-polarity-v1", source="Original CC0 instrumental fixture with every PCM sample multiplied by -1",
                        license="CC0-1.0", sample_rate=parameters.framerate, channels=parameters.nchannels,
                        duration_seconds=parameters.nframes / parameters.framerate,
                        original_sha256=hashlib.sha256(original.read_bytes()).hexdigest(),
                        sha256=hashlib.sha256(target.read_bytes()).hexdigest(),
                        cache_condition="Pinned transcribe.track_of hashes float32 waveform samples before SheetSage features; polarity changes the recording key, not inference settings")
