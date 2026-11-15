import asyncio
import json
import unittest
from unittest.mock import patch

import main
from assistant import CATALOG
from security import MAX_REQUEST_BYTES
from test_assistant import request


async def invoke(method="GET", path="/api/health", headers=(), chunks=(b"",), query_string=""):
    messages = []
    remaining = list(chunks)

    async def receive():
        if not remaining:
            return {"type": "http.disconnect"}
        body = remaining.pop(0)
        return {"type": "http.request", "body": body, "more_body": bool(remaining)}

    async def send(message):
        messages.append(message)

    await main.app({
        "type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1",
        "method": method, "scheme": "http", "path": path, "raw_path": path.encode(),
        "query_string": query_string.encode(), "headers": list(headers),
        "client": ("127.0.0.1", 12345), "server": ("localhost", 8000),
        "root_path": "",
    }, receive, send)
    start = next(m for m in messages if m["type"] == "http.response.start")
    body = b"".join(m.get("body", b"") for m in messages if m["type"] == "http.response.body")
    headers = dict(start["headers"])
    parsed = json.loads(body) if body and b"application/json" in headers.get(b"content-type", b"") else body.decode()
    return start["status"], headers, parsed


class SecurityTests(unittest.TestCase):
    def call(self, **kwargs):
        return asyncio.run(invoke(**kwargs))

    def test_health_and_headers(self):
        status, headers, body = self.call()
        self.assertEqual(status, 200)
        self.assertEqual(body, {"status": "healthy"})
        self.assertEqual(headers[b"x-content-type-options"], b"nosniff")

    def test_untrusted_browser_origin_rejected_before_inference(self):
        with patch("main.generate_answer") as model:
            status, _, _ = self.call(method="POST", path="/api/chat", headers=[
                (b"origin", b"https://untrusted.example"), (b"content-type", b"application/json"),
            ])
        self.assertEqual(status, 403)
        model.assert_not_called()

    def test_simple_cross_site_content_type_rejected(self):
        status, _, _ = self.call(method="POST", path="/api/chat", headers=[(b"content-type", b"text/plain")])
        self.assertEqual(status, 415)

    def test_cors_preflight_preserves_trusted_browser_access(self):
        status, headers, _ = self.call(method="OPTIONS", path="/api/chat", headers=[
            (b"origin", b"http://localhost:5173"),
            (b"access-control-request-method", b"POST"),
            (b"access-control-request-headers", b"content-type"),
        ])
        self.assertEqual(status, 200)
        self.assertEqual(headers[b"access-control-allow-origin"], b"http://localhost:5173")

    def test_utf8_history_within_field_limits_fits_request_cap(self):
        body = request(question="\U0001F30D" * 1000,
                       history=[{"role": "user", "content": "\U0001F30D" * 4000}] * 8)
        raw = body.model_dump_json().encode()
        self.assertLess(len(raw), MAX_REQUEST_BYTES)
        with patch("main.generate_answer", return_value={"text": "Answer", "sources": []}):
            status, _, _ = self.call(method="POST", path="/api/chat",
                headers=[(b"content-type", b"application/json")], chunks=(raw,))
        self.assertEqual(status, 200)

    def test_body_limits_with_and_without_content_length(self):
        for extra, chunks in [
            ([(b"content-length", str(MAX_REQUEST_BYTES + 1).encode())], (b"",)),
            ([], (b"a" * 100000, b"a" * 60001)),
        ]:
            status, _, _ = self.call(method="POST", path="/api/chat",
                headers=[(b"content-type", b"application/json"), *extra], chunks=chunks)
            self.assertEqual(status, 413)

    def test_trusted_origin_and_chunked_json_reach_model(self):
        raw = request().model_dump_json().encode()
        with patch("main.generate_answer", return_value={"text": "Grounded answer", "sources": []}) as model:
            status, headers, body = self.call(method="POST", path="/api/chat", headers=[
                (b"origin", b"http://localhost:5173"), (b"content-type", b"application/json; charset=utf-8"),
            ], chunks=(raw[:20], raw[20:]))
        self.assertEqual(status, 200)
        self.assertEqual(body["text"], "Grounded answer")
        self.assertEqual(headers[b"cache-control"], b"no-store")
        self.assertEqual(headers[b"access-control-allow-origin"], b"http://localhost:5173")
        model.assert_called_once()

    def test_api_regions_match_the_shared_catalogue(self):
        status, _, regions = self.call(path="/api/regions")
        self.assertEqual(status, 200)
        self.assertEqual({r["id"] for r in regions}, {r["id"] for r in CATALOG["regions"]})
        self.assertTrue(next(r for r in regions if r["id"] == "porto-velho")["waterMonitoring"])

    def test_inference_slot_is_released_after_failure(self):
        with patch("main.generate_answer", side_effect=RuntimeError("test")):
            with self.assertRaises(RuntimeError):
                main.chat(request())
        self.assertTrue(main.chat_slot.acquire(blocking=False))
        try:
            status, _, _ = self.call(method="POST", path="/api/chat",
                headers=[(b"content-type", b"application/json")], chunks=(request().model_dump_json().encode(),))
            self.assertEqual(status, 429)
        finally:
            main.chat_slot.release()


if __name__ == "__main__":
    unittest.main()
