"""Pinned native WS captions provide phase evidence, never weighted job percentages."""

from collections.abc import Callable
import json
import logging
import threading
from urllib.parse import urlencode, urlsplit, urlunsplit

from websockets.sync.client import connect
from websockets.sync.connection import Connection

from music_api.runtime_types import Operation, RuntimeRequest, RuntimeStatus
from music_api.workflow_registry import WorkflowDefinition


log = logging.getLogger("music_api")
CAPTIONS: dict[Operation, tuple[tuple[str, str], ...]] = {
    "Transcribe": (("Loading SheetSage2", "loading_model"), ("Listening to the recording", "transcribing"),
                   ("Writing down what it hears:", "transcribing"), ("Transcription reused:", "transcribing")),
    "Generate": (("Loading the ", "loading_model"), ("Reading the repacked checkpoint", "loading_model"),
                 ("Rebuilding the ", "loading_model"), ("Reading the embedded vocabulary", "loading_model"),
                 ("Writing the score", "planning_score"), ("Composing", "generating_semantic"),
                 ("Synthesizing audio", "synthesizing"), ("Decoding audio", "decoding_audio")),
}


class _CaptionContext:
    def __init__(self, handle: str, workflow: WorkflowDefinition, current_status: Callable[[], RuntimeStatus]) -> None:
        self.handle, self.operation, self.current_status = handle, workflow.operation, current_status
        self.core = str(workflow.manifest.get("execution_node", workflow.manifest.get("core_node")))
        self.owned = False
        self.node: str | None = None
        self.last_phase: str | None = None

    def lost(self) -> RuntimeStatus:
        self.owned, self.node, self.last_phase = False, None, None
        return RuntimeStatus("unconfirmed", code="native_event_source_lost")

    def feed(self, frame: str | bytes) -> RuntimeStatus | None:
        if isinstance(frame, str):
            try:
                payload: object = json.loads(frame)
            except ValueError:
                return self.lost()
            if not isinstance(payload, dict) or not isinstance(payload.get("data"), dict):
                return self.lost()
            data = payload["data"]
            kind = payload.get("type")
            if kind in {"execution_start", "executing", "executed", "execution_success", "execution_error", "execution_interrupted", "progress", "progress_state"}:
                prompt = data.get("prompt_id")
                if prompt is not None and prompt != self.handle:
                    return self.lost()
            if kind in {"execution_success", "execution_error", "execution_interrupted", "executed"}:
                self.lost()
                return RuntimeStatus("unconfirmed")
            if kind == "execution_start":
                self.lost()
                self.owned = data.get("prompt_id") == self.handle
                return RuntimeStatus("unconfirmed")
            if kind == "executing":
                node = data.get("node")
                if node is None:
                    self.lost()
                    return RuntimeStatus("unconfirmed")
                # Pinned reconnect sends only node to the attempt-specific clientId.
                if data.get("prompt_id") != self.handle and self.current_status().state != "running":
                    return self.lost()
                self.owned, self.node = True, str(node)
                return None
            # The pinned plugin rescales node/token-budget bars into heuristic
            # shares. Neither progress nor progress_state proves whole-Job ratio.
            return None
        if len(frame) < 8:
            return self.lost()
        if int.from_bytes(frame[:4], "big") != 3:
            return None
        size = int.from_bytes(frame[4:8], "big")
        if size == 0 or size > 256 or len(frame) <= 8 + size:
            return self.lost()
        try:
            node, caption = frame[8:8 + size].decode("utf-8"), frame[8 + size:].decode("utf-8")
        except UnicodeDecodeError:
            return self.lost()
        if not self.owned or node != self.node or node != self.core:
            return self.lost()
        # TEXT is broadcast without prompt identity. The current owned HTTP
        # status also has to confirm running before attributing this caption.
        if self.current_status().state != "running":
            return self.lost()
        phase = next((phase for prefix, phase in CAPTIONS[self.operation] if caption.startswith(prefix)), None)
        if phase is None:
            return self.lost()
        if phase == self.last_phase:
            return None
        self.last_phase = phase
        return RuntimeStatus("running", phase, None)


def subscribe_native(url: str, handle: str, request: RuntimeRequest, workflow: WorkflowDefinition,
                     on_status: Callable[[RuntimeStatus], None], timeout_seconds: float,
                     current_status: Callable[[], RuntimeStatus]) -> Callable[[], None]:
    if request.operation != workflow.operation:
        raise ValueError("Subscription operation differs from its saved request")
    address = urlsplit(url)
    websocket_url = urlunsplit(("ws", address.netloc, "/ws", urlencode({"clientId": str(request.attempt_id)}), ""))
    stopped = threading.Event()
    connection: Connection | None = None
    context = _CaptionContext(handle, workflow, current_status)

    def publish(value: RuntimeStatus) -> None:
        try:
            on_status(value)
        except Exception:
            log.exception("Runtime event consumer unavailable", extra={"event": "native_event_consumer_failed"})

    def run() -> None:
        nonlocal connection
        try:
            with connect(websocket_url, proxy=None, open_timeout=min(timeout_seconds, 2), close_timeout=0.5, max_size=1024 * 1024) as opened:
                connection = opened
                while not stopped.is_set():
                    try:
                        frame = opened.recv(timeout=0.2)
                    except TimeoutError:
                        continue
                    value = context.feed(frame)
                    if value is not None:
                        publish(value)
        except Exception:
            if not stopped.is_set():
                log.exception("Runtime subscription lost; HTTP remains authoritative", extra={"event": "native_subscription_lost"})
        finally:
            connection = None
            if not stopped.is_set():
                publish(context.lost())

    thread = threading.Thread(target=run, daemon=True, name="native-domain-events")
    thread.start()

    def close() -> None:
        stopped.set()
        if connection is not None:
            connection.close()
        thread.join(timeout=min(timeout_seconds + 2, 12))
        if thread.is_alive():
            log.error("Runtime event reader shutdown unconfirmed", extra={"event": "native_subscription_shutdown_unconfirmed"})

    return close
