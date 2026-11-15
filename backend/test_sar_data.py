import asyncio
import unittest
import json
from pathlib import Path
from fastapi import HTTPException
from sar_data import CATALOG, OBSERVATIONS, selected_context
from test_security import invoke
from assistant import build_context
from test_assistant import request


class SarTests(unittest.TestCase):
    def call(self, path, query=""):
        return asyncio.run(invoke(path=path, query_string=query))

    def test_artifacts_preserve_handoff_counts_and_quality(self):
        expected = {"BRA_PORTO_VELHO": (259,259), "BRA_PORTO_VELHO_FOREST": (324,304),
                    "VNM_CAN_THO": (337,337), "VNM_BINH_PHUOC_FOREST": (456,257),
                    "ITA_VENICE_VERTICAL": (2424,2424), "ITA_VENICE": (379,379), "ITA_BELLUNO_FOREST": (202,202),
                    "GBR_EAST_LONDON": (597,154), "GBR_EPPING_FOREST": (311,311), "GBR_LONDON_VERTICAL": (2416,2416)}
        self.assertEqual(set(CATALOG),set(expected))
        for key,(total,passing) in expected.items():
            self.assertEqual(len(OBSERVATIONS[key]),total)
            self.assertEqual(sum(r.qualityPass for r in OBSERVATIONS[key]),passing)
            self.assertEqual(len(CATALOG[key].source["sha256"]),64)

    def test_frontend_and_backend_catalogues_are_the_same_release(self):
        front=json.loads((Path(__file__).resolve().parent.parent/"frontend/src/data/sarCatalog.json").read_text(encoding="utf-8"))
        self.assertEqual({d["id"]:d for d in front},{key:value.model_dump(mode="json") for key,value in CATALOG.items()})

    def test_region_scope_and_retained_porto_alegre_stories(self):
        status,_,items=self.call("/api/datasets", "region_id=porto-velho")
        self.assertEqual(status,200)
        self.assertEqual({r["id"] for r in items},{"BRA_PORTO_VELHO","BRA_PORTO_VELHO_FOREST"})
        _,_,items=self.call("/api/datasets", "region_id=rio-grande-do-sul")
        self.assertEqual(items,[])
        context,_=build_context(request(region_id="rio-grande-do-sul"))
        self.assertEqual(len(context["stories"]),4)
        _,_,regions=self.call("/api/regions")
        self.assertNotIn("porto-alegre",{r["id"] for r in regions})

    def test_default_quality_filter_and_rejected_inspection(self):
        path="/api/datasets/VNM_BINH_PHUOC_FOREST/observations"
        status,_,data=self.call(path)
        self.assertEqual(status,200)
        self.assertEqual(data["total"],257)
        self.assertTrue(all(r["qualityPass"] for r in data["observations"]))
        _,_,data=self.call(path,"quality=rejected")
        self.assertEqual(data["total"],199)
        self.assertTrue(all(not r["qualityPass"] for r in data["observations"]))

    def test_pagination_dates_and_invalid_filters(self):
        path="/api/datasets/BRA_PORTO_VELHO/observations"
        _,_,first=self.call(path,"limit=2")
        _,_,second=self.call(path,"limit=2&offset=2")
        self.assertEqual(first["nextOffset"],2)
        self.assertTrue({r["id"] for r in first["observations"]}.isdisjoint(r["id"] for r in second["observations"]))
        _,_,filtered=self.call(path,"start=2026-11-01&end=2026-11-13")
        self.assertEqual(filtered["total"],3)  # repeated acquisitions are preserved, not silently summed
        for query in ("limit=501","offset=-1","quality=bogus","start=2025-01-01&end=2024-01-01","point_id=foreign"):
            self.assertEqual(self.call(path,query)[0],422)
        self.assertEqual(self.call("/api/datasets/UNKNOWN/observations")[0],404)

    def test_venice_point_histories_preserve_ids_and_inferred_grid_positions(self):
        meta=CATALOG["ITA_VENICE_VERTICAL"]
        self.assertIsNone(meta.bounds)
        self.assertEqual(meta.geometryStatus,"source_coordinates")
        for point in meta.points:
            _,_,data=self.call("/api/datasets/ITA_VENICE_VERTICAL/observations","point_id="+point["id"])
            self.assertEqual(data["total"],303)
            self.assertTrue(all(r["pointId"]==point["id"] for r in data["observations"]))
            self.assertEqual(point["locationStatus"], "source_coordinates")
            self.assertEqual(point["gridSizeMeters"], 100)
            self.assertTrue(point["name"].startswith("Venice Point "))
            self.assertTrue(45.3 < point["latitude"] < 45.6)
            self.assertTrue(12.2 < point["longitude"] < 12.5)

    def test_grounded_context_enforces_dataset_and_observation_ownership(self):
        context,_=build_context(request(region_id="porto-velho",dataset_id="BRA_PORTO_VELHO"))
        self.assertEqual(context["water_data"]["status"],"observations_available")
        self.assertEqual(context["sar_observation"]["observation"]["date"],"2026-11-13")
        self.assertEqual(context["water_data"]["unit"],"km²")
        for region,key,record in [("rio-grande-do-sul","BRA_PORTO_VELHO",None),
                                  ("porto-velho","BRA_PORTO_VELHO","VNM_CAN_THO:2")]:
            with self.assertRaises(HTTPException):selected_context(region,key,record)


if __name__ == "__main__":
    unittest.main()
