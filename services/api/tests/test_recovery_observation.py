"""Recovery state uses its verified queue/history pair; result I/O is a later phase."""
from dataclasses import replace
from pathlib import Path
from uuid import uuid4

import httpx

from music_api.comfy_runtime import ComfyUIRuntime
from music_api.config import Settings
from music_api.generation import validate_generation
from music_api.runtime_types import RuntimeRequest
from recovery_peer import recovery_peer


def test_recover_projects_owned_terminal_state_from_only_its_queue_bulk_history_pair(tmp_path: Path,monkeypatch):
    reads = []

    class ObservedRecovery(ComfyUIRuntime):
        def _read(self,path,deadline=None):
            reads.append(path)
            return super()._read(path,deadline)

    with recovery_peer(tmp_path,monkeypatch) as (url,receipt,registry),httpx.Client(base_url=url,trust_env=False) as peer:
        settings = Settings(data_dir=tmp_path/"application",runtime_mode="comfyui",runtime_url=url,runtime_evidence_path=receipt)
        original = ComfyUIRuntime(settings,registry)
        request = RuntimeRequest(uuid4(),"Generate",{"style":"gentle folk pop","lyrics":"Morning gathers on the window","seed":202625054,"max_seconds":35})
        request = replace(request,proof=original.prepare(request))
        submitted = original.submit(request)
        assert submitted.outcome == "accepted" and submitted.handle is not None
        peer.post("/fixture/control",json={"action":"complete"}).raise_for_status()
        restored = ObservedRecovery(settings,registry)
        owned = replace(request,runtime_handle=submitted.handle)
        recovered = restored.recover(owned)
        # The measured phase ends at recover returning, before status/result.
        assert tuple(reads) == ("/queue","/history")
        assert recovered.outcome == "accepted" and recovered.handle == submitted.handle
        assert recovered.status is not None and recovered.status.state == "completed"
        entry = peer.get("/history").json()[submitted.handle]
        assert entry["prompt"][1] == submitted.handle and entry["prompt"][3]["client_id"] == str(request.attempt_id)
        assert entry["prompt"][2]["2"]["inputs"]["style"] == "gentle folk pop"
        expected_audio = peer.get("/view",params=entry["outputs"]["3"]["audio"][0])
        expected_audio.raise_for_status()
        result = restored.result(submitted.handle,"Generate")
        audio = next(item for item in result.artifacts if item.role == "audio")
        abc = next(item for item in result.artifacts if item.role == "abc")
        assert audio.data.startswith(b"fLaC") and b"X:" in abc.data and b"K:" in abc.data
        assert audio.data == expected_audio.content
        assert result.score_validation is not None and result.score_validation["valid"] is True
        assert {material.role for material in validate_generation(result, request.inputs)} == {"abc","audio"}
        peer.post("/fixture/edit",json={"action":"wrong_graph"}).raise_for_status()
        reads.clear()
        rejected = restored.recover(owned)
        assert tuple(reads) == ("/queue","/history")
        assert rejected.outcome == "unconfirmed" and rejected.status is None
        assert peer.get("/fixture/state").json()["accepted"] == 1
