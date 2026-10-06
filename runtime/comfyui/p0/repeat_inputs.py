"""Freeze the concrete P0 series before any Runtime write."""

from array import array
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import sys
import wave

if __package__:
    from .reference_fixture import write_reference
else:
    from reference_fixture import write_reference


PROJECT = Path(__file__).resolve().parents[1]
ROOT = PROJECT.parents[1]
GEN = ROOT / "workflows/generate"
TRANS = PROJECT / "workflows/transcribe-sheetsage2/v1"


def sha256(path):
    with path.open("rb") as handle:
        return hashlib.file_digest(handle, "sha256").hexdigest()


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=True), encoding="utf-8")


def track_mark(path):
    """Pinned PCM16 decoder → planar float32 → rate/sample-byte mark."""
    with wave.open(str(path), "rb") as audio:
        if audio.getsampwidth() != 2 or audio.getcomptype() != "NONE":
            raise ValueError("Track mark requires the frozen PCM16 fixture")
        rate, channels = audio.getframerate(), audio.getnchannels()
        pcm = array("h")
        pcm.frombytes(audio.readframes(audio.getnframes()))
    if sys.byteorder != "little":
        pcm.byteswap()
    planar = array("f", (pcm[index] / 32768 for channel in range(channels) for index in range(channel, len(pcm), channels)))
    if sys.byteorder != "little":
        planar.byteswap()
    body = planar.tobytes()
    digest = hashlib.sha256(str(rate).encode("ascii") + b"\0" + body).hexdigest()[:16]
    return dict(track_mark=digest, decoded_float32_sha256=hashlib.sha256(body).hexdigest(),
                sample_rate=rate, channels=channels, frames=len(pcm) // channels,
                duration_seconds=(len(pcm) // channels) / rate, sha256=sha256(path), bytes=path.stat().st_size,
                decoder_scope="PCM16 scaled by 32768, channel-major float32; compared to actual native yue2_track at execution")


def ledger(directory):
    seeds, marks, receipts = set(), set(), []
    if directory is None:
        return dict(seeds=[], track_marks=[], receipts=[], scope="no prior ledger supplied; real run must supply it")
    for path in sorted(directory.glob("*-real/**/history.json")):
        record = read_json(path)
        prompt = record.get("prompt", [])
        graph = prompt[2] if isinstance(prompt, list) and len(prompt) > 2 and isinstance(prompt[2], dict) else {}
        seeds.update(node["inputs"]["seed"] for node in graph.values() if node.get("class_type") == "YuE2GenerateSong")
        for output in record.get("outputs", {}).values():
            marks.update(output.get("yue2_track", []))
        receipts.append(dict(path=str(path.resolve()), sha256=sha256(path)))
    return dict(seeds=sorted(seeds), track_marks=sorted(marks), receipts=receipts,
                scope="retained actual terminal histories; root also confirms reserved seeds/input conditions")


def prepare(output, ledger_root):
    output.mkdir(parents=True, exist_ok=True)
    if any(output.iterdir()):
        raise ValueError("Prepared directory must be empty; existing evidence is preserved")
    observed = ledger(ledger_root)
    inputs = read_json(GEN / "input.json")
    g_manifest, g_template = read_json(GEN / "manifest.json"), read_json(GEN / "workflow.json")
    t_manifest, t_template = read_json(TRANS / "manifest.json"), read_json(TRANS / "workflow.json")
    jobs = []
    for number in range(1, 7):
        fixture = write_reference(output / f"T{number}.wav", melody_shift=number)
        facts = dict(track_mark(fixture), melody_shift_semitones=number, license="CC0-1.0",
                     source="Original 16-second instrumental; only melody shifted; chords/bass/percussion/timing unchanged",
                     file=fixture.name, generator_sha256=sha256(PROJECT / "p0/reference_fixture.py"))
        if facts["track_mark"] in observed["track_marks"] or any(job["input"].get("track_mark") == facts["track_mark"] for job in jobs):
            raise ValueError("A prepared waveform track mark was previously used; no new GPU claim is allowed")
        t_job = dict(label=f"T{number}" if number <= 5 else "T6-after-free", operation="Transcribe", input=facts,
                     manifest=t_manifest, graph=deepcopy(t_template), core_node=t_manifest["execution_node"],
                     workflow_sha256=sha256(TRANS / "workflow.json"), role="repeat" if number <= 5 else "cleanup_witness")
        if number <= 5:
            jobs.append(t_job)
            seed = 2026190100 + number
            if seed in observed["seeds"]:
                raise ValueError("A planned generation seed already appears in the retained ledger")
            graph = deepcopy(g_template)
            values = dict(inputs, seed=seed)
            for field, binding in g_manifest["input_mapping"].items():
                graph[binding["node"]]["inputs"][binding["input"]] = values[field]
            jobs.append(dict(label=f"G{number}", operation="Generate", input=values, manifest=g_manifest,
                             graph=graph, core_node=g_manifest["core_node"], workflow_sha256=sha256(GEN / "workflow.json"), role="repeat"))
        else:
            replay = deepcopy(jobs[-1])
            replay.update(label="G5-after-free", role="cleanup_witness", exact_replay_of="G5")
            jobs.extend([replay, t_job])
    plan = dict(schema_version=1, protocol="p0-repeat-cleanup-v1", p0_passed=False, jobs=jobs, ledger=observed,
                waveform_scope="six actual melody shifts; not WAV header/name changes", retained_session=True,
                source_sha256={name: sha256(PROJECT / "p0" / name) for name in ["repeat_inputs.py", "reference_fixture.py"]},
                preflight_scope="CPU fixture creation before sampling; filesystem cache uncontrolled")
    write_json(output / "plan.json", plan)
    return plan


def verify_plan(plan, prepared):
    labels = [label for number in range(1, 6) for label in [f"T{number}", f"G{number}"]] + ["G5-after-free", "T6-after-free"]
    if plan.get("protocol") != "p0-repeat-cleanup-v1" or [job.get("label") for job in plan.get("jobs", [])] != labels:
        raise ValueError("Plan does not contain the fixed ten items and two witnesses in order")
    for name, expected in plan["source_sha256"].items():
        if sha256(PROJECT / "p0" / name) != expected:
            raise ValueError("Prepared producer source changed; freeze and prepare a new protocol explicitly")
    inputs = read_json(GEN / "input.json")
    g_template, t_template = read_json(GEN / "workflow.json"), read_json(TRANS / "workflow.json")
    manifests = {"Generate": read_json(GEN / "manifest.json"), "Transcribe": read_json(TRANS / "manifest.json")}
    for job in plan["jobs"]:
        if job["manifest"] != manifests.get(job["operation"]):
            raise ValueError("Frozen manifest differs from its validated source")
        expected = deepcopy(t_template if job["operation"] == "Transcribe" else g_template)
        if job["operation"] == "Generate":
            seed = 2026190105 if job["label"] == "G5-after-free" else 2026190100 + int(job["label"][1:])
            values = dict(inputs, seed=seed)
            if job["input"] != values:
                raise ValueError("Frozen style/lyrics/seed/duration input changed")
            for name, field in job["manifest"]["input_mapping"].items():
                expected[field["node"]]["inputs"][field["input"]] = values[name]
        else:
            relative = Path(job["input"]["file"])
            if relative.is_absolute() or relative.drive or ".." in relative.parts:
                raise ValueError("Prepared fixture path leaves the owned directory")
            observed = track_mark(prepared / relative)
            if any(job["input"].get(name) != value for name, value in observed.items()):
                raise ValueError("Prepared waveform metadata differs from decoded PCM16 audio; no Runtime write")
        if job["graph"] != expected:
            raise ValueError("Frozen graph IDs/bindings/settings differ from the validated Workflow")
