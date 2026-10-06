"""ABC validation consumes the public parser response, never plugin internals."""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import threading
import unittest

from runtime.comfyui.p0.runtime_client import RuntimeClient, RuntimeFailure
from runtime.comfyui.p0.score_validation import validate_abc


class ScoreValidationTests(unittest.TestCase):
    def test_http_success_with_empty_score_is_not_a_valid_transcription(self):
        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):
                self.rfile.read(int(self.headers["Content-Length"]))
                self.send_response(200)
                self.end_headers()
                self.wfile.write(json.dumps({"ok": True, "sheet": {"seconds": 2, "bars": [{}], "notes": {}, "cut": False}}).encode())

            def log_message(self, *args):
                pass

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with self.assertRaises(RuntimeFailure) as failure:
                validate_abc(RuntimeClient(f"http://127.0.0.1:{server.server_port}"), "X:1\nK:C\n")
            self.assertIn("notes", str(failure.exception))
        finally:
            server.shutdown()
            server.server_close()
            thread.join()
