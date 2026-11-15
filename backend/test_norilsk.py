import asyncio
import hashlib
import json
from pathlib import Path
import unittest

from sar_data import CATALOG, OBSERVATIONS
from test_security import invoke

ROOT = Path(__file__).resolve().parent.parent
DATASET = "NOR_TPP3_TANK_VERTICAL"


class NorilskTests(unittest.TestCase):
    def test_source_table_and_segmented_readings_are_traceable(self):
        meta = CATALOG[DATASET]
        table = ROOT / "frontend/public/norilsk/tables/tank_points_series.csv"
        self.assertEqual(hashlib.sha256(table.read_bytes()).hexdigest(), meta.source["sha256"])
        self.assertFalse(meta.forecastAvailable)
        self.assertEqual(meta.pointBadge, "SENTINEL-1 TARGETS")
        for point in meta.points:
            self.assertIsNone(point["velocity"])
            series = sorted((r for r in OBSERVATIONS[DATASET] if r.pointId == point["id"]), key=lambda r: r.date)
            segments = {r.details["segment"] for r in series}
            self.assertGreater(len(segments), 1)
            for segment in segments:
                self.assertEqual(next(r.value for r in series if r.details["segment"] == segment), 0)
        tank = sorted((r for r in OBSERVATIONS[DATASET] if r.pointId == "NOR_TANK5"), key=lambda r: r.date)
        self.assertEqual(tank[-1].date.isoformat(), "2020-04-04")
        self.assertEqual(tank[-1].value, -14.4)

    def test_observations_available_but_no_invented_forecast(self):
        status, _, data = asyncio.run(invoke(path=f"/api/datasets/{DATASET}/observations", query_string="point_id=NOR_TANK5"))
        self.assertEqual(status, 200)
        self.assertTrue(all(r["pointId"] == "NOR_TANK5" for r in data["observations"]))
        status, _, data = asyncio.run(invoke(path=f"/api/datasets/{DATASET}/forecast"))
        self.assertEqual(status, 200)
        self.assertEqual(data["status"], "unavailable")
        status, _, _ = asyncio.run(invoke(path=f"/api/datasets/{DATASET}/forecast", query_string="point_id=10UHknz6we"))
        self.assertEqual(status, 422)

    def test_every_ground_overlay_has_geographic_display_asset(self):
        evidence = json.loads((ROOT / "frontend/src/data/norilsk.json").read_text(encoding="utf-8"))
        self.assertEqual(len(evidence["overlays"]), 14)
        for item in evidence["overlays"]:
            self.assertTrue(item["imageUrl"].startswith("/norilsk/overlays/overlay_"))
            asset = ROOT / "frontend/public" / item["imageUrl"].lstrip("/")
            self.assertEqual(asset.read_bytes()[:8], b"\x89PNG\r\n\x1a\n")
            self.assertLess(item["bounds"]["west"], item["bounds"]["east"])
            self.assertLess(item["bounds"]["south"], item["bounds"]["north"])
            self.assertGreater(item["limit"], 0)
