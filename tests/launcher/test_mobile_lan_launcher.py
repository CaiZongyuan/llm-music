"""The public launcher owns, reuses and stops the two API listeners together."""

from contextlib import contextmanager
import json
from pathlib import Path
import socket
import subprocess
import sys

import psutil
import httpx

from test_dev_launcher import ROOT, SCRIPT, args, assert_no_listeners, request, stop, wait_status


def selected_ipv4():
    for name, entries in psutil.net_if_addrs().items():
        if name == "WLAN" and psutil.net_if_stats()[name].isup:
            return next(entry.address for entry in entries if entry.family == socket.AF_INET)
    for name, entries in psutil.net_if_addrs().items():
        if psutil.net_if_stats()[name].isup:
            for entry in entries:
                if entry.family == socket.AF_INET and not entry.address.startswith("127."):
                    return entry.address
    raise AssertionError("No active LAN IPv4 for actual launcher evidence")


def chosen_ports(address):
    reservations = [socket.socket() for _ in range(4)]
    try:
        for index, item in enumerate(reservations):
            item.bind((address if index == 3 else "127.0.0.1", 0))
        return [item.getsockname()[1] for item in reservations]
    finally:
        for item in reservations:
            item.close()


@contextmanager
def launch_lan(folder, chosen, address):
    folder.mkdir(parents=True, exist_ok=True)
    previous = set((folder / "launcher/sessions").glob("*/session.json"))
    with (folder / "output.log").open("w", encoding="utf-8") as log:
        process = subprocess.Popen([sys.executable, str(SCRIPT), *args(folder, chosen[:3]),
                                    "--api-lan-host", address, "--api-lan-port", str(chosen[3])], cwd=ROOT, stdout=log, stderr=log)
        path = None
        try:
            path, receipt = wait_status(folder, process, "ready", previous)
            yield process, path, receipt
        finally:
            if process.poll() is None:
                path = path or next((item for item in (folder / "launcher/sessions").glob("*/session.json") if item not in previous), None)
                if path:
                    stop(path)
                process.wait(timeout=20)


def test_lan_launcher_receipts_reuse_and_cleanup_cover_both_sockets(tmp_path: Path) -> None:
    address = selected_ipv4()
    chosen = chosen_ports(address)
    with launch_lan(tmp_path, chosen, address) as (original, original_path, first):
        api = next(item for item in first["services"] if item["identity"]["service"] == "api")
        assert api["identity"]["lan_host"] == address
        assert api["identity"]["lan_port"] == chosen[3]
        assert first["lan_url"] == f"http://{address}:{chosen[3]}"
        assert request(first["lan_url"] + "/connection")["server_id"] == request(f"http://127.0.0.1:{chosen[0]}/connection")["server_id"]
        with httpx.Client(base_url=first["url"], trust_env=False, timeout=3) as browser:
            csrf = browser.get("/api/pairing/owner", headers={"Origin": first["url"]}).json()["owner_csrf"]
            assert browser.post("/api/pairing/challenges", headers={"Origin": first["url"], "X-Owner-CSRF": csrf}).status_code == 201
        with httpx.Client(base_url=f"http://127.0.0.1:{chosen[0]}", trust_env=False, timeout=3) as api_browser:
            assert api_browser.delete("/pairing/challenges/current", headers={"Origin": str(api_browser.base_url).rstrip("/"), "X-Owner-CSRF": csrf}).status_code == 204
        owned = psutil.Process(api["process"]["pid"])
        listeners = {(item.laddr.ip, item.laddr.port) for item in owned.net_connections(kind="tcp") if item.status == psutil.CONN_LISTEN}
        assert ("127.0.0.1", chosen[0]) in listeners and (address, chosen[3]) in listeners
        with socket.socket() as reservation:
            reservation.bind((address, 0))
            changed_lan_port = reservation.getsockname()[1]
        different = subprocess.run([sys.executable, str(SCRIPT), *args(tmp_path, chosen[:3]),
                                    "--api-lan-host", address, "--api-lan-port", str(changed_lan_port)],
                                   cwd=ROOT, capture_output=True, text=True, timeout=45)
        assert different.returncode == 1 and "differently configured" in different.stderr
        assert original.poll() is None and request(first["lan_url"] + "/connection")["server_id"]
        with launch_lan(tmp_path, chosen, address) as (reuser, reuser_path, second):
            assert all(not item["owned"] for item in second["services"])
            assert next(item for item in second["services"] if item["identity"]["service"] == "api")["process"] == api["process"]
            stop(reuser_path)
            assert reuser.wait(timeout=20) == 0
        assert original.poll() is None
        assert request(first["lan_url"] + "/connection")["server_id"]
        stop(original_path)
        assert original.wait(timeout=20) == 0
    final = json.loads(original_path.read_text(encoding="utf-8"))
    assert final["status"] == "stopped" and final["forced_processes"] == []
    assert_no_listeners(chosen)


def test_foreign_lan_port_refuses_before_starting_api_and_preserves_its_owner(tmp_path: Path) -> None:
    from test_dev_launcher import stop_fixture
    import time
    address = selected_ipv4()
    chosen = chosen_ports(address)
    with (tmp_path / "foreign.log").open("w") as log:
        foreign = subprocess.Popen([sys.executable, "-m", "http.server", str(chosen[3]), "--bind", address],
                                   cwd=tmp_path, stdout=log, stderr=log)
        try:
            deadline = time.monotonic() + 15
            while not any(item.laddr.port == chosen[3] and item.status == psutil.CONN_LISTEN for item in psutil.net_connections(kind="tcp")):
                assert foreign.poll() is None, (tmp_path / "foreign.log").read_text()
                assert time.monotonic() < deadline, (tmp_path / "foreign.log").read_text()
                time.sleep(0.05)
            result = subprocess.run([sys.executable, str(SCRIPT), *args(tmp_path, chosen[:3]),
                                     "--api-lan-host", address, "--api-lan-port", str(chosen[3])],
                                    cwd=ROOT, capture_output=True, text=True, timeout=45)
            assert result.returncode == 1 and "unknown or differently configured" in result.stderr
            assert foreign.poll() is None
            assert_no_listeners(chosen[:3])
            assert len(list((tmp_path / "launcher/sessions").glob("*/api-owner.json"))) == 0
        finally:
            stop_fixture(foreign)
    assert_no_listeners(chosen)
