"""Owned 35/31-second CPU FLACs through unchanged Generate and Version APIs."""

from dataclasses import replace
from hashlib import sha256
from io import BytesIO
import json
import os
from pathlib import Path
import sys

sys.dont_write_bytecode = True

import av
from av.audio.stream import AudioStream
import numpy as np

import run_api
from run_generation_api import ControlledRuntime, control
from music_api.fake_generation import generation_fixture


def short_flac(*, regular: bool = True) -> bytes:
    target = BytesIO()
    rate, count = 48000, 1488000
    with av.open(target, mode="w", format="flac") as container:
        stream = container.add_stream("flac", rate=rate)
        if not isinstance(stream, AudioStream):
            raise RuntimeError("Owned short FLAC encoder is not an audio stream")
        stream.layout = "stereo"
        stream.codec_context.format = "s16"
        if regular:
            stream.codec_context.options = {"frame_size": "4800"}
            stream.codec_context.open()
            if stream.codec_context.frame_size != 4800 or stream.codec_context.options:
                raise RuntimeError("Owned FLAC encoder did not consume frame_size=4800")
        for offset in range(0, count, 4096):
            indices = np.arange(offset, min(count, offset + 4096))
            channel = np.round(8192 * np.sin(2 * np.pi * 660 * indices / rate)).astype(np.int16)
            frame = av.AudioFrame.from_ndarray(np.column_stack([channel, channel]).reshape(1, -1), format="s16", layout="stereo")
            frame.sample_rate = rate
            for packet in stream.encode(frame):
                container.mux(packet)
        for packet in stream.encode():
            container.mux(packet)
    return target.getvalue()


def inspect_complete_audio(data: bytes, count: int) -> dict:
    if data[:4] != b"fLaC" or data[4] & 127 != 0 or int.from_bytes(data[5:8], "big") != 34:
        raise RuntimeError("Owned fixture lacks FLAC STREAMINFO")
    packed = int.from_bytes(data[18:26], "big")
    header = {"sample_rate": packed >> 44, "channels": (packed >> 41 & 7) + 1,
              "bits_per_sample": (packed >> 36 & 31) + 1, "frames": packed & ((1 << 36) - 1)}
    frames = 0
    pcm = sha256()
    packet_samples = []
    with av.open(BytesIO(data)) as container:
        for packet in container.demux(container.streams.audio[0]):
            if not packet.size:
                continue
            decoded = packet.decode()
            packet_samples.append(sum(frame.samples for frame in decoded))
            for frame in decoded:
                if frame.sample_rate != 48000 or frame.layout.name != "stereo" or frame.format.name != "s16":
                    raise RuntimeError("Owned CPU fixture has unexpected decoded format")
                frames += frame.samples
                pcm.update(frame.to_ndarray().tobytes())
    if header != {"sample_rate": 48000, "channels": 2, "bits_per_sample": 16, "frames": count} or frames != count:
        raise RuntimeError("Owned FLAC header and entire decode disagree")
    return {"sha256": sha256(data).hexdigest(), "bytes": len(data), "header": header,
            "decoded_frames": frames, "duration_seconds": frames / 48000,
            "pcm_sha256": pcm.hexdigest(), "packet_samples": packet_samples,
            "scope": "CPU generated test tone; no GPU or original music crop"}


def compare_fixture():
    result = generation_fixture()
    profile = control().get("audio", "long")
    short = profile in {"short", "short-original"}
    count = 1488000 if short else 1679936
    data = short_flac(regular=profile == "short") if short else next(item.data for item in result.artifacts if item.role == "audio")
    receipt = inspect_complete_audio(data, count)
    receipt["fixture_profile"] = profile
    if short and receipt["pcm_sha256"] != "cc5c688c270350a2bba3ce5746489b9fb77a7062e6d470e1ee088b42f7352a23":
        raise RuntimeError("Owned short FLAC PCM differs from the original test tone")
    if profile == "short" and receipt["packet_samples"] != [4800] * 310:
        raise RuntimeError("Owned regular short FLAC packet profile differs")
    path = Path(os.environ["MUSIC_BROWSER_RUN_DIR"]) / "compare-media.json"
    receipts = json.loads(path.read_text(encoding="utf-8")) if path.exists() else []
    if not any(item["sha256"] == receipt["sha256"] for item in receipts):
        path.write_text(json.dumps([*receipts, receipt], indent=2) + "\n", encoding="utf-8")
    return replace(result, artifacts=tuple(replace(item, data=data) if item.role == "audio" else item for item in result.artifacts),
                   provenance={**result.provenance, "validation_scope": receipt["scope"], "cpu_audio_frames": count, "cpu_audio_profile": profile})


class CompareRuntime(ControlledRuntime):
    def __init__(self):
        super().__init__()
        self.result_factories.update({"Generate": compare_fixture, "GenerateFromScore": compare_fixture})


if __name__ == "__main__":
    original_create_app = run_api.create_app
    run_api.create_app = lambda settings: original_create_app(settings, runtime=CompareRuntime())
    run_api.main()
