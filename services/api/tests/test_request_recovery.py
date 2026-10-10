"""Exact durable request recovery through actual HTTP, not input guessing."""

from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
import os
from pathlib import Path
import socket
import subprocess
import sys
from uuid import uuid4
import time

import httpx
import pytest
import recovery_peer as recovery_provider
from recovery_peer import recovery_peer
from test_restart_recovery import owned_api, terminal

from test_mobile_lan_socket import dual_server, local_ipv4


@pytest.fixture(autouse=True)
def record_cpu_submissions(monkeypatch):
    # A separate CPU provider records accepted Fake Runtime attempts. Fault
    # tests avoid irrelevant native owner/model/Git preflight and still observe
    # actual worker dispatch through the provider's public HTTP interface.
    monkeypatch.setattr(recovery_provider, "EDIT", recovery_provider.EDIT + '''
@app.post("/fixture/record")
async def record_attempt(request: Request):
    value = await request.json()
    native[value["handle"]] = {"graph": {}, "client": value["attempt_id"], "complete": False}
    return {"accepted": len(native)}
''')


@contextmanager
def fault_server(data: Path, url: str, receipt: Path, registry: Path, controls: Path, log_path: Path):
    controls.mkdir(exist_ok=True)
    with socket.socket() as reservation:
        reservation.bind(("127.0.0.1", 0))
        port = reservation.getsockname()[1]
    with log_path.open("wb") as log:
        process = subprocess.Popen([sys.executable, str(Path(__file__).with_name("run_request_faults.py")),
                                    str(data), url, str(receipt), str(registry), str(port), str(controls)],
                                   stdin=subprocess.PIPE, stdout=log, stderr=log,
                                   env={**os.environ, "MUSIC_API_RUNTIME_MODE": "fake"},
                                   creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        try:
            with httpx.Client(base_url=f"http://127.0.0.1:{port}", trust_env=False, timeout=30) as client:
                deadline = time.monotonic() + 15
                while True:
                    assert process.poll() is None, log_path.read_text(encoding="utf-8", errors="replace")
                    try:
                        if client.get("/projects").status_code == 200:
                            break
                    except httpx.TransportError:
                        pass
                    assert time.monotonic() < deadline
                    time.sleep(0.02)
                yield client, process
        finally:
            if process.poll() is None:
                assert process.stdin is not None
                process.stdin.write(b"\n")
                process.stdin.flush()
                process.stdin.close()
                try:
                    process.wait(timeout=12)
                except subprocess.TimeoutExpired:
                    process.terminate()
                    process.wait(timeout=5)
                    raise AssertionError("Owned request fixture failed graceful shutdown")


def test_concurrent_keyed_project_creates_one_resource_and_exact_receipt(tmp_path: Path) -> None:
    with dual_server(tmp_path / "data", tmp_path / "project.log", local_ipv4()) as (client, _, _):
        key = str(uuid4())
        headers = {"Idempotency-Key": key}
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: client.post("/projects", json={"name": "  请求恢复项目  "}, headers=headers), range(2)))
        assert sorted(response.status_code for response in results) == [200, 201]
        assert results[0].json() == results[1].json()
        project = results[0].json()
        assert project["name"] == "请求恢复项目"
        assert client.get("/projects").json() == [project]
        receipt = client.get("/requests/" + key)
        assert receipt.status_code == 200
        value = receipt.json()
        assert {name: value[name] for name in ["request_id", "operation", "project_id", "resource_type", "resource_id", "source_job_id"]} == {
            "request_id": key, "operation": "create_project", "project_id": project["id"],
            "resource_type": "project", "resource_id": project["id"], "source_job_id": None,
        }
        assert client.post("/projects", json={"description": "", "name": "请求恢复项目"}, headers=headers).json() == project
        assert client.post("/projects", json={"name": "改变意图"}, headers=headers).status_code == 409
        assert client.get("/requests/" + str(uuid4())).status_code == 404


def test_concurrent_generate_replay_bypasses_unready_runtime_and_conflicting_target(tmp_path: Path, monkeypatch) -> None:
    with recovery_peer(tmp_path, monkeypatch) as (url, receipt, registry), httpx.Client(base_url=url, trust_env=False) as peer:
        with owned_api(tmp_path / "data", url, receipt, registry.root, tmp_path) as client:
            project = client.post("/projects", json={"name": "精确生成"}).json()
            route = "/projects/" + project["id"] + "/jobs/generate"
            key = str(uuid4())
            inputs = {"style": "中文 folk", "lyrics": "[verse]\n第一行\n第二行", "seed": 42, "max_seconds": 0}
            headers = {"Idempotency-Key": key}
            with ThreadPoolExecutor(max_workers=2) as pool:
                responses = list(pool.map(lambda _: client.post(route, json=inputs, headers=headers), range(2)))
            assert sorted(value.status_code for value in responses) == [200, 202]
            identifier = responses[0].json()["id"]
            assert responses[1].json()["id"] == identifier
            deadline = time.monotonic() + 5
            while peer.get("/fixture/state").json()["accepted"] != 1:
                assert time.monotonic() < deadline
                time.sleep(0.02)
            peer.post("/fixture/control", json={"action": "complete"}).raise_for_status()
            done = terminal(client, "/projects/" + project["id"] + "/jobs/" + identifier)
            assert done["status"] == "completed"
            receipt.write_text("{}", encoding="utf-8")  # External evidence became unavailable after acceptance.
            assert client.get("/health").json()["runtime"]["ready"] is False
            replay = client.post(route, json=inputs, headers=headers)
            assert replay.status_code == 200 and replay.json() == done
            recovered = client.get("/requests/" + key).json()
            assert recovered["resource_id"] == identifier and recovered["operation"] == "generate"
            assert client.post(route, json=inputs, headers={"Idempotency-Key": str(uuid4())}).status_code == 503
            foreign = client.post("/projects/" + str(uuid4()) + "/jobs/generate", json=inputs, headers=headers)
            assert foreign.status_code == 409
            assert foreign.json()["error"]["code"] == "idempotency_conflict"
            assert len(client.get("/projects/" + project["id"] + "/jobs").json()) == 1
            assert peer.get("/fixture/state").json()["accepted"] == 1


def test_commit_faults_never_separate_project_resource_from_receipt(tmp_path: Path, monkeypatch) -> None:
    with recovery_peer(tmp_path, monkeypatch) as (url, receipt, registry):
        with fault_server(tmp_path / "data", url, receipt, registry.root, tmp_path / "controls", tmp_path / "atomic.log") as (client, _):
            for fault, wanted_count in [("before", 0), ("after", 1)]:
                key = str(uuid4())
                body = {"name": "原子项目 " + fault}
                response = client.post("/projects", json=body, headers={"Idempotency-Key": key, "X-Fixture-Fault": fault})
                assert response.status_code == 503
                assert response.json()["error"]["code"] == "request_commit_unconfirmed"
                assert response.json()["error"]["resource_id"] == key
                projects = client.get("/projects").json()
                assert len(projects) == wanted_count
                found = client.get("/requests/" + key)
                assert found.status_code == (404 if fault == "before" else 200)
                if fault == "after":
                    assert found.json()["resource_id"] == projects[0]["id"]
                    replay = client.post("/projects", json=body, headers={"Idempotency-Key": key})
                    assert replay.status_code == 200 and replay.json() == projects[0]


def test_inflight_404_and_explicit_same_key_replay_converge_after_atomic_commit(tmp_path: Path, monkeypatch) -> None:
    controls = tmp_path / "controls"
    with recovery_peer(tmp_path, monkeypatch) as (url, receipt, registry):
        with fault_server(tmp_path / "data", url, receipt, registry.root, controls, tmp_path / "inflight.log") as (client, _):
            key, body = str(uuid4()), {"name": "仍在途的项目"}
            with ThreadPoolExecutor(max_workers=2) as pool:
                first = pool.submit(client.post, "/projects", json=body, headers={"Idempotency-Key": key, "X-Fixture-Fault": "hold"})
                deadline = time.monotonic() + 5
                while not (controls / "held").exists():
                    assert time.monotonic() < deadline
                    time.sleep(0.02)
                assert client.get("/requests/" + key).status_code == 404
                assert client.get("/projects").json() == []
                again = pool.submit(client.post, "/projects", json=body, headers={"Idempotency-Key": key})
                (controls / "release").write_text("Release owned commit", encoding="utf-8")
                responses = [first.result(timeout=10), again.result(timeout=10)]
            assert sorted(value.status_code for value in responses) == [200, 201]
            assert responses[0].json() == responses[1].json()
            assert len(client.get("/projects").json()) == 1
            assert client.get("/requests/" + key).json()["resource_id"] == responses[0].json()["id"]


def test_lost_job_commit_ack_hands_off_only_the_initial_committed_job(tmp_path: Path, monkeypatch) -> None:
    with recovery_peer(tmp_path, monkeypatch) as (url, receipt, registry), httpx.Client(base_url=url, trust_env=False) as peer:
        with fault_server(tmp_path / "data", url, receipt, registry.root, tmp_path / "controls", tmp_path / "job-ack.log") as (client, _):
            project = client.post("/projects", json={"name": "原任务仍继续"}).json()
            base = "/projects/" + project["id"]
            key = str(uuid4())
            body = {"style": "folk", "lyrics": "[verse]\n原始冻结输入", "seed": 7, "max_seconds": 0}
            rejected_key = str(uuid4())
            before = client.post(base + "/jobs/generate", json=body, headers={"Idempotency-Key": rejected_key, "X-Fixture-Fault": "before"})
            assert before.status_code == 503
            assert client.get(base + "/jobs").json() == [] and client.get("/requests/" + rejected_key).status_code == 404
            assert peer.get("/fixture/state").json()["accepted"] == 0
            unknown = client.post(base + "/jobs/generate", json=body, headers={"Idempotency-Key": key, "X-Fixture-Fault": "after"})
            assert unknown.status_code == 503 and unknown.json()["error"]["resource_id"] == key
            record = client.get("/requests/" + key).json()
            identifier = record["resource_id"]
            assert record["resource_type"] == "job"
            replay = client.post(base + "/jobs/generate", json=body, headers={"Idempotency-Key": key})
            assert replay.status_code == 200 and replay.json()["id"] == identifier
            deadline = time.monotonic() + 5
            while peer.get("/fixture/state").json()["accepted"] != 1:
                assert time.monotonic() < deadline
                time.sleep(0.02)
            peer.post("/fixture/control", json={"action": "complete"}).raise_for_status()
            assert terminal(client, base + "/jobs/" + identifier)["status"] == "completed"
            assert len(client.get(base + "/jobs").json()) == 1
            assert len(client.get(base + "/candidates").json()) == 1
            assert peer.get("/fixture/state").json()["accepted"] == 1


def test_lan_keys_and_rotated_credentials_recover_the_same_server_resource(tmp_path: Path) -> None:
    with dual_server(tmp_path / "data", tmp_path / "device.log", local_ipv4()) as (local, phone, _):
        owner = local.get("/pairing/owner").json()
        csrf = {"X-Owner-CSRF": owner["owner_csrf"]}

        def pair(token: str) -> str:
            window = local.post("/pairing/challenges", headers=csrf).json()
            device = str(uuid4())
            response = phone.post("/pairing/claim", json={"device_id": device, "device_token": token,
                                                        "device_name": "恢复设备", "code": window["code"]})
            assert response.status_code == 201
            phone.headers["Authorization"] = "Bearer " + token
            return device

        first_device = pair("ab" * 32)
        key, body = str(uuid4()), {"name": "保留原始 key"}
        assert phone.post("/projects", json=body).json()["error"]["code"] == "idempotency_key_required"
        assert phone.post("/projects", json=body, headers={"Idempotency-Key": "not-a-uuid"}).status_code == 422
        project = phone.post("/projects", json=body, headers={"Idempotency-Key": key})
        assert project.status_code == 201
        identifier = project.json()["id"]
        source = phone.get("/requests/" + key)
        assert source.status_code == 200
        route = "/projects/" + identifier + "/jobs/generate"
        inputs = {"style": "folk", "lyrics": "原来的歌词", "seed": 42}
        assert phone.post(route, json=inputs).status_code == 422
        assert phone.post("/projects/" + identifier + "/jobs/" + str(uuid4()) + "/retry").status_code == 422
        assert local.delete("/pairing/devices/" + first_device, headers=csrf).status_code == 200
        assert phone.get("/requests/" + key).json() == source.json()
        second_device = pair("cd" * 32)
        assert second_device != first_device
        assert phone.get("/requests/" + key).json() == source.json()
        replay = phone.post("/projects", json=body, headers={"Idempotency-Key": key})
        assert replay.status_code == 200 and replay.json() == project.json()
        assert local.post("/projects", json={"name": "旧本地调用无需 key"}).status_code == 201
        assert len(local.get("/projects").json()) == 2


def test_retry_key_returns_original_successor_without_new_native_validation(tmp_path: Path, monkeypatch) -> None:
    with recovery_peer(tmp_path, monkeypatch) as (url, receipt, registry), httpx.Client(base_url=url, trust_env=False) as peer:
        with owned_api(tmp_path / "data", url, receipt, registry.root, tmp_path) as client:
            project = client.post("/projects", json={"name": "明确重试"}).json()
            base = "/projects/" + project["id"]
            inputs = {"style": "folk", "lyrics": "[verse]\n原始输入", "seed": 12, "max_seconds": 0}
            original = client.post(base + "/jobs/generate", json=inputs, headers={"Idempotency-Key": str(uuid4())}).json()
            deadline = time.monotonic() + 5
            while peer.get("/fixture/state").json()["accepted"] != 1:
                assert time.monotonic() < deadline
                time.sleep(0.02)
            retry_key = str(uuid4())
            route = base + "/jobs/" + original["id"] + "/retry"
            assert client.post(route, headers={"Idempotency-Key": retry_key}).status_code == 409
            assert client.get("/requests/" + retry_key).status_code == 404
            peer.post("/fixture/edit", json={"action": "failed"}).raise_for_status()
            failed = terminal(client, base + "/jobs/" + original["id"])
            assert failed["status"] == "failed"
            with ThreadPoolExecutor(max_workers=2) as pool:
                replies = list(pool.map(lambda _: client.post(route, headers={"Idempotency-Key": retry_key}), range(2)))
            assert sorted(value.status_code for value in replies) == [200, 202]
            successor = replies[0].json()
            assert replies[1].json()["id"] == successor["id"] != original["id"]
            assert successor["inputs"] == original["inputs"]
            assert successor["provenance"]["retry_of_job_id"] == original["id"]
            deadline = time.monotonic() + 5
            while peer.get("/fixture/state").json()["accepted"] != 2:
                assert time.monotonic() < deadline
                time.sleep(0.02)
            receipt.write_text("{}", encoding="utf-8")
            peer.post("/fixture/edit", json={"action": "unavailable"}).raise_for_status()
            assert client.post(route, headers={"Idempotency-Key": retry_key}).status_code == 200
            reference = client.get("/requests/" + retry_key).json()
            assert reference["operation"] == "retry" and reference["resource_id"] == successor["id"]
            assert reference["source_job_id"] == original["id"]
            assert client.post(route, headers={"Idempotency-Key": str(uuid4())}).status_code == 409
            assert client.get(base + "/jobs/" + original["id"]).json() == failed
            assert len(client.get(base + "/jobs").json()) == 2
            assert peer.get("/fixture/state").json()["accepted"] == 2


def test_lost_commit_and_receipt_readback_do_not_leave_original_job_outside_worker(tmp_path: Path, monkeypatch) -> None:
    with recovery_peer(tmp_path, monkeypatch) as (url, receipt, registry), httpx.Client(base_url=url, trust_env=False) as peer:
        with fault_server(tmp_path / "data", url, receipt, registry.root, tmp_path / "controls", tmp_path / "lost-handoff.log") as (client, _):
            project = client.post("/projects", json={"name": "不能永久 queued"}).json()
            base = "/projects/" + project["id"]
            key = str(uuid4())
            inputs = {"style": "folk", "lyrics": "唯一原始提交", "seed": 42, "max_seconds": 0}
            lost = client.post(base + "/jobs/generate", json=inputs, headers={"Idempotency-Key": key, "X-Fixture-Fault": "after-readback"})
            assert lost.status_code == 503
            record = client.get("/requests/" + key).json()
            original = record["resource_id"]
            assert client.post(base + "/jobs/generate", json=inputs, headers={"Idempotency-Key": key}).json()["id"] == original
            following = client.post(base + "/jobs/generate", json={**inputs, "seed": 43}, headers={"Idempotency-Key": str(uuid4())}).json()
            deadline = time.monotonic() + 8
            while True:
                peer.post("/fixture/control", json={"action": "complete"}).raise_for_status()
                states = [client.get(base + "/jobs/" + identifier).json() for identifier in [original, following["id"]]]
                accepted = peer.get("/fixture/state").json()["accepted"]
                if all(job["status"] == "completed" for job in states):
                    break
                assert time.monotonic() < deadline, {"original": states[0], "following": states[1], "accepted": accepted}
                time.sleep(0.03)
            assert accepted == 2
            assert len(client.get(base + "/jobs").json()) == 2


def test_crash_after_commit_recovers_exact_reference_without_resubmitting_original(tmp_path: Path, monkeypatch) -> None:
    data, controls = tmp_path / "data", tmp_path / "controls"
    with recovery_peer(tmp_path, monkeypatch) as (url, receipt, registry), httpx.Client(base_url=url, trust_env=False) as peer:
        with fault_server(data, url, receipt, registry.root, controls, tmp_path / "crashed.log") as (first, process):
            project = first.post("/projects", json={"name": "重启精确恢复"}).json()
            base = "/projects/" + project["id"]
            key = str(uuid4())
            inputs = {"style": "folk", "lyrics": "相同输入仍有不同意图", "seed": 42, "max_seconds": 0}
            with pytest.raises(httpx.TransportError):
                first.post(base + "/jobs/generate", json=inputs, headers={"Idempotency-Key": key, "X-Fixture-Fault": "crash"})
            assert process.wait(timeout=10) == 77
            assert (controls / "committed").exists()
            assert peer.get("/fixture/state").json()["accepted"] == 0
        with fault_server(data, url, receipt, registry.root, controls, tmp_path / "restarted.log") as (restarted, _):
            recovered = restarted.get("/requests/" + key)
            assert recovered.status_code == 200
            original = recovered.json()["resource_id"]
            assert recovered.json()["operation"] == "generate"
            failed = terminal(restarted, base + "/jobs/" + original)
            assert failed["status"] == "failed" and failed["error"]["code"] == "runtime_unavailable"
            repeated = restarted.post(base + "/jobs/generate", json=inputs, headers={"Idempotency-Key": key})
            assert repeated.status_code == 200 and repeated.json() == failed
            assert peer.get("/fixture/state").json()["accepted"] == 0
            distinct_key = str(uuid4())
            another = restarted.post(base + "/jobs/generate", json=inputs, headers={"Idempotency-Key": distinct_key})
            assert another.status_code == 202 and another.json()["id"] != original
            deadline = time.monotonic() + 5
            while peer.get("/fixture/state").json()["accepted"] != 1:
                assert time.monotonic() < deadline
                time.sleep(0.02)
            peer.post("/fixture/control", json={"action": "complete"}).raise_for_status()
            assert terminal(restarted, base + "/jobs/" + another.json()["id"])["status"] == "completed"
            assert len(restarted.get(base + "/jobs").json()) == 2
            assert restarted.get("/requests/" + key).json() == recovered.json()
