"""Inspect, request cancellation, or explicitly create one new application Job."""

import argparse
import json
import math
from pathlib import Path
import time

import httpx


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["inspect", "cancel", "retry"])
    parser.add_argument("--url", default="http://127.0.0.1:8000")
    parser.add_argument("--project-id", required=True)
    parser.add_argument("--job-id", required=True)
    parser.add_argument("--wait-seconds", type=float, default=0, help="Read-only polling budget; zero returns the initial response")
    parser.add_argument("--output", type=Path, help="New result file; existing snapshots are preserved")
    args = parser.parse_args()
    if not math.isfinite(args.wait_seconds) or args.wait_seconds < 0 or args.wait_seconds > 1800:
        parser.error("wait-seconds must be between 0 and 1800")
    if args.output is not None and args.output.exists():
        parser.error("use a new output file")
    address = "/projects/" + args.project_id + "/jobs/" + args.job_id
    with httpx.Client(base_url=args.url, timeout=60, trust_env=False) as client:
        response = client.get(address) if args.command == "inspect" else client.post(address + "/" + args.command)
        value = {"http_status": response.status_code, "response": response.json()}
        if response.is_success and args.command != "inspect" and args.wait_seconds:
            deadline = time.monotonic() + args.wait_seconds
            job = value["response"]
            address = "/projects/" + args.project_id + "/jobs/" + job["id"]
            while job["status"] in {"queued", "running"}:
                if time.monotonic() >= deadline:
                    value["wait_expired"] = True
                    break
                time.sleep(min(0.2, max(0, deadline - time.monotonic())))
                read = client.get(address)
                read.raise_for_status()
                job = read.json()
                value["response"] = job
        text = json.dumps(value, indent=2, ensure_ascii=False) + "\n"
        if args.output is not None:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            with args.output.open("x", encoding="utf-8") as target:
                target.write(text)
        print(text, end="")
        if not response.is_success:
            raise SystemExit(1)


if __name__ == "__main__":
    main()
