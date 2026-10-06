"""Sample observed Runtime/host resources; do not infer per-process GPU residency."""

from datetime import datetime, timezone
import json
import hashlib
import math
from pathlib import Path
import re
import threading
import time


class RuntimeLogs:
    def __init__(self, sources, output):
        self.output = output
        self.sources = [(source, source.stat()) for source in sources]

    def finish(self):
        receipts, summaries = [], []
        for index, (source, original) in enumerate(self.sources, 1):
            current = source.stat()
            same_span = current.st_ino == original.st_ino and current.st_size >= original.st_size
            offset = original.st_size if same_span else 0
            with source.open("rb") as handle:
                handle.seek(offset)
                body = handle.read()
            target = self.output / f"runtime-log-{index:02d}.txt"
            target.write_bytes(body)
            receipts.append(dict(source=str(source.resolve()), start_byte=offset, end_byte=current.st_size,
                                 same_run_span=same_span, path=target.name, sha256=hashlib.sha256(body).hexdigest()))
            if same_span:
                for line in body.decode("utf-8", errors="replace").splitlines():
                    match = re.search(r"\[yue2_comfy\] stages: (.+) \| loading and the rest ([0-9.]+) s", line)
                    if match:
                        summaries.append(match)
        stages = {name: None for name in ["model_load", "planning_score", "generating_semantic", "synthesizing", "decoding_audio"]}
        other = None
        observation = "unavailable: no unambiguous same-run pinned-plugin stage summary; exclusive model-load time is not exposed"
        if len(summaries) == 1:
            match = summaries[0]
            names = {"score": "planning_score", "performance": "generating_semantic", "acoustic": "synthesizing", "decode": "decoding_audio"}
            for label, seconds in re.findall(r"(score|performance|acoustic|decode) ([0-9.]+) s", match[1]):
                value = float(seconds)
                if math.isfinite(value) and value >= 0:
                    stages[names[label]] = value
            other = float(match[2])
            if not math.isfinite(other) or other < 0:
                other = None
            observation = "Pinned plugin stage_times log, rounded to 0.1 seconds; 'loading and the rest' includes loading, unloading and other work, not exclusive model-load time"
        return dict(runtime_logs=receipts, stage_seconds=stages, loading_and_other_seconds=other,
                    stage_observability=observation)


def usable_bytes(value):
    return value if type(value) is int and value >= 0 else None


class MemorySampler:
    def __init__(self, client, interval, output, process_pid=None, expected_main=None):
        self.client, self.interval, self.output = client, interval, output
        self.process_pid, self.expected_main = process_pid, expected_main
        self.samples, self.errors = [], []
        self.stop_event = threading.Event()
        self.thread = None
        self.process = None
        self.process_error = "Runtime PID not supplied"
        if process_pid is not None:
            try:
                import psutil

                process = psutil.Process(process_pid)
                if expected_main is None or not any(Path(part).is_file() and Path(part).samefile(expected_main)
                                                    for part in process.cmdline()[1:]):
                    raise ValueError("PID does not execute the configured Runtime main.py")
                self.process, self.process_error = process, None
            except Exception as error:
                self.process_error = str(error)

    def __enter__(self):
        self.began = time.monotonic()
        self.take_sample()
        self.thread = threading.Thread(target=self.collect, daemon=True)
        self.thread.start()
        return self

    def collect(self):
        while not self.stop_event.wait(self.interval):
            self.take_sample()

    def take_sample(self):
        sample = dict(at=datetime.now(timezone.utc).isoformat(), elapsed_seconds=time.monotonic() - self.began,
                      device_vram_total_bytes=None, device_vram_used_bytes=None, host_ram_total_bytes=None,
                      host_ram_used_bytes=None, runtime_rss_bytes=None, runtime_torch_allocator_allocated_bytes=None,
                      comfy_vram_unavailable_bytes=None, cuda_free_bytes=None)
        try:
            stats = self.client.get_json("/system_stats")
            system = stats.get("system", {})
            total, free = usable_bytes(system.get("ram_total")), usable_bytes(system.get("ram_free"))
            if total is not None and free is not None and free <= total:
                sample.update(host_ram_total_bytes=total, host_ram_used_bytes=total - free)
            device = next((device for device in stats.get("devices", []) if device.get("type") == "cuda" and device.get("index") == 0), {})
            total, free = usable_bytes(device.get("vram_total")), usable_bytes(device.get("vram_free"))
            reserved, available = usable_bytes(device.get("torch_vram_total")), usable_bytes(device.get("torch_vram_free"))
            if total is not None and free is not None and free <= total:
                sample.update(device_vram_total_bytes=total, comfy_vram_unavailable_bytes=total - free)
                if available is not None and available <= free:
                    sample.update(cuda_free_bytes=free - available, device_vram_used_bytes=total - free + available)
            if reserved is not None and available is not None and available <= reserved:
                sample["runtime_torch_allocator_allocated_bytes"] = reserved - available
        except Exception as error:
            sample["sample_error"] = str(error)
            self.errors.append(str(error))
        if self.process is not None:
            try:
                if not self.process.is_running():
                    raise ValueError("The observed Runtime PID is no longer running")
                sample["runtime_rss_bytes"] = self.process.memory_info().rss
            except Exception as error:
                self.process_error = str(error)
        self.samples.append(sample)
        with self.output.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(sample, ensure_ascii=False) + "\n")

    def __exit__(self, *error):
        self.stop_event.set()
        self.thread.join(timeout=self.client.timeout + 1)
        if self.thread.is_alive():
            self.errors.append("Resource sampler did not finish before its bounded join")
        else:
            self.take_sample()

    def summary(self):
        def peak(key):
            values = [sample[key] for sample in self.samples if sample.get(key) is not None]
            return max(values) if values else None

        gaps = [right["elapsed_seconds"] - left["elapsed_seconds"] for left, right in zip(self.samples, self.samples[1:])]
        return dict(sample_count=len(self.samples), configured_sample_interval_seconds=self.interval,
                    maximum_observed_sample_gap_seconds=max(gaps) if gaps else None,
                    sampling_window="Immediately before submission through terminal history readback; preflight hashing and client artifact validation excluded",
                    sampled_peak_device_vram_used_bytes=peak("device_vram_used_bytes"),
                    sampled_peak_comfy_vram_unavailable_bytes=peak("comfy_vram_unavailable_bytes"),
                    sampled_peak_host_ram_used_bytes=peak("host_ram_used_bytes"),
                    sampled_peak_runtime_rss_bytes=peak("runtime_rss_bytes"),
                    sampled_peak_runtime_torch_allocator_bytes=peak("runtime_torch_allocator_allocated_bytes"),
                    device_scope="CUDA mem_get_info whole device total minus CUDA free reconstructed from Comfy vram_free minus torch_vram_free; includes other GPU consumers; allocated/available view, not WDDM resident process memory; sampled lower bound on peak",
                    comfy_proxy_scope="Device total minus Comfy available memory; Comfy availability includes unused Torch reservation, so this proxy excludes that reservation",
                    host_scope="Whole host total minus available RAM; includes other processes and system usage; sampled lower bound on peak",
                    process_ram_scope="Selected Runtime PID resident working set (psutil RSS); excludes client process memory",
                    process_pid=self.process_pid, process_ram_unavailable_reason=self.process_error,
                    torch_allocator_scope="Selected Runtime Torch allocator only; excludes non-Torch CUDA/context allocations; not resident process GPU memory",
                    process_gpu_resident_bytes=None,
                    process_gpu_unavailable_reason="WDDM per-process GPU residency is unavailable from this API; no device total is substituted",
                    errors=self.errors)
