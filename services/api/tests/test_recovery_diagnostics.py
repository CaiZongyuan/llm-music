"""An expired public observation keeps evidence and still fails its assertion."""
import json
from pathlib import Path
import time

import httpx
import pytest

from recovery_peer import recovery_peer
from test_restart_recovery import owned_api, terminal


def test_expired_observation_retains_actual_http_cursor_io_and_phase(tmp_path: Path,monkeypatch):
    with recovery_peer(tmp_path,monkeypatch) as (url,receipt,registry),httpx.Client(base_url=url,trust_env=False) as peer:
        data=tmp_path/"application"
        with owned_api(data,url,receipt,registry.root,tmp_path) as first:
            project=first.post("/projects",json={"name":"Observation evidence"}).json()
            route="/projects/"+project["id"]
            job=first.post(route+"/jobs/generate",json={"style":"gentle folk pop","lyrics":"Morning gathers","seed":2026279001}).json()
            route+="/jobs/"+job["id"]
            deadline=time.monotonic()+5
            while first.get(route).json()["status"]!="running":
                assert time.monotonic()<deadline
                time.sleep(.02)
        with owned_api(data,url,receipt,registry.root,tmp_path,{"MUSIC_API_RECOVERY_CONFIRMATION_WINDOW_SECONDS":"300"}) as reopened:
            deadline=time.monotonic()+5
            while reopened.get(route).json()["recovery_required"]:
                assert time.monotonic()<deadline
                time.sleep(.02)
            with pytest.raises(AssertionError,match="Recovery observation expired"):
                terminal(reopened,route,0)
            packet=json.loads((tmp_path/("timeout-"+job["id"]+".json")).read_bytes())
            assert packet["last_http"]["id"]==job["id"] and packet["last_http"]["status"]=="running"
            assert packet["durable_job"]["recovery_cursor"]["confirmed"] is True
            assert packet["durable_job"]["runtime_proof"]
            assert any("native-reads" in row["source"] and row["records"] for row in packet["io"])
            peer.post("/fixture/control",json={"action":"complete"}).raise_for_status()
            assert terminal(reopened,route,10)["status"]=="completed"
            phases=[json.loads(line) for p in tmp_path.glob("*.import-phases.jsonl") for line in p.read_text().splitlines()]
            owned=[row for row in phases if row["job_id"]==job["id"]]
            assert any(row["phase"]=="after_commit" for row in owned)
            notification=next(row for row in owned if row["phase"]=="notification" and row["status"]=="completed")
            assert any(row["phase"]=="after_commit" and row["clock"]<=notification["clock"] for row in owned)
            assert peer.get("/fixture/state").json()["accepted"]==1
