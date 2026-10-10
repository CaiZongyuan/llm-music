"""Actual Windows listeners share one API and preserve socket-based privilege."""

from contextlib import contextmanager
import os
from pathlib import Path
import socket
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4
from collections.abc import Iterator

import httpx
import psutil
from test_projects_assets import reference_wav
from websockets.sync.client import connect
from websockets.exceptions import InvalidStatus
import pytest


def local_ipv4() -> str:
    selected = os.environ.get("MUSIC_TEST_LAN_HOST")
    if selected:
        return selected
    for name, entries in psutil.net_if_addrs().items():
        if psutil.net_if_stats().get(name) and psutil.net_if_stats()[name].isup:
            for entry in entries:
                if entry.family == socket.AF_INET and not entry.address.startswith("127."):
                    return entry.address
    raise AssertionError("Real dual listener evidence requires an active non-loopback IPv4")


@contextmanager
def dual_server(data: Path, log_path: Path, address: str, ports: tuple[int, int] | None = None,
                finish_runtime: Path | None = None, unknown_port: int | None = None) -> Iterator[tuple[httpx.Client, httpx.Client, subprocess.Popen]]:
    if ports is None:
        with socket.socket() as first, socket.socket() as second:
            first.bind(("127.0.0.1", 0))
            second.bind((address, 0))
            ports = first.getsockname()[1], second.getsockname()[1]
    with log_path.open("wb") as log:
        command = [sys.executable, str(Path(__file__).with_name("run_mobile_lan.py")), str(data), address, *map(str, ports)]
        if finish_runtime is not None:
            command.append(str(finish_runtime))
        if unknown_port is not None:
            if finish_runtime is None:
                command.append("-")
            command.append(str(unknown_port))
        process = subprocess.Popen(command,
                                   stdin=subprocess.PIPE, stdout=log, stderr=log,
                                   env={**os.environ, "MUSIC_API_RUNTIME_MODE": "fake"},
                                   creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        try:
            with httpx.Client(base_url=f"http://127.0.0.1:{ports[0]}", trust_env=False, timeout=3) as local, \
                    httpx.Client(base_url=f"http://{address}:{ports[1]}", trust_env=False, timeout=3) as phone:
                deadline = time.monotonic() + 15
                while True:
                    assert process.poll() is None, log_path.read_text(encoding="utf-8", errors="replace")
                    try:
                        if local.get("/connection").status_code == phone.get("/connection").status_code == 200:
                            break
                    except httpx.TransportError:
                        pass
                    assert time.monotonic() < deadline, log_path.read_text(encoding="utf-8", errors="replace")
                    time.sleep(0.05)
                yield local, phone, process
        finally:
            if process.poll() is None:
                assert process.stdin is not None
                process.stdin.write(b"\n")
                process.stdin.flush()
                process.stdin.close()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.terminate()
                    process.wait(timeout=5)
                    raise AssertionError("Owned dual listener did not stop gracefully")


def test_real_direct_socket_cannot_spoof_local_admin_privilege(tmp_path: Path) -> None:
    address, log = local_ipv4(), tmp_path / "dual.log"
    with dual_server(tmp_path / "data", log, address) as (local, phone, process):
        assert local.get("/connection").json() == phone.get("/connection").json()
        assert phone.get("/health").status_code == 200
        headers = {"Host": str(local.base_url).removeprefix("http://").rstrip("/"),
                   "Forwarded": "for=127.0.0.1;host=localhost", "X-Forwarded-Host": "localhost", "X-Forwarded-For": "127.0.0.1"}
        assert phone.get("/pairing/owner", headers=headers).status_code == 403
        assert phone.get("/projects", headers=headers).status_code == 200
        csrf = local.get("/pairing/owner").json()["owner_csrf"]
        challenge = local.post("/pairing/challenges", headers={"X-Owner-CSRF": csrf}).json()
        claim = {"device_id": "4d2e5f73-5dad-431d-815a-71c000bfbe36", "device_token": "cd" * 32,
                 "device_name": "Real socket phone", "code": challenge["code"]}
        assert phone.post("/pairing/claim", json=claim).status_code == 201
        phone.headers["Authorization"] = "Bearer " + claim["device_token"]
        project = phone.post("/projects", json={"name": "Shared socket Project"}, headers={"Idempotency-Key": str(uuid4())})
        assert project.status_code == 201
        assert local.get("/projects/" + project.json()["id"]).json() == project.json()
        listeners = [item for item in psutil.net_connections(kind="tcp") if item.status == psutil.CONN_LISTEN
                     and item.laddr.port in {local.base_url.port, phone.base_url.port}]
        assert len({item.pid for item in listeners}) == 1
        assert {item.laddr.ip for item in listeners} == {"127.0.0.1", address}
    text = log.read_text(encoding="utf-8")
    assert text.count("Application startup complete.") == 1
    assert text.count("Application shutdown complete.") == 1


def test_wrong_attempts_and_exact_claim_are_durable_across_real_restart(tmp_path: Path) -> None:
    address, data = local_ipv4(), tmp_path / "data"
    with dual_server(data, tmp_path / "first.log", address) as (local, phone, _):
        server_id = phone.get("/connection").json()["server_id"]
        owner = local.get("/pairing/owner").json()
        headers = {"X-Owner-CSRF": owner["owner_csrf"]}
        challenge = local.post("/pairing/challenges", headers=headers).json()
        claim = {"device_id": str(uuid4()), "device_token": "12" * 32, "device_name": "Durable phone", "code": challenge["code"]}
        wrong = {**claim, "code": "000000" if claim["code"] != "000000" else "111111"}
        assert phone.post("/pairing/claim", json=wrong).status_code == 403
        assert phone.post("/pairing/claim", json=wrong).status_code == 403
    with dual_server(data, tmp_path / "second.log", address) as (local, phone, _):
        assert phone.get("/connection").json()["server_id"] == server_id
        owner = local.get("/pairing/owner").json()
        assert owner["challenge"]["attempts_remaining"] == 3
        assert local.post("/pairing/challenges", headers=headers).status_code == 403  # Process-local CSRF never survives restart.
        assert [phone.post("/pairing/claim", json=wrong).status_code for _ in range(3)] == [403, 403, 429]
        assert phone.post("/pairing/claim", json=claim).status_code == 429
        challenge = local.post("/pairing/challenges", headers={"X-Owner-CSRF": owner["owner_csrf"]}).json()
        claim["code"] = challenge["code"]
        accepted = phone.post("/pairing/claim", json=claim)
        assert accepted.status_code == 201
    with dual_server(data, tmp_path / "third.log", address) as (local, phone, _):
        assert phone.post("/pairing/claim", json=claim).status_code == 200
        assert phone.post("/pairing/claim", json=claim).json() == accepted.json()
        assert phone.post("/pairing/claim", json={**claim, "device_name": "Altered"}).status_code == 409
        assert len(local.get("/pairing/devices").json()) == 1


def test_concurrent_claims_only_authorize_one_phone(tmp_path: Path) -> None:
    address = local_ipv4()
    with dual_server(tmp_path / "data", tmp_path / "concurrent.log", address) as (local, phone, _):
        csrf = local.get("/pairing/owner").json()["owner_csrf"]
        challenge = local.post("/pairing/challenges", headers={"X-Owner-CSRF": csrf}).json()
        claims = [{"device_id": str(uuid4()), "device_token": token * 32, "device_name": "Concurrent phone", "code": challenge["code"]}
                  for token in ["34", "56"]]
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda claim: phone.post("/pairing/claim", json=claim), claims))
        assert sorted(result.status_code for result in results) == [201, 410]
        assert len(local.get("/pairing/devices").json()) == 1
        accepted = claims[next(index for index, result in enumerate(results) if result.status_code == 201)]
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: phone.post("/pairing/claim", json=accepted), range(2)))
        assert [result.status_code for result in results] == [200, 200]


def test_direct_original_audio_survives_legacy_device_revocation(tmp_path: Path) -> None:
    address = local_ipv4()
    with dual_server(tmp_path / "data", tmp_path / "audio.log", address) as (local, phone, _):
        csrf = local.get("/pairing/owner").json()["owner_csrf"]
        headers = {"X-Owner-CSRF": csrf}
        challenge = local.post("/pairing/challenges", headers=headers).json()
        claim = {"device_id": str(uuid4()), "device_token": "78" * 32, "device_name": "Audio phone", "code": challenge["code"]}
        assert phone.post("/pairing/claim", json=claim).status_code == 201
        auth = {"Authorization": "Bearer " + claim["device_token"]}
        project = local.post("/projects", json={"name": "Original audio"}).json()
        base = "/projects/" + project["id"] + "/assets"
        original = reference_wav()
        asset = local.post(base, files={"file": ("original.wav", original)}).json()
        content = base + "/" + asset["id"] + "/content"
        assert phone.head(content, headers=auth).status_code == 200
        full = phone.get(content, headers=auth)
        assert full.content == original and full.headers["content-type"] == "audio/wav"
        head = phone.head(content, headers=auth)
        assert head.content == b"" and int(head.headers["content-length"]) == len(original)
        assert head.headers["etag"] == full.headers["etag"]
        partial = phone.get(content, headers={**auth, "Range": "bytes=4-11"})
        assert partial.status_code == 206 and partial.content == original[4:12]
        assert partial.headers["content-range"] == f"bytes 4-11/{len(original)}"
        assert phone.get(content, headers={**auth, "Range": "bytes=999999999-"}).status_code == 416
        for path in ["/health", "/runtime/diagnostics", "/openapi.json", "/docs", "/projects", base, content]:
            assert phone.get(path).status_code == 200
        assert phone.post("/projects", json={"name": "Direct write without frozen key"}).status_code == 422
        assert local.delete("/pairing/devices/" + claim["device_id"], headers=headers).status_code == 200
        assert phone.get("/device", headers=auth).status_code == 401
        assert phone.head(content).status_code == 200
        assert phone.get(content, headers={"Range": "bytes=4-11"}).content == original[4:12]
        assert phone.get(content, headers=auth).content == original
        assert local.get(content).content == original


def test_legacy_revoke_does_not_close_direct_websocket_or_cancel_shared_jobs(tmp_path: Path) -> None:
    import json
    address, release = local_ipv4(), tmp_path / "finish-runtime"
    with dual_server(tmp_path / "data", tmp_path / "websocket.log", address, finish_runtime=release) as (local, phone, _):
        csrf = local.get("/pairing/owner").json()["owner_csrf"]
        challenge = local.post("/pairing/challenges", headers={"X-Owner-CSRF": csrf}).json()
        claim = {"device_id": str(uuid4()), "device_token": "90" * 32, "device_name": "WS phone", "code": challenge["code"]}
        assert phone.post("/pairing/claim", json=claim).status_code == 201
        auth = {"Authorization": "Bearer " + claim["device_token"]}
        project = local.post("/projects", json={"name": "Shared queue"}).json()
        base = "/projects/" + project["id"]
        inputs = {"style": "测试 folk", "lyrics": "[verse]\n第一行\n第二行", "seed": 42, "max_seconds": 0}
        first = phone.post(base + "/jobs/generate", json=inputs, headers={**auth, "Idempotency-Key": str(uuid4())}).json()
        deadline = time.monotonic() + 5
        while local.get(base + "/jobs/" + first["id"]).json()["status"] != "running":
            assert time.monotonic() < deadline
            time.sleep(0.02)
        second = local.post(base + "/jobs/generate", json={**inputs, "seed": 43}).json()
        assert second["status"] == "queued"
        ws = str(phone.base_url).replace("http://", "ws://").rstrip("/") + base + "/jobs/" + first["id"] + "/events"
        with connect(ws, proxy=None, open_timeout=3) as observer:
            initial = json.loads(observer.recv(timeout=3))
            assert initial["job"]["id"] == first["id"] and initial["job"]["status"] == "running"
            assert local.delete("/pairing/devices/" + claim["device_id"], headers={"X-Owner-CSRF": csrf}).status_code == 200
            assert local.get(base + "/jobs/" + first["id"]).json()["status"] == "running"
            assert local.get(base + "/jobs/" + second["id"]).json()["status"] == "queued"
            release.touch()
            deadline = time.monotonic() + 5
            while True:
                event = json.loads(observer.recv(timeout=max(0.01, deadline - time.monotonic())))
                if event["job"]["status"] == "completed":
                    break
                assert time.monotonic() < deadline, event
        deadline = time.monotonic() + 5
        while True:
            jobs = local.get(base + "/jobs").json()
            if all(job["status"] == "completed" for job in jobs):
                break
            assert time.monotonic() < deadline, jobs
            time.sleep(0.03)
        assert len(jobs) == 2
        assert phone.get(base + "/jobs").status_code == 200
        assert phone.get("/device", headers=auth).status_code == 401


def test_actual_unregistered_socket_is_denied_even_with_loopback_host(tmp_path: Path) -> None:
    with socket.socket() as reservation:
        reservation.bind(("127.0.0.1", 0))
        unknown_port = reservation.getsockname()[1]
    with dual_server(tmp_path / "data", tmp_path / "unknown.log", local_ipv4(), unknown_port=unknown_port) as (local, _, _):
        with httpx.Client(base_url=f"http://127.0.0.1:{unknown_port}", trust_env=False, timeout=3) as unknown:
            for path in ["/connection", "/pairing/owner", "/projects", "/openapi.json"]:
                response = unknown.get(path, headers={"Host": str(local.base_url).removeprefix("http://").rstrip("/"), "Forwarded": "host=localhost;for=127.0.0.1"})
                assert response.status_code == 403
                assert response.json()["error"]["code"] == "listener_forbidden"


def test_direct_access_ignores_legacy_query_credentials_and_does_not_log_them(tmp_path: Path) -> None:
    secret, pin, log = "fe" * 32, "765432", tmp_path / "safe-log.log"
    with dual_server(tmp_path / "data", log, local_ipv4()) as (_, phone, _):
        assert phone.get("/projects", params={"token": secret, "code": pin}).status_code == 200
        ws = str(phone.base_url).replace("http://", "ws://").rstrip("/") + f"/projects/{uuid4()}/jobs/{uuid4()}/events?token={secret}&code={pin}"
        with pytest.raises(InvalidStatus):
            connect(ws, proxy=None, open_timeout=3)
    logged = log.read_text(encoding="utf-8")
    assert secret not in logged and pin not in logged
