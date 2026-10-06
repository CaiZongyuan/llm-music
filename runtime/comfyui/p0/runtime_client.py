"""Small public ComfyUI HTTP boundary for P0 verification tools."""

import json
import mimetypes
from pathlib import Path
import time
from urllib.error import HTTPError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen
import uuid


class RuntimeFailure(RuntimeError):
    def __init__(self, endpoint, message, status=None, details=None):
        self.endpoint, self.message, self.status, self.details = endpoint, message, status, details
        super().__init__(f"Runtime {endpoint}: {message}" + (f" (HTTP {status})" if status else ""))


class RuntimeClient:
    def __init__(self, base_url="http://127.0.0.1:8188", timeout=30):
        self.base_url, self.timeout = base_url.rstrip("/"), timeout

    def _request(self, endpoint, data=None, content_type=None):
        headers = {"Content-Type": content_type} if content_type else {}
        request = Request(self.base_url + endpoint, data=data, headers=headers)
        try:
            with urlopen(request, timeout=self.timeout) as response:
                return response.read()
        except HTTPError as error:
            body = error.read().decode("utf-8", errors="replace")
            try:
                details = json.loads(body)
            except ValueError:
                details = body[:4096]
            raise RuntimeFailure(endpoint, json.dumps(details, ensure_ascii=False), error.code, details) from error
        except OSError as error:
            raise RuntimeFailure(endpoint, f"Connection failed: {error}. Confirm the owned Runtime is running.") from error

    def _json(self, endpoint, data=None, content_type=None):
        raw = self._request(endpoint, data, content_type)
        try:
            result = json.loads(raw)
        except (ValueError, UnicodeDecodeError) as error:
            raise RuntimeFailure(endpoint, "Response is not valid JSON; verify Runtime address and logs.") from error
        if not isinstance(result, dict):
            raise RuntimeFailure(endpoint, "Expected a JSON object from Runtime.")
        if result.get("ok") is False:
            raise RuntimeFailure(endpoint, str(result.get("error", "Runtime rejected the request")), details=result)
        return result

    def get_json(self, endpoint):
        return self._json(endpoint)

    def post_json(self, endpoint, payload):
        return self._json(endpoint, json.dumps(payload).encode("utf-8"), "application/json")

    def submit(self, graph, client_id=None):
        payload = {"prompt": graph, "client_id": client_id or str(uuid.uuid4())}
        result = self.post_json("/prompt", payload)
        identifier = result.get("prompt_id")
        if not isinstance(identifier, str) or not identifier or result.get("node_errors"):
            raise RuntimeFailure("/prompt", "Submission returned no valid prompt_id or reported node errors.", details=result)
        return identifier

    def history(self, prompt_id):
        result = self.get_json("/history/" + quote(prompt_id, safe=""))
        entry = result.get(prompt_id)
        if entry is not None and not isinstance(entry, dict):
            raise RuntimeFailure("/history", "History entry is not a JSON object.", details=result)
        return entry

    def wait(self, prompt_id, timeout=1800, poll_interval=1):
        deadline = time.monotonic() + timeout
        while True:
            entry = self.history(prompt_id)
            if entry:
                status = entry.get("status", {})
                if status.get("status_str") == "error":
                    raise RuntimeFailure("/history", "Execution failed: " + json.dumps(status, ensure_ascii=False), details=entry)
                if status.get("completed") is True:
                    if status.get("status_str") != "success":
                        raise RuntimeFailure("/history", "Execution ended without success.", details=entry)
                    return entry
            if time.monotonic() >= deadline:
                raise RuntimeFailure("/history", f"Timed out waiting for {prompt_id}; request remains owned by this run. Inspect history/queue before retrying.")
            time.sleep(min(poll_interval, max(0, deadline - time.monotonic())))

    def artifact(self, descriptor):
        if not isinstance(descriptor.get("filename"), str) or not descriptor["filename"]:
            raise RuntimeFailure("/view", "Artifact has no filename.", details=descriptor)
        query = urlencode({key: descriptor.get(key, "output" if key == "type" else "")
                           for key in ["filename", "subfolder", "type"]})
        return self._request("/view?" + query)

    def upload(self, path, subfolder=""):
        path = Path(path)
        boundary = "music-p0-" + uuid.uuid4().hex
        chunks = []
        for key, value in {"type": "input", "subfolder": subfolder}.items():
            chunks.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'.encode())
        filename = path.name.replace('"', "_").replace("\r", "_").replace("\n", "_")
        mime = mimetypes.guess_type(filename)[0] or "application/octet-stream"
        chunks.append(f'--{boundary}\r\nContent-Disposition: form-data; name="image"; filename="{filename}"\r\nContent-Type: {mime}\r\n\r\n'.encode())
        chunks.extend([path.read_bytes(), f"\r\n--{boundary}--\r\n".encode()])
        result = self._json("/upload/image", b"".join(chunks), f"multipart/form-data; boundary={boundary}")
        if not isinstance(result.get("name"), str) or not result["name"] or result.get("type") != "input":
            raise RuntimeFailure("/upload/image", "Upload returned no input file descriptor.", details=result)
        return result
