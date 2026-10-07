"""Fresh ownership evidence during saving supersedes an earlier terminal snapshot."""
from pathlib import Path
import threading

from fastapi.testclient import TestClient
import httpx

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
