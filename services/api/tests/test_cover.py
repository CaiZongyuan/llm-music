"""Cover is verified through public HTTP and immutable source files, without GPU."""

from io import BytesIO
from pathlib import Path
from uuid import uuid4
import hashlib
import wave

import av
import numpy as np
from av.audio.stream import AudioStream
from fastapi.testclient import TestClient

from music_api.config import Settings
from music_api.main import create_app
from music_api.fake_generation import generation_fixture
from music_api.fake_runtime import FakeInferenceRuntime
from music_api.runtime_types import RuntimeArtifact
from dataclasses import replace
from test_generate_from_score import source_version
from test_generation_versions import wait_job


def test_version_audio_becomes_actual_first_sixteen_seconds_reference_with_inherited_parent(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path, runtime_mode="fake")
    indices = np.arange(1679936)
    # A time-varying, distinct L/R source distinguishes wrong segments/channels.
    left = ((indices % 16001) - 8000 + (indices // 48000) * 100).astype(np.int16)
    right = (12000 - (indices % 15013) - (indices // 48000) * 50).astype(np.int16)
    original_pcm = np.column_stack([left, right]).astype("<i2").tobytes()
    encoded = BytesIO()
    with av.open(encoded, mode="w", format="flac") as container:
        stream = container.add_stream("flac", rate=48000)
        assert isinstance(stream, AudioStream)
        stream.layout = "stereo"
        stream.codec_context.format = "s16"
        for offset in range(0, len(indices), 4096):
            values = np.column_stack([left[offset:offset + 4096], right[offset:offset + 4096]]).reshape(1, -1)
            frame = av.AudioFrame.from_ndarray(values, format="s16", layout="stereo")
            frame.sample_rate = 48000
            for packet in stream.encode(frame):
                container.mux(packet)
        for packet in stream.encode():
            container.mux(packet)
    result = generation_fixture()
    result = replace(result, artifacts=tuple(RuntimeArtifact("audio", encoded.getvalue(), "flac", "audio/flac", "original.flac") if item.role == "audio" else item for item in result.artifacts))
    runtime = FakeInferenceRuntime(result_factories={"Generate": lambda: result})
    with TestClient(create_app(settings, runtime=runtime)) as client:
        project = client.post("/projects", json={"name": "Morning cover"}).json()
        base = "/projects/" + project["id"]
        original = source_version(client, base)
        source_audio = client.get(base + "/assets/" + original["audio_asset_id"] + "/content").content
        source_asset = client.get(base + "/assets/" + original["audio_asset_id"]).json()
        intent = {"source_version_id": original["id"], "save_id": str(uuid4())}
        created = client.post(base + "/reference-audio/from-version", json=intent)
        assert created.status_code == 201, created.text
        reference = created.json()
        assert reference["id"] == intent["save_id"]
        assert (reference["kind"], reference["format"], reference["duration_seconds"], reference["sample_rate"], reference["channels"], reference["sample_width_bits"]) == ("reference_audio", "wav", 16, 48000, 2, 16)
        origin = client.get(base + "/assets/" + reference["id"] + "/reference-origin").json()
        assert origin == {"reference_asset_id": reference["id"], "source_version_id": original["id"], "source_asset_id": original["audio_asset_id"],
                          "source_sha256": source_asset["sha256"], "start_frame": 0, "frame_count": 768000, "sample_rate": 48000, "derivation_version": "1.0.0"}
        derived = client.get(base + "/assets/" + reference["id"] + "/content").content
        with wave.open(BytesIO(derived), "rb") as reader:
            assert (reader.getnframes(), reader.getframerate(), reader.getnchannels(), reader.getsampwidth()) == (768000, 48000, 2, 2)
            pcm = reader.readframes(768000)
        assert pcm == original_pcm[:768000 * 4]
        assert hashlib.sha256(derived).hexdigest() == reference["sha256"]
        assert client.post(base + "/reference-audio/from-version", json=intent).status_code == 200
        assert client.get(base + "/versions").json() == [original]
        transcribed = client.post(base + "/transcriptions", json={"reference_asset_id": reference["id"]}).json()
        completed = wait_job(client, project["id"], transcribed["id"])
        assert completed["status"] == "completed", completed
        score = client.get(base + "/scores/" + completed["result"]["score_id"]).json()
        assert score["source_reference_asset_id"] == reference["id"]
        assert score["parent_version_id"] == original["id"]
        abc = client.get(base + "/assets/" + score["abc_asset_id"] + "/content").text
        edited = client.post(base + "/scores", json={"abc": abc.replace("D4", "E4"), "source_score_id": score["id"]})
        assert edited.status_code == 201, edited.text
        assert edited.json()["parent_version_id"] == original["id"]
    with TestClient(create_app(settings)) as client:
        assert client.get(base + "/assets/" + reference["id"] + "/reference-origin").json() == origin
        assert client.get(base + "/assets/" + reference["id"] + "/content").content == derived
        assert client.get(base + "/scores/" + edited.json()["id"]).json() == edited.json()
        assert client.get(base + "/versions/" + original["id"]).json() == original
        assert client.get(base + "/assets/" + original["audio_asset_id"] + "/content").content == source_audio
