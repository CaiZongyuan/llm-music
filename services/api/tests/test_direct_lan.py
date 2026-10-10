"""Direct LAN public HTTP/WS/audio retains durable single-user request identity."""

from pathlib import Path
from uuid import uuid4

import pytest
from starlette.websockets import WebSocketDisconnect

from generation_fixture import generated_result
from music_api.config import Settings
from music_api.fake_generation import flac_fixture
from music_api.fake_runtime import FakeInferenceRuntime
from music_api.main import create_app
from test_generation_versions import wait_job
from test_mobile_pairing import at_socket


LAN = ("192.168.31.209", 8001)


def test_direct_lan_http_websocket_original_flac_and_request_recovery(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path, lan_host=LAN[0], lan_port=LAN[1], runtime_mode="fake")
    original = flac_fixture(5)
    runtime = FakeInferenceRuntime(results={"Generate": generated_result(original)})
    project_key, job_key = str(uuid4()), str(uuid4())
    inputs = {"style": "中文 folk", "lyrics": "[Verse]\n第一行\n第二行", "seed": 42, "max_seconds": 5}
    with at_socket(create_app(settings, runtime=runtime), LAN) as phone:
        identity = phone.get("/connection").json()
        assert identity["access_method"] == "direct"
        assert identity["pairing_available"] is False
        assert identity["lan_address"] == "http://192.168.31.209:8001"
        assert phone.get("/projects").json() == []
        assert phone.get("/health").status_code == 200
        missing_key = phone.post("/projects", json={"name": "中文直连项目"})
        assert missing_key.status_code == 422
        assert missing_key.json()["error"]["code"] == "idempotency_key_required"
        created = phone.post("/projects", json={"name": "中文直连项目"}, headers={"Idempotency-Key": project_key})
        assert created.status_code == 201
        project = created.json()
        base = "/projects/" + project["id"]
        submitted = phone.post(base + "/jobs/generate", json=inputs, headers={"Idempotency-Key": job_key})
        assert submitted.status_code == 202
        job = wait_job(phone, project["id"], submitted.json()["id"])
        assert job["status"] == "completed", job
        assert len(phone.get(base + "/jobs").json()) == 1
        with phone.websocket_connect(base + "/jobs/" + job["id"] + "/events") as observer:
            event = observer.receive_json()
            assert event["type"] == "job.updated"
            assert event["job"]["id"] == job["id"]
            assert event["job"]["status"] == "completed"
        candidate = phone.get(base + "/candidates/" + job["result"]["candidate_id"]).json()
        content = base + "/assets/" + candidate["audio_asset_id"] + "/content"
        full = phone.get(content)
        assert full.status_code == 200 and full.content == original
        assert full.headers["content-type"] == "audio/flac"
        assert full.content.startswith(b"fLaC")
        head = phone.head(content)
        assert head.status_code == 200 and head.content == b""
        assert int(head.headers["content-length"]) == len(original)
        assert head.headers["etag"] == full.headers["etag"]
        partial = phone.get(content, headers={"Range": "bytes=4-11"})
        assert partial.status_code == 206 and partial.content == original[4:12]
        assert partial.headers["content-range"] == f"bytes 4-11/{len(original)}"
        saved = phone.post(base + "/versions", json={"candidate_id": candidate["id"], "name": "直连保存"})
        assert saved.status_code == 201
        version = saved.json()

    with at_socket(create_app(settings), LAN) as phone:
        assert phone.get("/connection").json() == identity
        replay = phone.post("/projects", json={"name": "中文直连项目"}, headers={"Idempotency-Key": project_key})
        assert replay.status_code == 200 and replay.json() == project
        replay = phone.post(base + "/jobs/generate", json=inputs, headers={"Idempotency-Key": job_key})
        assert replay.status_code == 200 and replay.json() == job
        recovered = phone.get("/requests/" + job_key).json()
        assert recovered["resource_id"] == job["id"]
        assert recovered["project_id"] == project["id"]
        conflict = phone.post(base + "/jobs/generate", json={**inputs, "seed": 43}, headers={"Idempotency-Key": job_key})
        assert conflict.status_code == 409 and conflict.json()["error"]["code"] == "idempotency_conflict"
        assert phone.get(base + "/versions").json() == [version]
        assert phone.get(content).content == original
        assert len(phone.get("/projects").json()) == len(phone.get(base + "/jobs").json()) == 1


def test_direct_access_still_requires_the_actual_configured_listener(tmp_path: Path) -> None:
    app = create_app(Settings(data_dir=tmp_path, lan_host=LAN[0], lan_port=LAN[1]))
    with at_socket(app, ("127.0.0.1", 8000)) as local:
        assert local.get("/connection").json()["lan_address"] == "http://192.168.31.209:8001"
        unknown = at_socket(app, ("192.168.31.210", 8001))
        assert unknown.get("/projects", headers={"Host": "127.0.0.1:8000"}).json()["error"]["code"] == "listener_forbidden"
        with pytest.raises(WebSocketDisconnect) as rejected:
            with unknown.websocket_connect(f"/projects/{uuid4()}/jobs/{uuid4()}/events"):
                pass
        assert rejected.value.code == 4403

    app = create_app(Settings(data_dir=tmp_path))
    with at_socket(app, ("127.0.0.1", 8000)) as local:
        assert local.get("/connection").json()["lan_address"] is None
        assert local.get("/projects").status_code == 200
        unconfigured = at_socket(app, LAN)
        # Actual serving entrypoints always provide bindings even without LAN.
        app.state.access.bindings = {("127.0.0.1", 8000): "local"}
        assert unconfigured.get("/projects").status_code == 403
