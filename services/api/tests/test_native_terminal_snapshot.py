"""Fresh ownership evidence during saving supersedes an earlier terminal snapshot."""
from pathlib import Path
import threading

from fastapi.testclient import TestClient
import httpx
import pytest

from music_api.comfy_runtime import ComfyUIRuntime
from music_api.config import Settings
from music_api.main import create_app
from recovery_peer import recovery_peer
from test_cancel_retry import wait_running
from test_transcription import reference_audio,terminal


def test_changed_history_ownership_during_saving_cannot_import_an_older_snapshot(tmp_path: Path,monkeypatch):
    entered,release = threading.Event(),threading.Event()

    class ResultGate(ComfyUIRuntime):
        def result(self,handle,operation):
            entered.set()
            assert release.wait(5),"Owned result provider gate must be released"
            return super().result(handle,operation)

    try:
        with recovery_peer(tmp_path,monkeypatch) as (url,receipt,registry),httpx.Client(base_url=url,trust_env=False) as peer:
            settings = Settings(data_dir=tmp_path/"application",runtime_mode="comfyui",runtime_url=url,runtime_evidence_path=receipt)
            with TestClient(create_app(settings,runtime=ResultGate(settings,registry),registry=registry)) as client:
                project = client.post("/projects",json={"name":"Original terminal observation"}).json()
                base = "/projects/"+project["id"]
                original = reference_audio()
                reference = client.post(base+"/assets",files={"file":("reference.wav",original)}).json()
                submitted = client.post(base+"/transcriptions",json={"reference_asset_id":reference["id"]}).json()
                route = base+"/jobs/"+submitted["id"]
                wait_running(client,route)
                peer.post("/fixture/control",json={"action":"complete"}).raise_for_status()
                assert entered.wait(5),"Validated terminal observation must reach result consumption"
                assert client.get(route).json()["phase"] == "saving"
                peer.post("/fixture/edit",json={"action":"wrong_graph"}).raise_for_status()
                changed = client.post(route+"/cancel")
                assert changed.status_code == 503 and changed.json()["error"]["code"] == "runtime_unavailable"
                release.set()
                failed = terminal(client,route)
                assert failed["status"] == "failed" and failed["result"] is None,failed
                assert client.get(base+"/assets").json() == [reference]
                assert client.get(base+"/assets/"+reference["id"]+"/content").content == original
                assert peer.get("/fixture/state").json()["accepted"] == 1
    finally:
        release.set()


@pytest.mark.parametrize("changed",[False,True],ids=["owned-inflight-control","newer-ownership-rejection"])
def test_newer_ownership_evidence_invalidates_an_older_inflight_terminal_read(tmp_path: Path,monkeypatch,changed):
    entered,release = threading.Event(),threading.Event()

    class InflightGate(ComfyUIRuntime):
        armed = True

        def _read(self,path,deadline=None):
            value = super()._read(path,deadline)
            successful = path.startswith("/history/") and isinstance(value,dict) and any(
                isinstance(item,dict) and isinstance(item.get("status"),dict)
                and item["status"].get("status_str") == "success" and item["status"].get("completed") is True
                for item in value.values())
            if self.armed and threading.current_thread().name == "application-jobs" and successful:
                self.armed = False
                entered.set()
                assert release.wait(5),"Owned older transport response must be released"
            return value

    try:
        with recovery_peer(tmp_path,monkeypatch) as (url,receipt,registry),httpx.Client(base_url=url,trust_env=False) as peer:
            settings = Settings(data_dir=tmp_path/"application",runtime_mode="comfyui",runtime_url=url,runtime_evidence_path=receipt)
            with TestClient(create_app(settings,runtime=InflightGate(settings,registry),registry=registry)) as client:
                project = client.post("/projects",json={"name":"In-flight terminal ownership"}).json()
                base = "/projects/"+project["id"]
                original = reference_audio()
                reference = client.post(base+"/assets",files={"file":("reference.wav",original)}).json()
                submitted = client.post(base+"/transcriptions",json={"reference_asset_id":reference["id"]}).json()
                route = base+"/jobs/"+submitted["id"]
                wait_running(client,route)
                peer.post("/fixture/control",json={"action":"complete"}).raise_for_status()
                assert entered.wait(5),"Older completed response must precede later ownership evidence"
                if changed:
                    peer.post("/fixture/edit",json={"action":"wrong_graph"}).raise_for_status()
                    rejected = client.post(route+"/cancel")
                    assert rejected.status_code == 503 and rejected.json()["error"]["code"] == "runtime_unavailable"
                release.set()
                value = terminal(client,route)
                assert value["status"] == ("failed" if changed else "completed"),value
                assert len(client.get(base+"/assets").json()) == (1 if changed else 3)
                if changed:
                    assert value["result"] is None and value["error"]["code"] == "runtime_unavailable"
                assert client.get(base+"/assets/"+reference["id"]+"/content").content == original
                assert peer.get("/fixture/state").json()["accepted"] == 1
    finally:
        release.set()
