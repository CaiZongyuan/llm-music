"""A saved Cover's owning Version can become a distinct new GFS branch origin."""

import hashlib
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from music_api.config import Settings
from music_api.main import create_app
from test_cover import SELECTED
from test_generate_from_score import source_version
from test_generation_versions import INPUTS, wait_job


@pytest.mark.parametrize("edit", [False, True], ids=["owned-score", "independently-saved-edit"])
def test_branch_from_saved_cover_owner_preserves_older_origin_forest_and_bytes(tmp_path: Path, edit: bool) -> None:
    settings = Settings(data_dir=tmp_path, runtime_mode="fake")
    with TestClient(create_app(settings)) as client:
        project = client.post("/projects", json={"name": "Morning branches"}).json()
        base = "/projects/" + project["id"]
        original = source_version(client, base)
        reference = client.post(base + "/reference-audio/from-version", json={"source_version_id": original["id"]}).json()
        transcribed = client.post(base + "/transcriptions", json={"reference_asset_id": reference["id"]}).json()
        complete = wait_job(client, project["id"], transcribed["id"])
        assert complete["status"] == "completed", complete
        selected = client.post(base + "/scores", json={"abc": SELECTED, "source_score_id": complete["result"]["score_id"]}).json()
        cover_inputs = dict(INPUTS, abc=SELECTED, source_score_id=selected["id"], parent_version_id=original["id"],
                            reference_asset_id=reference["id"], mode="full", mode_transform_version="1.0.0", max_seconds=35,
                            effective_abc_sha256=hashlib.sha256(SELECTED.encode()).hexdigest())
        submitted = client.post(base + "/jobs/cover", json=cover_inputs)
        assert submitted.status_code == 202, submitted.text
        complete = wait_job(client, project["id"], submitted.json()["id"])
        assert complete["status"] == "completed", complete
        cover = client.post(base + "/versions", json={"candidate_id": complete["result"]["candidate_id"], "name": "V2 full harmony"}).json()
        output = client.get(base + "/scores/" + cover["score_id"]).json()
        assert cover["parent_version_id"] == original["id"]
        assert output["parent_version_id"] == original["id"]
        independent = source_version(client, base)
        assert independent["parent_version_id"] is None
        prior_versions = client.get(base + "/versions").json()
        origin = client.get(base + "/assets/" + reference["id"] + "/reference-origin").json()
        old_bytes = {asset["id"]: client.get(base + "/assets/" + asset["id"] + "/content").content
                     for asset in client.get(base + "/assets").json()}

        abc = SELECTED.replace("C4 D4 E4 G4", "G4 A4 B4 c4") if edit else SELECTED
        source = output
        if edit:
            saved = client.post(base + "/scores", json={"abc": abc, "source_score_id": output["id"], "parent_version_id": cover["id"]})
            assert saved.status_code == 201, saved.text
            source = saved.json()
            assert source["parent_version_id"] == cover["id"]
        inputs = dict(INPUTS, abc=abc, source_score_id=source["id"], parent_version_id=cover["id"], max_seconds=35)
        submitted = client.post(base + "/jobs/generate-from-score", json=inputs)
        assert submitted.status_code == 202, submitted.text
        complete = wait_job(client, project["id"], submitted.json()["id"])
        assert complete["status"] == "completed", complete
        assert complete["inputs"] == inputs
        candidate = client.get(base + "/candidates/" + complete["result"]["candidate_id"]).json()
        assert candidate["inputs"] == inputs
        assert client.get(base + "/versions").json() == prior_versions
        intent = {"candidate_id": candidate["id"], "name": "V3 from saved full harmony"}
        saved = client.post(base + "/versions", json=intent)
        assert saved.status_code == 201, saved.text
        child = saved.json()
        assert child["parent_version_id"] == cover["id"]
        assert child["inputs"] == inputs
        repeated = client.post(base + "/versions", json=intent)
        assert repeated.status_code == 200
        assert repeated.json() == child
        changed = client.post(base + "/versions", json={**intent, "parent_version_id": original["id"]})
        assert changed.status_code == 409
        assert changed.json()["error"]["code"] == "source_parent_mismatch"

    with TestClient(create_app(settings)) as client:
        versions = client.get(base + "/versions").json()
        assert versions == [*prior_versions, child]
        for version in prior_versions:
            assert client.get(base + "/versions/" + version["id"]).json() == version
        assert client.get(base + "/scores/" + output["id"]).json() == output
        assert client.get(base + "/assets/" + reference["id"] + "/reference-origin").json() == origin
        for asset_id, data in old_bytes.items():
            assert client.get(base + "/assets/" + asset_id + "/content").content == data
