"""The public read-only source boundary uses actual owned CPU identity/layout facts."""

from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import subprocess
import sys

import pytest

from evidence_fixture import bound_evidence, write_registry_fixture
from music_api.runtime_evidence import RuntimeReceipt, publish_receipt, read_runtime_evidence


def test_current_bound_source_preserves_verified_hash_without_loading_gpu(tmp_path: Path) -> None:
    with bound_evidence(tmp_path) as (url, requirements, receipt, receipt_path, _, _):
        evidence = read_runtime_evidence(receipt_path, runtime_url=url, now=datetime.now(timezone.utc),
                                         max_age_seconds=300, requirements=requirements)
        assert evidence.binding_verified is True
        assert evidence.models[0].state == "ready"
        assert evidence.models[0].sha256 == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        assert evidence.models[0].checked_at == receipt.models[0].checked_at


@pytest.mark.parametrize("scenario,code", [
    ("foreign_url", "runtime_evidence_identity_mismatch"),
    ("reused_pid", "runtime_process_identity_changed"),
    ("changed_fingerprint", "model_fingerprint_changed"),
    ("missing_file", "model_missing"),
    ("invalid_hash", "model_hash_invalid"),
    ("resaved_stale", "runtime_evidence_stale"),
    ("foreign_revision", "runtime_evidence_revision_mismatch"),
    ("foreign_mode", "runtime_evidence_invalid"),
])
def test_current_authorization_rejects_changed_or_foreign_source(tmp_path: Path, scenario: str, code: str) -> None:
    with bound_evidence(tmp_path) as (url, requirements, receipt, receipt_path, model, _):
        data = json.loads(receipt.model_dump_json())
        if scenario == "foreign_url":
            data["runtime_url"] = "http://127.0.0.1:1"
        elif scenario == "reused_pid":
            data["process"]["create_time"] -= 1
        elif scenario == "changed_fingerprint":
            model.write_bytes(b"different fixture bytes")
        elif scenario == "missing_file":
            model.unlink()
        elif scenario == "invalid_hash":
            data["models"][0]["actual_sha256"] = "0" * 64
        elif scenario == "resaved_stale":
            old = (datetime.now(timezone.utc) - timedelta(seconds=600)).isoformat()
            data["checked_at"] = old
            data["models"][0]["checked_at"] = old
        elif scenario == "foreign_revision":
            data["runtime_revision"] = "0" * 40
        else:
            data["mode"] = "fake"
        receipt_path.write_text(json.dumps(data), encoding="utf-8")
        evidence = read_runtime_evidence(receipt_path, runtime_url=url, now=datetime.now(timezone.utc),
                                         max_age_seconds=300, requirements=requirements)
        codes = [*evidence.reasons, *(reason for item in evidence.models for reason in item.reasons)]
        assert code in codes
        assert not evidence.binding_verified or evidence.models[0].state != "ready"
        if scenario != "foreign_mode":
            assert evidence.models[0].checked_at == datetime.fromisoformat(data["models"][0]["checked_at"].replace("Z", "+00:00"))
            assert evidence.models[0].sha256 == data["models"][0]["actual_sha256"]


def test_owner_refresh_command_rehashes_and_publishes_a_new_source_receipt(tmp_path: Path) -> None:
    with bound_evidence(tmp_path) as (url, requirements, receipt, _, _, _):
        write_registry_fixture(tmp_path, requirements)
        output = tmp_path / "fresh-owner-receipt.json"
        started = datetime.now(timezone.utc)
        result = subprocess.run([sys.executable, "-m", "music_api.runtime_evidence", "collect", "--runtime-url", url,
                                 "--pid", str(receipt.process.pid), "--repository-root", str(tmp_path), "--output", str(output)],
                                capture_output=True, text=True, encoding="utf-8", timeout=15)
        assert result.returncode == 0, result.stderr
        assert output.is_file()
        collected = RuntimeReceipt.model_validate_json(output.read_bytes())
        assert collected.checked_at >= started
        assert collected.models[0].checked_at >= started
        assert collected.models[0].actual_sha256 == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        assert collected.models[0].actual_size_bytes == 3
        assert collected.process.pid == receipt.process.pid
        assert "argv" not in json.loads(output.read_bytes())["process"]
        assert "environment" not in json.loads(output.read_bytes())

        previous_bytes = output.read_bytes()
        refreshed = subprocess.run([sys.executable, "-m", "music_api.runtime_evidence", "collect", "--runtime-url", url,
                                    "--pid", str(receipt.process.pid), "--repository-root", str(tmp_path), "--output", str(output)],
                                   capture_output=True, text=True, encoding="utf-8", timeout=15)
        assert refreshed.returncode == 0, refreshed.stderr
        latest = RuntimeReceipt.model_validate_json(output.read_bytes())
        assert latest.checked_at > collected.checked_at
        archive = list(tmp_path.glob("fresh-owner-receipt.previous.*.json"))
        assert len(archive) == 1
        assert archive[0].read_bytes() == previous_bytes


def test_owner_refresh_refuses_to_overwrite_an_unrelated_output(tmp_path: Path) -> None:
    with bound_evidence(tmp_path) as (url, requirements, receipt, _, _, _):
        write_registry_fixture(tmp_path, requirements)
        output = tmp_path / "foreign.json"
        original = b"an unrelated owner file"
        output.write_bytes(original)
        result = subprocess.run([sys.executable, "-m", "music_api.runtime_evidence", "collect", "--runtime-url", url,
                                 "--pid", str(receipt.process.pid), "--repository-root", str(tmp_path), "--output", str(output)],
                                capture_output=True, text=True, encoding="utf-8", timeout=15)
        assert result.returncode == 1
        assert output.read_bytes() == original
        assert not list(tmp_path.glob("foreign.previous.*.json"))


def test_receipt_replacement_failure_retains_original_time_and_evidence(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    import os
    with bound_evidence(tmp_path) as (_, _, receipt, output, _, _):
        original = output.read_bytes()
        actual_replace = os.replace

        def denied(source, target, *args, **kwargs):
            if Path(target) == output:
                raise PermissionError("Injected owner receipt replacement denial")
            return actual_replace(source, target, *args, **kwargs)

        monkeypatch.setattr(os, "replace", denied)
        with pytest.raises(PermissionError):
            publish_receipt(receipt.model_copy(update={"checked_at": datetime.now(timezone.utc)}), output)
        assert output.read_bytes() == original
        assert RuntimeReceipt.model_validate_json(output.read_bytes()).checked_at == receipt.checked_at
        assert not list(tmp_path.glob("*.receipt.part"))


def test_refresh_refuses_a_valid_receipt_for_another_runtime(tmp_path: Path) -> None:
    with bound_evidence(tmp_path) as (_, _, receipt, output, _, _):
        other = receipt.model_copy(update={"runtime_url": "http://127.0.0.1:1"})
        output.write_text(other.model_dump_json(), encoding="utf-8")
        original = output.read_bytes()
        with pytest.raises(ValueError):
            publish_receipt(receipt, output)
        assert output.read_bytes() == original
        assert not list(tmp_path.glob("owner-receipt.previous.*.json"))
