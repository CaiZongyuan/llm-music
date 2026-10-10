"""The CPU export and public discovery expose one HTTP/WS contract."""

import json
import os
from pathlib import Path
import subprocess
import sys

from fastapi.testclient import TestClient
from pydantic import create_model
import pytest

from music_api.config import Settings
from music_api.main import create_app


def test_cpu_export_matches_http_and_registered_job_events(tmp_path: Path) -> None:
    output, absent_data = tmp_path / "openapi.json", tmp_path / "not-created"
    exported = subprocess.run(
        [sys.executable, "-m", "music_api", "openapi", "--data-dir", str(absent_data), "--output", str(output)],
        capture_output=True, text=True, encoding="utf-8", timeout=15,
        env={**os.environ, "MUSIC_API_RUNTIME_MODE": "fake"},
    )
    assert exported.returncode == 0, exported.stderr
    assert not absent_data.exists()
    document = json.loads(output.read_bytes())
    with TestClient(create_app(Settings(data_dir=tmp_path / "application", runtime_mode="fake"))) as client:
        assert client.get("/openapi.json").json() == document
    websocket_path = "/projects/{project_id}/jobs/{job_id}/events"
    assert websocket_path not in document["paths"]
    assert document["x-websockets"] == {
        websocket_path: {"message": {"$ref": "#/components/schemas/JobEventRead"},
                         "security": [{"DeviceBearer": []}, {}],
                         "x-listener-access": "lan-device",
                         "description": "LAN requires Authorization: Bearer in the handshake headers. Local business consumers remain compatible. Revoking the device closes active sockets with code 4401 without cancelling the Job."},
    }
    event = document["components"]["schemas"]["JobEventRead"]
    assert event["properties"]["type"]["const"] == "job.updated"
    assert event["properties"]["job"] == {"$ref": "#/components/schemas/JobRead"}
    status = document["components"]["schemas"]["JobRead"]["properties"]["status"]["enum"]
    assert status == ["queued", "running", "completed", "failed", "cancelled"]


def test_binary_download_and_bodyless_operations_are_described(tmp_path: Path) -> None:
    document = create_app(Settings(data_dir=tmp_path / "not-created", runtime_mode="fake")).openapi()
    download = document["paths"]["/projects/{project_id}/assets/{asset_id}/content"]["get"]
    assert set(download["responses"]["200"]["content"]) == {
        "audio/wav", "audio/flac", "text/vnd.abc", "audio/midi",
    }
    assert download["responses"]["404"]["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/ErrorResponse",
    }
    for operation in ["cancel", "retry"]:
        route = document["paths"][f"/projects/{{project_id}}/jobs/{{job_id}}/{operation}"]["post"]
        assert "requestBody" not in route
    saves = document["paths"]["/projects/{project_id}/versions"]["post"]["responses"]
    assert {"200", "201"}.issubset(saves)
    assert set(download["responses"]["206"]["content"]) == {
        "audio/wav", "audio/flac", "text/vnd.abc", "audio/midi", "multipart/byteranges",
    }
    assert download["responses"]["416"]["content"] == {"text/plain": {"schema": {"type": "string"}}}
    assert download["security"] == [{"DeviceBearer": []}, {}]
    assert document["paths"]["/pairing/challenges"]["post"]["security"] == [{"OwnerCSRF": []}]
    assert document["paths"]["/connection"]["get"]["security"] == []


def test_export_refuses_a_conflicting_registered_event_schema(tmp_path: Path) -> None:
    app = create_app(Settings(data_dir=tmp_path / "not-created", runtime_mode="fake"))
    conflicting = create_model("JobEventRead", unrelated=(int, ...))

    @app.get("/conflicting-schema", response_model=conflicting)
    def conflicting_contract() -> dict[str, int]:
        return {"unrelated": 1}

    with pytest.raises(ValueError, match="WebSocket schema collides with HTTP schema: JobEventRead"):
        app.openapi()
