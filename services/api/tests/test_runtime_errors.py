"""Native errors become readable domain failures; private detail remains structured logs."""

import io
import json
import logging
from pathlib import Path
import pytest

from fastapi.testclient import TestClient
import httpx

from cancellation_peer import cancellation_peer
from music_api.cli import JsonLogFormatter
from music_api.config import Settings
from music_api.main import create_app
from test_transcription import reference_audio, terminal


@pytest.mark.parametrize("scenario,expected_code", [("oom", "runtime_out_of_memory"), ("model_missing", "model_missing"),
                                                  ("ordinary_failure", "transcription_failed")])
def test_owned_native_failure_is_a_domain_error_with_private_detail_only_in_logs(tmp_path: Path, monkeypatch, scenario: str, expected_code: str) -> None:
    output = io.StringIO()
    handler = logging.StreamHandler(output)
    handler.setFormatter(JsonLogFormatter())
    logger = logging.getLogger("music_api")
    logger.addHandler(handler)
    try:
        with cancellation_peer(tmp_path, monkeypatch) as (url, receipt_path, registry):
            configured = Settings(data_dir=tmp_path / "application", runtime_mode="comfyui", runtime_url=url, runtime_evidence_path=receipt_path)
            with TestClient(create_app(configured, registry=registry)) as client, httpx.Client(base_url=url, trust_env=False) as peer:
                peer.post("/control", json={"action": "scenario", "value": scenario}).raise_for_status()
                project = client.post("/projects", json={"name": "Morning song"}).json()
                base = "/projects/" + project["id"]
                original = reference_audio()
                reference = client.post(base + "/assets", files={"file": ("reference.wav", original)}).json()
                submitted = client.post(base + "/transcriptions", json={"reference_asset_id": reference["id"]}).json()
                failed = terminal(client, base + "/jobs/" + submitted["id"])
                assert failed["status"] == "failed"
                assert failed["error"]["code"] == expected_code
                assert failed["error"]["recovery"]
                assert "INTERNAL" not in json.dumps(failed)
                assert failed["result"] is None
                assert client.get(base + "/assets").json() == [reference]
                assert client.get(base + "/assets/" + reference["id"] + "/content").content == original
                records = [json.loads(line) for line in output.getvalue().splitlines()]
                assert any("INTERNAL" in json.dumps(record) for record in records)
                assert any(record.get("job_id") == failed["id"] for record in records)
    finally:
        logger.removeHandler(handler)
