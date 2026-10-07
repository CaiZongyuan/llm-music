"""Read current application diagnostics without creating Projects or Jobs."""

import argparse
import json
from pathlib import Path
from urllib.request import urlopen


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8000")
    parser.add_argument("--output", type=Path, required=True, help="New snapshot file; existing files are preserved")
    arguments = parser.parse_args()
    snapshots = {}
    for path in ["/health", "/runtime/capabilities", "/runtime/models", "/runtime/diagnostics", "/settings/metadata"]:
        with urlopen(arguments.url.rstrip("/") + path, timeout=60) as response:
            snapshots[path] = json.load(response)
    arguments.output.parent.mkdir(parents=True, exist_ok=True)
    with arguments.output.open("x", encoding="utf-8") as output:
        json.dump(snapshots, output, indent=2, ensure_ascii=False)
        output.write("\n")
    print("Saved sourced diagnostics. Check mode, availability, freshness and per-operation reasons before submission.")


if __name__ == "__main__":
    main()
