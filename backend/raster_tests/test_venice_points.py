import json
from pathlib import Path
import unittest
from prepare_venice_points import georeference, grid_centre


class VeniceGridTests(unittest.TestCase):
    def setUp(self):
        catalog = json.loads((Path(__file__).resolve().parents[1] / "data/sar/catalog.json").read_text(encoding="utf-8"))
        self.points = next(d for d in catalog if d["id"] == "ITA_VENICE_VERTICAL")["points"]

    def test_grid_id_matches_source_and_axis_order_places_samples_in_venice(self):
        self.assertEqual(grid_centre("10UHknz6we"), (4504450, 2483350))
        mapped = georeference(self.points)
        self.assertAlmostEqual(mapped[0]["longitude"], 12.34142094, places=7)
        self.assertAlmostEqual(mapped[0]["latitude"], 45.43654091, places=7)
        for point in mapped:
            self.assertEqual(grid_centre(point["id"]), (point["easting"], point["northing"]))
        self.assertEqual({p["id"]: p["name"] for p in mapped},
                         {p["id"]: p["name"] for p in georeference(list(reversed(self.points)))})

    def test_reject_mismatched_ids_coordinates_and_selection(self):
        wrong = [dict(p) for p in self.points]
        wrong[0]["easting"] += 100
        with self.assertRaises(ValueError):
            georeference(wrong)
        with self.assertRaises(ValueError):
            georeference(self.points[:-1])
        with self.assertRaises(ValueError):
            grid_centre("not-an-egms-id")
