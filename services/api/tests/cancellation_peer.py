"""An owned CPU native peer makes target cancellation and survivor outcomes observable."""

from contextlib import contextmanager
from pathlib import Path

import evidence_fixture
from evidence_fixture import bound_evidence, write_registry_fixture
from music_api.workflow_registry import WorkflowRegistry
from test_native_transcription import NATIVE_EXTENSION


CANCELLATION_EXTENSION = '''
live = {}
removed = set()
scenario = "running"
current = None
foreign_state = "queued"
foreign_row = [1, "foreign-survivor", {}, {"client_id":"foreign-owner"}, []]
class CancellationHandler(NativeHandler):
    def do_GET(self):
        if self.path == "/queue":
            rows = [native[current]["prompt"]] if current in live else [foreign_row] if current == "foreign-survivor" else []
            pending = [native[key]["prompt"] for key,state in live.items() if state == "queued"]
            self.reply({"queue_running":rows, "queue_pending":pending + ([foreign_row] if foreign_state == "queued" else [])})
        elif self.path == "/facts":
            self.reply({"foreign_state":foreign_state, "target_states":{key:"removed_pending" if key in removed else live.get(key, value["status"]["status_str"]) for key,value in native.items()}})
        elif self.path == "/accepted-attempts":
            self.reply([entry["prompt"][3]["client_id"] for entry in native.values()])
        elif self.path.startswith("/history/"):
            handle = self.path.split("/")[-1]
            self.reply({handle:native[handle]} if handle in native and handle not in live and handle not in removed else {})
        elif self.path == "/history": self.reply({key:value for key,value in native.items() if key not in live and key not in removed})
        elif self.path.startswith("/api/jobs/"):
            handle = self.path.split("/")[-1]
            entry = native.get(handle)
            state = live.get(handle, "cancelled" if entry and entry["status"]["status_str"] == "error" else "completed")
            self.reply({"id":handle,"status":state})
        else: super().do_GET()
    def do_POST(self):
        global current, foreign_state, scenario
        if self.path == "/prompt":
            body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            handle = "native-" + str(len(native) + 1)
            native[handle] = {"prompt":[0,handle,body["prompt"],{"client_id":body["client_id"]},[]],"outputs":{"score":{"text":[abc]}},"status":{"status_str":"success","completed":True,"messages":[]}}
            if len(native) == 1:
                pending_scenario = scenario in {"queued", "queued_to_running"}
                live[handle] = "queued" if pending_scenario else "running"
                current = "foreign-survivor" if pending_scenario else handle
                if pending_scenario: foreign_state = "running"
            self.reply({"prompt_id":handle})
        elif self.path == "/queue":
            body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            for handle in body.get("delete", []):
                if live.get(handle) == "queued":
                    if scenario == "queued_to_running":
                        live[handle], current, foreign_state = "running", handle, "completed"
                    else:
                        del live[handle]
                        removed.add(handle)
            self.reply({})
        elif self.path.startswith("/api/jobs/") and self.path.endswith("/cancel"):
            self.rfile.read(int(self.headers["Content-Length"]))
            handle = self.path.split("/")[-2]
            dispatched = handle == current and handle in live
            if dispatched and scenario != "delayed_confirmation":
                del live[handle]
                native[handle]["status"] = {"status_str":"error","completed":False,"messages":[["execution_interrupted",{"prompt_id":handle}]]}
                current = "foreign-survivor" if foreign_state == "queued" else None
                if foreign_state == "queued": foreign_state = "running"
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
            elif body["action"] == "scenario": scenario = body["value"]
            elif body["action"] == "confirm_cancellation":
                handle = "native-1"
                live.pop(handle, None)
                native[handle]["status"] = {"status_str":"error","completed":False,"messages":[["execution_interrupted",{"prompt_id":handle}]]}
                current, foreign_state = "foreign-survivor", "running"
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
