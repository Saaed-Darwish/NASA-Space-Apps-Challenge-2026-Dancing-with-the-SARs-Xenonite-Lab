from datetime import date
import json
from pathlib import Path
import unittest
import numpy as np


class SubsidenceExportTests(unittest.TestCase):
    def test_supplied_forecast_means_and_model_choice_reproduce_from_point_readings(self):
        root=Path(__file__).resolve().parents[1]
        export=json.loads((root/"subsidence_forecast.json").read_bytes())
        observations=json.loads((root/"data/sar/ITA_VENICE_VERTICAL.json").read_bytes())+json.loads((root/"data/sar/GBR_LONDON_VERTICAL.json").read_bytes())
        def design(t,accel):
            columns=[np.ones_like(t),t,np.cos(2*np.pi*t),np.sin(2*np.pi*t)]
            return np.column_stack(columns+([.5*t*t] if accel else []))
        for pid,item in export["points"].items():
            rows=sorted([r for r in observations if r["pointId"]==pid],key=lambda r:r["date"])
            origin=date.fromisoformat(rows[0]["date"])
            t=np.array([(date.fromisoformat(r["date"])-origin).days/365.25 for r in rows])
            y=np.array([r["value"] for r in rows]);train=t<=t.max()-1;test=~train
            errors=[]
            for accel in (False,True):
                beta=np.linalg.lstsq(design(t[train],accel),y[train],rcond=None)[0]
                errors.append(np.mean(np.abs(y[test]-design(t[test],accel)@beta)))
            chosen=bool(errors[1]<.9*errors[0])
            self.assertEqual(chosen,"acceleration" in item["forecast_model"])
            beta=np.linalg.lstsq(design(t,chosen),y,rcond=None)[0]
            future=np.array([(date.fromisoformat(r["month"]+"-01")-origin).days/365.25 for r in item["forecast"]])
            np.testing.assert_allclose(design(future,chosen)@beta,[r["mean"] for r in item["forecast"]],atol=.005001,rtol=0)
