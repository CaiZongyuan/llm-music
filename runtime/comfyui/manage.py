"""P0 environment commands; Doctor is read-only apart from a tiny CUDA probe."""

import argparse
import csv
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import socket
import subprocess
import sys
from urllib.request import Request, urlopen


PROJECT = Path(__file__).resolve().parent


def read_config(path):
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("configuration must be a JSON object")
    if data.get("schema_version") != 1:
        raise ValueError("unsupported schema_version")
    return data


def validate_runtime(config):
    for name in ["python", "torch", "torch_cuda", "gpu_name"]:
        if not isinstance(config.get(name), str):
            raise ValueError(f"runtime.{name} must be a string")
    for name in ["min_vram_mib", "min_free_disk_bytes", "port"]:
        if type(config.get(name)) is not int or config[name] < 0:
            raise ValueError(f"runtime.{name} must be a nonnegative integer")
    if not 1 <= config["port"] <= 65535:
        raise ValueError("runtime.port must be between 1 and 65535")
    if not isinstance(config.get("required_nodes"), list) or not config["required_nodes"]:
        raise ValueError("runtime.required_nodes must be a nonempty list")
    if not all(isinstance(node, str) and node for node in config["required_nodes"]):
        raise ValueError("runtime.required_nodes must contain nonempty strings")
    if not isinstance(config.get("sources"), dict):
        raise ValueError("runtime.sources must be an object")
    for name in ["comfyui", "plugin"]:
        source = config.get("sources", {}).get(name, {})
        if not isinstance(source, dict) or not isinstance(source.get("revision"), str):
            raise ValueError(f"runtime.sources.{name} must contain a revision")
        if len(source["revision"]) != 40 or not source.get("repository"):
            raise ValueError(f"runtime.sources.{name} requires a pinned revision and repository")
        int(source["revision"], 16)


def validate_registry(registry):
    models = registry.get("models")
    if not isinstance(models, list) or not models:
        raise ValueError("registry.models must be a nonempty list")
    seen = set()
    for model in models:
        if not isinstance(model, dict):
            raise ValueError("registry model must be an object")
        for name in ["id", "name", "provider", "repository", "revision", "filename",
                     "sha256", "local_path", "weights_license", "license_source", "hash_source"]:
            if not isinstance(model.get(name), str) or not model[name]:
                raise ValueError(f"model.{name} must be a nonempty string")
        if model["id"] in seen:
            raise ValueError("duplicate model id")
        seen.add(model["id"])
        if len(model["revision"]) != 40 or len(model["sha256"]) != 64:
            raise ValueError("model revision or SHA256 is not pinned")
        int(model["sha256"], 16)
        int(model["revision"], 16)
        if type(model.get("size_bytes")) is not int or model["size_bytes"] < 1:
            raise ValueError("model.size_bytes must be positive")
        for field in ["local_path", "filename"]:
            path = Path(model[field])
            if path.is_absolute() or path.drive or ".." in path.parts:
                raise ValueError(f"model.{field} must stay inside its root")


def run(command, **kwargs):
    return subprocess.run(command, capture_output=True, text=True, encoding="utf-8",
                          errors="replace", check=True, timeout=120, **kwargs)


def check_result(identifier, passed, message, recovery="", **facts):
    return dict(id=identifier, status="passed" if passed else "failed", message=message,
                recovery="" if passed else recovery, facts=facts)


def source_check(name, path, source):
    try:
        head = run(["git", "-C", str(path), "rev-parse", "HEAD"]).stdout.strip()
        changes = run(["git", "-C", str(path), "status", "--porcelain", "--untracked-files=no"]).stdout.strip()
        passed = head == source["revision"] and not changes
        return check_result(name, passed, "Pinned clean checkout" if passed else "Runtime revision or tracked files differ",
                            "Restore a clean checkout at the configured commit; preserve local edits first.",
                            path=str(path), expected_revision=source["revision"], revision=head, tracked_changes=changes)
    except (OSError, subprocess.SubprocessError) as error:
        return check_result(name, False, f"Pinned Runtime checkout unavailable: {error}",
                            "Run the prepare command to create pinned Runtime checkouts.", path=str(path))


def gpu_check(args, config):
    try:
        result = run([args.nvidia_smi, "--query-gpu=index,name,memory.total,memory.free,driver_version",
                      "--format=csv,noheader,nounits"])
        rows = list(csv.reader(result.stdout.splitlines()))
        gpus = [dict(index=int(row[0]), name=row[1].strip(), vram_mib=int(row[2]),
                     free_vram_mib=int(row[3]), driver=row[4].strip()) for row in rows]
        passed = any(gpu["vram_mib"] >= config["min_vram_mib"] and gpu["name"] == config["gpu_name"] for gpu in gpus)
        return check_result("gpu", passed, "NVIDIA GPU detected" if passed else "No GPU meets the target VRAM requirement",
                            "Install the NVIDIA driver and use the target 8 GiB NVIDIA GPU.", devices=gpus)
    except (OSError, ValueError, IndexError, subprocess.SubprocessError) as error:
        return check_result("gpu", False, f"NVIDIA GPU query failed: {error}",
                            "Install the NVIDIA driver, confirm nvidia-smi works, then rerun Doctor.")


def import_checks(args, config):
    try:
        environment = dict(os.environ, YUE2_MODELS_ROOT=str(args.models_root.resolve()), PYTHONUTF8="1")
        result = run([sys.executable, str(PROJECT / "probe.py"), str(args.runtime_root)], env=environment)
        lines = [line for line in result.stdout.splitlines() if line.startswith("MUSIC_DOCTOR_JSON=")]
        facts = json.loads(lines[-1].partition("=")[2])
    except (OSError, ValueError, IndexError, subprocess.SubprocessError) as error:
        facts = dict(torch_ok=False, comfyui_ok=False, plugin_ok=False, import_error=str(error))
    torch_ready = (facts.get("torch_ok", False) and facts.get("torch") == config["torch"]
                   and facts.get("torch_cuda") == config["torch_cuda"]
                   and facts.get("gpu") == config["gpu_name"]
                   and facts.get("vram_bytes", 0) >= config["min_vram_mib"] * 1024 * 1024)
    registered = set(facts.get("registered_nodes", []))
    missing = sorted(set(config["required_nodes"]) - registered)
    recovery = "Run uv sync --project runtime/comfyui --frozen, use that environment, and inspect facts/traceback."
    return [
        check_result("torch_cuda", torch_ready, "Pinned Torch CUDA and BF16 operational" if torch_ready else "Torch CUDA/BF16 or pinned version unavailable",
                     recovery, **facts),
        check_result("runtime_import", facts.get("comfyui_ok", False), "ComfyUI nodes import" if facts.get("comfyui_ok") else "ComfyUI import failed",
                     recovery, import_error=facts.get("import_error"), traceback=facts.get("traceback")),
        check_result("custom_nodes", facts.get("plugin_ok", False) and not missing,
                     "Required nodes registered; inference imports and audio resampling operational" if facts.get("plugin_ok") and not missing else "Custom nodes or lazy inference imports unavailable",
                     recovery, missing_nodes=missing, import_error=facts.get("import_error")),
    ]


def model_check(model, root, overrides):
    path = overrides.get(model["id"], root / model["local_path"])
    facts = dict(model, path=str(path), checked_at=datetime.now(timezone.utc).isoformat())
    recovery = "Run download-models, or use --model-path ID=PATH for a matching legal local file; verify its pinned SHA256."
    try:
        if not path.exists():
            state = "downloading" if path.with_name(path.name + ".part").exists() else "missing"
            facts["state"] = state
            return check_result("model:" + model["id"], False, f"{model['name']}: {state}", recovery, **facts)
        facts["actual_size_bytes"] = path.stat().st_size
        if facts["actual_size_bytes"] != model["size_bytes"]:
            facts["state"] = "invalid"
            return check_result("model:" + model["id"], False, f"{model['name']}: invalid size", recovery, **facts)
        with path.open("rb") as handle:
            facts["actual_sha256"] = hashlib.file_digest(handle, "sha256").hexdigest()
        passed = facts["actual_sha256"] == model["sha256"]
        facts["state"] = "ready" if passed else "invalid"
        expected = root / model["local_path"]
        facts["runtime_path"] = str(expected)
        facts["runtime_resolved"] = expected.exists() and expected.samefile(path)
        if passed and not facts["runtime_resolved"]:
            return check_result("model:" + model["id"], False,
                                f"{model['name']}: hash verified, but unavailable in Runtime model layout",
                                "Place or link this verified file at runtime_path inside the Runtime model root, then rerun Doctor without --model-path.",
                                **facts)
        return check_result("model:" + model["id"], passed,
                            f"{model['name']}: " + ("ready (SHA256 verified)" if passed else "invalid SHA256"), recovery, **facts)
    except OSError as error:
        facts["state"] = "invalid"
        return check_result("model:" + model["id"], False, f"Model unreadable: {error}", recovery, **facts)


def disk_check(root, minimum):
    path = root.resolve()
    while not path.exists():
        path = path.parent
    try:
        free = shutil.disk_usage(path).free
        return check_result("disk", free >= minimum, f"{free} bytes free; {minimum} bytes required",
                            "Free disk space on the model volume and rerun Doctor.", volume_path=str(path), free_bytes=free, required_bytes=minimum)
    except OSError as error:
        return check_result("disk", False, f"Disk query failed: {error}", "Make the model volume accessible.")


def port_check(port):
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as connection:
            if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
                connection.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
            connection.bind(("127.0.0.1", port))
        return check_result("port", True, f"127.0.0.1:{port} available", port=port)
    except OSError as error:
        return check_result("port", False, f"127.0.0.1:{port} unavailable: {error}",
                            "Stop the owning Runtime process, or select an unused --port for Doctor and start.", port=port)


def doctor(args, config, registry, overrides):
    plugin = args.runtime_root / "custom_nodes" / "YuE2-ComfyUI"
    checks = [check_result("python", platform.python_version() == config["python"],
                           f"Python {platform.python_version()}", "Run Doctor in the pinned uv project environment.",
                           expected=config["python"], actual=platform.python_version(), executable=sys.executable),
              source_check("comfyui", args.runtime_root, config["sources"]["comfyui"]),
              source_check("plugin", plugin, config["sources"]["plugin"]), gpu_check(args, config)]
    checks.extend(import_checks(args, config))
    model_checks = [model_check(model, args.models_root, overrides) for model in registry["models"]]
    checks.extend(model_checks)
    missing_bytes = sum(check["facts"]["size_bytes"] for check in model_checks if check["facts"]["state"] != "ready")
    checks.extend([disk_check(args.models_root, config["min_free_disk_bytes"] + missing_bytes),
                   port_check(args.port or config["port"])])
    ready = all(check["status"] == "passed" for check in checks)
    report = dict(schema_version=1, ready=ready, p0_passed=False, verification_scope="environment-prerequisites",
                  checked_at=datetime.now(timezone.utc).isoformat(), checks=checks, p0_defaults=config.get("p0_defaults", {}))
    if args.json:
        print(json.dumps(report, indent=2, ensure_ascii=True))
    else:
        print("Runtime " + ("READY" if ready else "NOT READY") + "; P0 inference gate remains unverified.")
        for check in checks:
            print(f"[{check['status'].upper()}] {check['id']}: {check['message']}")
            if check["recovery"]:
                print("  Recovery: " + check["recovery"])
    return 0 if ready else 1


def prepare(args, config):
    paths = {"comfyui": args.runtime_root,
             "plugin": args.runtime_root / "custom_nodes" / "YuE2-ComfyUI"}
    for name, path in paths.items():
        source = config["sources"][name]
        if not path.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            subprocess.run(["git", "clone", "--no-checkout", source["repository"], str(path)], check=True)
            subprocess.run(["git", "-C", str(path), "checkout", "--detach", source["revision"]], check=True)
        check = source_check(name, path, source)
        if check["status"] != "passed":
            raise ValueError(check["message"] + ". " + check["recovery"])
        print(name + ": " + source["revision"])
    subprocess.run(["uv", "sync", "--project", str(PROJECT), "--frozen"], check=True)
    print("Pinned Runtime prepared. Run Doctor after preparing models.")
    return 0


def download_models(args, registry):
    args.models_root.mkdir(parents=True, exist_ok=True)
    for model in registry["models"]:
        check = model_check(model, args.models_root, {})
        if check["status"] == "passed":
            print(check["message"])
            continue
        if check["facts"]["state"] == "invalid":
            raise ValueError(check["message"] + "; preserve or remove the invalid file before downloading.")
        destination = args.models_root / model["local_path"]
        destination.parent.mkdir(parents=True, exist_ok=True)
        partial = destination.with_name(destination.name + ".part")
        offset = partial.stat().st_size if partial.exists() else 0
        if offset > model["size_bytes"]:
            raise ValueError(f"Oversized partial file: {partial}; preserve or remove it before retrying.")
        disk = disk_check(args.models_root, model["size_bytes"] - offset)
        if disk["status"] != "passed":
            raise ValueError(disk["message"] + ". " + disk["recovery"])
        if offset < model["size_bytes"]:
            url = f"https://huggingface.co/{model['repository']}/resolve/{model['revision']}/{model['filename']}"
            request = Request(url, headers={"Range": f"bytes={offset}-"} if offset else {})
            print(f"Downloading {model['id']} from pinned revision {model['revision']}", flush=True)
            with urlopen(request, timeout=60) as response:
                append = response.status == 206 and offset > 0
                if response.status == 206 and not response.headers.get("Content-Range", "").startswith(f"bytes {offset}-"):
                    raise ValueError("Download server returned an unexpected Content-Range")
                with partial.open("ab" if append else "wb") as handle:
                    shutil.copyfileobj(response, handle, length=4 * 1024 * 1024)
        if partial.stat().st_size != model["size_bytes"]:
            raise ValueError(f"Incomplete download: {partial}. Rerun download-models to resume.")
        with partial.open("rb") as handle:
            digest = hashlib.file_digest(handle, "sha256").hexdigest()
        if digest != model["sha256"]:
            raise ValueError(f"Invalid SHA256: {partial}. Preserve or remove the corrupt partial before retrying.")
        partial.replace(destination)
        print(model["id"] + ": ready (SHA256 verified)")
    return 0


def start(args, config, registry):
    if args.model_path:
        raise ValueError("start uses YUE2_MODELS_ROOT exclusively; place or link verified files inside --models-root")
    if doctor(args, config, registry, {}):
        return 1
    state = args.state_root.resolve()
    for folder in ["input", "output", "user", "temp"]:
        (state / folder).mkdir(parents=True, exist_ok=True)
    environment = dict(os.environ, YUE2_MODELS_ROOT=str(args.models_root.resolve()),
                       AIOHTTP_NOSENDFILE="1", PYTHONUTF8="1")
    command = [sys.executable, str((args.runtime_root / "main.py").resolve()),
               "--listen", "127.0.0.1", "--port", str(args.port or config["port"]),
               "--disable-auto-launch", "--disable-all-custom-nodes", "--whitelist-custom-nodes", "YuE2-ComfyUI",
               "--input-directory", str(state / "input"), "--output-directory", str(state / "output"),
               "--user-directory", str(state / "user"), "--temp-directory", str(state / "temp")]
    print(f"Starting local Runtime at http://127.0.0.1:{args.port or config['port']}; Ctrl+C stops it.", flush=True)
    return subprocess.call(command, cwd=args.runtime_root, env=environment)


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["doctor", "prepare", "download-models", "start"])
    parser.add_argument("--runtime-config", type=Path, default=PROJECT / "runtime.json")
    parser.add_argument("--registry", type=Path, default=PROJECT / "models.json")
    parser.add_argument("--runtime-root", type=Path, default=PROJECT / ".upstream" / "ComfyUI")
    parser.add_argument("--models-root", type=Path, default=PROJECT.parents[1] / "data" / "models")
    parser.add_argument("--state-root", type=Path, default=PROJECT.parents[1] / "data" / "runtime" / "comfyui")
    parser.add_argument("--model-path", action="append", default=[], metavar="ID=PATH")
    parser.add_argument("--nvidia-smi", default="nvidia-smi")
    parser.add_argument("--port", type=int)
    parser.add_argument("--json", action="store_true", help="Doctor: print a JSON report")
    args = parser.parse_args()
    try:
        config = read_config(args.runtime_config)
        registry = read_config(args.registry)
        validate_runtime(config)
        validate_registry(registry)
        overrides = {}
        for entry in args.model_path:
            identifier, separator, path = entry.partition("=")
            if not separator or identifier not in {model["id"] for model in registry["models"]} or not path:
                raise ValueError("--model-path requires a registered ID=PATH")
            overrides[identifier] = Path(path).resolve()
        if args.port is not None and not 1 <= args.port <= 65535:
            raise ValueError("--port must be between 1 and 65535")
    except (OSError, ValueError) as error:
        report = {
            "ready": False,
            "error": f"Invalid configuration: {error}",
            "recovery": "Restore the version-controlled runtime configuration and rerun Doctor.",
        }
        print(json.dumps(report) if args.json else report["error"] + "\n" + report["recovery"])
        return 2
    try:
        if args.command == "prepare":
            return prepare(args, config)
        if args.command == "download-models":
            return download_models(args, registry)
        if args.command == "start":
            return start(args, config, registry)
        return doctor(args, config, registry, overrides)
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        print(f"{args.command} failed: {error}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("Interrupted. Model partials remain resumable; no ready verdict was issued.", file=sys.stderr)
        return 130


if __name__ == "__main__":
    sys.exit(main())
