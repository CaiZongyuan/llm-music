"""Real HTTP wire behavior of the adapter against an owned CPU native peer."""

from pathlib import Path
import pytest
from fastapi.testclient import TestClient

import evidence_fixture
from evidence_fixture import bound_evidence, write_registry_fixture
from music_api.config import Settings
from music_api.main import create_app
from music_api.workflow_registry import WorkflowRegistry
from test_transcription import ABC, reference_audio, terminal


NATIVE_EXTENSION = '''
import base64
native = {}
abc = "X:1\\nM:4/4\\nL:1/4\\nK:C\\nC D E F |\\n"
midi = b'MThd\\x00\\x00\\x00\\x06\\x00\\x00\\x00\\x01\\x01\\xe0MTrk\\x00\\x00\\x00\\x0d\\x00\\x90\\x3c\\x40\\x83\\x60\\x80\\x3c\\x00\\x00\\xff\\x2f\\x00'
class NativeHandler(Handler):
    def reply(self, payload):
        body = json.dumps(payload).encode()
        self.send_response(200); self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
    def do_GET(self):
        if self.path == "/accepted": self.reply({"count":len(native)}); return
        if self.path.startswith("/history/"):
            handle = self.path.split("/")[-1]
            self.reply({handle:native[handle]} if handle in native else {})
        elif self.path == "/history": self.reply(native)
        else: super().do_GET()
    def do_POST(self):
        raw = self.rfile.read(int(self.headers["Content-Length"]))
        if self.path == "/upload/image":
            self.reply({"name":"uploaded.wav", "subfolder":"input", "type":"input"}); return
        body = json.loads(raw)
        if self.path == "/prompt":
            handle = "native-" + str(len(native) + 1)
            native[handle] = {"prompt":[0,handle,body["prompt"],{"client_id":body["client_id"]},[]],"outputs":{"score":{"text":[abc]}},"status":{"status_str":"success","completed":True,"messages":[]}}
            self.reply({"prompt_id":handle})
        elif self.path == "/yue2/score/read":
            self.reply({"sheet":{"cut":False,"seconds":2,"bars":[{}],"notes":{"Vocal":[{"pitch":60,"length":1}]}}})
        elif self.path == "/yue2/score/midi": self.reply({"data":base64.b64encode(midi).decode()})
        elif self.path == "/yue2/midi/tracks": self.reply({"parts":[{"notes":1}]})
        else: self.send_error(404)
'''


def test_native_http_transcription_imports_both_outputs_through_the_application(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    source = evidence_fixture.PEER_SOURCE.replace('server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)', NATIVE_EXTENSION + '\nserver = ThreadingHTTPServer(("127.0.0.1", 0), NativeHandler)')
    monkeypatch.setattr(evidence_fixture, "PEER_SOURCE", source)
    (tmp_path / "peer").mkdir()
    with bound_evidence(tmp_path / "peer") as (url, requirements, receipt, receipt_path, model, writes):
        fixture_root = tmp_path / "registry"
        write_registry_fixture(fixture_root, requirements)
        registry = WorkflowRegistry(fixture_root)
        configured = Settings(data_dir=tmp_path / "application-comfy-fixture", runtime_mode="comfyui", runtime_url=url, runtime_evidence_path=receipt_path)
        with TestClient(create_app(configured, registry=registry)) as client:
            project = client.post("/projects", json={"name":"Morning song"}).json()
            base = "/projects/" + project["id"]
            reference = client.post(base + "/assets", files={"file":("reference.wav",reference_audio())}).json()
            submitted = client.post(base + "/transcriptions", json={"reference_asset_id":reference["id"]})
            assert submitted.status_code == 202, submitted.text
            job = terminal(client, base + "/jobs/" + submitted.json()["id"])
            assert job["status"] == "completed", job
            assert client.get(base + "/assets/" + job["result"]["abc_asset_id"] + "/content").content == ABC
            midi = client.get(base + "/assets/" + job["result"]["midi_asset_id"] + "/content").content
            assert midi[:14] == b"MThd\x00\x00\x00\x06\x00\x00\x00\x01\x01\xe0"
            assert "native-1" not in str(job)


def test_native_accept_then_lost_ack_does_not_silently_resubmit_or_claim_nonexecution(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    extension = NATIVE_EXTENSION.replace('self.reply({"prompt_id":handle})', 'self.connection.shutdown(2); self.connection.close()')
    source = evidence_fixture.PEER_SOURCE.replace('server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)', extension + '\nserver = ThreadingHTTPServer(("127.0.0.1", 0), NativeHandler)')
    monkeypatch.setattr(evidence_fixture, "PEER_SOURCE", source)
    (tmp_path / "peer").mkdir()
    with bound_evidence(tmp_path / "peer") as (url, requirements, receipt, receipt_path, model, writes):
        fixture_root = tmp_path / "registry"
        write_registry_fixture(fixture_root, requirements)
        registry = WorkflowRegistry(fixture_root)
        configured = Settings(data_dir=tmp_path / "application", runtime_mode="comfyui", runtime_url=url, runtime_evidence_path=receipt_path)
        with TestClient(create_app(configured, registry=registry)) as client:
            project = client.post("/projects", json={"name":"Morning song"}).json()
            base = "/projects/" + project["id"]
            reference = client.post(base + "/assets", files={"file":("reference.wav",reference_audio())}).json()
            created = client.post(base + "/transcriptions", json={"reference_asset_id":reference["id"]}).json()
            job = terminal(client, base + "/jobs/" + created["id"])
            assert job["status"] == "failed"
            assert job["recovery_required"] is True
            assert job["error"]["code"] == "submission_unconfirmed"
            assert "may have been accepted" in job["error"]["message"]
            assert job["result"] is None
            from urllib.request import urlopen
            import json
            with urlopen(url + "/accepted", timeout=2) as response:
                assert json.loads(response.read())["count"] == 1
            for _ in range(3):
                assert client.get(base + "/jobs/" + created["id"]).json() == job
            with urlopen(url + "/accepted", timeout=2) as response:
                assert json.loads(response.read())["count"] == 1
