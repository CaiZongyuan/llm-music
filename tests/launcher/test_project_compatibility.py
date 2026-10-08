"""Public pinned-project comparator; no environment, model or service mutation."""

import hashlib
from pathlib import Path
import sys

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from dev import check_runtime_project_files, LaunchError


def test_checkout_line_endings_match_but_dependency_and_configuration_changes_refuse(tmp_path):
    pinned = Path(__file__).resolve().parents[2] / "runtime/comfyui"
    names = ["pyproject.toml", "uv.lock", "runtime.json", "models.json"]
    original = {name: (pinned / name).read_bytes() for name in names}
    for ending in [b"\n", b"\r\n"]:
        for name, content in original.items():
            (tmp_path / name).write_bytes(content.replace(b"\r\n", b"\n").replace(b"\n", ending))
        before = {name: (tmp_path / name).read_bytes() for name in names}
        check_runtime_project_files(tmp_path)
        assert {name: (tmp_path / name).read_bytes() for name in names} == before
        for name, previous, changed in [("pyproject.toml", b'torch==2.10.0', b'torch==2.10.1'),
                                        ("uv.lock", b'2.10.0+cu130', b'2.10.1+cu130'),
                                        ("runtime.json", b'"port": 8188', b'"port": 8189'),
                                        ("models.json", b'"schema_version": 1', b'"schema_version": 2')]:
            assert previous in before[name]
            (tmp_path / name).write_bytes(before[name].replace(previous, changed))
            with pytest.raises(LaunchError, match=name.replace(".", r"\.")):
                check_runtime_project_files(tmp_path)
            (tmp_path / name).write_bytes(before[name])
        check_runtime_project_files(tmp_path)
    assert {name: (pinned / name).read_bytes() for name in names} == original
    # Provenance stays the actual file-byte hash; comparison normalizes nothing on disk.
    assert hashlib.sha256((pinned / "uv.lock").read_bytes()).hexdigest() == hashlib.sha256(original["uv.lock"]).hexdigest()
