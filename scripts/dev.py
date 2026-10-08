"""Start local Web/API and optional native Runtime, with explicit process ownership."""

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import queue
import subprocess
import sys
import threading
import time
from urllib.error import URLError
from urllib.request import urlopen
import uuid
import webbrowser

import psutil

from dev_process import identity, listeners, matching, stop_requested, write_json
from dev_origin import interpreter_origin


ROOT = Path(__file__).resolve().parents[1]


class LaunchError(Exception):
    pass


def bounded_collect(url: str, pid: int, requirements: object, timeout: float):
    from music_api.runtime_evidence import collect_runtime_evidence
    result = queue.Queue(maxsize=1)

    def collect() -> None:
        try:
            result.put(collect_runtime_evidence(url, pid, requirements))
        except Exception as error:
            result.put(error)

    # Read-only hashing may outlast the startup budget; it cannot prolong process exit.
    threading.Thread(target=collect, daemon=True).start()
    try:
        receipt = result.get(timeout=max(0.01, timeout))
    except queue.Empty:
        raise LaunchError("Runtime owner/model collection exceeded the startup budget. Preserve logs, resolve storage latency, then retry.") from None
    if isinstance(receipt, Exception):
        raise receipt
    return receipt


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def http(url: str) -> bytes:
    with urlopen(url, timeout=2) as response:
        return response.read(2 * 1024 * 1024)


def command(name: str) -> str:
    found = shutil.which(name)
    if found is None:
        raise LaunchError(f"{name} is missing. Install {name}, then rerun from the repository root.")
    return found


def environment(project: Path) -> Path:
    folder = project / ".venv"
    executable = folder / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    if not (project / "uv.lock").is_file() or not executable.is_file():
        raise LaunchError(f"Environment not prepared: {project}. Run uv sync --project \"{project}\" --frozen, then retry.")
    return folder.resolve()


def check_environment(project: Path) -> None:
    environment(project)
    result = subprocess.run([command("uv"), "sync", "--project", str(project), "--frozen", "--check"],
                            capture_output=True, text=True, timeout=15)
    if result.returncode:
        raise LaunchError(f"Environment does not match its lock: {project}. Run uv sync --project \"{project}\" --frozen, then retry. This check made no changes.")


def check_runtime_project_files(project: Path) -> None:
    # Git can use LF/CRLF in separate Windows worktrees. Compare tracked text
    # without changing files or the raw uv.lock hash used in origin provenance.
    for filename in ["pyproject.toml", "uv.lock", "runtime.json", "models.json"]:
        actual = (project / filename).read_bytes().replace(b"\r\n", b"\n")
        pinned = (ROOT / "runtime/comfyui" / filename).read_bytes().replace(b"\r\n", b"\n")
        if actual != pinned:
            raise LaunchError(f"Runtime project {filename} differs from this repository's pinned environment. Restore matching configuration; no reused process was changed.")


def signature(config: dict) -> str:
    return hashlib.sha256(json.dumps(config, sort_keys=True).encode()).hexdigest()


def live_service(record: dict, expected: dict) -> bool:
    if record.get("signature") != signature(expected) or record.get("identity") != expected:
        return False
    process = matching(record.get("process", {}))
    if process is None or listeners(expected["port"]) != {process.pid}:
        return False
    try:
        addresses = [item.laddr.ip for item in process.net_connections(kind="tcp")
                     if item.status == psutil.CONN_LISTEN and item.laddr.port == expected["port"]]
        return bool(addresses) and all(address == "127.0.0.1" for address in addresses)
    except psutil.Error:
        return False


class Launcher:
    def __init__(self, args: argparse.Namespace):
        self.args = args
        self.session = uuid.uuid4().hex
        self.state = args.state_dir.resolve()
        self.folder = self.state / "sessions" / self.session
        self.owned: list[dict] = []
        self.logs = []
        self.receipt = dict(schema_version=1, session=self.session, root=str(ROOT), mode=args.mode,
                            launcher=identity(os.getpid()), services=[], status="starting")
        self.stop_config = dict(stop_file=str(self.folder / "stop"), stop_token=self.session)
        self.receipt.update(self.stop_config)
        self.lock = self.state / "startup.lock"
        self.evidence_slot = self.state / f"runtime-evidence-{args.runtime_port}.json"
        self.native_binding = None
        self.native_receipt = None

    def acquire(self) -> None:
        self.state.mkdir(parents=True, exist_ok=True)
        try:
            with self.lock.open("x", encoding="utf-8") as handle:
                json.dump(dict(process=identity(os.getpid()), session=self.session), handle)
        except FileExistsError:
            raise LaunchError(f"Another launcher owns {self.lock}. Wait for its startup to finish. If its recorded PID/create_time is no longer live, preserve/remove this stale lock and retry.") from None

    def release(self) -> None:
        try:
            if read_json(self.lock).get("session") == self.session:
                self.lock.unlink()
        except FileNotFoundError:
            pass

    def save(self) -> None:
        write_json(self.folder / "session.json", self.receipt)

    def expected(self, role: str, port: int) -> dict:
        value = dict(service=role, root=str(ROOT), mode=self.args.mode, port=port)
        if role == "api":
            evidence_path = self.evidence_slot if self.args.mode == "comfyui" else None
            if self.args.mode != "comfyui" and self.args.runtime_evidence:
                evidence_path = self.args.runtime_evidence.resolve()
            value.update(data_dir=str(self.args.data_dir.resolve()), runtime_url=self.args.runtime_url,
                         runtime_evidence=str(evidence_path) if evidence_path else None,
                         python_environment=str(environment(ROOT / "services/api")))
            if self.args.mode == "comfyui":
                value["runtime_configuration"] = {name: str(getattr(self.args, name).resolve()) for name in
                                                   ["runtime_project", "runtime_root", "models_root", "runtime_state_root"]}
        elif role == "web":
            value.update(api_url=f"http://127.0.0.1:{self.args.api_port}")
        else:
            value.update(runtime_project=str(self.args.runtime_project.resolve()), runtime_root=str(self.args.runtime_root.resolve()),
                         models_root=str(self.args.models_root.resolve()), runtime_state_root=str(self.args.runtime_state_root.resolve()),
                         python_environment=str(environment(self.args.runtime_project.resolve())))
        return value

    def record_path(self, role: str, port: int) -> Path:
        return self.state / f"{role}-{port}.json"

    def find_service(self, expected: dict) -> dict | None:
        holders = listeners(expected["port"])
        if not holders:
            return None
        try:
            record = read_json(self.record_path(expected["service"], expected["port"]))
        except (OSError, ValueError):
            record = {}
        if live_service(record, expected):
            print(f"Reusing {expected['service']} PID {record['process']['pid']} on {expected['port']}; external to this session.", flush=True)
            self.receipt["services"].append(dict(record, owned=False))
            return record
        raise LaunchError(f"Port {expected['port']} belongs to an unknown or differently configured service (PIDs {sorted(str(pid) for pid in holders)}). "
                          "No process was changed. Choose unused --api-port/--web-port/--runtime-port, or ask its owner to stop it.")

    def wait_ready(self, role: str, record: dict, deadline: float) -> None:
        url = f"http://127.0.0.1:{record['identity']['port']}"
        while time.monotonic() < deadline:
            if not live_service(record, record["identity"]):
                raise LaunchError(f"{role} process/listener identity changed. Inspect {self.folder / (role + '.log')}; retry after fixing that service.")
            try:
                if role == "runtime":
                    if isinstance(json.loads(http(url + "/system_stats")).get("system"), dict):
                        return
                else:
                    health = json.loads(http(url + ("/api/health" if role == "web" else "/health")))
                    if health["backend"]["status"] == "ready" and health["runtime"]["mode"] == self.args.mode:
                        if health["runtime"]["ready"]:
                            if role != "web" or b'id="root"' in http(url):
                                return
                        else:
                            reasons = [item["code"] for item in health["runtime"]["reasons"]]
                            raise LaunchError(f"Runtime/models are not ready: {', '.join(reasons)}. Run Doctor or obtain a fresh matching owner receipt; logs: {self.folder}.")
            except (URLError, TimeoutError, ValueError, KeyError, OSError):
                pass
            time.sleep(0.1)
        raise LaunchError(f"{role} health wait expired. Inspect {self.folder / (role + '.log')}, repair the service, then retry.")

    def start(self, expected: dict, deadline: float) -> dict:
        role = expected["service"]
        config = dict(expected, stop_file=str(self.folder / f"{role}-stop"), stop_token=self.session,
                      owner_file=str(self.folder / f"{role}-owner.json"), stopped_file=str(self.folder / f"{role}-stopped.json"))
        if role == "api" and self.args.mode == "comfyui":
            config["native_binding"] = self.native_binding
        config_path = self.folder / f"{role}-config.json"
        write_json(config_path, config)
        env = dict(os.environ, PYTHONUTF8="1", MUSIC_DEV_SESSION=self.session)
        # Settings unrelated to this launch must not leak between Fake and native namespaces.
        for key in list(env):
            if key.startswith("MUSIC_API_"):
                del env[key]
        if role == "web":
            env["MUSIC_WEB_API_TARGET"] = expected["api_url"]
            cmd = [command("pnpm"), "--filter", "@llm-music/web", "exec", "node", str(ROOT / "scripts/dev_web.mjs"), str(config_path)]
        else:
            project = ROOT / "services/api" if role == "api" else Path(expected["runtime_project"])
            cmd = [command("uv"), "run", "--project", str(project), "--frozen", "--no-sync", "python", str(ROOT / f"scripts/dev_{role}.py"), str(config_path)]
        log = (self.folder / f"{role}.log").open("w", encoding="utf-8")
        self.logs.append(log)
        child = subprocess.Popen(cmd, cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT)

        def check_child() -> None:
            if child.poll() is not None:
                raise LaunchError(f"{role} startup failed (exit {child.returncode}). Inspect {self.folder / (role + '.log')}; repair and retry.")

        try:
            launcher_child = identity(child.pid)
        except psutil.NoSuchProcess:
            check_child()
            raise
        owned = dict(config=config, launcher_child=launcher_child, process_tree={}, popen=child)
        self.owned.append(owned)
        while time.monotonic() < deadline:
            self.observe_children(owned)
            check_child()
            try:
                owner = read_json(Path(config["owner_file"]))
                pid = owner.get("pid") or owner["process"]["pid"]
                if owner["config"] != config or pid not in owned["process_tree"]:
                    raise LaunchError(f"{role} owner handshake differs from this session")
                if role == "runtime":
                    candidates = listeners(expected["port"]) & owned["process_tree"].keys()
                    if len(candidates) != 1:
                        time.sleep(0.1)
                        continue
                    pid = candidates.pop()
                process = identity(pid)
                record = dict(identity=expected, signature=signature(expected), process=process, owner_file=config["owner_file"], session=self.session)
                if role == "api" and self.args.mode == "comfyui":
                    record["native_binding"] = self.native_binding
                if live_service(record, expected):
                    self.wait_ready(role, record, deadline)
                    write_json(self.record_path(role, expected["port"]), record)
                    self.receipt["services"].append(dict(record, owned=True))
                    self.save()
                    return record
            except (OSError, ValueError, KeyError, psutil.Error):
                pass
            time.sleep(0.1)
        raise LaunchError(f"{role} startup wait expired. Inspect {self.folder / (role + '.log')}; fix the environment/Doctor result, then retry.")

    def observe_children(self, owned: dict) -> None:
        process = matching(owned["launcher_child"])
        if process is None:
            return
        try:
            children = process.children(recursive=True)
        except psutil.NoSuchProcess:
            # A verified launcher child can exit between matching and traversal.
            # Only its creation handle can confirm that this is a completed exit.
            if owned["popen"].poll() is None:
                raise
            return
        for item in [process, *children]:
            try:
                if item.environ().get("MUSIC_DEV_SESSION") == self.session:
                    owned["process_tree"].setdefault(item.pid, identity(item.pid))
            except psutil.Error:
                pass

    def native_evidence(self, record: dict | None, deadline: float) -> None:
        from music_api.runtime_evidence import RuntimeReceipt, read_runtime_evidence
        from music_api.workflow_registry import WorkflowRegistry
        args = self.args
        requirements = WorkflowRegistry().requirements()
        if record is not None and args.runtime_evidence is None:
            # Only collect for a native listener started by this session.
            args.runtime_evidence = self.folder / "runtime-evidence.json"
            write_json(args.runtime_evidence, bounded_collect(args.runtime_url, record["process"]["pid"], requirements, deadline - time.monotonic()).model_dump(mode="json"))
        input_path = args.runtime_evidence or self.evidence_slot
        if not input_path.is_file() or input_path.stat().st_size > 131072:
            raise LaunchError("Native owner evidence unavailable or oversized. Supply a fresh matching --runtime-evidence; no reused service was changed.")
        snapshot = self.folder / "runtime-evidence-input.json"
        snapshot.write_bytes(input_path.read_bytes())
        evidence = read_runtime_evidence(snapshot, runtime_url=args.runtime_url, now=datetime.now(timezone.utc), max_age_seconds=300, requirements=requirements)
        problems = list(evidence.reasons) + [code for model in evidence.models if model.state != "ready" for code in model.reasons]
        if not evidence.binding_verified or problems:
            raise LaunchError(f"Native owner/model evidence refused: {', '.join(problems) or 'model verification unavailable'}. Obtain a fresh collector receipt for the exact listener and model root; no reused process was changed.")
        receipt = RuntimeReceipt.model_validate_json(snapshot.read_bytes())
        if receipt.runtime_root.resolve() != args.runtime_root.resolve() or receipt.models_root.resolve() != args.models_root.resolve():
            raise LaunchError("Native receipt runtime/model directories differ from requested paths. Use matching paths; no reused process was changed.")
        process = psutil.Process(receipt.process.pid)
        cmd = process.cmdline()
        expected_options = {"--listen": "127.0.0.1", "--port": str(args.runtime_port),
                            **{f"--{folder}-directory": str((args.runtime_state_root / folder).resolve()) for folder in ["input", "output", "user", "temp"]}}
        for option, value in expected_options.items():
            if option not in cmd or cmd.index(option) + 1 >= len(cmd):
                raise LaunchError(f"Native listener lacks matching {option}. Use the actual owner settings; no reused process was changed.")
            actual = cmd[cmd.index(option) + 1]
            matches = Path(actual).resolve() == Path(value).resolve() if option.endswith("-directory") else actual == value
            if not matches:
                raise LaunchError(f"Native listener {option} differs from requested settings. Use matching owner settings; no reused process was changed.")
        environment(args.runtime_project.resolve())
        check_runtime_project_files(args.runtime_project)
        check_environment(args.runtime_project)
        binding = interpreter_origin(receipt.process.pid, args.runtime_project)
        self.native_binding = dict(process=binding["listener"], runtime_project=binding["project"],
                                   lock_sha256=binding["lock_sha256"])
        self.native_receipt = read_json(snapshot)
        self.receipt["native_evidence_source"] = dict(path=str(input_path.resolve()), snapshot=str(snapshot),
                                                     checked_at=self.native_receipt["checked_at"])
        if record is None:
            self.receipt["services"].append(dict(identity=dict(service="runtime", port=args.runtime_port, runtime_root=str(receipt.runtime_root), models_root=str(receipt.models_root)), process=identity(receipt.process.pid), owned=False, evidence=str(input_path), environment_binding=binding))
        else:
            for service in self.receipt["services"]:
                if service["process"]["pid"] == receipt.process.pid:
                    service["environment_binding"] = binding

    def run(self) -> int:
        self.folder.mkdir(parents=True)
        self.save()
        print(f"Session receipt: {self.folder / 'session.json'}", flush=True)
        print("Fake mode: API-local CPU Runtime + Web; no model inference." if self.args.mode == "fake" else "Native mode: independent Runtime uv / API uv / Web pnpm.", flush=True)
        deadline = time.monotonic() + self.args.timeout
        try:
            self.acquire()
            # Inspect both product ports before starting any child.
            api = self.find_service(self.expected("api", self.args.api_port))
            web = self.find_service(self.expected("web", self.args.web_port))
            if self.args.mode == "comfyui":
                if listeners(self.args.runtime_port):
                    self.native_evidence(None, deadline)
                else:
                    native = self.start(self.expected("runtime", self.args.runtime_port), deadline)
                    self.native_evidence(native, deadline)
                if api is not None and api.get("native_binding") != self.native_binding:
                    raise LaunchError("Existing API native binding differs or is unproved. Ask its original owner to restart against the verified Runtime; no reused service or active receipt was changed.")
                # Product ports/configuration and the live native proof now match.
                # Publish real verified source timestamps unchanged; the immutable
                # input snapshot stays in this session even after a later refresh.
                write_json(self.evidence_slot, self.native_receipt)
            if api is None:
                api = self.start(self.expected("api", self.args.api_port), deadline)
            else:
                self.wait_ready("api", api, deadline)
            if web is None:
                web = self.start(self.expected("web", self.args.web_port), deadline)
            else:
                self.wait_ready("web", web, deadline)
            url = f"http://127.0.0.1:{self.args.web_port}"
            self.receipt.update(status="ready", url=url)
            self.save()
            self.release()
            print(f"Web ready: {url}\nCtrl+C stops only this session's children. Separate-terminal stop: pnpm dev -- --stop-session \"{self.folder / 'session.json'}\"", flush=True)
            if self.args.open:
                webbrowser.open(url)
            while not stop_requested(self.stop_config):
                for record in self.receipt["services"]:
                    if matching(record["process"]) is None:
                        raise LaunchError(f"{record['identity']['service']} exited or changed identity. Inspect its owner log and restart the launcher.")
                for owned in self.owned:
                    self.observe_children(owned)
                time.sleep(0.2)
            return 0
        except KeyboardInterrupt:
            return 0
        except (LaunchError, OSError, ValueError, psutil.Error, subprocess.SubprocessError) as error:
            self.receipt["error"] = str(error)
            print(f"Launch refused: {error}", file=sys.stderr, flush=True)
            return 1
        finally:
            self.cleanup()
            self.release()

    def cleanup(self) -> None:
        for owned in reversed(self.owned):
            self.observe_children(owned)
            if matching(owned["launcher_child"]) or any(matching(item) for item in owned["process_tree"].values()):
                Path(owned["config"]["stop_file"]).write_text(self.session, encoding="utf-8")
        deadline = time.monotonic() + 12
        while time.monotonic() < deadline and any(item["popen"].poll() is None for item in self.owned):
            time.sleep(0.1)
        forced = []
        for owned in reversed(self.owned):
            for receipt in reversed(list(owned["process_tree"].values())):
                process = matching(receipt)
                if process is not None:
                    forced.append(receipt)
                    process.terminate()
        _, alive = psutil.wait_procs([process for receipt in forced if (process := matching(receipt))], timeout=2)
        for process in alive:
            if any(matching(item) and item["pid"] == process.pid for item in forced):
                process.kill()
        for log in self.logs:
            log.close()
        self.receipt.update(status="failed" if "error" in self.receipt else "stopped", forced_processes=forced,
                            stopped_at=datetime.now(timezone.utc).isoformat())
        self.save()
        print(f"Session {self.receipt['status']}; {len(self.owned)} owned service(s) stopped; {len(forced)} forced process(es).", flush=True)


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mode", choices=["fake", "comfyui"], default="fake")
    parser.add_argument("--api-port", type=int, default=8000)
    parser.add_argument("--web-port", type=int, default=5173)
    parser.add_argument("--runtime-port", type=int, default=8188)
    parser.add_argument("--data-dir", type=Path)
    parser.add_argument("--state-dir", type=Path)
    parser.add_argument("--runtime-project", type=Path, default=ROOT / "runtime/comfyui")
    parser.add_argument("--runtime-root", type=Path, default=ROOT / "runtime/comfyui/.upstream/ComfyUI")
    parser.add_argument("--models-root", type=Path, default=ROOT / "data/models")
    parser.add_argument("--runtime-state-root", type=Path, default=ROOT / "data/runtime/comfyui")
    parser.add_argument("--runtime-evidence", type=Path)
    parser.add_argument("--timeout", type=float, default=180)
    parser.add_argument("--open", action="store_true", help="Open the browser after health checks pass")
    parser.add_argument("--stop-session", type=Path, help="Request a matching live launcher to stop its own children")
    parser.add_argument("--inspect-runtime-origin", type=int, metavar="PID", help="Read-only launch environment provenance; does not check models or Runtime readiness")
    args = parser.parse_args([item for item in sys.argv[1:] if item != "--"])
    if args.inspect_runtime_origin is not None:
        try:
            check_environment(args.runtime_project)
            print(json.dumps(interpreter_origin(args.inspect_runtime_origin, args.runtime_project), indent=2))
            return 0
        except (LaunchError, OSError, ValueError, psutil.Error, subprocess.SubprocessError) as error:
            print(f"Runtime origin refused: {error}", file=sys.stderr)
            return 1
    if args.stop_session:
        try:
            path = args.stop_session.resolve()
            receipt = read_json(path)
            valid_path = path.name == "session.json" and path.parent.name == receipt["session"] and Path(receipt["stop_file"]) == path.parent / "stop" and receipt["stop_token"] == receipt["session"]
        except (OSError, ValueError, KeyError, TypeError):
            parser.error("Invalid session receipt; nothing was stopped")
        if not valid_path or receipt.get("root") != str(ROOT) or receipt.get("status") not in {"starting", "ready"} or matching(receipt.get("launcher", {})) is None:
            parser.error("Session is no longer owned by a matching live launcher; nothing was stopped")
        Path(receipt["stop_file"]).write_text(receipt["stop_token"], encoding="utf-8")
        print("Stop requested; the session receipt records the final cleanup result.")
        return 0
    if any(not 1 <= port <= 65535 for port in [args.api_port, args.web_port, args.runtime_port]) or len({args.api_port, args.web_port, args.runtime_port}) != 3:
        parser.error("Service ports must be distinct integers between 1 and 65535")
    if not 1 <= args.timeout <= 300:
        parser.error("timeout must be between 1 and 300 seconds")
    args.data_dir = args.data_dir or ROOT / "data/dev" / args.mode / "application"
    args.state_dir = args.state_dir or ROOT / "data/dev" / args.mode / "launcher"
    args.runtime_url = f"http://127.0.0.1:{args.runtime_port}"
    try:
        command("pnpm")
        command("uv")
        if not (ROOT / "node_modules/.pnpm").is_dir():
            raise LaunchError("JS dependencies are missing. Run pnpm install --frozen-lockfile, then retry.")
        check_environment(ROOT / "services/api")
        if args.mode == "comfyui" and not listeners(args.runtime_port):
            if environment(ROOT / "services/api") == environment(args.runtime_project):
                raise LaunchError("API and Runtime must not share a Python environment")
            if not (args.runtime_root / "main.py").is_file() or not args.models_root.is_dir():
                raise LaunchError("Native source/models are not prepared. Follow docs/guides/runtime-doctor.md; launcher never downloads models.")
            check_runtime_project_files(args.runtime_project)
            check_environment(args.runtime_project)
        build = subprocess.run([command("pnpm"), "--filter", "@llm-music/api-client", "build"], cwd=ROOT, timeout=30, capture_output=True, text=True)
        if build.returncode:
            raise LaunchError("API client build failed. Run pnpm --filter @llm-music/api-client build, repair its error, then retry.")
        return Launcher(args).run()
    except (LaunchError, OSError, psutil.Error, subprocess.SubprocessError) as error:
        print(f"Launch refused: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
