"""Measurement boundaries and exact cleanup identity for the fixed P0 series."""

from copy import deepcopy
import hashlib
import json
import math
import wave
from array import array
import sys


MEMORY_FIELDS = ["device_vram_used_bytes", "comfy_vram_unavailable_bytes", "runtime_torch_allocator_allocated_bytes",
                 "runtime_rss_bytes", "host_ram_used_bytes"]


def window(samples, start, end):
    rows = sorted((sample for sample in samples if start <= sample["elapsed_seconds"] <= end), key=lambda sample: sample["elapsed_seconds"])
    gaps = [right["elapsed_seconds"] - left["elapsed_seconds"] for left, right in zip(rows, rows[1:])]
    return dict(start_elapsed_seconds=start, end_elapsed_seconds=end, sample_count=len(rows),
                maximum_observed_sample_gap_seconds=max(gaps) if gaps else None,
                scope="Slice of the one series sampler's monotonic time origin; sampled lower bound, not continuous peak",
                memory={field: dict(sampled_peak=max(values) if values else None, minimum=min(values) if values else None,
                                    last=next((row[field] for row in reversed(rows) if row.get(field) is not None), None))
                        for field in MEMORY_FIELDS for values in [[row[field] for row in rows if row.get(field) is not None]]},
                availability="observed" if rows else "unavailable: no in-window samples")


def fingerprint(graph, manifest):
    normalized = deepcopy(graph)
    normalized[manifest["output_mapping"]["audio"]["node"]]["inputs"].pop("filename_prefix")
    return hashlib.sha256(json.dumps(normalized, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def signal(path):
    squares, count, peak = 0.0, 0, 0.0
    if path.suffix.lower() == ".wav":
        with wave.open(str(path), "rb") as audio:
            if audio.getsampwidth() != 2:
                raise ValueError("Signal observation supports the fixed PCM16 WAV fixture or FLAC")
            while body := audio.readframes(16384):
                pcm = array("h")
                pcm.frombytes(body)
                if sys.byteorder != "little":
                    pcm.byteswap()
                values = [sample / 32768 for sample in pcm]
                squares += sum(value * value for value in values)
                count += len(values)
                peak = max(peak, max(abs(value) for value in values))
    else:
        import av
        import numpy as np

        with av.open(str(path)) as audio:
            for frame in audio.decode(audio=0):
                values = frame.to_ndarray()
                scale = max(abs(np.iinfo(values.dtype).min), np.iinfo(values.dtype).max) if np.issubdtype(values.dtype, np.integer) else 1
                values = values.astype(np.float64) / scale
                if not np.isfinite(values).all():
                    raise ValueError("Decoded audio contains non-finite samples")
                squares += float(np.square(values).sum())
                count += values.size
                peak = max(peak, float(np.abs(values).max()))
    if not count or not squares or not math.isfinite(squares):
        raise ValueError("Decoded output audio is empty or silent")
    return dict(rms=math.sqrt(squares / count), peak=peak, sample_values=count,
                scope="Every decoded channel sample; objective nonzero signal only, subjective listening deferred")


def trends(jobs):
    result = {}
    for operation in ["Transcribe", "Generate"]:
        rows = [job for job in jobs if job["operation"] == operation and job["role"] == "repeat"]
        result[operation] = {field: dict(values=[job["memory"]["idle"]["memory"][field]["last"] for job in rows],
                                         labels=[job["label"] for job in rows]) for field in MEMORY_FIELDS}
    return dict(state="unverified", reason="Root must interpret same-type idle vectors, raw samples and bounded retention; unexplained sustained growth cannot pass",
                strata=result, threshold="No invented memory/growth threshold; not a leak-free or performance claim")
