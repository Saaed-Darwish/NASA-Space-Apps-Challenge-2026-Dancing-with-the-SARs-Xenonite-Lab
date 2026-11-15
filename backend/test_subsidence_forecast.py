import asyncio
import json
from pathlib import Path
import unittest
from subsidence_forecast_data import ARTIFACTS, adapt_subsidence
from test_security import invoke


class SubsidenceForecastTests(unittest.TestCase):
    def test_every_point_has_its_own_history_horizon_and_signed_ranges(self):
        for pid in ARTIFACTS:
            status,_,data=asyncio.run(invoke(path=f"/api/datasets/{ARTIFACTS[pid]['datasetId']}/forecast",query_string="point_id="+pid))
            self.assertEqual(status,200)
            self.assertEqual(data["pointId"],pid)
            self.assertEqual(data["unit"],"mm")
            self.assertEqual(len(data["history"]),303 if data["regionId"]=="venice" else 302)
            self.assertEqual(len(data["forecast"]),24)
            self.assertEqual(data["forecast"][0]["month"],"2025-12")
            self.assertEqual(data["forecast"][-1]["month"],"2027-11")
            self.assertTrue(all(r["lower"]<=r["mean"]<=r["upper"] for r in data["forecast"]))
            self.assertTrue(data["forecast"][-1]["lower"] <= data["forecast"][-1]["mean"])
            self.assertEqual(data["selectedObservation"]["pointId"],pid)
        self.assertFalse(ARTIFACTS["10UHknz6we"]["backtest"]["beatNaive"])

    def test_foreign_points_are_rejected_and_default_is_stable(self):
        status,_,data=asyncio.run(invoke(path="/api/datasets/ITA_VENICE_VERTICAL/forecast"))
        self.assertEqual(status,200)
        self.assertEqual(data["pointId"],"10UHknz6we")
        for dataset in ("ITA_VENICE_VERTICAL","VNM_CAN_THO"):
            self.assertEqual(asyncio.run(invoke(path=f"/api/datasets/{dataset}/forecast",query_string="point_id=foreign"))[0],422)

    def test_reject_wrong_point_release_history_location_and_range(self):
        source=json.loads((Path(__file__).parent/"subsidence_forecast.json").read_bytes())
        for kind in ("point","history","dates","location","range","chronology","nonfinite","velocity"):
            value=json.loads(json.dumps(source));item=value["points"]["10UHknz6we"]
            if kind=="point":value["points"]["foreign"]=value["points"].pop("10UHknz6we")
            if kind=="history":item["history"][0]["mm"]+=1
            if kind=="dates":item["history"].reverse()
            if kind=="location":item["location"]["lat"]+=1
            if kind=="range":item["forecast"][0]["lower"]=10
            if kind=="chronology":item["forecast"][0]["month"]="2025-11"
            if kind=="nonfinite":item["forecast"][0]["mean"]=float("nan")
            if kind=="velocity":item["egms_published_velocity"]+=1
            with self.subTest(kind=kind),self.assertRaises(ValueError):adapt_subsidence(json.dumps(value).encode())
