"""Runtime API boundary tests use a local fake HTTP server, never GPU evidence."""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from contextlib import contextmanager
import json
import threading
import unittest
from urllib.parse import parse_qs, urlsplit

from runtime.comfyui.p0.runtime_client import RuntimeClient, RuntimeFailure


class RuntimeClientTests(unittest.TestCase):
    @contextmanager
    def server(self, handler):
        server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            yield RuntimeClient(f"http://127.0.0.1:{server.server_port}")
        finally:
            server.shutdown()
            server.server_close()
            thread.join()

    def test_successful_history_and_artifact_preserve_observed_runtime_data(self):
        terminal = {"outputs": {"save": {"audio": [{"filename": "take one.wav", "type": "output"}]}},
                    "status": {"status_str": "success", "completed": True, "messages": [["execution_success", {"timestamp": 123}]]}}
        artifact_bytes = b"known external artifact bytes"

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                self.send_response(200)
                self.end_headers()
                if self.path.startswith("/history/"):
                    self.wfile.write(json.dumps({"fixed-prompt": terminal}).encode())
                else:
                    query = parse_qs(urlsplit(self.path).query)
                    if query["filename"] == ["take one.wav"] and query["subfolder"] == ["p0/run"]:
                        self.wfile.write(artifact_bytes)

            def log_message(self, *args):
                pass

        with self.server(Handler) as client:
            self.assertEqual(client.wait("fixed-prompt", timeout=1), terminal)
            self.assertEqual(client.artifact({"filename": "take one.wav", "subfolder": "p0/run", "type": "output"}), artifact_bytes)

    def test_failed_history_preserves_model_diagnostic_and_is_never_a_success(self):
        terminal = {"status": {"status_str": "error", "completed": True,
                               "messages": [["execution_error", {"exception_message": "SheetSage2 model is missing; download is off"}]]}, "outputs": {}}

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                self.send_response(200)
                self.end_headers()
                self.wfile.write(json.dumps({"failed-prompt": terminal}).encode())

            def log_message(self, *args):
                pass

        with self.server(Handler) as client:
            self.assertEqual(client.history("failed-prompt"), terminal)
            with self.assertRaises(RuntimeFailure) as failure:
                client.wait("failed-prompt", timeout=1)
            self.assertEqual(failure.exception.details, terminal)
            self.assertIn("SheetSage2 model is missing", str(failure.exception))

    def test_rejected_workflow_reports_public_node_errors_without_retrying_submission(self):
        received = []

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):
                received.append(json.loads(self.rfile.read(int(self.headers["Content-Length"]))))
                body = json.dumps({"error": {"message": "Prompt outputs failed validation"},
                                   "node_errors": {"transcribe": {"errors": [{"message": "Missing audio"}]}}}).encode()
                self.send_response(400)
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, *args):
                pass

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            client = RuntimeClient(f"http://127.0.0.1:{server.server_port}")
            with self.assertRaises(RuntimeFailure) as failure:
                client.submit({"transcribe": {"class_type": "YuE2Transcribe", "inputs": {}}}, "fixed-client")
            self.assertEqual(failure.exception.status, 400)
            self.assertEqual(failure.exception.endpoint, "/prompt")
            self.assertIn("Missing audio", str(failure.exception))
            self.assertEqual(len(received), 1)
            self.assertEqual(received[0]["client_id"], "fixed-client")
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == "__main__":
    unittest.main()
