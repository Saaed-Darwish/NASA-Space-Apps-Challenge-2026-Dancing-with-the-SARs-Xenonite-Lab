import asyncio
import json
from pathlib import Path
import unittest
from forecast_data import ARTIFACTS, adapt_forecasts
from test_security import invoke


class ForecastTests(unittest.TestCase):
    def test_supported_exports_and_provenance(self):
        for key in ("BRA_PORTO_VELHO", "VNM_CAN_THO"):
            status, _, data = asyncio.run(invoke(path=f"/api/datasets/{key}/forecast"))
            self.assertEqual(status, 200)
            self.assertEqual(data["status"], "available")
            self.assertEqual(len(data["history"]), 95)
            self.assertEqual(len(data["forecast"]), 12)
            self.assertEqual(data["forecast"][0]["month"], "2026-12")
            self.assertEqual(data["forecast"][-1]["month"], "2027-11")
            self.assertTrue(data["history"][-1]["partial"])
            self.assertEqual(data["evaluationStatus"], "requires_revalidation")
            self.assertNotIn("backtest", data)
            self.assertEqual(len(data["artifactSha256"]), 64)
            for row in data["history"]:
                self.assertEqual(row["filled"], row["observationCount"] == 0)

    def test_unavailable_and_unknown_are_distinct(self):
        status, _, data = asyncio.run(invoke(path="/api/datasets/ITA_VENICE_VERTICAL/forecast"))
        self.assertEqual(status, 200)
        self.assertEqual(data["status"], "unavailable")
        self.assertEqual(asyncio.run(invoke(path="/api/datasets/UNKNOWN/forecast"))[0], 404)

    def test_reject_incompatible_release_ranges_and_chronology(self):
        source = (Path(__file__).parent / "forecasts.json").read_bytes()
        for kind in ("history", "range", "chronology", "bounds"):
            data = json.loads(source)
            item = data["regions"]["BRA_PORTO_VELHO"]
            if kind == "history": item["history"][0]["value"] += 1
            if kind == "range": item["forecast"][0]["lower"] = 9000
            if kind == "chronology": item["forecast"][0]["month"] = "2026-11"
            if kind == "bounds": item["location"]["bounds"]["east"] += .1
            with self.subTest(kind=kind), self.assertRaises(ValueError):
                adapt_forecasts(json.dumps(data).encode())

    def test_filled_month_counts(self):
        self.assertEqual(sum(r["filled"] for r in ARTIFACTS["BRA_PORTO_VELHO"]["history"]), 2)
        self.assertEqual(sum(r["filled"] for r in ARTIFACTS["VNM_CAN_THO"]["history"]), 1)


if __name__ == "__main__": unittest.main()
