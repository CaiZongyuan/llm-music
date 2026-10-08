"""A real shipped 0005 SQLite graph upgrades through public reads and new work."""

import io
from pathlib import Path
import subprocess
import tarfile

from test_generate_from_score import SELECTED_ABC, source_version
from test_generation_versions import INPUTS, wait_job
from test_lifecycle import server
from test_transcription import reference_audio


BASELINE = "711df508dd0edead070f4345a7b23eb9c6834e77"


def test_actual_0005_generate_transcribe_and_branched_versions_upgrade_without_changing_public_history(tmp_path: Path) -> None:
    baseline = tmp_path / "baseline"
    baseline.mkdir()
    repository = Path(__file__).resolve().parents[3]
    archive = subprocess.check_output(["git", "-C", str(repository), "archive", BASELINE,
        "services/api/src", "workflows", "runtime/comfyui/runtime.json", "runtime/comfyui/models.json", "runtime/comfyui/workflows"])
    with tarfile.open(fileobj=io.BytesIO(archive)) as content:
        content.extractall(baseline, filter="data")
    data = tmp_path / "application"
    with server(data, tmp_path / "old-api.log", source_root=baseline / "services/api/src") as client:
        project = client.post("/projects", json={"name": "Morning song"}).json()
        base = "/projects/" + project["id"]
        original = source_version(client, base)
        job = wait_job(client, project["id"], client.post(base + "/jobs/generate", json=dict(INPUTS, seed=2026410001)).json()["id"])
        branch = client.post(base + "/versions", json={"candidate_id": job["result"]["candidate_id"], "name": "Existing branch", "parent_version_id": original["id"]})
        assert branch.status_code == 201
        reference = client.post(base + "/assets", files={"file": ("reference.wav", reference_audio())}).json()
        transcription = client.post(base + "/transcriptions", json={"reference_asset_id": reference["id"]}).json()
        assert wait_job(client, project["id"], transcription["id"])["status"] == "completed"
        history = {route: client.get(base + "/" + route).json() for route in ("assets", "scores", "jobs", "candidates", "versions")}
        original_bytes = {asset["id"]: client.get(base + "/assets/" + asset["id"] + "/content").content for asset in history["assets"]}
        assert client.post(base + "/jobs/generate-from-score", json={}).status_code == 405
    with server(data, tmp_path / "upgraded-api.log") as client:
        assert client.get(base).json() == project
        for route, expected in history.items():
            assert client.get(base + "/" + route).json() == expected
        inputs = dict(INPUTS, abc=SELECTED_ABC, source_score_id=original["score_id"], parent_version_id=original["id"])
        submitted = client.post(base + "/jobs/generate-from-score", json=inputs)
        assert submitted.status_code == 202, submitted.text
        job = wait_job(client, project["id"], submitted.json()["id"])
        assert job["status"] == "completed", job
        save = {"candidate_id": job["result"]["candidate_id"], "name": "Selected morning"}
        saved = client.post(base + "/versions", json=save)
        assert saved.status_code == 201
        assert saved.json()["parent_version_id"] == original["id"]
        assert client.post(base + "/versions", json=save).json() == saved.json()
        for identifier, expected in original_bytes.items():
            assert client.get(base + "/assets/" + identifier + "/content").content == expected
    with server(data, tmp_path / "reopened-api.log") as client:
        assert client.get(base + "/jobs/" + job["id"]).json() == job
        assert client.get(base + "/versions/" + saved.json()["id"]).json() == saved.json()
        for version in history["versions"]:
            assert client.get(base + "/versions/" + version["id"]).json() == version
