"""Watch one application Job over WS, then recover its persistent state by HTTP."""

import argparse
from datetime import datetime, timezone
import json
import math
from pathlib import Path
import time
from urllib.parse import urlsplit, urlunsplit
from uuid import UUID

import httpx
from websockets.exceptions import ConnectionClosed
from websockets.sync.client import connect


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8000")
    parser.add_argument("--project-id", required=True, type=UUID)
    parser.add_argument("--job-id", required=True, type=UUID)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--disconnect-after-first", action="store_true", help="Close WS after its initial snapshot and prove HTTP recovery")
    parser.add_argument("--wait-seconds", type=float, default=180)
    arguments = parser.parse_args()
    if arguments.output.exists() or not math.isfinite(arguments.wait_seconds) or arguments.wait_seconds <= 0:
        parser.error("Use a new output file and a positive wait window")
    address = urlsplit(arguments.url)
    if address.scheme != "http" or address.hostname not in {"127.0.0.1", "localhost", "::1"} or address.username or address.password:
        parser.error("Use the configured local HTTP application address")
    path = f"/projects/{arguments.project_id}/jobs/{arguments.job_id}"
    websocket_url = urlunsplit(("ws", address.netloc, path + "/events", "", ""))
    began = datetime.now(timezone.utc)
    deadline = time.monotonic() + arguments.wait_seconds
    messages, websocket_outcome = [], "initializing"
    try:
        with connect(websocket_url, proxy=None, open_timeout=5, close_timeout=1, max_size=1024 * 1024) as websocket:
            while True:
                value = json.loads(websocket.recv(timeout=max(0.01, deadline - time.monotonic())))
                messages.append(value)
                job = value["job"]
                print(json.dumps({"status": job["status"], "phase": job["phase"], "progress": job["progress"]}))
                if arguments.disconnect_after_first:
                    websocket_outcome = "deliberately disconnected after initial snapshot"
                    break
                if job["status"] in {"completed", "failed", "cancelled"}:
                    websocket_outcome = "terminal snapshot received"
                    break
    except (ConnectionClosed, TimeoutError, OSError):
        websocket_outcome = "subscription unavailable; HTTP recovery required"
    with httpx.Client(base_url=arguments.url, timeout=10, trust_env=False) as client:
        while True:
            response = client.get(path)
            response.raise_for_status()
            recovered = response.json()
            if recovered["status"] in {"completed", "failed", "cancelled"}:
                break
            if time.monotonic() >= deadline:
                break
            time.sleep(min(0.2, max(0, deadline - time.monotonic())))
    arguments.output.parent.mkdir(parents=True, exist_ok=True)
    with arguments.output.open("x", encoding="utf-8") as output:
        json.dump({"started_at": began.isoformat(), "finished_at": datetime.now(timezone.utc).isoformat(),
                   "websocket_outcome": websocket_outcome, "events": messages, "http_job": recovered}, output, indent=2)
        output.write("\n")
    print("Saved domain events and HTTP recovery. Keep this same application Job id if it still needs confirmation.")


if __name__ == "__main__":
    main()
