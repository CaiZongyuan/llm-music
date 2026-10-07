"""Identified fixture observations exercise the same subscription and close contract."""

from collections.abc import Callable
import logging
import threading

from music_api.runtime_types import RuntimeStatus


log = logging.getLogger("music_api")


def subscribe_fake(current_status: Callable[[], RuntimeStatus], on_status: Callable[[RuntimeStatus], None]) -> Callable[[], None]:
    stopped = threading.Event()

    def run() -> None:
        previous = None
        try:
            while not stopped.is_set():
                value = current_status()
                if value != previous:
                    on_status(value if value.state == "running" else RuntimeStatus("unconfirmed"))
                    previous = value
                if value.state in {"completed", "failed", "cancelled"}:
                    return
                stopped.wait(0.01)
        except Exception:
            if not stopped.is_set():
                log.exception("Fixture subscription unavailable", extra={"event": "fake_subscription_lost"})
                on_status(RuntimeStatus("unconfirmed", code="native_event_source_lost"))

    thread = threading.Thread(target=run, daemon=True, name="fake-domain-events")
    thread.start()

    def close() -> None:
        stopped.set()
        thread.join(timeout=2)

    return close
