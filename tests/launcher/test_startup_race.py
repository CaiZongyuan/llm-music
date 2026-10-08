"""Pin real owned-child exit at the launcher's process-observation boundaries."""

import argparse
import json
from pathlib import Path
import subprocess
import sys

import psutil
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from dev import Launcher
from test_dev_launcher import assert_no_listeners, ports


@pytest.mark.parametrize("exit_boundary", ["identity", "descendants"])
def test_fast_api_exit_keeps_service_failure_diagnostic(tmp_path, monkeypatch, capsys, exit_boundary):
    chosen = ports()
    application = tmp_path / "application"
    application.write_text("a file cannot be application storage")
    launcher = Launcher(argparse.Namespace(mode="fake", state_dir=tmp_path / "launcher", data_dir=application,
        api_port=chosen[0], web_port=chosen[1], runtime_port=chosen[2], runtime_url=f"http://127.0.0.1:{chosen[2]}",
        runtime_evidence=None, timeout=15, open=False))
    spawned = []
    popen = subprocess.Popen

    def spawn(*args, **kwargs):
        child = popen(*args, **kwargs)
        spawned.append(child)
        if exit_boundary == "identity":
            child.wait(timeout=10)
        return child

    monkeypatch.setattr(subprocess, "Popen", spawn)
    children = psutil.Process.children
    observed = []

    def descendants(process, *args, **kwargs):
        if exit_boundary == "descendants" and not observed and any(child.pid == process.pid for child in spawned):
            observed.append(process.pid)
            spawned[0].wait(timeout=10)
        return children(process, *args, **kwargs)

    monkeypatch.setattr(psutil.Process, "children", descendants)
    assert launcher.run() == 1
    assert "api startup failed" in capsys.readouterr().err
    assert spawned and all(child.poll() is not None for child in spawned)
    if exit_boundary == "descendants":
        assert observed == [spawned[0].pid]
    receipt = json.loads((launcher.folder / "session.json").read_text())
    assert receipt["status"] == "failed" and receipt["forced_processes"] == []
    assert "Traceback" in (launcher.folder / "api.log").read_text(encoding="utf-8")
    assert_no_listeners(chosen)


def test_live_child_observation_error_keeps_identity_refusal(tmp_path, monkeypatch, capsys):
    chosen = ports()
    launcher = Launcher(argparse.Namespace(mode="fake", state_dir=tmp_path / "launcher", data_dir=tmp_path / "application",
        api_port=chosen[0], web_port=chosen[1], runtime_port=chosen[2], runtime_url=f"http://127.0.0.1:{chosen[2]}",
        runtime_evidence=None, timeout=15, open=False))
    children = psutil.Process.children
    observed = []

    def unavailable(process, *args, **kwargs):
        if not observed and any(owned["popen"].pid == process.pid for owned in launcher.owned):
            assert launcher.owned[0]["popen"].poll() is None
            observed.append(process.pid)
            raise psutil.NoSuchProcess(process.pid)
        return children(process, *args, **kwargs)

    monkeypatch.setattr(psutil.Process, "children", unavailable)
    assert launcher.run() == 1
    error = capsys.readouterr().err
    assert observed
    assert f"Launch refused: {psutil.NoSuchProcess(observed[0])}" in error
    assert "api startup failed" not in error
    assert all(owned["popen"].poll() is not None for owned in launcher.owned)
    receipt = json.loads((launcher.folder / "session.json").read_text())
    assert receipt["status"] == "failed" and receipt["forced_processes"] == []
    assert_no_listeners(chosen)
