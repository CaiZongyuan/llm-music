"""Device authorization through the public HTTP and WebSocket boundaries."""

from pathlib import Path
from uuid import UUID
import time

import pytest

from fastapi.testclient import TestClient

from music_api.config import Settings
from music_api.main import create_app
from starlette.types import Receive, Scope, Send


def at_socket(app, address: tuple[str, int]) -> TestClient:
    async def socket_boundary(scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] in {"http", "websocket"}:
            scope["server"] = address
        await app(scope, receive, send)
    return TestClient(socket_boundary)


def test_connection_identity_survives_api_restart(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path)
    with TestClient(create_app(settings)) as client:
        response = client.get("/connection")
        assert response.status_code == 200
        connection = response.json()
        UUID(connection["server_id"])
        assert connection["protocol_version"] == 1
        assert connection["pairing_available"] is False
        assert connection["access_method"] == "direct"
        assert connection["lan_address"] is None
        assert set(connection) == {"server_id", "protocol_version", "access_method", "pairing_available", "lan_address"}
    with TestClient(create_app(settings)) as client:
        assert client.get("/connection").json() == connection


def test_phone_claims_once_and_authorization_cannot_manage_the_computer(tmp_path: Path) -> None:
    app = create_app(Settings(data_dir=tmp_path, lan_host="192.168.31.209"))
    with at_socket(app, ("127.0.0.1", 8000)) as local:
        phone = at_socket(app, ("192.168.31.209", 8001))
        assert phone.get("/projects", headers={"Host": "127.0.0.1:8000", "Forwarded": "host=localhost;for=127.0.0.1"}).status_code == 200
        owner = local.get("/pairing/owner").json()
        assert local.post("/pairing/challenges").status_code == 403
        headers = {"X-Owner-CSRF": owner["owner_csrf"], "Origin": "http://127.0.0.1:5173"}
        challenge = local.post("/pairing/challenges", headers=headers)
        assert challenge.status_code == 201
        assert phone.get("/connection").json()["pairing_available"] is False
        claim = {"device_id": "73897c39-8d1b-43d4-bfc0-22f0c39b4165", "device_token": "ab" * 32,
                 "device_name": "Test phone", "code": challenge.json()["code"]}
        claimed = phone.post("/pairing/claim", json=claim)
        assert claimed.status_code == 201
        assert phone.post("/pairing/claim", json=claim).json() == claimed.json()
        auth = {"Authorization": "Bearer " + claim["device_token"]}
        assert phone.get("/projects", headers=auth).json() == []
        assert phone.get("/device", headers=auth).json() == claimed.json()
        assert phone.get("/pairing/owner", headers=auth).status_code == 403
        assert phone.delete("/pairing/devices/" + claim["device_id"], headers={**auth, **headers}).status_code == 403


def test_unknown_or_missing_socket_never_becomes_local(tmp_path: Path) -> None:
    app = create_app(Settings(data_dir=tmp_path, lan_host="192.168.31.209"))
    with at_socket(app, ("127.0.0.1", 8000)):
        for address in [("127.0.0.1", 8001), ("192.168.31.209", 8000), ("testserver", 80)]:
            client = at_socket(app, address)
            assert client.get("/connection", headers={"Host": "127.0.0.1:8000"}).json()["error"]["code"] == "listener_forbidden"
        assert TestClient(app).get("/pairing/owner").status_code == 403


def test_pairing_window_rejects_foreign_origin_and_expires(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    app = create_app(Settings(data_dir=tmp_path, lan_host="192.168.31.209"))
    with at_socket(app, ("127.0.0.1", 8000)) as local:
        phone = at_socket(app, ("192.168.31.209", 8001))
        csrf = local.get("/pairing/owner").json()["owner_csrf"]
        for origin in ["http://evil.example", "http://localhost:5173.evil.example", "null"]:
            assert local.post("/pairing/challenges", headers={"X-Owner-CSRF": csrf, "Origin": origin}).status_code == 403
        created_at = time.time()
        challenge = local.post("/pairing/challenges", headers={"X-Owner-CSRF": csrf}).json()
        assert 119 <= challenge["expires_at"] - created_at <= 121
        assert challenge["attempts_remaining"] == 5
        claim = {"device_id": "58b159cc-13ed-4c92-aabd-568cf89c1bb6", "device_token": "ef" * 32,
                 "device_name": "Expired phone", "code": challenge["code"]}
        monkeypatch.setattr(time, "time", lambda: challenge["expires_at"] + 1)
        assert phone.get("/connection").json()["pairing_available"] is False
        assert phone.post("/pairing/claim", json=claim).json()["error"]["code"] == "pairing_expired"


def test_latest_pairing_window_is_ordered_by_creation_not_wall_clock_or_uuid(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    app = create_app(Settings(data_dir=tmp_path, lan_host="192.168.31.209"))
    with at_socket(app, ("127.0.0.1", 8000)) as local:
        phone = at_socket(app, ("192.168.31.209", 8001))
        headers = {"X-Owner-CSRF": local.get("/pairing/owner").json()["owner_csrf"]}
        now = time.time()
        identifiers = iter([UUID("ffffffff-ffff-4fff-bfff-ffffffffffff"), UUID("00000000-0000-4000-8000-000000000001")])
        monkeypatch.setattr(time, "time", lambda: now)
        monkeypatch.setattr("music_api.pairing.uuid4", lambda: next(identifiers))
        first = local.post("/pairing/challenges", headers=headers).json()
        second = local.post("/pairing/challenges", headers=headers).json()
        assert first["id"] != second["id"]
        assert local.get("/pairing/owner").json()["challenge"]["id"] == second["id"]
        assert phone.get("/connection").json()["pairing_available"] is False
        claim = {"device_id": "d6bfedc9-40a9-40da-9727-81ddf39cc12f", "device_token": "23" * 32,
                 "device_name": "Latest window phone", "code": second["code"]}
        assert phone.post("/pairing/claim", json=claim).status_code == 201


def test_existing_token_cannot_authorize_another_device(tmp_path: Path) -> None:
    app = create_app(Settings(data_dir=tmp_path, lan_host="192.168.31.209"))
    with at_socket(app, ("127.0.0.1", 8000)) as local:
        phone = at_socket(app, ("192.168.31.209", 8001))
        headers = {"X-Owner-CSRF": local.get("/pairing/owner").json()["owner_csrf"]}
        challenge = local.post("/pairing/challenges", headers=headers).json()
        claim = {"device_id": "bc276042-2543-4436-a209-691aa72e0d4c", "device_token": "45" * 32,
                 "device_name": "Original phone", "code": challenge["code"]}
        assert phone.post("/pairing/claim", json=claim).status_code == 201
        next_window = local.post("/pairing/challenges", headers=headers).json()
        conflict = phone.post("/pairing/claim", json={**claim, "device_id": "ee5fcfc6-6b8f-4cc6-9040-8c9f85c64c27", "code": next_window["code"]})
        assert conflict.status_code == 409
        assert conflict.json()["error"]["code"] == "pairing_conflict"
        assert len(local.get("/pairing/devices").json()) == 1
        assert phone.get("/connection").json()["pairing_available"] is False


def test_non_ascii_owner_csrf_is_rejected_without_a_server_error(tmp_path: Path) -> None:
    app = create_app(Settings(data_dir=tmp_path, lan_host="192.168.31.209"))
    with at_socket(app, ("127.0.0.1", 8000)) as local:
        response = local.post("/pairing/challenges", headers={b"x-owner-csrf": b"\xff", b"origin": b"http://127.0.0.1:5173"})
        assert response.status_code == 403
        assert response.json()["error"]["code"] == "owner_csrf_required"
