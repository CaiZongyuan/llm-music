"""Owned native-shaped CPU peer retains accepted work across API process restarts."""
from contextlib import contextmanager
from dataclasses import replace
from datetime import datetime, timezone
import hashlib
from pathlib import Path
import time

import httpx

import evidence_fixture
from evidence_fixture import bound_evidence, write_registry_fixture
from native_event_peer import PEER_SOURCE
from music_api.runtime_evidence import ModelFingerprint, ModelReceipt
from music_api.workflow_registry import WorkflowRegistry

EDIT = '''
from datetime import datetime, timezone
import time
uploads = []
bad_upload = False
unavailable = False
slow_history = False
foreign_descriptor = False
extra_history = {}
malformed_queue = False
delay_ack = False
read_delay = 0
native_reads = []
@app.post("/fixture/edit")
async def edit(request: Request):
    global bad_upload,unavailable,slow_history,foreign_descriptor,malformed_queue,delay_ack,read_delay
    value = await request.json()
    if value["action"] == "wrong_graph":
        for item in native.values():
            item["graph"][item["core"]]["class_type"] = "ForeignGraph"
    elif value["action"] in {"failed","cancelled"}:
        for item in native.values():
            item["complete"],item["outcome"] = True,value["action"]
    elif value["action"] == "bad_upload":
        bad_upload = True
    elif value["action"] == "missing_history":
        for item in native.values(): item["hidden"] = True
    elif value["action"] == "unavailable":
        unavailable = True
    elif value["action"] == "slow_history":
        slow_history = True
    elif value["action"] == "foreign_descriptor":
        foreign_descriptor = True
    elif value["action"] == "wrong_client":
        for item in native.values(): item["client"] = "foreign-owner"
    elif value["action"] == "duplicate":
        item = next(iter(native.values()))
        extra_history["duplicate-handle"] = history("duplicate-handle",item)
    elif value["action"] == "malformed":
        malformed_queue = True
    elif value["action"] == "queued":
        for item in native.values(): item["queued"] = True
    elif value["action"] == "delay_ack":
        delay_ack = True
    elif value["action"] == "read_delay":
        read_delay = value["seconds"]
    return {"accepted":len(native)}

@app.middleware("http")
async def readonly_availability(request,call_next):
    tracked = request.method == "GET" and (request.url.path == "/queue" or request.url.path.startswith("/history"))
    if not tracked:
        return await observed_read(request,call_next)
    observation = {"path":request.url.path,"began_at":datetime.now(timezone.utc).isoformat(),"begin_clock":time.monotonic()}
    try:
        return await observed_read(request,call_next)
    finally:
        observation.update(finished_at=datetime.now(timezone.utc).isoformat(),end_clock=time.monotonic())
        native_reads.append(observation)
        with Path(sys.argv[1]).with_suffix(".native-reads.jsonl").open("a",encoding="utf-8") as output:
            output.write(json.dumps(observation)+"\\n")

async def observed_read(request,call_next):
    if read_delay and (request.url.path == "/queue" or request.url.path.startswith("/history")):
        await asyncio.sleep(read_delay)
    if malformed_queue and request.url.path == "/queue":
        return Response(json.dumps({"queue_running":[["opaque"]],"queue_pending":[]}),media_type="application/json")
    if slow_history and request.url.path.startswith("/history/"):
        await asyncio.sleep(2)
    if unavailable and (request.url.path == "/queue" or request.url.path.startswith("/history")):
        return Response(status_code=503)
    return await call_next(request)

@app.get("/api/jobs/{handle}")
def native_status(handle):
    item = native[handle]
    return {"id":handle,"status":item.get("outcome","completed" if item["complete"] else "running")}
'''

@contextmanager
def recovery_peer(tmp_path: Path, monkeypatch):
    source = PEER_SOURCE.replace('@app.get("/{path:path}")', EDIT + '\n@app.get("/{path:path}")')
    source = source.replace('"frames":len(frames)}', '"frames":len(frames),"jobs":{handle:{"graph":item["graph"],"client":item["client"],"complete":item["complete"]} for handle,item in native.items()}}')
    source = source.replace('if item["complete"] else {}','if item["complete"] and not item.get("hidden") else {}')
    source = source.replace('if item["complete"]}', 'if item["complete"] and not item.get("hidden")}')
    source = source.replace('if not item["complete"]]', 'if not item["complete"] and not item.get("hidden")]')
    source = source.replace('if not item["complete"] and not item.get("hidden")],"queue_pending":[]',
                            'if not item["complete"] and not item.get("hidden") and not item.get("queued")],"queue_pending":[[0,handle,item["graph"],{"client_id":item["client"]},[]] for handle,item in native.items() if not item["complete"] and item.get("queued")]')
    source = source.replace('return {"prompt_id":handle}', 'if delay_ack: await asyncio.sleep(3)\n    return {"prompt_id":handle}')
    source = source.replace('return {handle:history(handle,item) for handle,item in native.items() if item["complete"] and not item.get("hidden")}',
                            'return {**extra_history,**{handle:history(handle,item) for handle,item in native.items() if item["complete"] and not item.get("hidden")}}')
    source = source.replace('"jobs":{handle:', '"uploads":uploads,"jobs":{handle:')
    source = source.replace('await incoming.read()\n    return {"name":incoming.filename,"subfolder":str(form["subfolder"]),"type":"input"}',
                            'body = await incoming.read()\n    descriptor = {"name":incoming.filename,"subfolder":str(form["subfolder"]),"type":"input"}\n    uploads.append({**descriptor,"size_bytes":len(body),"sha256":__import__("hashlib").sha256(body).hexdigest()})\n    return {**descriptor,"subfolder":"foreign"} if bad_upload else descriptor')
    source = source.replace('"status":{"status_str":"success","completed":True,"messages":[]}',
                            '"status":({"status_str":"error","completed":False,"messages":[["execution_interrupted" if item["outcome"] == "cancelled" else "execution_error",{"prompt_id":handle,"exception_type":"ValueError","exception_message":"Owned CPU failure"}]]} if item.get("outcome") else {"status_str":"success","completed":True,"messages":[]})')
    source = source.replace('return {"prompt":[0,handle',
                            'if item["generate"] and foreign_descriptor: outputs["3"]["audio"][0]["subfolder"] = "foreign/output"\n    return {"prompt":[0,handle')
    monkeypatch.setattr(evidence_fixture, "PEER_SOURCE", source)
    with bound_evidence(tmp_path) as (url, requirements, receipt, receipt_path, _, _):
        model_requirement = replace(requirements.models[0], id="yue2-bf16", name="Owned CPU fixture, no model inference",
                                    filename="checkpoints/yue2_3b_bf16.safetensors", local_path="checkpoints/yue2_3b_bf16.safetensors")
        model = receipt.models_root / model_requirement.local_path
        model.parent.mkdir(parents=True)
        model.write_bytes(b"abc")
        facts, now = model.stat(), datetime.now(timezone.utc)
        evidence = ModelReceipt(id=model_requirement.id, state="ready", revision=model_requirement.revision, checked_at=now,
                                actual_sha256=hashlib.sha256(model.read_bytes()).hexdigest(), actual_size_bytes=facts.st_size,
                                fingerprint=ModelFingerprint(resolved_path=model.resolve(), size_bytes=facts.st_size, mtime_ns=facts.st_mtime_ns))
        requirements = replace(requirements, models=(*requirements.models, model_requirement))
        receipt = receipt.model_copy(update={"checked_at":now,"models":[*receipt.models,evidence]})
        receipt_path.write_text(receipt.model_dump_json(), encoding="utf-8")
        registry_root = tmp_path / "registry"
        write_registry_fixture(registry_root, requirements)
        with httpx.Client(base_url=url,trust_env=False) as client:
            deadline = time.monotonic() + 10
            while True:
                try:
                    if client.get("/fixture/state").status_code == 200:
                        break
                except httpx.TransportError:
                    pass
                assert time.monotonic() < deadline
                time.sleep(0.02)
        yield url, receipt_path, WorkflowRegistry(registry_root)
