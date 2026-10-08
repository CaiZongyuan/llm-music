"""The actually shipped 0007 graph remains readable when Cover is introduced."""

import io
from pathlib import Path
import subprocess
import tarfile

from test_cover import SELECTED, EFFECTIVE, selected_inputs
from test_generate_from_score import source_version
from test_generation_versions import INPUTS, wait_job
from test_lifecycle import server
from test_transcription import reference_audio


BASELINE = "2c445a51fea92628ea558ddee512b177ab56249f"


def test_actual_0007_graph_upgrades_with_immutable_history_and_cover(tmp_path: Path) -> None:
    baseline = tmp_path / "baseline"
    baseline.mkdir()
    repository = Path(__file__).resolve().parents[3]
    archive = subprocess.check_output(["git", "-C", str(repository), "archive", BASELINE, "services/api/src", "workflows", "runtime/comfyui/runtime.json", "runtime/comfyui/models.json", "runtime/comfyui/workflows"])
    with tarfile.open(fileobj=io.BytesIO(archive)) as content:
        content.extractall(baseline, filter="data")
    data = tmp_path / "application"
    with server(data, tmp_path / "original-api.log", source_root=baseline / "services/api/src") as client:
        project = client.post("/projects", json={"name": "Morning music"}).json()
        base = "/projects/" + project["id"]
        parent = source_version(client, base)
        edited = client.post(base + "/scores", json={"abc": SELECTED, "source_score_id": parent["score_id"], "parent_version_id": parent["id"]})
        assert edited.status_code == 201
        gfs = client.post(base + "/jobs/generate-from-score", json=dict(INPUTS, abc=SELECTED, source_score_id=edited.json()["id"], parent_version_id=parent["id"])).json()
        completed = wait_job(client, project["id"], gfs["id"])
        assert completed["status"] == "completed", completed
        branch = client.post(base + "/versions", json={"candidate_id": completed["result"]["candidate_id"], "name": "Existing edited branch"})
        assert branch.status_code == 201 and branch.json()["parent_version_id"] == parent["id"]
        reference = client.post(base + "/assets", files={"file": ("reference.wav", reference_audio())}).json()
        transcribed = client.post(base + "/transcriptions", json={"reference_asset_id": reference["id"]}).json()
        completed = wait_job(client, project["id"], transcribed["id"])
        assert completed["status"] == "completed", completed
        saved = client.post(base + "/scores", json={"abc": SELECTED, "source_score_id": completed["result"]["score_id"]}).json()
        assert client.post(base + "/jobs/cover", json={}).status_code in {404, 405}
        history = {route: client.get(base + "/" + route).json() for route in ("assets", "scores", "jobs", "candidates", "versions")}
        original_bytes = {asset["id"]: client.get(base + "/assets/" + asset["id"] + "/content").content for asset in history["assets"]}
    with server(data, tmp_path / "upgraded-api.log") as client:
        assert client.get(base).json() == project
        for route, expected in history.items():
            assert client.get(base + "/" + route).json() == expected
        assert client.get(base + "/assets/" + reference["id"] + "/reference-origin").json() is None
        submitted = client.post(base + "/jobs/cover", json=selected_inputs(reference, saved))
        assert submitted.status_code == 202, submitted.text
        job = wait_job(client, project["id"], submitted.json()["id"])
        assert job["status"] == "completed", job
        version = client.post(base + "/versions", json={"candidate_id": job["result"]["candidate_id"], "name": "New Cover"})
        assert version.status_code == 201
        assert client.get(base + "/assets/" + job["result"]["abc_asset_id"] + "/content").text == EFFECTIVE
        for identifier, expected in original_bytes.items():
            assert client.get(base + "/assets/" + identifier + "/content").content == expected
    with server(data, tmp_path / "reopened-api.log") as client:
        assert client.get(base + "/jobs/" + job["id"]).json() == job
        assert client.get(base + "/versions/" + version.json()["id"]).json() == version.json()
        for saved_version in history["versions"]:
            assert client.get(base + "/versions/" + saved_version["id"]).json() == saved_version
