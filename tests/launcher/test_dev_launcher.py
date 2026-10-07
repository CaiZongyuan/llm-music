"""Exercise the actual public CLI, HTTP services, receipts and cleanup on CPU."""

from contextlib import contextmanager
import json
from pathlib import Path
import socket
import subprocess
import sys
import time
from urllib.error import URLError
from urllib.request import Request, urlopen

import psutil


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts/dev.py"


def ports():
    sockets = [socket.socket() for _ in range(3)]
    try:
        for item in sockets:
            item.bind(("127.0.0.1", 0))
        return [item.getsockname()[1] for item in sockets]
    finally:
        for item in sockets:
            item.close()


def args(folder, chosen):
    return ["--api-port", str(chosen[0]), "--web-port", str(chosen[1]), "--runtime-port", str(chosen[2]),
            "--data-dir", str(folder / "application"), "--state-dir", str(folder / "launcher"), "--timeout", "40"]


def request(url, data=None):
    with urlopen(Request(url, data=None if data is None else json.dumps(data).encode(),
                         headers={"Content-Type": "application/json"}), timeout=3) as response:
        return json.load(response)


def receipt(folder):
    candidates = list((folder / "launcher/sessions").glob("*/session.json"))
    return max(candidates, key=lambda item: item.stat().st_mtime) if candidates else None


def wait_status(folder, process, wanted, previous):
    deadline = time.monotonic() + 50
    while time.monotonic() < deadline:
        path = receipt(folder)
        if path and path not in previous:
            value = json.loads(path.read_text(encoding="utf-8"))
            if value["status"] == wanted:
                return path, value
        if process.poll() is not None:
            raise AssertionError((folder / "output.log").read_text(encoding="utf-8"))
        time.sleep(0.1)
    raise AssertionError("Public launcher status did not arrive within the test budget")


def stop(path):
    result = subprocess.run([sys.executable, str(SCRIPT), "--stop-session", str(path)], cwd=ROOT,
                            capture_output=True, text=True, timeout=10)
    assert result.returncode == 0, result.stderr


@contextmanager
def launch(folder, chosen):
    folder.mkdir(parents=True, exist_ok=True)
    previous = set((folder / "launcher/sessions").glob("*/session.json"))
    with (folder / "output.log").open("w", encoding="utf-8") as log:
        process = subprocess.Popen([sys.executable, str(SCRIPT), *args(folder, chosen)], cwd=ROOT, stdout=log, stderr=log)
        path = None
        try:
            path, value = wait_status(folder, process, "ready", previous)
            yield process, path, value
        finally:
            if process.poll() is None:
                path = path or next((item for item in (folder / "launcher/sessions").glob("*/session.json") if item not in previous), None)
                if path:
                    stop(path)
                process.wait(timeout=20)


def assert_no_listeners(chosen):
    deadline = time.monotonic() + 3
    while time.monotonic() < deadline:
        occupied = {item.laddr.port for item in psutil.net_connections(kind="tcp") if item.status == psutil.CONN_LISTEN}
        if not occupied.intersection(chosen):
            return
        time.sleep(0.1)
    assert not occupied.intersection(chosen)


def stop_fixture(process):
    parent = psutil.Process(process.pid)
    owned = [(child, child.create_time()) for child in [parent, *parent.children(recursive=True)]]
    for child, created in reversed(owned):
        if child.is_running() and child.create_time() == created:
            child.terminate()
    psutil.wait_procs([item[0] for item in owned], timeout=3)
    process.wait(timeout=5)


def test_clean_start_project_identity_and_graceful_stop(tmp_path):
    chosen = ports()
    with launch(tmp_path, chosen) as (process, path, value):
        assert value["mode"] == "fake"
        assert value["url"] == f"http://127.0.0.1:{chosen[1]}"
        assert {item["identity"]["service"] for item in value["services"]} == {"api", "web"}
        assert all(item["owned"] for item in value["services"])
        health = request(value["url"] + "/api/health")
        assert health["backend"]["status"] == "ready"
        assert health["runtime"]["mode"] == "fake"
        project = request(value["url"] + "/api/projects", {"name": "Launcher project"})
        assert request(value["url"] + "/api/projects/" + project["id"])["id"] == project["id"]
        stop(path)
        assert process.wait(timeout=20) == 0
    final = json.loads(path.read_text(encoding="utf-8"))
    assert final["status"] == "stopped" and final["forced_processes"] == []
    assert json.loads((path.parent / "api-stopped.json").read_text())["graceful"]
    assert json.loads((path.parent / "web-stopped.json").read_text())["graceful"]
    assert_no_listeners(chosen)
    with launch(tmp_path, chosen) as (_, _, value):
        assert request(value["url"] + "/api/projects/" + project["id"])["id"] == project["id"]


def test_matching_reuse_stop_leaves_original_services_alive(tmp_path):
    chosen = ports()
    with launch(tmp_path, chosen) as (original, original_path, first):
        first_pids = {item["process"]["pid"] for item in first["services"]}
        with launch(tmp_path, chosen) as (reuser, reuser_path, second):
            assert original_path != reuser_path
            assert {item["process"]["pid"] for item in second["services"]} == first_pids
            assert all(not item["owned"] for item in second["services"])
            stop(reuser_path)
            assert reuser.wait(timeout=20) == 0
        assert original.poll() is None
        assert request(first["url"] + "/api/health")["backend"]["status"] == "ready"


def test_same_port_different_configuration_refuses_and_preserves_owner(tmp_path):
    chosen = ports()
    with launch(tmp_path, chosen) as (original, _, value):
        changed = args(tmp_path, chosen)
        changed[changed.index("--data-dir") + 1] = str(tmp_path / "other-application")
        result = subprocess.run([sys.executable, str(SCRIPT), *changed], cwd=ROOT, capture_output=True, text=True, timeout=45)
        assert result.returncode == 1
        assert "differently configured" in result.stderr
        assert original.poll() is None
        assert request(value["url"] + "/api/health")["runtime"]["mode"] == "fake"


def test_foreign_port_refuses_without_mutating_foreign_service(tmp_path):
    chosen = ports()
    foreign = subprocess.Popen([sys.executable, "-m", "http.server", str(chosen[0]), "--bind", "127.0.0.1"], cwd=tmp_path,
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            try:
                with urlopen(f"http://127.0.0.1:{chosen[0]}", timeout=1):
                    break
            except (URLError, OSError):
                time.sleep(0.1)
        result = subprocess.run([sys.executable, str(SCRIPT), *args(tmp_path, chosen)], cwd=ROOT, capture_output=True, text=True, timeout=45)
        assert result.returncode == 1 and "unknown" in result.stderr
        assert foreign.poll() is None
    finally:
        stop_fixture(foreign)
    assert_no_listeners(chosen)


def test_child_startup_failure_reports_log_and_cleans_owned_processes(tmp_path):
    chosen = ports()
    (tmp_path / "application").write_text("a file cannot be application storage")
    result = subprocess.run([sys.executable, str(SCRIPT), *args(tmp_path, chosen)], cwd=ROOT, capture_output=True, text=True, timeout=55)
    assert result.returncode == 1 and "api startup failed" in result.stderr
    path = receipt(tmp_path)
    assert json.loads(path.read_text())["status"] == "failed"
    assert "Traceback" in (path.parent / "api.log").read_text(encoding="utf-8")
    assert_no_listeners(chosen)


def test_unprepared_native_environment_refuses_before_starting_children(tmp_path):
    chosen = ports()
    result = subprocess.run([sys.executable, str(SCRIPT), *args(tmp_path, chosen), "--mode", "comfyui", "--runtime-project", str(tmp_path / "unprepared")],
                            cwd=ROOT, capture_output=True, text=True, timeout=10)
    assert result.returncode == 1 and "Environment not prepared" in result.stderr
    assert "uv sync" in result.stderr
    assert receipt(tmp_path) is None
    assert_no_listeners(chosen)


def test_invalid_native_owner_model_receipt_refuses_foreign_listener(tmp_path):
    chosen = ports()
    evidence = tmp_path / "invalid-native.json"
    evidence.write_text(json.dumps({"ready": True, "models": [{"state": "ready"}]}))
    foreign = subprocess.Popen([sys.executable, "-m", "http.server", str(chosen[2]), "--bind", "127.0.0.1"], cwd=tmp_path,
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        time.sleep(0.5)
        result = subprocess.run([sys.executable, str(SCRIPT), *args(tmp_path, chosen), "--mode", "comfyui", "--runtime-evidence", str(evidence)],
                                cwd=ROOT, capture_output=True, text=True, timeout=45)
        assert result.returncode == 1
        assert "runtime_evidence_invalid" in result.stderr
        assert foreign.poll() is None
    finally:
        stop_fixture(foreign)
    assert_no_listeners(chosen)
