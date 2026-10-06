"""Create an original CC0 PCM reference and exercise the public application API."""

import argparse
from array import array
import hashlib
import json
import math
import sys
from pathlib import Path
from urllib.request import Request, urlopen
import uuid
import wave


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8000")
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=False)
    rate = 24000
    samples = array("h")
    melody = [60, 64, 67, 64, 62, 65, 69, 65, 64, 67, 72, 67, 62, 65, 67, 60]
    for note in melody:
        frequency = 440 * 2 ** ((note - 69) / 12)
        for index in range(rate):
            envelope = min(1, index / (rate * 0.01), (rate - index) / (rate * 0.04))
            samples.append(round(32767 * 0.2 * envelope * math.sin(2 * math.pi * frequency * index / rate)))
    source = args.output_dir / "reference.wav"
    if sys.byteorder != "little":
        samples.byteswap()
    with wave.open(str(source), "wb") as writer:
        writer.setparams((1, 2, rate, 0, "NONE", "not compressed"))
        writer.writeframes(samples.tobytes())
    data = source.read_bytes()

    def request(path: str, body: bytes | None = None, content_type: str | None = None) -> bytes:
        headers = {"Content-Type": content_type} if content_type else {}
        with urlopen(Request(args.url.rstrip("/") + path, data=body, headers=headers), timeout=30) as response:
            return response.read()

    project = json.loads(request("/projects", json.dumps({"name": "Morning song", "description": "Original reference melody"}).encode(), "application/json"))
    receipt = dict(project=project, url=args.url, verified_original_bytes=False)
    receipt_path = args.output_dir / "receipt.json"
    receipt_path.write_text(json.dumps(receipt, indent=2), encoding="utf-8")
    boundary = "music-reference-" + uuid.uuid4().hex
    body = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="reference.wav"\r\nContent-Type: audio/wav\r\n\r\n'.encode()
            + data + f"\r\n--{boundary}--\r\n".encode())
    base = "/projects/" + project["id"] + "/assets"
    asset = json.loads(request(base, body, "multipart/form-data; boundary=" + boundary))
    receipt["asset"] = asset
    receipt_path.write_text(json.dumps(receipt, indent=2), encoding="utf-8")
    downloaded = request(base + "/" + asset["id"] + "/content")
    if downloaded != data or asset["sha256"] != hashlib.sha256(data).hexdigest():
        raise ValueError("Downloaded Asset does not match the original reference")
    (args.output_dir / "downloaded.wav").write_bytes(downloaded)
    receipt["verified_original_bytes"] = True
    receipt_path.write_text(json.dumps(receipt, indent=2), encoding="utf-8")
    print(json.dumps(receipt, indent=2))


if __name__ == "__main__":
    main()
