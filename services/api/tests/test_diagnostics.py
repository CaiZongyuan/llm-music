"""Diagnostics public HTTP uses isolated CPU peers, receipts and application data."""

from datetime import datetime, timedelta, timezone
import importlib.util
import io
import json
from pathlib import Path
import wave

import pytest

from fastapi.testclient import TestClient

from diagnostics_peer import diagnostics_peer
from music_api.config import Settings
from music_api.main import create_app


def supported_reference() -> bytes:
    output = io.BytesIO()
    with wave.open(output, "wb") as writer:
        writer.setparams((1, 2, 24000, 0, "NONE", "not compressed"))
        writer.writeframes(b"\x10\x00" * 384000)
    return output.getvalue()


def test_old_ready_receipt_and_current_unreachable_cannot_authorize_work(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    source_time = datetime.now(timezone.utc) - timedelta(seconds=600)
    with diagnostics_peer(unavailable=True) as (url, peer):
        receipt = tmp_path / "historical-ready.json"
        receipt.write_text(json.dumps({
            "schema_version": 1, "mode": "comfyui", "runtime_url": url, "source": "isolated CPU fixture; historical prerequisites",
            "checked_at": source_time.isoformat(), "runtime_root": str(tmp_path / "runtime"), "models_root": str(tmp_path / "models"),
            "runtime_revision": "7a5dad695fe1cae25efcb2550530fb20ef68da3d", "plugin_revision": "fc78df9dfb214f396aa281f5b03519cefff5b00a",
            "process": {"pid": 1, "create_time": 1, "executable": "historical-python.exe", "entrypoint": "historical-main.py"},
            "models": [{"id": "sheetsage2-bf16", "state": "ready", "revision": "2f76ca75e6ee094169de899cc7fc99d6887e2196",
                        "checked_at": source_time.isoformat(), "actual_sha256": "5fd960ce3df281e3f3a889d174584d88f96247711480cf96377b12d7e8b6adc5",
                        "actual_size_bytes": 1386868122, "fingerprint": None}],
        }), encoding="utf-8")
        monkeypatch.setenv("MUSIC_API_RUNTIME_MODE", "comfyui")
        monkeypatch.setenv("MUSIC_API_RUNTIME_URL", url)
        monkeypatch.setenv("MUSIC_API_RUNTIME_EVIDENCE_PATH", str(receipt))
        with TestClient(create_app(Settings(data_dir=tmp_path / "application"))) as client:
            project = client.post("/projects", json={"name": "Morning song"}).json()
            base = "/projects/" + project["id"] + "/assets"
            original = supported_reference()
            uploaded = client.post(base, files={"file": ("reference.wav", original)})
            assert uploaded.status_code == 201
            response = client.get("/runtime/capabilities")
            assert response.status_code == 200
            capability = next(item for item in response.json()["capabilities"] if item["operation"] == "Transcribe")
            assert capability["ready"] is False
            assert "runtime_unavailable" in [reason["code"] for reason in capability["reasons"]]
            models = client.get("/runtime/models").json()["models"]
            model = next(item for item in models if item["id"] == "sheetsage2-bf16")
            assert model["observation"]["freshness"] == "stale"
            assert model["observation"]["age_seconds"] >= 600
            assert datetime.fromisoformat(model["observation"]["observed_at"].replace("Z", "+00:00")) == source_time
            submitted = client.post("/projects/" + project["id"] + "/transcriptions", json={"reference_asset_id": uploaded.json()["id"]})
            assert submitted.status_code == 503
            assert submitted.json()["error"]["code"] == "runtime_unavailable"
            assert peer["writes"] == []
            assert client.get("/projects/" + project["id"]).json() == project
            assert client.get(base + "/" + uploaded.json()["id"] + "/content").content == original
            assert importlib.util.find_spec("torch") is None
