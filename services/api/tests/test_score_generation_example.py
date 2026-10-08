"""The documented selected-score CLI runs against a real isolated CPU API."""

import json
from pathlib import Path
import subprocess
import sys

from test_generate_from_score import SELECTED_ABC, source_version
from test_lifecycle import server


def test_documented_selected_score_command_downloads_unsaved_candidate_and_preserves_source_parent(tmp_path: Path) -> None:
    abc, lyrics = tmp_path / "selected.abc", tmp_path / "lyrics.txt"
    abc.write_text(SELECTED_ABC, encoding="utf-8")
    lyrics.write_text("[Verse]\nMorning gathers on the window", encoding="utf-8")
    example = Path(__file__).parents[1] / "examples/generate_save.py"
    with server(tmp_path / "application", tmp_path / "example-api.log") as client:
        project = client.post("/projects", json={"name": "Morning song"}).json()
        base = "/projects/" + project["id"]
        parent = source_version(client, base)
        command = [sys.executable, str(example), "from-score", "--url", str(client.base_url), "--project-id", project["id"],
                   "--source-score-id", parent["score_id"], "--parent-version-id", parent["id"], "--abc-file", str(abc),
                   "--style", "gentle folk pop", "--lyrics-file", str(lyrics), "--seed", "2026410001", "--output-dir", str(tmp_path / "download")]
        result = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", timeout=20)
        assert result.returncode == 0, result.stderr
        candidate = json.loads(result.stdout)["candidate"]
        assert candidate["inputs"]["abc"] == SELECTED_ABC
        assert (tmp_path / "download/score.abc").read_bytes() == SELECTED_ABC.encode()
        assert (tmp_path / "download/audio.flac").read_bytes().startswith(b"fLaC")
        assert client.get(base + "/versions").json() == [parent]
        saved = subprocess.run([sys.executable, str(example), "save", "--url", str(client.base_url), "--project-id", project["id"],
            "--candidate-id", candidate["id"], "--name", "Selected morning"], capture_output=True, text=True, encoding="utf-8", timeout=20)
        assert saved.returncode == 0, saved.stderr
        version = json.loads(saved.stdout)["version"]
        assert version["parent_version_id"] == parent["id"]
        assert version["inputs"] == candidate["inputs"]
