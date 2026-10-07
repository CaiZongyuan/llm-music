"""An actual isolated WS peer sends pinned binary frames to the Runtime boundary."""

from dataclasses import asdict
import json
from queue import Queue
import threading
from uuid import uuid4

from websockets.sync.server import serve
import pytest

from music_api.native_events import subscribe_native
from music_api.runtime_types import RuntimeRequest, RuntimeStatus
from music_api.workflow_registry import WorkflowRegistry


@pytest.mark.parametrize("invalidate", [
    json.dumps({"type": "execution_start", "data": {"prompt_id": "foreign-B"}}),
    json.dumps({"type": "executing", "data": {"prompt_id": "owned-A", "node": None}}),
    b"\x00\x00\x00\x03\x00\x00\x00\x05\x32",
    bytes.fromhex("000000030000000132ff"),
    bytes.fromhex("00000003000000013957726974696e67207468652073636f7265"),
    bytes.fromhex("000000030000000132556e6b6e6f776e2063617074696f6e"),
], ids=["foreign-start", "owned-node-finished", "truncated-text", "invalid-utf8", "unknown-node", "unknown-caption"])
def test_owned_native_binary_caption_becomes_domain_phase_and_invalid_context_cannot_reuse_it(invalidate: str | bytes) -> None:
    outgoing: Queue[str | bytes | None] = Queue()
    observed: list[RuntimeStatus] = []
    composing = threading.Event()

    def peer(connection) -> None:
        while True:
            value = outgoing.get(timeout=5)
            if value is None:
                return
            connection.send(value)

    def receive(value: RuntimeStatus) -> None:
        observed.append(value)
        if value.phase == "generating_semantic":
            composing.set()

    with serve(peer, "127.0.0.1", 0) as server:
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        port = server.socket.getsockname()[1]
        request = RuntimeRequest(uuid4(), "Generate", {})
        close = subscribe_native(f"http://127.0.0.1:{port}", "owned-A", request, WorkflowRegistry().workflow("Generate"),
                                 receive, 2, lambda: RuntimeStatus("running"))
        try:
            outgoing.put(json.dumps({"type": "execution_start", "data": {"prompt_id": "owned-A"}}))
            outgoing.put(json.dumps({"type": "executing", "data": {"prompt_id": "owned-A", "node": "2"}}))
            # Independent pinned literal: uint32 TEXT=3, uint32 node length=1,
            # UTF-8 node "2", then the plugin's exact stage caption.
            outgoing.put(bytes.fromhex("00000003000000013257726974696e67207468652073636f7265"))
            outgoing.put(json.dumps({"type": "progress", "data": {"prompt_id": "owned-A", "node": "2", "value": 80, "max": 100}}))
            outgoing.put(invalidate)
            outgoing.put(bytes.fromhex("00000003000000013257726974696e67207468652073636f7265"))
            outgoing.put(json.dumps({"type": "execution_start", "data": {"prompt_id": "owned-A"}}))
            outgoing.put(json.dumps({"type": "executing", "data": {"prompt_id": "owned-A", "node": "2"}}))
            outgoing.put(bytes.fromhex("000000030000000132436f6d706f73696e67"))
            assert composing.wait(timeout=5), "Owned native caption did not reach the domain subscription"
            phases = [asdict(value) for value in observed if value.phase is not None]
            assert [value["phase"] for value in phases] == ["planning_score", "generating_semantic"]
            assert all(value["progress"] is None for value in phases)
            assert "owned-A" not in json.dumps(phases) and "foreign-B" not in json.dumps(phases)
            assert "prompt_id" not in json.dumps(phases) and "node_id" not in json.dumps(phases)
        finally:
            close()
            outgoing.put(None)
        server.shutdown()
        thread.join(timeout=5)
        assert not thread.is_alive()
