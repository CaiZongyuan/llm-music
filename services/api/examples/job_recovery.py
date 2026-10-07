"""Read the same Job after API restart; retry only when explicitly requested."""

import argparse
import json
import math
from pathlib import Path
import time
from uuid import UUID

import httpx


def positive_seconds(value: str) -> float:
    seconds = float(value)
    if not math.isfinite(seconds) or seconds <= 0:
        raise argparse.ArgumentTypeError("seconds must be positive and finite")
    return seconds


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["inspect", "wait", "retry"])
    parser.add_argument("--url", default="http://127.0.0.1:8000")
    parser.add_argument("--project-id", type=UUID, required=True)
    parser.add_argument("--job-id", type=UUID, required=True)
    parser.add_argument("--wait-seconds", type=positive_seconds, default=330)
    parser.add_argument("--output-dir", type=Path)
    args = parser.parse_args()
    if args.output_dir is not None and (args.command == "retry" or args.output_dir.exists()):
        parser.error("downloads require inspect/wait and a new output directory")
    route = f"/projects/{args.project_id}/jobs/{args.job_id}"
    deadline = time.monotonic() + args.wait_seconds
    with httpx.Client(base_url=args.url, timeout=10, trust_env=False) as client:
        if args.command == "retry":
            # One explicit POST. A lost response never causes a repeated attempt.
            response = client.post(route + "/retry")
            response.raise_for_status()
            print(json.dumps(response.json(), indent=2, ensure_ascii=False))
            return
        while True:
            try:
                response = client.get(route)
                response.raise_for_status()
                job = response.json()
            except httpx.TransportError:
                if args.command != "wait" or time.monotonic() >= deadline:
                    raise
            else:
                if args.command == "inspect" or job["status"] in {"completed", "failed", "cancelled"}:
                    break
            if time.monotonic() >= deadline:
                raise TimeoutError("Wait expired. Inspect the same Project/Job before any new attempt.")
            time.sleep(min(0.2, max(0, deadline - time.monotonic())))
        if args.output_dir is not None:
            if job["status"] != "completed":
                raise RuntimeError("Outputs are unavailable: " + json.dumps(job, ensure_ascii=False))
            args.output_dir.mkdir(parents=True)
            for role in ("audio", "abc", "midi"):
                identifier = job["result"].get(role + "_asset_id")
                if identifier is None:
                    continue
                asset_route = f"/projects/{args.project_id}/assets/{identifier}"
                metadata = client.get(asset_route)
                metadata.raise_for_status()
                content = client.get(asset_route + "/content")
                content.raise_for_status()
                (args.output_dir / (role + "." + metadata.json()["format"])).write_bytes(content.content)
        print(json.dumps(job, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
