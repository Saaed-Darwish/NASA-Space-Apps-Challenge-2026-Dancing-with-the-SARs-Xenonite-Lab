import copy
import asyncio
import json
from pathlib import Path
import unittest
from sar_data import CATALOG, OBSERVATIONS
from forecast_data import ARTIFACTS
from test_security import invoke
from import_finalized_sar import subsidence, london_bounds


class FinalizedSarTests(unittest.TestCase):
    def test_london_coordinate_sheets_must_agree(self):
        point=CATALOG["GBR_LONDON_VERTICAL"].points[0]
        metadata={"point_id":point["id"],"area_label_approx":point["areaLabel"],
                  "easting_epsg3035_m":str(point["easting"]),"northing_epsg3035_m":str(point["northing"]),
                  "latitude_wgs84":str(point["latitude"]),"longitude_wgs84":str(point["longitude"]),
                  "mean_velocity_mm_per_year":str(point["velocity"]),"rmse_ts_mm":str(point["rmse"])}
        location={"hazard":"Land Subsidence","point_id_or_AOI":point["id"],"area_label":point["areaLabel"],
                  "coordinate_notes":"EGMS point; lat/lon derived from EPSG:3035",**{k:v for k,v in metadata.items() if k.endswith(("wgs84","3035_m"))}}
        sheets={"Point Metadata":[metadata],"Map Coordinates":[location],"Land Subsidence":[]}
        meta,_=subsidence(Path(__file__),sheets,"London")
        self.assertEqual(meta["points"][0]["coordinateNote"],location["coordinate_notes"])
        location["longitude_wgs84"]="1"
        with self.assertRaises(ValueError):subsidence(Path(__file__),sheets,"London")

    def test_london_rectangle_and_centroids_must_agree(self):
        location = dict(hazard="Flooding", latitude_wgs84="51.51", longitude_wgs84="0.06",
                        coordinate_notes="Centroid of original GEE rectangle [0.00,51.48,0.12,51.54]; not a per-pixel measurement")
        row = dict(latitude_wgs84="51.51", longitude_wgs84="0.06", coordinate_type="AOI centroid (not pixel location)")
        self.assertEqual(london_bounds({"Map Coordinates":[location]},"water",[row])["west"],0)
        for defect in ("missing", "duplicate", "malformed", "reversed", "latitude", "observation", "pixel"):
            loc, observation = copy.deepcopy(location), copy.deepcopy(row)
            if defect == "malformed": loc["coordinate_notes"] = "Unspecified"
            if defect == "reversed": loc["coordinate_notes"] = loc["coordinate_notes"].replace("0.00,51.48,0.12", "0.12,51.48,0.00")
            if defect == "latitude": loc["latitude_wgs84"] = "51.52"
            if defect == "observation": observation["longitude_wgs84"] = "0.07"
            if defect == "pixel": observation["coordinate_type"] = "pixel"
            mapped = [] if defect == "missing" else [loc,loc] if defect == "duplicate" else [loc]
            with self.subTest(defect=defect), self.assertRaises(ValueError):
                london_bounds({"Map Coordinates":mapped},"water",[observation])

    def test_every_finalized_dataset_has_a_matching_forecast(self):
        for key,meta in CATALOG.items():
            status,_,data=asyncio.run(invoke(path=f"/api/datasets/{key}/forecast"))
            self.assertEqual(status,200)
            self.assertEqual(data["status"],"available")
            self.assertEqual(data["datasetId"],key)
            self.assertEqual(data["regionId"],meta.regionId)
            self.assertEqual(data["sourceSha256"],meta.source["sha256"])
            self.assertEqual(data["unit"],"dB" if meta.kind=="forest" else meta.unit)

    def test_london_study_areas_do_not_inherit_point_coordinates(self):
        for key, bounds in (("GBR_EAST_LONDON", [0,51.48,.12,51.54]), ("GBR_EPPING_FOREST", [0,51.60,.08,51.69])):
            self.assertEqual(CATALOG[key].bounds.model_dump(), dict(zip(("west","south","east","north"), bounds)))
            self.assertEqual(CATALOG[key].geometryStatus,"study_area_only")
            self.assertIn("Coordinates_Completed.xlsx",CATALOG[key].source["file"])
        self.assertIsNone(CATALOG["GBR_LONDON_VERTICAL"].bounds)
        london=CATALOG["GBR_LONDON_VERTICAL"]
        self.assertEqual(len(london.points),8)
        self.assertTrue(all(p["locationStatus"]=="source_coordinates" for p in london.points))
        for dataset,pid in (("GBR_LONDON_VERTICAL","10UHknz6we"),("ITA_VENICE_VERTICAL","40d4mz3ZFY")):
            self.assertEqual(asyncio.run(invoke(path=f"/api/datasets/{dataset}/forecast",query_string="point_id="+pid))[0],422)

    def test_forest_export_deduplication_preserves_all_observations_and_seasons(self):
        expected={"BRA_PORTO_VELHO_FOREST":(324,303,12),"VNM_BINH_PHUOC_FOREST":(456,257,12),"ITA_BELLUNO_FOREST":(202,201,6),"GBR_EPPING_FOREST":(311,198,6)}
        for key,(records,history,months) in expected.items():
            self.assertEqual(len(OBSERVATIONS[key]),records)
            self.assertEqual(len(ARTIFACTS[key]["history"]),history)
            self.assertEqual(len(ARTIFACTS[key]["forecast"]),months)
            if months==6:
                self.assertEqual([r["month"] for r in ARTIFACTS[key]["forecast"]],[f"2027-{m:02d}" for m in range(5,11)])

    def test_regions_have_unique_pins_and_all_dataset_owners_are_present(self):
        context=json.loads((Path(__file__).parent/"data/earth_context.json").read_text(encoding="utf-8"))
        ids=[r["id"] for r in context["regions"]]
        self.assertEqual(len(ids),len(set(ids)))
        for dataset in CATALOG.values():self.assertIn(dataset.regionId,ids)
        for region in context["regions"]:
            self.assertEqual(set(region.get("datasetIds",[])),{k for k,v in CATALOG.items() if v.regionId==region["id"]})
        self.assertTrue(any(s["regionId"]=="london" for s in context["stories"]))
