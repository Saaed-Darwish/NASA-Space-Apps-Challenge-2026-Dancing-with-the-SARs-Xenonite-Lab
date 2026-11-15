import copy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import numpy as np
import rasterio
from rasterio.transform import from_origin
from prepare_water_layers import choose_scenes, mosaic_crops, search


class AcquisitionTests(unittest.TestCase):
    def scene(self, month, second, orbit, direction="descending", track=81):
        return {"id":f"scene_{month}_{second}_{orbit}","bbox":[-1,50,1,53],"assets":{"vv":{}},
                "properties":{"datetime":f"2024-{month:02d}-15T06:15:{second:02d}Z",
                              "platform":"SENTINEL-1A","sat:orbit_state":direction,
                              "sat:relative_orbit":track,"sat:absolute_orbit":orbit,"sar:instrument_mode":"IW"}}

    def test_london_track_selection_and_same_pass_slices(self):
        scenes = [self.scene(m,s,m) for m in (3,6) for s in (0,25)]
        scenes += [self.scene(3,0,999,"ascending"),self.scene(6,0,888,track=8)]
        with patch("prepare_water_layers.get_json", return_value={"features":scenes}):
            groups=search({"bounds":{"west":0,"south":51.48,"east":.12,"north":51.54}},2024,81,"descending")
        selected=choose_scenes(groups,2024,[3,6])
        self.assertEqual(len(selected),2)
        self.assertEqual([len(s["components"]) for s in selected],[2,2])
        self.assertTrue(all(len({x["properties"]["sat:absolute_orbit"] for x in s["components"]})==1 for s in selected))
        bad=copy.deepcopy(groups)
        first=next(iter(bad.values()))
        first[1]["properties"]["datetime"]="2024-03-15T07:00:00Z"
        with self.assertRaises(ValueError):choose_scenes(bad,2024,[3,6])

    def test_footprint_union_rejects_diagonal_bbox_false_coverage(self):
        bounds={"west":0,"south":51.48,"east":.12,"north":51.54}
        items=[]
        for month in (3,6):
            a=self.scene(month,0,month)
            a["geometry"]={"type":"Polygon","coordinates":[[[0,51.48],[.12,51.48],[0,51.54],[0,51.48]]]}
            items.append(a)
        groups={("SENTINEL-1A","descending",81):items}
        with self.assertRaises(ValueError): choose_scenes(groups,2024,[3,6],bounds)
        for item in list(items):
            other=copy.deepcopy(item);other["id"]+="_adjacent"
            other["geometry"]={"type":"Polygon","coordinates":[[[.12,51.48],[.12,51.54],[0,51.54],[.12,51.48]]]}
            items.append(other)
        self.assertEqual(len(choose_scenes(groups,2024,[3,6],bounds)),2)

    def test_published_london_and_venice_rasters_and_transparency_match(self):
        from hashlib import sha256
        from PIL import Image
        from rasterio.transform import from_bounds
        from water_change import GAIN_RGBA, LOSS_RGBA
        root=Path(__file__).resolve().parents[1]/"data/water_layers"
        layers=[r for r in json.loads((root/"catalog.json").read_bytes()) if r["datasetId"] in ("GBR_EAST_LONDON","ITA_VENICE")]
        for dataset in ("GBR_EAST_LONDON","ITA_VENICE"):
            self.assertEqual(sum(r["datasetId"]==dataset for r in layers),3)
        for layer in layers:
            tif=root/(layer["id"]+"_"+layer["classifiedSha256"]+".tif")
            self.assertEqual(sha256(tif.read_bytes()).hexdigest(),layer["classifiedSha256"])
            with rasterio.open(tif) as src:
                classes=src.read(1)
                self.assertEqual(src.crs.to_epsg(),4326)
                self.assertEqual(src.transform,from_bounds(*(layer["bounds"][k] for k in ("west","south","east","north")),layer["width"],layer["height"]))
            image=np.array(Image.open(root/(layer["id"]+"_"+layer["pngSha256"]+".png")))
            self.assertEqual(image.shape,(*classes.shape,4))
            self.assertTrue(set(np.unique(classes))<={0,1,2,255})
            self.assertTrue(np.all(image[classes==1]==GAIN_RGBA))
            self.assertTrue(np.all(image[classes==2]==LOSS_RGBA))
            self.assertTrue(np.all(image[...,3][(classes==0)|(classes==255)]==0))
            self.assertGreaterEqual(layer["summary"]["validFraction"],.95)

    def test_mosaic_preserves_nodata_and_averages_only_valid_overlap(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            arrays=[np.array([[1,2,-32768],[-32768,-32768,-32768]],dtype="float32"),
                    np.array([[-32768,4,8],[-32768,-32768,-32768]],dtype="float32")]
            paths=[]
            for i,a in enumerate(arrays):
                path=root/f"slice{i}.tif";paths.append(path)
                with rasterio.open(path,"w",driver="GTiff",width=3,height=2,count=1,dtype="float32",
                                   crs="EPSG:4326",transform=from_origin(0,52,.01,.01),nodata=-32768) as dst: dst.write(a,1)
            output=root/"mosaic.tif"
            mosaic_crops(paths,output)
            with rasterio.open(output) as src:
                np.testing.assert_array_equal(src.read(1),[[1,3,8],[-32768,-32768,-32768]])
                self.assertEqual(src.tags()["units"],"linear_power")
            with rasterio.open(paths[1],"r+") as dst: dst.transform=from_origin(.01,52,.01,.01)
            with self.assertRaises(ValueError):mosaic_crops(paths,output)
