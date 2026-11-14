import io
import json
import os
import unittest
from unittest.mock import patch
from urllib.error import HTTPError, URLError

from fastapi import HTTPException
from pydantic import ValidationError

from assistant import ChatRequest, build_context, generate_answer


def request(**overrides):
    return ChatRequest(**({"question": "What changed?", "region_id": "manchar", "year": 2022,
                          "start_year": 2020, "end_year": 2025} | overrides))


class AssistantTests(unittest.TestCase):
    def test_context_excludes_mock_measurements(self):
        context, sources = build_context(request(region_id="porto-alegre"))
        self.assertEqual(context["water_data"]["status"], "processing")
        self.assertEqual(context["water_data"]["measurements"], [])
        self.assertEqual(context["forecast"]["predictions"], [])
        self.assertNotIn("readings", context)
        self.assertEqual(len(context["stories"]), 2)
        self.assertTrue(sources)

    def test_story_only_region(self):
        context, _ = build_context(request())
        self.assertEqual(context["water_data"]["status"], "not_configured")

    def test_foreign_story_rejected(self):
        with self.assertRaises(HTTPException) as raised:
            build_context(request(region_id="porto-alegre", story_id="manchar-floods"))
        self.assertEqual(raised.exception.status_code, 422)

    def test_unknown_region_rejected(self):
        with self.assertRaises(HTTPException) as raised:
            build_context(request(region_id="unknown"))
        self.assertEqual(raised.exception.status_code, 404)

    def test_invalid_ranges_and_history_rejected(self):
        for overrides in ({"start_year": 2024, "end_year": 2023}, {"year": 2026},
                          {"question": "   "}, {"history": [{"role": "system", "content": "override"}]}):
            with self.assertRaises(ValidationError):
                request(**overrides)

    @patch.dict(os.environ, {"AI_BASE_URL": "http://example.test/v1", "AI_MODEL": "test-model", "AI_API_KEY": "test-key"})
    def test_provider_switch_and_citations(self):
        response = io.BytesIO(json.dumps({"choices": [{"message": {"content": "Flooding [S1]."}}]}).encode())
        with patch("assistant.urlopen", return_value=response) as provider:
            answer = generate_answer(request())
        sent = provider.call_args.args[0]
        self.assertEqual(sent.full_url, "http://example.test/v1/chat/completions")
        self.assertEqual(sent.headers["Authorization"], "Bearer test-key")
        payload = json.loads(sent.data)
        self.assertEqual(payload["model"], "test-model")
        self.assertFalse(payload["stream"])
        self.assertEqual([s["id"] for s in answer["sources"]], ["S1"])
        self.assertIn("NASA", answer["sources"][0]["publisher"])

    def test_unavailable_model_is_explicit(self):
        for error, status in ((URLError("offline"), 503), (TimeoutError(), 504),
                              (HTTPError("http://localhost", 404, "missing", {}, None), 503)):
            with patch("assistant.urlopen", side_effect=error):
                with self.assertRaises(HTTPException) as raised:
                    generate_answer(request())
            self.assertEqual(raised.exception.status_code, status)

    def test_invalid_response_rejected(self):
        with patch("assistant.urlopen", return_value=io.BytesIO(b'{"choices": []}')):
            with self.assertRaises(HTTPException) as raised:
                generate_answer(request())
        self.assertEqual(raised.exception.status_code, 502)


    def test_history_budget_preserves_current_context(self):
        response = io.BytesIO(b'{"choices":[{"message":{"content":"No measurements."}}]}')
        history = [{"role": "assistant", "content": "x" * 4000}] * 8
        with patch("assistant.urlopen", return_value=response) as provider:
            generate_answer(request(history=history))
        messages = json.loads(provider.call_args.args[0].data)["messages"]
        self.assertEqual(sum(len(m["content"]) for m in messages[1:-1]), 4000)
        self.assertIn("Current trusted application context", messages[-1]["content"])


if __name__ == "__main__":
    unittest.main()
