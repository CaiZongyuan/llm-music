"""Run from the repository root with the independent API project's Python."""

import argparse
import json
from pathlib import Path
import time

import httpx


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate an unsaved Candidate or explicitly save one as a Version.")
    parser.add_argument("command", choices=["generate", "save"])
    parser.add_argument("--url", default="http://127.0.0.1:8000")
    parser.add_argument("--project-id")
    parser.add_argument("--style")
    parser.add_argument("--lyrics-file", type=Path)
    parser.add_argument("--seed", type=int, default=2026192201)
    parser.add_argument("--output-dir", type=Path)
    parser.add_argument("--candidate-id")
    parser.add_argument("--name")
    parser.add_argument("--parent-version-id")
    args = parser.parse_args()
    if args.command == "generate" and (not args.style or not args.lyrics_file or not args.output_dir):
        parser.error("generate requires --style, --lyrics-file, and --output-dir")
    if args.command == "save" and (not args.project_id or not args.candidate_id or not args.name):
        parser.error("save requires --project-id, --candidate-id, and --name")
    if args.command == "generate" and args.output_dir.exists():
        parser.error("use a new output directory to preserve previous downloads")
    with httpx.Client(base_url=args.url, timeout=15) as client:
        project_id = args.project_id
        if args.command == "generate":
            if project_id is None:
                response = client.post("/projects", json={"name": "Morning song"})
                response.raise_for_status()
                project_id = response.json()["id"]
            base = "/projects/" + project_id
            inputs = {"style": args.style, "lyrics": args.lyrics_file.read_text(encoding="utf-8"), "seed": args.seed}
            response = client.post(base + "/jobs/generate", json=inputs)
            response.raise_for_status()
            job_id = response.json()["id"]
            deadline = time.monotonic() + 180
            while True:
                response = client.get(base + "/jobs/" + job_id)
                response.raise_for_status()
                job = response.json()
                if job["status"] in {"completed", "failed", "cancelled"}:
                    break
                if time.monotonic() >= deadline:
                    raise RuntimeError("Wait expired; inspect Project " + project_id + " Job " + job_id + " before retrying.")
                time.sleep(0.2)
            if job["status"] != "completed":
                raise RuntimeError(json.dumps(job, ensure_ascii=False))
            response = client.get(base + "/candidates/" + job["result"]["candidate_id"])
            response.raise_for_status()
            candidate = response.json()
            args.output_dir.mkdir(parents=True)
            for name, asset_id in [("audio.flac", candidate["audio_asset_id"]), ("score.abc", candidate["output_snapshot"]["score"]["abc_asset_id"])]:
                response = client.get(base + "/assets/" + asset_id + "/content")
                response.raise_for_status()
                (args.output_dir / name).write_bytes(response.content)
            value = {"project_id": project_id, "candidate": candidate, "output_dir": str(args.output_dir)}
        else:
            intent = {"candidate_id": args.candidate_id, "name": args.name, "parent_version_id": args.parent_version_id}
            response = client.post("/projects/" + project_id + "/versions", json=intent)
            response.raise_for_status()
            value = {"project_id": project_id, "version": response.json()}
        print(json.dumps(value, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
