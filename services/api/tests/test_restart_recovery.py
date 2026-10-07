"""Actual API process restart recovers original accepted work without new inference."""
from contextlib import contextmanager
import json
import hashlib
import os
from pathlib import Path
import subprocess
import sys
import time
from uuid import uuid4

import httpx
import pytest
from recovery_peer import recovery_peer

@contextmanager
def owned_api(data: Path, url: str, receipt: Path, registry: Path, log_root: Path, recovery_options=None, abrupt=False):
    ready = log_root / ("ready-" + uuid4().hex + ".json")
    with ready.with_suffix(".log").open("wb") as log:
        child = subprocess.Popen([sys.executable,str(Path(__file__).with_name("recovery_api_server.py")),str(data),url,str(receipt),str(registry),str(ready)],
                                 stdout=log,stderr=log,
                                 env={**os.environ,"MUSIC_API_RECOVERY_CONFIRMATION_WINDOW_SECONDS":"0.4","MUSIC_API_RECOVERY_MAX_ATTEMPTS":"3",
                                      "MUSIC_API_RECOVERY_POLL_INTERVAL_SECONDS":"0.02","MUSIC_API_RECOVERY_MAX_POLL_INTERVAL_SECONDS":"0.05",**(recovery_options or {})},
                                 creationflags=getattr(subprocess,"CREATE_NO_WINDOW",0))
        try:
            deadline = time.monotonic() + 10
            while not ready.exists():
                assert child.poll() is None and time.monotonic() < deadline
                time.sleep(0.02)
            address = "http://127.0.0.1:" + str(json.loads(ready.read_text(encoding="utf-8"))["port"])
            with httpx.Client(base_url=address,trust_env=False,timeout=30) as client:
                while True:
                    try:
                        if client.get("/projects").status_code == 200:
                            break
                    except httpx.TransportError:
                        pass
                    assert child.poll() is None and time.monotonic() < deadline
                    time.sleep(0.02)
                yield client
        finally:
            if child.poll() is None:
                if abrupt:
                    child.kill()
                else:
                    ready.with_suffix(".stop").write_text("Owned API stop\n",encoding="utf-8")
                child.wait(timeout=10)
            assert abrupt or child.returncode == 0

def terminal(client, route):
    deadline = time.monotonic() + 4
    while True:
        value = client.get(route).json()
        if value["status"] in {"completed","failed","cancelled"}:
            return value
        assert time.monotonic() < deadline, value
        time.sleep(0.02)

@pytest.mark.parametrize("wrong_graph",[True,False],ids=["stored-handle-wrong-graph","exact-original-graph"])
def test_restart_retains_original_handle_but_requires_exact_graph_and_imports_once(tmp_path: Path,monkeypatch,wrong_graph: bool):
    with recovery_peer(tmp_path,monkeypatch) as (url,receipt,registry), httpx.Client(base_url=url,trust_env=False) as peer:
        data = tmp_path / "application"
        with owned_api(data,url,receipt,registry.root,tmp_path) as first:
            project = first.post("/projects",json={"name":"Restart morning"}).json()
            base = "/projects/" + project["id"]
            submitted = first.post(base + "/jobs/generate",json={"style":"gentle folk pop","lyrics":"Morning gathers on the window","seed":202625001})
            assert submitted.status_code == 202, submitted.text
            route = base + "/jobs/" + submitted.json()["id"]
            deadline = time.monotonic() + 5
            while first.get(route).json()["status"] != "running":
                assert time.monotonic() < deadline
                time.sleep(0.02)
            before = first.get(route).json()
            # Running follows the worker's committed accepted receipt, including its
            # opaque native handle; this is a normal submission, not a seeded row.
            assert peer.get("/fixture/state").json()["accepted"] == 1

            observations = {"submitted":submitted.json(),"before_restart":before,"native_before_edit":peer.get("/fixture/state").json()}
        if wrong_graph:
            peer.post("/fixture/edit",json={"action":"wrong_graph"}).raise_for_status()
        peer.post("/fixture/control",json={"action":"complete"}).raise_for_status()
        observations["native_after_edit"] = peer.get("/fixture/state").json()
        observations["native_history"] = peer.get("/history").json()
        description = next(iter(observations["native_history"].values()))["outputs"]["3"]["audio"][0]
        audio_response = peer.get("/view",params=description)
        assert audio_response.status_code == 200
        assert peer.get("/view",params=dict(description,subfolder="foreign")).status_code == 404
        original_audio = audio_response.content
        (tmp_path / "native-original.flac").write_bytes(original_audio)
        observations["native_audio"] = {"size_bytes":len(original_audio),"sha256":hashlib.sha256(original_audio).hexdigest(),"header":original_audio[:4].decode("ascii")}
        with owned_api(data,url,receipt,registry.root,tmp_path) as restarted:
            try:
                recovered = terminal(restarted,route)
            finally:
                observations["after_restart"] = restarted.get(route).json()
                observations["native_after_restart"] = peer.get("/fixture/state").json()
                (tmp_path / "oracle-observations.json").write_text(json.dumps(observations,indent=2) + "\n",encoding="utf-8")
            assert recovered["inputs"] == before["inputs"]
            assert recovered["id"] == before["id"]
            assert peer.get("/fixture/state").json()["accepted"] == 1
            if wrong_graph:
                assert recovered["status"] == "failed"
                assert recovered["error"]["code"] == "runtime_unavailable"
                assert recovered["result"] is None
                assert restarted.get(base + "/assets").json() == []
            else:
                assert recovered["status"] == "completed", recovered
                assert recovered["result"]["candidate_id"]
                assert len(restarted.get(base + "/assets").json()) == 2
                assert len(restarted.get(base + "/scores").json()) == 1
                assert len(restarted.get(base + "/candidates").json()) == 1
                contents = {}
                for asset in restarted.get(base + "/assets").json():
                    downloaded = restarted.get(base + "/assets/" + asset["id"] + "/content")
                    assert downloaded.status_code == 200, downloaded.text
                    contents[asset["id"]] = downloaded.content
                assert contents[recovered["result"]["audio_asset_id"]] == original_audio
                original_abc = next(iter(observations["native_history"].values()))["outputs"]["4"]["text"][0].encode("utf-8")
                assert contents[recovered["result"]["abc_asset_id"]] == original_abc
        with owned_api(data,url,receipt,registry.root,tmp_path) as again:
            assert again.get(route).json() == recovered
            assert peer.get("/fixture/state").json()["accepted"] == 1
            if not wrong_graph:
                assert len(again.get(base + "/assets").json()) == 2
                assert len(again.get(base + "/scores").json()) == 1
                assert len(again.get(base + "/candidates").json()) == 1
                for identifier,content in contents.items():
                    downloaded = again.get(base + "/assets/" + identifier + "/content")
                    assert downloaded.status_code == 200, downloaded.text
                    assert downloaded.content == content


@pytest.mark.parametrize("slow",[False,True],ids=["fast-owned-read","slow-owned-read"])
def test_running_original_cannot_postpone_other_startup_unknown_jobs_confirmation_budget(tmp_path: Path,monkeypatch,slow):
    with recovery_peer(tmp_path,monkeypatch) as (url,receipt,registry),httpx.Client(base_url=url,trust_env=False) as peer:
        data = tmp_path / "application"
        with owned_api(data,url,receipt,registry.root,tmp_path) as first:
            project = first.post("/projects",json={"name":"Shared recovery fairness"}).json()
            base = "/projects/" + project["id"]
            inputs = {"style":"gentle folk pop","lyrics":"Morning gathers on the window","seed":202625010}
            active = first.post(base+"/jobs/generate",json=inputs).json()
            active_route = base+"/jobs/"+active["id"]
            deadline = time.monotonic()+5
            while first.get(active_route).json()["status"] != "running":
                assert time.monotonic()<deadline
                time.sleep(0.02)
            queued = [first.post(base+"/jobs/generate",json=dict(inputs,seed=inputs["seed"]+number+1)).json() for number in range(4)]
            assert all(value["status"] == "queued" for value in queued)
            assert peer.get("/fixture/state").json()["accepted"] == 1
        options = {"MUSIC_API_RECOVERY_CONFIRMATION_WINDOW_SECONDS":"0.4","MUSIC_API_RECOVERY_MAX_ATTEMPTS":"100"}
        if slow:
            peer.post("/fixture/edit",json={"action":"slow_history"}).raise_for_status()
        with owned_api(data,url,receipt,registry.root,tmp_path,options) as restarted:
            deadline = time.monotonic()+1.2
            while True:
                values = [restarted.get(base+"/jobs/"+value["id"]).json() for value in queued]
                if all(value["status"] == "failed" for value in values):
                    break
                assert time.monotonic()<deadline,values
                time.sleep(0.02)
            assert all(value["error"]["code"] == "runtime_unavailable" and value["result"] is None for value in values)
            assert restarted.get(active_route).json()["status"] in {"running","failed"}
            assert peer.get("/fixture/state").json()["accepted"] == 1
            if slow:
                return
            peer.post("/fixture/control",json={"action":"complete"}).raise_for_status()
            assert terminal(restarted,active_route)["status"] == "completed"
            assert len(restarted.get(base+"/candidates").json()) == 1


def test_confirmed_running_original_can_complete_after_an_expired_window_and_another_restart(tmp_path: Path,monkeypatch):
    with recovery_peer(tmp_path,monkeypatch) as (url,receipt,registry),httpx.Client(base_url=url,trust_env=False) as peer:
        data = tmp_path/"application"
        with owned_api(data,url,receipt,registry.root,tmp_path) as first:
            project = first.post("/projects",json={"name":"Long confirmed generation"}).json()
            base = "/projects/"+project["id"]
            submitted = first.post(base+"/jobs/generate",json={"style":"gentle folk pop","lyrics":"Morning gathers on the window","seed":202625011}).json()
            route = base+"/jobs/"+submitted["id"]
            deadline = time.monotonic()+5
            while first.get(route).json()["status"] != "running":
                assert time.monotonic()<deadline
                time.sleep(0.02)
        with owned_api(data,url,receipt,registry.root,tmp_path) as confirmed:
            deadline = time.monotonic()+2
            while confirmed.get(route).json()["recovery_required"]:
                assert time.monotonic()<deadline
                time.sleep(0.02)
            time.sleep(0.5)
            assert confirmed.get(route).json()["status"] == "running"
        peer.post("/fixture/control",json={"action":"complete"}).raise_for_status()
        with owned_api(data,url,receipt,registry.root,tmp_path) as reopened:
            value = terminal(reopened,route)
            assert value["status"] == "completed",value
            assert peer.get("/fixture/state").json()["accepted"] == 1
            assert len(reopened.get(base+"/candidates").json()) == 1


def test_second_restart_does_not_renew_an_original_unknown_confirmation_window(tmp_path: Path,monkeypatch):
    with recovery_peer(tmp_path,monkeypatch) as (url,receipt,registry),httpx.Client(base_url=url,trust_env=False) as peer:
        data = tmp_path/"application"
        with owned_api(data,url,receipt,registry.root,tmp_path) as first:
            project = first.post("/projects",json={"name":"Unknown recovery window"}).json()
            base = "/projects/"+project["id"]
            submitted = first.post(base+"/jobs/generate",json={"style":"gentle folk pop","lyrics":"Morning gathers on the window","seed":202625020}).json()
            route = base+"/jobs/"+submitted["id"]
            deadline = time.monotonic()+5
            while first.get(route).json()["status"] != "running":
                assert time.monotonic()<deadline
                time.sleep(0.02)
        peer.post("/fixture/edit",json={"action":"wrong_graph"}).raise_for_status()
        peer.post("/fixture/control",json={"action":"complete"}).raise_for_status()
        options = {"MUSIC_API_RECOVERY_MAX_ATTEMPTS":"1000","MUSIC_API_RECOVERY_CONFIRMATION_WINDOW_SECONDS":"5"}
        with owned_api(data,url,receipt,registry.root,tmp_path,options) as uncertain:
            current = uncertain.get(route).json()
            assert current["status"] == "running" and current["recovery_required"] is True
            for _ in range(3):
                assert uncertain.get(route).json()["status"] == "running"
            original_public_deadline = time.monotonic()+5
            time.sleep(0.5)
        # Reopening cannot give the original uncertainty a fresh five seconds.
        with owned_api(data,url,receipt,registry.root,tmp_path,options) as reopened:
            while True:
                exhausted = reopened.get(route).json()
                if exhausted["status"] == "failed":
                    break
                assert time.monotonic()<original_public_deadline,exhausted
                time.sleep(0.02)
            assert exhausted["status"] == "failed",exhausted
            assert exhausted["error"]["code"] == "runtime_unavailable"
            assert exhausted["result"] is None
            assert peer.get("/fixture/state").json()["accepted"] == 1


def test_expired_new_submission_receipt_does_not_erase_original_accepted_recovery(tmp_path: Path,monkeypatch):
    from datetime import datetime,timedelta,timezone
    with recovery_peer(tmp_path,monkeypatch) as (url,receipt,registry),httpx.Client(base_url=url,trust_env=False) as peer:
        data = tmp_path/"application"
        with owned_api(data,url,receipt,registry.root,tmp_path) as first:
            project = first.post("/projects",json={"name":"Original acceptance survives"}).json()
            base = "/projects/"+project["id"]
            job = first.post(base+"/jobs/generate",json={"style":"gentle folk pop","lyrics":"Morning gathers on the window","seed":202625030}).json()
            route = base+"/jobs/"+job["id"]
            deadline = time.monotonic()+5
            while first.get(route).json()["status"] != "running":
                assert time.monotonic()<deadline
                time.sleep(0.02)
        facts = json.loads(receipt.read_text(encoding="utf-8"))
        facts["checked_at"] = (datetime.now(timezone.utc)-timedelta(seconds=600)).isoformat()
        receipt.write_text(json.dumps(facts),encoding="utf-8")
        peer.post("/fixture/control",json={"action":"complete"}).raise_for_status()
        with owned_api(data,url,receipt,registry.root,tmp_path) as recovered:
            complete = terminal(recovered,route)
            assert complete["status"] == "completed",complete
            assert peer.get("/fixture/state").json()["accepted"] == 1
            new = recovered.post(base+"/jobs/generate",json={"style":"gentle folk pop","lyrics":"New intent","seed":202625031})
            assert new.status_code == 503 and new.json()["error"]["code"] == "runtime_evidence_stale"
            assert recovered.get(route).json() == complete


@pytest.mark.parametrize("outcome",["failed","cancelled"])
def test_original_failure_or_cancellation_is_recovered_without_import_or_second_submission(tmp_path: Path,monkeypatch,outcome):
    with recovery_peer(tmp_path,monkeypatch) as (url,receipt,registry),httpx.Client(base_url=url,trust_env=False) as peer:
        data = tmp_path/"application"
        with owned_api(data,url,receipt,registry.root,tmp_path) as first:
            project = first.post("/projects",json={"name":"Original terminal recovery"}).json()
            base = "/projects/"+project["id"]
            job = first.post(base+"/jobs/generate",json={"style":"gentle folk pop","lyrics":"Morning gathers on the window","seed":202625040}).json()
            route = base+"/jobs/"+job["id"]
            deadline = time.monotonic()+5
            while first.get(route).json()["status"] != "running":
                assert time.monotonic()<deadline
                time.sleep(0.02)
            original = first.get(route).json()
        peer.post("/fixture/edit",json={"action":outcome}).raise_for_status()
        with owned_api(data,url,receipt,registry.root,tmp_path) as recovered:
            value = terminal(recovered,route)
            assert value["status"] == outcome,value
            assert value["inputs"] == original["inputs"] and value["provenance"] == original["provenance"]
            assert value["error"]["code"] == ("generation_failed" if outcome == "failed" else "cancelled")
            assert value["result"] is None
            assert recovered.get(base+"/assets").json() == []
            assert peer.get("/fixture/state").json()["accepted"] == 1

def test_transcribe_restarts_with_frozen_upload_and_original_reference_without_reupload(tmp_path: Path,monkeypatch):
    from test_transcription import reference_audio
    with recovery_peer(tmp_path,monkeypatch) as (url,receipt,registry),httpx.Client(base_url=url,trust_env=False) as peer:
        data = tmp_path/"application"
        original = reference_audio()
        with owned_api(data,url,receipt,registry.root,tmp_path) as first:
            project = first.post("/projects",json={"name":"Original reference recovery"}).json()
            base = "/projects/"+project["id"]
            reference = first.post(base+"/assets",files={"file":("reference.wav",original)}).json()
            job = first.post(base+"/transcriptions",json={"reference_asset_id":reference["id"]}).json()
            route = base+"/jobs/"+job["id"]
            deadline = time.monotonic()+5
            while first.get(route).json()["status"] != "running":
                assert time.monotonic()<deadline,first.get(route).json()
                time.sleep(0.02)
            uploads = peer.get("/fixture/state").json()["uploads"]
            assert len(uploads) == 1 and uploads[0]["sha256"] == hashlib.sha256(original).hexdigest()
        peer.post("/fixture/control",json={"action":"complete"}).raise_for_status()
        with owned_api(data,url,receipt,registry.root,tmp_path) as recovered:
            complete = terminal(recovered,route)
            assert complete["status"] == "completed",complete
            score = recovered.get(base+"/scores/"+complete["result"]["score_id"]).json()
            assert score["source_reference_asset_id"] == reference["id"]
            assert recovered.get(base+"/assets/"+reference["id"]+"/content").content == original
            for role in ("abc","midi"):
                response = recovered.get(base+"/assets/"+complete["result"][role+"_asset_id"]+"/content")
                assert response.status_code == 200 and response.content
            after = peer.get("/fixture/state").json()
            assert [value for value in after["uploads"] if value["name"] == uploads[0]["name"]] == uploads
            assert after["accepted"] == 1


def test_foreign_upload_ack_never_dispatches_inference_or_changes_original_reference(tmp_path: Path,monkeypatch):
    from test_transcription import reference_audio
    with recovery_peer(tmp_path,monkeypatch) as (url,receipt,registry),httpx.Client(base_url=url,trust_env=False) as peer:
        data = tmp_path/"application"
        original = reference_audio()
        with owned_api(data,url,receipt,registry.root,tmp_path) as client:
            project = client.post("/projects",json={"name":"Rejected upload binding"}).json()
            base = "/projects/"+project["id"]
            reference = client.post(base+"/assets",files={"file":("reference.wav",original)}).json()
            peer.post("/fixture/edit",json={"action":"bad_upload"}).raise_for_status()
            job = client.post(base+"/transcriptions",json={"reference_asset_id":reference["id"]}).json()
            rejected = terminal(client,base+"/jobs/"+job["id"])
            assert rejected["status"] == "failed" and rejected["error"]["code"] == "runtime_upload_unverified"
            assert rejected["result"] is None
            assert peer.get("/fixture/state").json()["accepted"] == 0
            assert client.get(base+"/assets/"+reference["id"]+"/content").content == original


@pytest.mark.parametrize("fault",["missing_history","unavailable","wrong_client","duplicate","malformed"])
def test_missing_or_unavailable_runtime_is_bounded_without_blind_retry(tmp_path: Path,monkeypatch,fault):
    with recovery_peer(tmp_path,monkeypatch) as (url,receipt,registry),httpx.Client(base_url=url,trust_env=False) as peer:
        data = tmp_path/"application"
        with owned_api(data,url,receipt,registry.root,tmp_path) as first:
            project = first.post("/projects",json={"name":"Unknown original work"}).json()
            base = "/projects/"+project["id"]
            submitted = first.post(base+"/jobs/generate",json={"style":"gentle folk pop","lyrics":"Morning gathers on the window","seed":202625050}).json()
            route = base+"/jobs/"+submitted["id"]
            deadline = time.monotonic()+5
            while first.get(route).json()["status"] != "running":
                assert time.monotonic()<deadline
                time.sleep(0.02)
            original = first.get(route).json()
        peer.post("/fixture/edit",json={"action":fault}).raise_for_status()
        with owned_api(data,url,receipt,registry.root,tmp_path) as reopened:
            value = terminal(reopened,route)
            assert value["status"] == "failed" and value["error"]["code"] == "runtime_unavailable"
            assert value["inputs"] == original["inputs"] and value["provenance"] == original["provenance"]
            assert value["result"] is None and reopened.get(base+"/assets").json() == []
            assert reopened.post(route+"/retry").status_code == 409
            assert peer.get("/fixture/state").json()["accepted"] == 1


@pytest.mark.parametrize("wrong_inputs",[False,True],ids=["original-fake-request","foreign-fake-inputs"])
def test_identified_persistent_fake_and_real_sqlite_recover_across_actual_api_processes(tmp_path: Path,wrong_inputs):
    from music_api.workflow_registry import WorkflowRegistry
    from test_transcription import reference_audio
    fixture_state = tmp_path/"external-fake"/"attempts.json"
    data = tmp_path/"application"
    registry = WorkflowRegistry().root
    with owned_api(data,"fake",fixture_state,registry,tmp_path) as first:
        project = first.post("/projects",json={"name":"Persistent fake recovery"}).json()
        base = "/projects/"+project["id"]
        original = reference_audio()
        reference = first.post(base+"/assets",files={"file":("reference.wav",original)}).json()
        submitted = first.post(base+"/transcriptions",json={"reference_asset_id":reference["id"]}).json()
        route = base+"/jobs/"+submitted["id"]
        deadline = time.monotonic()+5
        while first.get(route).json()["status"] != "running":
            assert time.monotonic()<deadline
            time.sleep(0.02)
    state = json.loads(fixture_state.read_text(encoding="utf-8"))
    assert len(state["requests"]) == 1
    state["completed"] = True
    if wrong_inputs:
        next(iter(state["requests"].values()))["inputs"]["reference_sha256"] = "0"*64
    fixture_state.write_text(json.dumps(state),encoding="utf-8")
    # Success checks ownership/output persistence, not subsecond host capacity.
    options = {} if wrong_inputs else {"MUSIC_API_RECOVERY_CONFIRMATION_WINDOW_SECONDS":"300"}
    with owned_api(data,"fake",fixture_state,registry,tmp_path,options) as recovered:
        complete = terminal(recovered,route)
        if wrong_inputs:
            assert complete["status"] == "failed" and complete["result"] is None,complete
            assert len(recovered.get(base+"/assets").json()) == 1
            assert recovered.post(route+"/retry").status_code == 409
            return
        assert complete["status"] == "completed" and complete["provenance"]["runtime_kind"] == "fake",complete
        assert len(json.loads(fixture_state.read_text(encoding="utf-8"))["requests"]) == 1
        assert recovered.get(base+"/assets/"+reference["id"]+"/content").content == original
        assert len(recovered.get(base+"/assets").json()) == 3
    with owned_api(data,"fake",fixture_state,registry,tmp_path) as again:
        assert again.get(route).json() == complete
        assert len(again.get(base+"/assets").json()) == 3


def test_recovered_history_cannot_import_a_descriptor_outside_the_original_audio_prefix(tmp_path: Path,monkeypatch):
    with recovery_peer(tmp_path,monkeypatch) as (url,receipt,registry),httpx.Client(base_url=url,trust_env=False) as peer:
        data = tmp_path/"application"
        with owned_api(data,url,receipt,registry.root,tmp_path) as first:
            project = first.post("/projects",json={"name":"Foreign result descriptor"}).json()
            base = "/projects/"+project["id"]
            submitted = first.post(base+"/jobs/generate",json={"style":"gentle folk pop","lyrics":"Morning gathers on the window","seed":202625060}).json()
            route = base+"/jobs/"+submitted["id"]
            deadline = time.monotonic()+5
            while first.get(route).json()["status"] != "running":
                assert time.monotonic()<deadline
                time.sleep(0.02)
        peer.post("/fixture/edit",json={"action":"foreign_descriptor"}).raise_for_status()
        peer.post("/fixture/control",json={"action":"complete"}).raise_for_status()
        with owned_api(data,url,receipt,registry.root,tmp_path) as recovered:
            value = terminal(recovered,route)
            assert value["status"] == "failed" and value["result"] is None,value
            assert recovered.get(base+"/assets").json() == []
            assert recovered.get(base+"/candidates").json() == []
            assert peer.get("/fixture/state").json()["accepted"] == 1


@pytest.mark.parametrize("lost_ack",[False,True],ids=["native-pending","acceptance-ack-interruption"])
def test_original_native_pending_or_acceptance_without_ack_recovers_once(tmp_path: Path,monkeypatch,lost_ack):
    with recovery_peer(tmp_path,monkeypatch) as (url,receipt,registry),httpx.Client(base_url=url,trust_env=False) as peer:
        data = tmp_path/"application"
        if lost_ack:
            peer.post("/fixture/edit",json={"action":"delay_ack"}).raise_for_status()
        with owned_api(data,url,receipt,registry.root,tmp_path,abrupt=lost_ack) as first:
            project = first.post("/projects",json={"name":"Original native attempt"}).json()
            base = "/projects/"+project["id"]
            submitted = first.post(base+"/jobs/generate",json={"style":"gentle folk pop","lyrics":"Morning gathers on the window","seed":202625070}).json()
            route = base+"/jobs/"+submitted["id"]
            deadline = time.monotonic()+5
            while peer.get("/fixture/state").json()["accepted"] != 1:
                assert time.monotonic()<deadline
                time.sleep(0.02)
            if lost_ack:
                assert first.get(route).json()["status"] == "queued"
            else:
                while first.get(route).json()["status"] != "running":
                    assert time.monotonic()<deadline
                    time.sleep(0.02)
        if not lost_ack:
            peer.post("/fixture/edit",json={"action":"queued"}).raise_for_status()
        options = {"MUSIC_API_RECOVERY_CONFIRMATION_WINDOW_SECONDS":"3"}
        with owned_api(data,url,receipt,registry.root,tmp_path,options) as reopened:
            deadline = time.monotonic()+3
            while True:
                before = reopened.get(route).json()
                if not before["recovery_required"]:
                    break
                assert time.monotonic()<deadline,before
                time.sleep(0.02)
            assert before["status"] == ("running" if lost_ack else "queued"),before
            peer.post("/fixture/control",json={"action":"complete"}).raise_for_status()
            complete = terminal(reopened,route)
            assert complete["status"] == "completed",complete
            assert peer.get("/fixture/state").json()["accepted"] == 1
            assert len(reopened.get(base+"/candidates").json()) == 1


def test_actual_0004_database_upgrade_keeps_saved_version_files_and_bounds_opaque_active_mapping(tmp_path: Path,monkeypatch):
    import io
    import tarfile
    import sqlite3
    from contextlib import closing
    baseline = tmp_path/"shipped-0004"
    baseline.mkdir()
    repository = Path(__file__).resolve().parents[3]
    archive = subprocess.check_output(["git","-C",str(repository),"archive","236eee2ec2b7fc0ca66b53ebea5c679dec736190","services/api/src"])
    with tarfile.open(fileobj=io.BytesIO(archive)) as content:
        content.extractall(baseline,filter="data")
    with recovery_peer(tmp_path,monkeypatch) as (url,receipt,registry),httpx.Client(base_url=url,trust_env=False) as peer:
        data = tmp_path/"application"
        old_source = {"MUSIC_API_FIXTURE_SOURCE_PATH":str(baseline/"services/api/src")}
        with owned_api(data,url,receipt,registry.root,tmp_path,old_source) as shipped:
            project = shipped.post("/projects",json={"name":"Shipped Version survives upgrade"}).json()
            base = "/projects/"+project["id"]
            inputs = {"style":"gentle folk pop","lyrics":"Morning gathers on the window","seed":202625080}
            submitted = shipped.post(base+"/jobs/generate",json=inputs).json()
            deadline = time.monotonic()+5
            while peer.get("/fixture/state").json()["accepted"] != 1:
                assert time.monotonic()<deadline
                time.sleep(0.02)
            peer.post("/fixture/control",json={"action":"complete"}).raise_for_status()
            complete_route = base+"/jobs/"+submitted["id"]
            complete = terminal(shipped,complete_route)
            assert complete["status"] == "completed",complete
            version = shipped.post(base+"/versions",json={"candidate_id":complete["result"]["candidate_id"],"name":"Shipped first morning"}).json()
            assets = shipped.get(base+"/assets").json()
            originals = {asset["id"]:shipped.get(base+"/assets/"+asset["id"]+"/content").content for asset in assets}
            active = shipped.post(base+"/jobs/generate",json=dict(inputs,seed=202625081)).json()
            active_route = base+"/jobs/"+active["id"]
            while shipped.get(active_route).json()["status"] != "running":
                assert time.monotonic()<deadline
                time.sleep(0.02)
            active_original = shipped.get(active_route).json()
        with closing(sqlite3.connect(data/"app.sqlite")) as stored:
            assert stored.execute("SELECT version_num FROM alembic_version").fetchone()[0] == "0004_job_cancellation"
        with owned_api(data,url,receipt,registry.root,tmp_path) as upgraded:
            failed = terminal(upgraded,active_route)
            assert failed["status"] == "failed" and failed["error"]["code"] == "runtime_unavailable"
            assert failed["inputs"] == active_original["inputs"] and failed["provenance"] == active_original["provenance"]
            assert failed["result"] is None and upgraded.post(active_route+"/retry").status_code == 409
            assert upgraded.get(complete_route).json() == complete
            assert upgraded.get(base+"/versions/"+version["id"]).json() == version
            assert upgraded.get(base+"/assets").json() == assets
            for identifier,original in originals.items():
                assert upgraded.get(base+"/assets/"+identifier+"/content").content == original
            assert peer.get("/fixture/state").json()["accepted"] == 2


@pytest.mark.parametrize("fault",["storage","before-commit","commit-ack","commit-readback","commit-readback-after-startup-delay"])
def test_recovered_result_provider_failures_cannot_duplicate_or_downgrade_owned_results(tmp_path: Path,monkeypatch,fault):
    with recovery_peer(tmp_path,monkeypatch) as (url,receipt,registry),httpx.Client(base_url=url,trust_env=False) as peer:
        data = tmp_path/"application"
        with owned_api(data,url,receipt,registry.root,tmp_path) as first:
            project = first.post("/projects",json={"name":"Recovered import provider boundary"}).json()
            base = "/projects/"+project["id"]
            submitted = first.post(base+"/jobs/generate",json={"style":"gentle folk pop","lyrics":"Morning gathers on the window","seed":202625090}).json()
            route = base+"/jobs/"+submitted["id"]
            deadline = time.monotonic()+5
            while first.get(route).json()["status"] != "running":
                assert time.monotonic()<deadline
                time.sleep(0.02)
            original = first.get(route).json()
        if fault == "storage":
            (data/"assets"/project["id"]).write_bytes(b"Owned path obstruction")
        peer.post("/fixture/control",json={"action":"complete"}).raise_for_status()
        provider_fault = "commit-readback" if fault == "commit-readback-after-startup-delay" else fault
        # This workload measures result-provider faults, not recovery capacity.
        options = {"MUSIC_API_RECOVERY_CONFIRMATION_WINDOW_SECONDS":"300"}
        if fault != "storage":
            options["MUSIC_API_FIXTURE_IMPORT_FAULT"] = provider_fault
        if fault == "commit-readback-after-startup-delay":
            options["MUSIC_API_FIXTURE_STARTUP_READ_DELAY"] = "0.55"
        with owned_api(data,url,receipt,registry.root,tmp_path,options) as reopened:
            value = terminal(reopened,route)
            assets = reopened.get(base+"/assets").json()
            if fault in {"storage","before-commit"}:
                assert value["status"] == "failed" and value["result"] is None,value
                assert value["error"]["code"] == ("result_storage_unavailable" if fault == "storage" else "result_persistence_failed")
                assert value["inputs"] == original["inputs"] and value["provenance"] == original["provenance"]
                assert assets == [] and reopened.get(base+"/candidates").json() == []
            else:
                assert value["status"] == "completed" and value["error"] is None,value
                assert len(assets) == 2 and len(reopened.get(base+"/candidates").json()) == 1
            if fault != "storage":
                assert list(tmp_path.glob("*.fault")),"External provider fault must have executed"
            if provider_fault == "commit-readback":
                assert list(tmp_path.glob("*.readback-fault")),"Independent confirmation read fault must have executed"
            if fault == "commit-readback-after-startup-delay":
                markers = [json.loads(path.read_text(encoding="utf-8")) for path in tmp_path.glob("*.startup-delay.json")]
                assert len(markers) == 1 and markers[0]["phase"] == "initial_worker_admission_metadata_read"
            downloads = {asset["id"]:reopened.get(base+"/assets/"+asset["id"]+"/content").content for asset in assets}
        with owned_api(data,url,receipt,registry.root,tmp_path) as again:
            assert again.get(route).json() == value
            assert again.get(base+"/assets").json() == assets
            for identifier,content in downloads.items():
                assert again.get(base+"/assets/"+identifier+"/content").content == content
            assert peer.get("/fixture/state").json()["accepted"] == 1


@pytest.mark.parametrize("fault,foreign",[("attempt-ack",False),("attempt-ack-readback",False),("before-attempt",False),("accept-ack",False),("attempt-ack-readback",True),("exhausted-ack",True)])
def test_cursor_ack_and_independent_readback_loss_reconciles_same_original_then_processes_new_live_work(tmp_path: Path,monkeypatch,fault,foreign):
    with recovery_peer(tmp_path,monkeypatch) as (url,receipt,registry),httpx.Client(base_url=url,trust_env=False) as peer:
        data = tmp_path/"application"
        with owned_api(data,url,receipt,registry.root,tmp_path) as first:
            project = first.post("/projects",json={"name":"Cursor provider recovery"}).json()
            base = "/projects/"+project["id"]
            inputs = {"style":"gentle folk pop","lyrics":"Morning gathers on the window","seed":202625651}
            submitted = first.post(base+"/jobs/generate",json=inputs).json()
            route = base+"/jobs/"+submitted["id"]
            deadline = time.monotonic()+5
            while first.get(route).json()["status"] != "running":
                assert time.monotonic()<deadline
                time.sleep(0.02)
            sibling = first.post(base+"/jobs/generate",json=dict(inputs,seed=202625652)).json()
            assert sibling["status"] == "queued" and peer.get("/fixture/state").json()["accepted"] == 1
        if foreign:
            peer.post("/fixture/edit",json={"action":"wrong_graph"}).raise_for_status()
        peer.post("/fixture/control",json={"action":"complete"}).raise_for_status()
        options = {"MUSIC_API_FIXTURE_CURSOR_FAULT":fault,"MUSIC_API_FIXTURE_CURSOR_FAULT_JOB_ID":submitted["id"]}
        if not foreign:
            # This workload verifies provider recovery, not subsecond host capacity.
            # The unsent sibling still exhausts the unchanged three-attempt limit.
            options["MUSIC_API_RECOVERY_CONFIRMATION_WINDOW_SECONDS"] = "300"
        with owned_api(data,url,receipt,registry.root,tmp_path,options) as recovered:
            complete = terminal(recovered,route)
            assert complete["status"] == ("failed" if foreign else "completed"),complete
            if foreign:
                assert complete["error"]["code"] == "runtime_unavailable" and complete["result"] is None
            assert list(tmp_path.glob("*.cursor-fault"))
            if fault == "attempt-ack-readback":
                assert list(tmp_path.glob("*.cursor-readback-fault"))
            assert peer.get("/fixture/state").json()["accepted"] == 1
            assert len(recovered.get(base+"/assets").json()) == (0 if foreign else 2)
            sibling_terminal = terminal(recovered,base+"/jobs/"+sibling["id"])
            assert sibling_terminal["status"] == "failed" and sibling_terminal["error"]["code"] == "runtime_unavailable"
            assert sibling_terminal["result"] is None and peer.get("/fixture/state").json()["accepted"] == 1
            following = recovered.post(base+"/jobs/generate",json=dict(inputs,seed=202625653)).json()
            deadline = time.monotonic()+5
            while peer.get("/fixture/state").json()["accepted"] != 2:
                assert time.monotonic()<deadline
                time.sleep(0.02)
            peer.post("/fixture/control",json={"action":"complete"}).raise_for_status()
            assert terminal(recovered,base+"/jobs/"+following["id"])["status"] == "completed"
            assert recovered.get(route).json() == complete


def test_first_worker_admission_starts_cursor_after_delayed_metadata_read(tmp_path: Path,monkeypatch):
    from datetime import datetime
    with recovery_peer(tmp_path,monkeypatch) as (url,receipt,registry),httpx.Client(base_url=url,trust_env=False) as peer:
        data = tmp_path/"application"
        with owned_api(data,url,receipt,registry.root,tmp_path) as first:
            project = first.post("/projects",json={"name":"Independent admission timing"}).json()
            base = "/projects/"+project["id"]
            submitted = first.post(base+"/jobs/generate",json={"style":"gentle folk pop","lyrics":"Morning gathers on the window","seed":202625003}).json()
            route = base+"/jobs/"+submitted["id"]
            deadline = time.monotonic()+5
            while first.get(route).json()["status"] != "running":
                assert time.monotonic()<deadline
                time.sleep(0.02)
        # The peer remains running; this oracle ends at admission, before import.
        with owned_api(data,url,receipt,registry.root,tmp_path,{"MUSIC_API_FIXTURE_STARTUP_READ_DELAY":"0.55"}) as reopened:
            deadline = time.monotonic()+5
            while not list(tmp_path.glob("*.admission-cursor.json")):
                assert time.monotonic()<deadline
                time.sleep(0.02)
            markers = [json.loads(path.read_text(encoding="utf-8")) for path in tmp_path.glob("*.startup-delay.json")]
            cursors = [json.loads(path.read_text(encoding="utf-8")) for path in tmp_path.glob("*.admission-cursor.json")]
            assert len(markers) == len(cursors) == 1
            marker,cursor = markers[0],cursors[0]
            assert marker["phase"] == "initial_worker_admission_metadata_read" and marker["cursor_before"] == [None]
            assert marker["seconds"]>0.4
            assert datetime.fromisoformat(cursor["started_at"])>=datetime.fromisoformat(marker["finished_at"])
            assert (datetime.fromisoformat(cursor["deadline"])-datetime.fromisoformat(cursor["started_at"])).total_seconds() == 0.4
            assert cursor["attempts"] == 0
            assert reopened.get(route).json()["inputs"] == submitted["inputs"]
            assert peer.get("/fixture/state").json()["accepted"] == 1
