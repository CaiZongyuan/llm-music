"""Local launch, migration and OpenAPI export without any GPU environment."""

import argparse
from datetime import datetime, timezone
import json
import logging
from pathlib import Path

import uvicorn

from music_api.config import Settings
from music_api.database import Database
from music_api.main import create_app


class JsonLogFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        value: dict[str, object] = dict(at=datetime.fromtimestamp(record.created, timezone.utc).isoformat(),
                                        level=record.levelname, message=record.getMessage())
        for key in ["event", "project_id", "asset_id", "request_path", "owned_path"]:
            if key in record.__dict__:
                value[key] = record.__dict__[key]
        if record.exc_info:
            value["exception"] = self.formatException(record.exc_info)
        return json.dumps(value, ensure_ascii=False)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["serve", "migrate", "openapi"])
    parser.add_argument("--data-dir", type=Path, help="Owned application data directory; defaults to MUSIC_API_DATA_DIR or repository data/")
    parser.add_argument("--host", choices=["127.0.0.1", "localhost", "::1"], default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--output", type=Path, help="OpenAPI output file; absent writes stdout")
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("port must be between 1 and 65535")
    configured = Settings() if args.data_dir is None else Settings(data_dir=args.data_dir)
    logger = logging.getLogger("music_api")
    handler = logging.StreamHandler()
    handler.setFormatter(JsonLogFormatter())
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    if args.command == "openapi":
        document = json.dumps(create_app(configured).openapi(), indent=2, ensure_ascii=False) + "\n"
        if args.output is None:
            print(document, end="")
        else:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(document, encoding="utf-8")
    elif args.command == "migrate":
        database = Database(configured)
        try:
            database.migrate()
        finally:
            database.close()
    else:
        uvicorn.run(create_app(configured), host=args.host, port=args.port)
