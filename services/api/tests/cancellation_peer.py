"""An owned CPU native peer makes target cancellation and survivor outcomes observable."""

from contextlib import contextmanager
from pathlib import Path

import evidence_fixture
from evidence_fixture import bound_evidence, write_registry_fixture
from music_api.workflow_registry import WorkflowRegistry
from test_native_transcription import NATIVE_EXTENSION


CANCELLATION_EXTENSION = '''
live = {}
current = None
foreign_state = "queued"
foreign_row = [1, "foreign-survivor", {}, {"client_id":"foreign-owner"}, []]
class CancellationHandler(NativeHandler):
    def do_GET(self):
        if self.path == "/queue":
            rows = [native[current]["prompt"]] if current in live else [foreign_row] if current == "foreign-survivor" else []
            self.reply({"queue_running":rows, "queue_pending":[foreign_row] if foreign_state == "queued" else []})
        elif self.path == "/facts":
            self.reply({"foreign_state":foreign_state, "target_states":{key:live.get(key, value["status"]["status_str"]) for key,value in native.items()}})
        elif self.path.startswith("/history/"):
            handle = self.path.split("/")[-1]
            self.reply({handle:native[handle]} if handle in native and handle not in live else {})
        elif self.path == "/history": self.reply({key:value for key,value in native.items() if key not in live})
        elif self.path.startswith("/api/jobs/"):
            handle = self.path.split("/")[-1]
            entry = native.get(handle)
            state = live.get(handle, "cancelled" if entry and entry["status"]["status_str"] == "error" else "completed")
            self.reply({"id":handle,"status":state})
        else: super().do_GET()
    def do_POST(self):
        global current, foreign_state
        if self.path == "/prompt":
            body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            handle = "native-" + str(len(native) + 1)
            native[handle] = {"prompt":[0,handle,body["prompt"],{"client_id":body["client_id"]},[]],"outputs":{"score":{"text":[abc]}},"status":{"status_str":"success","completed":True,"messages":[]}}
            if len(native) == 1:
                live[handle] = "running"
                current = handle
            self.reply({"prompt_id":handle})
        elif self.path.startswith("/api/jobs/") and self.path.endswith("/cancel"):
            self.rfile.read(int(self.headers["Content-Length"]))
            handle = self.path.split("/")[-2]
            dispatched = handle == current and handle in live
            if dispatched:
                del live[handle]
                native[handle]["status"] = {"status_str":"error","completed":False,"messages":[["execution_interrupted",{"prompt_id":handle}]]}
                current, foreign_state = "foreign-survivor", "running"
            self.reply({"cancelled":dispatched})
        elif self.path == "/interrupt":
            self.rfile.read(int(self.headers["Content-Length"]))
            if current == "foreign-survivor": foreign_state = "cancelled"
            elif current in live:
                del live[current]
                native[current]["status"] = {"status_str":"error","completed":False,"messages":[]}
            self.reply({})
        elif self.path == "/control":
            body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            if body["action"] == "finish_survivor":
                foreign_state, current = "completed", None
            self.reply({"foreign_state":foreign_state})
        else: super().do_POST()
'''


@contextmanager
def cancellation_peer(tmp_path: Path, monkeypatch):
    source = evidence_fixture.PEER_SOURCE.replace(
        'server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)',
        NATIVE_EXTENSION + CANCELLATION_EXTENSION + '\nserver = ThreadingHTTPServer(("127.0.0.1", 0), CancellationHandler)')
    monkeypatch.setattr(evidence_fixture, "PEER_SOURCE", source)
    (tmp_path / "peer").mkdir()
    with bound_evidence(tmp_path / "peer") as (url, requirements, receipt, receipt_path, model, writes):
        fixture_root = tmp_path / "registry"
        write_registry_fixture(fixture_root, requirements)
        yield url, receipt_path, WorkflowRegistry(fixture_root)
