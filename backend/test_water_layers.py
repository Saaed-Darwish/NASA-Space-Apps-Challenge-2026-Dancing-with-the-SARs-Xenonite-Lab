import asyncio
from hashlib import sha256
import unittest
from pydantic import ValidationError
from water_layers import LAYERS, WaterLayer
from test_security import invoke


class WaterLayerTests(unittest.TestCase):
    def test_ai_keeps_raster_comparisons_distinct_from_workbook_readings(self):
        from assistant import build_context
        from test_assistant import request
        context,sources=build_context(request(region_id="can-tho",dataset_id="VNM_CAN_THO"))
        self.assertEqual(len(context["spatial_water_comparisons"]),3)
        self.assertEqual(context["sar_observation"]["observation"]["date"],"2026-11-03")
        self.assertTrue(all(r["after_date"].startswith("2024-") for r in context["spatial_water_comparisons"]))
        self.assertTrue(any("Planetary Computer" in s["publisher"] for s in sources))

    def test_catalogues_are_scoped_and_not_reused_for_other_hazards(self):
        for dataset_id in ("BRA_PORTO_VELHO","VNM_CAN_THO","GBR_EAST_LONDON","ITA_VENICE"):
            status,_,data=asyncio.run(invoke(path=f"/api/datasets/{dataset_id}/water-changes"))
            self.assertEqual(status,200)
            self.assertEqual(data["status"],"available")
            self.assertEqual(len(data["comparisons"]),3)
            self.assertTrue(all(r["datasetId"]==dataset_id for r in data["comparisons"]))
        for dataset_id in ("BRA_PORTO_VELHO_FOREST","VNM_BINH_PHUOC_FOREST","ITA_VENICE_VERTICAL"):
            _,_,data=asyncio.run(invoke(path=f"/api/datasets/{dataset_id}/water-changes"))
            self.assertEqual(data["status"],"unavailable")
            self.assertEqual(data["comparisons"],[])
        self.assertEqual(asyncio.run(invoke(path="/api/datasets/UNKNOWN/water-changes"))[0],404)

    def test_london_mosaic_components_are_traced_and_same_pass(self):
        layers=[l for l in LAYERS.values() if l.datasetId=="GBR_EAST_LONDON"]
        self.assertEqual(len(layers),3)
        for layer in layers:
            for source in (layer.before,layer.after):
                self.assertEqual(len(source.components),2)
                self.assertEqual(source.relativeOrbit,81)
                self.assertEqual(source.orbitState,"descending")
                data=layer.model_dump(mode="json")
                data["before"]["components"][1]["datetime"]=data["after"]["datetime"]
                with self.assertRaises(ValidationError):WaterLayer.model_validate(data)

    def test_venice_uses_source_aoi_track_and_serves_all_images(self):
        from sar_data import CATALOG
        layers=[l for l in LAYERS.values() if l.datasetId=="ITA_VENICE"]
        self.assertEqual(len(layers),3)
        for layer in layers:
            self.assertEqual(layer.bounds,CATALOG["ITA_VENICE"].bounds)
            self.assertEqual(layer.before.relativeOrbit,95)
            self.assertEqual(layer.after.relativeOrbit,95)
            self.assertEqual(layer.before.orbitState,"descending")
            self.assertGreaterEqual(layer.summary.validFraction,.95)
            self.assertTrue(any(note.startswith("Lagoon conditions:") for note in layer.limitations))
            status,_,png=asyncio.run(invoke(path=f"/api/water-changes/{layer.id}/{layer.pngSha256}.png"))
            self.assertEqual(status,200)
            self.assertEqual(sha256(png).hexdigest(),layer.pngSha256)

    def test_images_are_fixed_content_addressed_pngs(self):
        layer=next(iter(LAYERS.values()))
        status,headers,png=asyncio.run(invoke(path=f"/api/water-changes/{layer.id}/{layer.pngSha256}.png"))
        self.assertEqual(status,200)
        self.assertEqual(headers[b"content-type"],b"image/png")
        self.assertEqual(sha256(png).hexdigest(),layer.pngSha256)
        self.assertIn(b"immutable",headers[b"cache-control"])
        self.assertEqual(asyncio.run(invoke(path=f"/api/water-changes/{layer.id}/{'0'*64}.png"))[0],404)
        self.assertEqual(asyncio.run(invoke(path=f"/api/water-changes/FOREIGN/{layer.pngSha256}.png"))[0],404)

    def test_incompatible_pairs_and_inconsistent_areas_rejected(self):
        original=next(iter(LAYERS.values())).model_dump(mode="json")
        for change in ("chronology","track","region","area","token"):
            data=__import__("copy").deepcopy(original)
            if change=="chronology":data["beforeDate"]=data["afterDate"]
            if change=="track":data["after"]["relativeOrbit"]+=1
            if change=="region":data["datasetId"]="BRA_PORTO_VELHO_FOREST"
            if change=="area":data["summary"]["gainedKm2"]=data["summary"]["totalAreaKm2"]*2
            if change=="token":data["before"]["assetUrl"]+="?sig=temporary-token"
            with self.subTest(change=change),self.assertRaises(ValidationError):WaterLayer.model_validate(data)


if __name__=="__main__":unittest.main()
