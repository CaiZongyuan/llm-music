"""Playwright-owned, loopback-only CPU API with an acknowledged graceful stop."""

from datetime import datetime, timezone
import importlib.util
import json
import logging
import os
from pathlib import Path
import threading

import uvicorn

from music_api.config import Settings
from music_api.main import create_app


def main() -> None:
    run_dir = Path(os.environ["MUSIC_BROWSER_RUN_DIR"]).resolve()
    artifacts_root = Path(__file__).resolve().parent / ".artifacts"
    if run_dir.parent != artifacts_root or run_dir.exists():
        raise ValueError("Browser API requires a new direct child of its owned .artifacts directory")
    if importlib.util.find_spec("torch") is not None:
        raise RuntimeError("Browser tests require the independent CPU application environment")
    port = int(os.environ["MUSIC_BROWSER_PORT"])
    run_dir.mkdir(parents=True)
    data_dir = run_dir / "application"
    (run_dir / "owner.json").write_text(json.dumps({
        "pid": os.getpid(), "port": port, "runtime_mode": "fake", "data_dir": str(data_dir),
        "started_at": datetime.now(timezone.utc).isoformat(), "torch_installed": False,
    }, indent=2) + "\n", encoding="utf-8")
    log_path = run_dir / "api.log"
    handler = logging.FileHandler(log_path, encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
    config = uvicorn.Config(create_app(Settings(data_dir=data_dir, runtime_mode="fake", runtime_evidence_path=None)),
                            host="127.0.0.1", port=port)
    for name in ["uvicorn", "uvicorn.error", "uvicorn.access", "music_api"]:
        logging.getLogger(name).addHandler(handler)
    server = uvicorn.Server(config)

    def watch_stop() -> None:
        stop = run_dir / "stop"
        while not server.should_exit:
            if stop.exists():
                server.should_exit = True
                return
            threading.Event().wait(0.1)

    threading.Thread(target=watch_stop, daemon=True).start()
    server.run()
    handler.flush()
    (run_dir / "stopped.json").write_text(json.dumps({
        "pid": os.getpid(), "port": port, "stopped_at": datetime.now(timezone.utc).isoformat(),
        "graceful": "Application shutdown complete." in log_path.read_text(encoding="utf-8"),
    }, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
