"""Offline report for this fixed P0 protocol; it cannot authorize the P0 gate."""

import json


CASES = ["transcription", "generation", "queue", "queued_cancel", "running_cancel", "history", "repeat", "cleanup"]


def render(run_dir, output, prior_root=None, assessment_path=None):
    record = json.loads((run_dir / "report.json").read_text(encoding="utf-8"))
    items = record.get("items", [])
    cases = {case: dict(status="unverified", reason="Actual evidence is missing") for case in CASES}
    if record.get("evidence_kind") == "real" and prior_root:
        sources = [("15-real/run-01/receipt.json", ["transcription"]), ("16-real/baseline/report.json", ["generation"]),
                   ("17-real/run-01/report.json", ["queue", "queued_cancel", "history"]),
                   ("18-real/run-01/report.json", ["running_cancel"])]
        for relative, names in sources:
            path = prior_root / relative
            if not path.is_file():
                continue
            value = json.loads(path.read_text(encoding="utf-8"))
            actual = value.get("evidence_kind") == "real"
            if relative.startswith("15-"):
                command = prior_root / "15-real/command-receipt.json"
                log = prior_root / "15-real/service-evidence/first-transcription-log.txt"
                actual = command.is_file() and log.is_file() and json.loads(command.read_text(encoding="utf-8")).get("exitCode") == 0
            passed = actual and value.get("status") == "completed" and value.get("verified", relative.startswith("16-")) is True
            status = "passed" if passed else "failed" if value.get("status") == "failed" else "unverified"
            for name in names:
                cases[name] = dict(status=status, evidence=str(path.resolve()), reason="Retained root actual receipt; does not count toward the new ten items")
    ten = [item for item in items if item.get("role") == "repeat"]
    completed = len(ten) == 10 and all(item.get("status") == "completed" for item in ten)
    if record.get("evidence_kind") == "real" and completed:
        cases["repeat"] = dict(status="unverified", observations_complete=True,
                               reason="Ten outputs alone cannot prove stability; root must assess raw idle/growth/retention and unknowns")
    elif record.get("evidence_kind") == "real" and record.get("status") == "failed":
        cases["repeat"] = dict(status="failed", reason=record.get("error", "Series failed"))
    g5 = next((item for item in items if item.get("label") == "G5"), {})
    witnesses = [next((item for item in items if item.get("label") == label), {}) for label in ["G5-after-free", "T6-after-free"]]
    cleanup_proved = (record.get("cleanup", {}).get("witness_verified") is True and len(witnesses) == 2
                      and all(item.get("status") == "completed" and item.get("core_uncached") is True and item.get("log_proof", {}).get("verified") is True for item in witnesses)
                      and g5.get("core_fingerprint") is not None and witnesses[0].get("core_fingerprint") == g5["core_fingerprint"])
    if record.get("evidence_kind") == "real" and record.get("status") == "completed" and cleanup_proved:
        cases["cleanup"] = dict(status="passed", reason="One /free acknowledgement followed by exact uncached G5 and new T6 with valid outputs and reload/stage evidence; not complete memory-zero proof")
    if assessment_path:
        assessment = json.loads(assessment_path.read_text(encoding="utf-8"))
        measured = all(item.get("memory", {}).get(scope, {}).get("sample_count", 0) > 0
                       and all(item["memory"][scope].get("memory", {}).get(field, {}).get("last") is not None
                               for field in ["device_vram_used_bytes", "runtime_torch_allocator_allocated_bytes", "runtime_rss_bytes"])
                       for item in ten for scope in ["active", "idle"])
        if (record.get("evidence_kind") != "real" or not completed or assessment.get("run_id") != record.get("run_id")
                or assessment.get("status") not in ["passed", "failed", "unverified"] or not assessment.get("rationale")
                or not assessment.get("evidence") or (assessment.get("status") == "passed" and (assessment.get("unexplained_growth") is not False or not measured))):
            raise ValueError("Assessment cannot promote fake/incomplete/mismatched data or unexplained growth to stability")
        cases["repeat"] = dict(status=assessment["status"], observations_complete=True, root_assessment=assessment)
    summary = dict(schema_version=1, run_id=record.get("run_id"), cases=cases, p0_passed=False,
                   final_gate="Root PM owns actual evidence/review/CI/integration decision; this harness never unlocks P1",
                   trend_review=record.get("trend_review", {"state": "unverified"}))
    output.mkdir(parents=True, exist_ok=True)
    (output / "runtime-report.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    lines = ["# P0 Runtime report", "", "P0 gate remains unpassed by this tool. Root makes the integrated delivery decision.", "", "| Case | Status | Evidence / reason |", "| --- | --- | --- |"]
    lines += [f"| {name} | {item['status']} | {item.get('evidence', item.get('reason', 'Root assessment'))} |" for name, item in cases.items()]
    (output / "runtime-report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    benchmark = ["# Fixed-workload observations", "", "Inputs/seeds differ by the frozen plan. No performance improvement or cold-server comparison is claimed.", "",
                 "| Item | Operation / scope | Runtime seconds | Input / output duration seconds | RTF / processing factor |", "| --- | --- | ---: | ---: | ---: |"]
    for item in items:
        timing = item.get("timing", {})
        benchmark.append(f"| {item['label']} | {item['operation']} / {item['role']} | {timing.get('runtime_seconds', 'unavailable')} | {timing.get('denominator_seconds', 'unavailable')} | {timing.get('factor', 'unavailable')} |")
    benchmark += ["", "Generation factor uses fully decoded output audio. Transcription factor uses its 16-second Reference Audio, not Score time. Native timings include Workflow overhead. Stage-exclusive/model-load times remain unavailable where not exposed."]
    (output / "benchmark.md").write_text("\n".join(benchmark) + "\n", encoding="utf-8")
    (output / "known-limitations.md").write_text("# Known limits\n\nSampled peaks are lower bounds. Whole-device and whole-host values include other consumers; WDDM process GPU residency is unavailable. Idle vectors require root assessment; unknown sustained growth cannot pass. Bounded result/song/allocator/OS caches need actual evidence, not budgets alone. One series does not prove indefinite leak freedom, arbitrary music quality or long-song support. Subjective listening is deferred. /free does not delete model, input/output, song files or evidence.\n", encoding="utf-8")
    return summary
