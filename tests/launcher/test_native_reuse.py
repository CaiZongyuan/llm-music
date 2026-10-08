"""CPU orchestration seam: production run/signatures/HTTP with external test peers.

Doctor, CUDA/native worker and model collection are replaced at their boundary.
This proves receipt/configuration reuse; it is not native readiness evidence.
"""

import argparse
from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import time
from urllib.request import urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from dev import Launcher, LaunchError, read_json, write_json, identity, signature
from test_dev_launcher import ports, stop_fixture, assert_no_listeners


def test_native_auto_then_fresh_path_reuses_services_without_renewing_old_proof(tmp_path):
    chosen = ports()
    source = tmp_path / "peer.py"
    source.write_text('''import json,os,pathlib,sys,time
from datetime import datetime,timezone
from http.server import BaseHTTPRequestHandler,HTTPServer
from urllib.request import urlopen
config=json.loads(pathlib.Path(sys.argv[1]).read_text())
pathlib.Path(sys.argv[1]+'.pid').write_text(str(os.getpid()))
class Handler(BaseHTTPRequestHandler):
 def do_GET(self):
  if config['service']=='runtime': value={'system':{'scope':'CPU orchestration fixture'}}
  elif config['service']=='web':
   if self.path=='/': self.send_response(200);self.end_headers();self.wfile.write(b'<div id="root"></div>');return
   with urlopen(config['api_url']+'/health') as response: value=json.load(response)
  else:
   proof=json.loads(pathlib.Path(config['runtime_evidence']).read_text())
   ready=(datetime.now(timezone.utc)-datetime.fromisoformat(proof['checked_at'])).total_seconds()<300
   value={'backend':{'status':'ready'},'runtime':{'mode':'comfyui','ready':ready,'reasons':[]},'proof_time':proof['checked_at']}
  self.send_response(200);self.end_headers();self.wfile.write(json.dumps(value).encode())
HTTPServer(('127.0.0.1',config['port']),Handler).serve_forever()
''', encoding="utf-8")
    peers = {}
    originals = []
    api_project = Path(__file__).resolve().parents[2] / "services/api"
    old_time = (datetime.now(timezone.utc) - timedelta(seconds=5)).isoformat()

    class CpuOrchestration(Launcher):
        def start(self, expected, deadline):
            role = expected["service"]
            path = tmp_path / f"{role}-peer.json"
            write_json(path, expected)
            process = subprocess.Popen([sys.executable, str(source), str(path)], cwd=tmp_path,
                                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            originals.append(process)
            pid_file = Path(str(path) + ".pid")
            while not pid_file.exists():
                assert process.poll() is None and time.monotonic() < deadline
                time.sleep(0.02)
            owner = identity(int(pid_file.read_text()))
            record = dict(identity=expected, signature=signature(expected), process=owner, session="external-cpu-peer-owner")
            if role == "api":
                record["native_binding"] = self.native_binding
            while time.monotonic() < deadline:
                try:
                    with urlopen(f"http://127.0.0.1:{expected['port']}/health", timeout=1):
                        break
                except OSError:
                    time.sleep(0.02)
            peers[role] = record
            write_json(self.record_path(role, expected["port"]), record)
            self.receipt["services"].append(dict(record, owned=False))
            return record

        def native_evidence(self, record, deadline):
            if self.args.runtime_evidence is None and record is not None:
                self.args.runtime_evidence = self.folder / "auto-evidence.json"
                write_json(self.args.runtime_evidence, dict(process=peers["runtime"]["process"], checked_at=old_time))
            path = self.args.runtime_evidence or self.evidence_slot
            value = read_json(path)
            if value["process"] != peers["runtime"]["process"] or (datetime.now(timezone.utc) - datetime.fromisoformat(value["checked_at"])).total_seconds() > 300:
                raise LaunchError("CPU evidence boundary refused wrong native/stale source")
            self.native_receipt = value
            self.native_binding = dict(process=value["process"], runtime_project=str(api_project),
                                       lock_sha256=hashlib.sha256((api_project / "uv.lock").read_bytes()).hexdigest())

        def save(self):
            super().save()
            if self.receipt["status"] == "ready":
                Path(self.stop_config["stop_file"]).write_text(self.session)

    def instance(evidence=None, data=None):
        return CpuOrchestration(argparse.Namespace(mode="comfyui", state_dir=tmp_path / "state", data_dir=data or tmp_path / "data",
            api_port=chosen[0], web_port=chosen[1], runtime_port=chosen[2], runtime_url=f"http://127.0.0.1:{chosen[2]}",
            runtime_project=api_project, runtime_root=tmp_path / "native", models_root=tmp_path / "models",
            runtime_state_root=tmp_path / "runtime-state", runtime_evidence=evidence, timeout=10, open=False))

    try:
        first = instance()
        assert first.run() == 0
        first_pids = {key: value["process"]["pid"] for key, value in peers.items()}
        original = read_json(first.args.runtime_evidence)
        assert original["checked_at"] == old_time
        # Expire the active proof, then supply a genuinely fresh source at a new
        # GUID-style path. The original immutable source must stay unchanged.
        expired = dict(original, checked_at=(datetime.now(timezone.utc) - timedelta(seconds=600)).isoformat())
        write_json(first.evidence_slot, expired)
        fresh = dict(original, checked_at=datetime.now(timezone.utc).isoformat())
        new_path = tmp_path / "fresh-different-guid.json"
        write_json(new_path, fresh)
        second = instance(new_path)
        assert second.run() == 0
        assert all(not value["owned"] for value in second.receipt["services"])
        assert {key: value["process"]["pid"] for key, value in peers.items()} == first_pids
        assert read_json(second.evidence_slot) == fresh
        assert read_json(first.args.runtime_evidence) == original
        # An identical no-path invocation consumes only the still-current slot.
        assert instance().run() == 0
        for invalid in [expired, dict(fresh, process=dict(fresh["process"], pid=999999))]:
            invalid_path = tmp_path / "bad-receipt.json"
            write_json(invalid_path, invalid)
            assert instance(invalid_path).run() == 1
            assert read_json(first.evidence_slot) == fresh
        assert instance(new_path, tmp_path / "different-data").run() == 1
        assert read_json(first.evidence_slot) == fresh
        with urlopen(f"http://127.0.0.1:{chosen[0]}/health") as response:
            assert json.load(response)["proof_time"] == fresh["checked_at"]
        assert all(process.poll() is None for process in originals)
    finally:
        for process in reversed(originals):
            stop_fixture(process)
    assert_no_listeners(chosen)
