"""Export Settings metadata without reading environment values or starting services."""

import json
from pathlib import Path
import sys

from music_api.diagnostics_routes import settings_metadata


root = Path(__file__).resolve().parents[3]
document = settings_metadata().model_dump(mode="json")
for value in document["settings_schema"]["properties"].values():
    if value.get("format") == "path" and isinstance(value.get("default"), str):
        default = Path(value["default"])
        if default.is_absolute() and default.is_relative_to(root):
            value["default"] = "${REPOSITORY}/" + default.relative_to(root).as_posix()

Path(sys.argv[1]).write_text(json.dumps(document, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
