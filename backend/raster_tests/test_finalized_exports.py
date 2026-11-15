from datetime import date
import json
from pathlib import Path
import unittest
import numpy as np
from pyproj import Transformer


class FinalizedExportsTests(unittest.TestCase):
    def test_forest_export_means_reproduce_from_quality_filtered_deduplicated_vh(self):
        root=Path(__file__).resolve().parents[1]
        export=json.loads((root/"forest_forecast.json").read_bytes())
        for key,item in export["regions"].items():
            rows=json.loads((root/"data/sar"/(key+".json")).read_bytes());by_date={}
            for row in rows:
                if row["qualityPass"] and (row["date"] not in by_date or row["coverage"]>by_date[row["date"]]["coverage"]):by_date[row["date"]]=row
            rows=sorted(by_date.values(),key=lambda r:r["date"])
            dates=[date.fromisoformat(r["date"]) for r in rows];origin=min(dates);months=sorted({d.month for d in dates})
            def design(values):return np.column_stack([*[np.array([d.month==m for d in values],float) for m in months],np.array([(d-origin).days/365.25 for d in values])])
            x=design(dates);y=np.array([r["details"]["averageVhDb"] for r in rows]);beta=np.linalg.lstsq(x,y,rcond=None)[0]
            residual=y-x@beta;scale=np.median(np.abs(residual-np.median(residual)))*1.4826
            keep=np.abs((residual-np.median(residual))/scale)<=4
            beta=np.linalg.lstsq(x[keep],y[keep],rcond=None)[0]
            future=[date.fromisoformat(r["month"]+"-15") for r in item["forecast"]]
            np.testing.assert_allclose(design(future)@beta,[r["mean"] for r in item["forecast"]],rtol=0,atol=.000501)

    def test_source_subsidence_coordinates_match_projected_grids(self):
        root=Path(__file__).resolve().parents[1];catalog=json.loads((root/"data/sar/catalog.json").read_bytes())
        transform=Transformer.from_crs(3035,4326,always_xy=True)
        for meta in catalog:
            for point in meta["points"]:
                lon,lat=transform.transform(point["easting"],point["northing"])
                self.assertAlmostEqual(point["longitude"],lon,places=5)
                self.assertAlmostEqual(point["latitude"],lat,places=5)
