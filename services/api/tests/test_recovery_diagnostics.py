"""An expired public observation keeps evidence and still fails its assertion."""
import json
from pathlib import Path
import time
import threading

import httpx
import pytest
from websockets.sync.client import connect

from recovery_peer import recovery_peer
from test_restart_recovery import owned_api, owned_observations, terminal


@pytest.mark.parametrize("corrupt_diagnostic,hold_notification",[(False,False),(True,False),(False,True)],
                         ids=["complete-packet","collector-io-failure","completion-before-notification"])
def test_expired_observation_retains_actual_http_cursor_io_and_phase(tmp_path: Path,monkeypatch,corrupt_diagnostic,hold_notification):
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
        options={"MUSIC_API_RECOVERY_CONFIRMATION_WINDOW_SECONDS":"300"}
        if hold_notification:
            options["MUSIC_API_FIXTURE_HOLD_COMPLETED_NOTIFICATION"]="1"
        with owned_api(data,url,receipt,registry.root,tmp_path,options) as reopened:
            deadline=time.monotonic()+5
            while reopened.get(route).json()["recovery_required"]:
                assert time.monotonic()<deadline
                time.sleep(.02)
            if corrupt_diagnostic:
                (tmp_path/"corrupt-diagnostic.jsonl").write_bytes(b"\xff")
            with pytest.raises(AssertionError,match="Recovery observation expired") as expired:
                terminal(reopened,route,0)
            assert job["id"] in str(expired.value) and "last HTTP" in str(expired.value)
            if corrupt_diagnostic:
                assert isinstance(expired.value.__cause__,UnicodeDecodeError)
                assert any("Diagnostic collection failed" in note for note in expired.value.__notes__)
            else:
                packet=json.loads((tmp_path/("timeout-"+job["id"]+".json")).read_bytes())
                assert packet["last_http"]["id"]==job["id"] and packet["last_http"]["status"]=="running"
                assert packet["durable_job"]["recovery_cursor"]["confirmed"] is True
                assert packet["durable_job"]["runtime_proof"]
                assert any("native-reads" in row["source"] and row["records"] for row in packet["io"])
            ready=owned_observations[reopened][2]
            release=ready.with_suffix(".release-notification")
            socket_url=str(reopened.base_url).rstrip("/").replace("http://","ws://")+route+"/events"
            with connect(socket_url,proxy=None,open_timeout=5,close_timeout=1) as socket:
                # A running seed distinguishes delivery from a terminal reconnect snapshot.
                initial=json.loads(socket.recv(timeout=10))
                assert initial["job"]["id"]==job["id"] and initial["job"]["status"]=="running"
                try:
                    peer.post("/fixture/control",json={"action":"complete"}).raise_for_status()
                    complete=terminal(reopened,route,10)
                    assert complete["status"]=="completed"
                    if hold_notification:
                        deadline=time.monotonic()+10
                        while not ready.with_suffix(".notification-held").exists():
                            assert time.monotonic()<deadline,"Completed notification did not reach its owned gate"
                            threading.Event().wait(.01)
                        held=[json.loads(line) for p in tmp_path.glob("*.import-phases.jsonl") for line in p.read_text().splitlines()]
                        held=[row for row in held if row["job_id"]==job["id"]]
                        assert any(row["phase"]=="after_commit" for row in held)
                        assert not any(row["phase"]=="notification" and row["status"]=="completed" for row in held)
                    release.write_text("Release owned completed notification\n",encoding="utf-8")
                    deadline=time.monotonic()+10
                    while True:
                        delivered=json.loads(socket.recv(timeout=max(.001,deadline-time.monotonic())))
                        assert delivered["job"]["id"]==job["id"]
                        if delivered["job"]["status"]=="completed":
                            break
                        assert time.monotonic()<deadline,delivered
                    assert delivered["job"]==complete
                finally:
                    release.write_text("Release owned completed notification\n",encoding="utf-8")
            # The fixture closes its notification log record before public WS delivery.
            phases=[json.loads(line) for p in tmp_path.glob("*.import-phases.jsonl") for line in p.read_text().splitlines()]
            owned=[row for row in phases if row["job_id"]==job["id"]]
            assert any(row["phase"]=="after_commit" for row in owned)
            notifications=[index for index,row in enumerate(owned) if row["phase"]=="notification" and row["status"]=="completed"]
            assert notifications,owned
            # Callback/file order remains precise when Windows clock ticks are equal.
            assert any(index<notifications[0] for index,row in enumerate(owned) if row["phase"]=="after_commit")
            assert peer.get("/fixture/state").json()["accepted"]==1
