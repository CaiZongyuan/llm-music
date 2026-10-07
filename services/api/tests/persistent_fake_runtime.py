"""External identified Fake fixture state survives real API process restarts."""
import json
from pathlib import Path
import time
from uuid import UUID

from music_api.fake_generation import generation_fixture
from music_api.fake_runtime import FakeInferenceRuntime
from music_api.runtime_types import RuntimeRequest,RuntimeStatus

class PersistentFake(FakeInferenceRuntime):
    def __init__(self,path: Path,registry):
        super().__init__(registry=registry,result_factories={"Generate":generation_fixture})
        self.path = path
        if path.exists():
            for handle,row in json.loads(path.read_text(encoding="utf-8"))["requests"].items():
                self._requests[handle] = (RuntimeRequest(UUID(row["attempt"]),row["operation"],row["inputs"],proof=row["proof"]),time.monotonic())

    def submit(self,request):
        receipt = super().submit(request)
        self.path.parent.mkdir(parents=True,exist_ok=True)
        previous = json.loads(self.path.read_text(encoding="utf-8")) if self.path.exists() else {"requests":{},"completed":False}
        previous["requests"][receipt.handle] = dict(attempt=str(request.attempt_id),operation=request.operation,inputs=dict(request.inputs),proof=dict(request.proof))
        self.path.write_text(json.dumps(previous),encoding="utf-8")
        return receipt

    def status(self,handle):
        state = json.loads(self.path.read_text(encoding="utf-8"))
        return RuntimeStatus("completed") if state["completed"] else RuntimeStatus("running","transcribing")
