"""Public WS snapshots follow durable HTTP state through external event/commit loss."""

import json
from datetime import datetime
from contextlib import ExitStack
from pathlib import Path
import threading
import time

from fastapi.testclient import TestClient
import httpx
import pytest
from sqlalchemy import event
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from music_api.config import Settings
from music_api.fake_generation import generation_fixture
from music_api.fake_runtime import FakeInferenceRuntime
from music_api.job_models import Job
from music_api.main import create_app
from music_api.runtime_types import RuntimeStatus
from music_api.schemas import JobRead
from music_api.event_schemas import JobEventRead
from test_transcription import reference_audio
from cancellation_peer import cancellation_peer
from test_cancel_retry import wait_running


@pytest.mark.parametrize("operation", ["Transcribe", "Generate"])
def test_ws_unknown_progress_saving_and_reconnect_recover_the_same_durable_result(tmp_path: Path, operation: str) -> None:
    native_finished, commit_entered, allow_commit = threading.Event(), threading.Event(), threading.Event()
    callbacks = []

    class ExternalRuntimeFixture(FakeInferenceRuntime):
        def subscribe(self, handle, operation, on_status):
            callbacks.append(on_status)
            return super().subscribe(handle, operation, on_status)

        def status(self, handle: str) -> RuntimeStatus:
            if native_finished.is_set():
                return RuntimeStatus("completed")
            return RuntimeStatus("running", "transcribing" if operation == "Transcribe" else "synthesizing", None)

    def hold_result_commit(session: Session) -> None:
        if any(isinstance(item, Job) and item.status == "completed" for item in session.identity_map.values()):
            commit_entered.set()
            assert allow_commit.wait(timeout=10), "External result commit gate was not released"

    event.listen(Session, "before_commit", hold_result_commit)
    runtime = ExternalRuntimeFixture(result_factories={"Generate": generation_fixture})
    try:
        with TestClient(create_app(Settings(data_dir=tmp_path, runtime_mode="fake"), runtime=runtime)) as client, ExitStack() as cleanup:
            cleanup.callback(allow_commit.set)
            cleanup.callback(native_finished.set)
            project = client.post("/projects", json={"name": "Morning song"}).json()
            base = "/projects/" + project["id"]
            original = reference_audio()
            source = client.post(base + "/assets", files={"file": ("reference.wav", original)}).json()
            if operation == "Transcribe":
                response = client.post(base + "/transcriptions", json={"reference_asset_id": source["id"]})
            else:
                response = client.post(base + "/jobs/generate", json={"style": "gentle folk pop", "lyrics": "Morning gathers on the window", "seed": 2026192201})
            assert response.status_code == 202
            identifier = response.json()["id"]
            job_url = base + "/jobs/" + identifier
            with client.websocket_connect(job_url + "/events") as websocket:
                while True:
                    message = websocket.receive_json()
                    assert message["job"]["id"] == identifier
                    assert message["job"]["project_id"] == project["id"]
                    assert message["job"]["progress"] is None
                    assert "prompt_id" not in json.dumps(message) and "node_id" not in json.dumps(message)
                    if message["job"]["status"] == "running":
                        assert message["job"]["phase"] == ("transcribing" if operation == "Transcribe" else "synthesizing")
                        break
                native_finished.set()
                assert commit_entered.wait(timeout=5)
                before_commit = client.get(job_url).json()
                assert before_commit["status"] == "running"
                assert before_commit["phase"] == "saving"
                assert before_commit["progress"] is None
                assert before_commit["result"] is None
                for callback in callbacks:
                    callback(RuntimeStatus("completed"))
                    callback(RuntimeStatus("running", "transcribing" if operation == "Transcribe" else "planning_score", None))
                saving = websocket.receive_json()
                assert saving["job"]["status"] == "running"
                assert saving["job"]["phase"] == "saving"
                assert saving["job"]["result"] is None
            # This client deliberately misses the completion event and recovers by HTTP.
            allow_commit.set()
            deadline = time.monotonic() + 5
            while True:
                durable = client.get(job_url).json()
                if durable["status"] in {"completed", "failed", "cancelled"}:
                    break
                assert time.monotonic() < deadline
                time.sleep(0.01)
            assert durable["status"] == "completed", durable
            # Late/duplicate external hints cannot re-enter import or change HTTP.
            for callback in callbacks:
                callback(RuntimeStatus("running", "loading_model", None))
                callback(RuntimeStatus("completed"))
                callback(RuntimeStatus("completed"))
            with client.websocket_connect(job_url + "/events") as websocket:
                recovered = websocket.receive_json()["job"]
                assert recovered == durable
            assets = client.get(base + "/assets").json()
            assert len(assets) == 3
            assert client.get(base + "/assets/" + source["id"] + "/content").content == original
            for role in (["abc", "midi"] if operation == "Transcribe" else ["abc", "audio"]):
                assert client.get(base + "/assets/" + durable["result"][role + "_asset_id"] + "/content").content
            assert client.get(job_url).json() == durable
    finally:
        native_finished.set()
        allow_commit.set()
        event.remove(Session, "before_commit", hold_result_commit)


def test_missing_and_cross_project_ws_job_references_are_denied(tmp_path: Path) -> None:
    from uuid import uuid4
    from starlette.websockets import WebSocketDisconnect

    with TestClient(create_app(Settings(data_dir=tmp_path, runtime_mode="fake"))) as client:
        project = client.post("/projects", json={"name": "Morning song"}).json()
        other = client.post("/projects", json={"name": "Another song"}).json()
        source = client.post("/projects/" + project["id"] + "/assets", files={"file": ("reference.wav", reference_audio())}).json()
        job = client.post("/projects/" + project["id"] + "/transcriptions", json={"reference_asset_id": source["id"]}).json()
        for project_id, identifier in [(project["id"], str(uuid4())), (other["id"], job["id"])]:
            with pytest.raises(WebSocketDisconnect) as failure:
                with client.websocket_connect("/projects/" + project_id + "/jobs/" + identifier + "/events"):
                    pass
            assert failure.value.code == 4404


def test_reconnected_ws_and_http_retain_the_same_failed_result_recovery(tmp_path: Path) -> None:
    from music_api.runtime_types import RuntimeArtifact, RuntimeResult

    runtime = FakeInferenceRuntime(results={"Transcribe": RuntimeResult((RuntimeArtifact("abc", b"X:1\nK:C\nC|", "abc", "text/vnd.abc", "score.abc"),),
                                                                        score_validation={"valid": True, "note_count": 1})})
    with TestClient(create_app(Settings(data_dir=tmp_path, runtime_mode="fake"), runtime=runtime)) as client:
        project = client.post("/projects", json={"name": "Morning song"}).json()
        base = "/projects/" + project["id"]
        source = client.post(base + "/assets", files={"file": ("reference.wav", reference_audio())}).json()
        job = client.post(base + "/transcriptions", json={"reference_asset_id": source["id"]}).json()
        job_url = base + "/jobs/" + job["id"]
        with client.websocket_connect(job_url + "/events") as websocket:
            while True:
                failed = websocket.receive_json()["job"]
                if failed["status"] in {"completed", "failed", "cancelled"}:
                    break
        assert failed["status"] == "failed"
        assert failed["error"]["code"] == "transcription_failed"
        assert failed["error"]["recovery"]
        assert failed["result"] is None
        assert client.get(job_url).json() == failed
        with client.websocket_connect(job_url + "/events") as websocket:
            assert websocket.receive_json()["job"] == failed
        assert client.get(base + "/assets").json() == [source]
        assert client.get(base + "/scores").json() == []


@pytest.mark.parametrize("reading,expected", [(0.25, 0.25), (float("nan"), None), (1.1, None), (-0.1, None), (True, None)])
def test_only_reliable_bounded_whole_job_progress_reaches_http_and_ws(tmp_path: Path, reading, expected) -> None:
    finished = threading.Event()

    class MeasuredExternalFixture(FakeInferenceRuntime):
        # The legal reading models one of four measured whole-Job units; the
        # invalid samples model an unavailable/invalid external source.
        def status(self, handle: str) -> RuntimeStatus:
            return RuntimeStatus("completed") if finished.is_set() else RuntimeStatus("running", "transcribing", reading)

    runtime = MeasuredExternalFixture()
    with TestClient(create_app(Settings(data_dir=tmp_path, runtime_mode="fake"), runtime=runtime)) as client, ExitStack() as cleanup:
        cleanup.callback(finished.set)
        project = client.post("/projects", json={"name": "Morning song"}).json()
        base = "/projects/" + project["id"]
        source = client.post(base + "/assets", files={"file": ("reference.wav", reference_audio())}).json()
        job = client.post(base + "/transcriptions", json={"reference_asset_id": source["id"]}).json()
        job_url = base + "/jobs/" + job["id"]
        with client.websocket_connect(job_url + "/events") as websocket:
            while True:
                value = websocket.receive_json()["job"]
                if value["status"] == "running":
                    break
            assert value["phase"] == "transcribing"
            assert value["progress"] == expected
            assert client.get(job_url).json()["progress"] == expected
            finished.set()
            while True:
                completed = websocket.receive_json()["job"]
                if completed["status"] in {"completed","failed","cancelled"}:
                    break
            assert completed["status"] == "completed" and completed["error"] is None
            assert completed["progress"] is None and completed["result"] is not None
            assert completed == client.get(job_url).json()
            closed = websocket.receive()
            assert closed["type"] == "websocket.close" and closed["code"] == 1000


def test_ws_cancel_intent_ack_loss_exposes_recovery_then_the_same_confirmed_target(tmp_path: Path, monkeypatch) -> None:
    armed = {"value": False, "fired": False}
    loss_seen, allow_loss = threading.Event(), threading.Event()

    def hold_source_loss(jobs):
        subscribe = jobs.subscription_factory
        def controlled_subscribe(handle,operation,on_status):
            def observed(value):
                if value.code == "native_event_source_lost":
                    loss_seen.set()
                    assert allow_loss.wait(timeout=5),"Owned source-loss gate was not released"
                on_status(value)
            close = subscribe(handle,operation,observed)
            def release_and_close():
                allow_loss.set()
                close()
            return release_and_close
        jobs.subscription_factory = controlled_subscribe

    def lose_intent_ack(session: Session) -> None:
        if armed["value"] and any(isinstance(item, Job) and item.cancel_requested for item in session.identity_map.values()):
            armed["value"], armed["fired"] = False, True
            raise OperationalError("External durable cancellation intent acknowledgement loss", None, RuntimeError("Provider ack lost"))

    with cancellation_peer(tmp_path, monkeypatch) as (url, receipt, registry):
        settings = Settings(data_dir=tmp_path / "application", runtime_mode="comfyui", runtime_url=url, runtime_evidence_path=receipt)
        with TestClient(create_app(settings, registry=registry,configure_jobs=hold_source_loss)) as client, httpx.Client(base_url=url, trust_env=False) as peer, ExitStack() as cleanup:
            cleanup.callback(allow_loss.set)
            def assert_two_time_observation(intent,current):
                expected_keys=set(JobRead.model_fields)
                assert intent.keys()==current.keys()==expected_keys
                JobRead.model_validate(intent)
                JobRead.model_validate(current)
                assert intent["phase"]=="preparing" and current["phase"] is None
                assert intent["progress"] is None and current["progress"] is None
                for value in (intent,current):
                    assert value["status"]=="running" and value["cancel_requested"] is True and value["recovery_required"] is True
                    assert value["result"] is None and value["error"] is None
                assert {key:value for key,value in intent.items() if key not in {"phase","updated_at"}} == {key:value for key,value in current.items() if key not in {"phase","updated_at"}}
                assert datetime.fromisoformat(intent["updated_at"])<=datetime.fromisoformat(current["updated_at"])
            project = client.post("/projects", json={"name": "Morning song"}).json()
            base = "/projects/" + project["id"]
            reference = client.post(base + "/assets", files={"file": ("reference.wav", reference_audio())}).json()
            submitted = client.post(base + "/transcriptions", json={"reference_asset_id": reference["id"]}).json()
            address = base + "/jobs/" + submitted["id"]
            original = wait_running(client, address)
            assert loss_seen.wait(timeout=5),"The actual native source-loss event did not reach its owned gate"
            with client.websocket_connect(address + "/events") as websocket:
                assert websocket.receive_json()["job"]["status"] == "running"
                event.listen(Session, "after_commit", lose_intent_ack)
                try:
                    armed["value"] = True
                    unconfirmed = client.post(address + "/cancel")
                finally:
                    event.remove(Session, "after_commit", lose_intent_ack)
                assert unconfirmed.status_code == 503 and armed["fired"]
                assert unconfirmed.json()["error"]["resource_id"] == submitted["id"]
                intent_frame = websocket.receive_json()
                assert intent_frame.keys()==set(JobEventRead.model_fields)
                JobEventRead.model_validate(intent_frame)
                assert intent_frame["type"]=="job.updated" and intent_frame["sequence"]>=0
                intent = intent_frame["job"]
                immutable=("id","project_id","operation","inputs","provenance","created_at")
                assert {key:intent[key] for key in immutable}=={key:original[key] for key in immutable}
                allow_loss.set()
                deadline=time.monotonic()+5
                while True:
                    current = client.get(address).json()
                    if current["phase"] is None:
                        break
                    assert time.monotonic()<deadline,current
                    threading.Event().wait(.01)
                assert_two_time_observation(intent,current)
                # The allowed phase transition must not hide changed ownership or intent.
                wrong_fields=({"id":"00000000-0000-4000-8000-000000000001"},{"project_id":"00000000-0000-4000-8000-000000000002"},
                              {"cancel_requested":False},{"recovery_required":False},{"provenance":{"foreign":True}},
                              {"inputs":{"foreign":True}},{"result":{"unexpected":"result"}},{"progress":.25},{"phase":"transcribing"})
                for wrong in wrong_fields:
                    with pytest.raises(AssertionError):
                        assert_two_time_observation(intent,{**current,**wrong})
                missing_key=dict(current)
                del missing_key["operation"]
                with pytest.raises(AssertionError):
                    assert_two_time_observation(intent,missing_key)
                assert peer.get("/facts").json()["target_states"]["native-1"] == "running"
                assert client.post(address + "/cancel").status_code in {200, 202}
                while True:
                    cancelled = websocket.receive_json()["job"]
                    assert cancelled["id"] == submitted["id"]
                    if cancelled["status"] in {"completed", "failed", "cancelled"}:
                        break
                    assert cancelled["cancel_requested"] is True and cancelled["recovery_required"] is True
                assert cancelled == client.get(address).json()
                assert cancelled["status"] == "cancelled" and cancelled["recovery_required"] is False
                assert cancelled["inputs"] == original["inputs"] and cancelled["provenance"] == original["provenance"]
            with client.websocket_connect(address + "/events") as websocket:
                assert websocket.receive_json()["job"] == cancelled
            assert peer.get("/facts").json()["foreign_state"] == "running"
            assert peer.get("/accepted").json()["count"] == 1
            (tmp_path/"two-time-observation.json").write_text(json.dumps({"intent_ws":intent,"later_http":current,"terminal":cancelled,
                "native_facts":peer.get("/facts").json(),"native_accepted":1,"wrong_core_controls_rejected":len(wrong_fields)+1}),encoding="utf-8")
            assert client.get(base + "/assets/" + reference["id"] + "/content").content == reference_audio()
            peer.post("/control", json={"action": "finish_survivor"}).raise_for_status()
