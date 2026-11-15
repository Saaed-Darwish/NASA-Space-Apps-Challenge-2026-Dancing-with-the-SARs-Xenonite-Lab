import io
from pathlib import Path
import tempfile
import unittest

import numpy as np
from PIL import Image
import rasterio
from rasterio.transform import from_origin
from rasterio.io import MemoryFile
from water_change import compute_change


class WaterChangeTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.transform = from_origin(105.65,10.15,.001,.001)

    def tearDown(self): self.tmp.cleanup()

    def write(self,name,values,transform=None):
        path=self.root/name
        with rasterio.open(path,"w",driver="GTiff",width=values.shape[1],height=values.shape[0],count=1,
                           dtype="float32",crs="EPSG:4326",transform=transform or self.transform,nodata=-32768) as dst:
            dst.write(np.where(np.isfinite(values),values,-32768).astype("float32"),1)
        return path

    def process(self,before,after,**kwargs):
        return compute_change(self.write("b.tif",before),self.write("a.tif",after),
                              before_label="2024-01-01",after_label="2024-02-01",filter_size=1,
                              min_blob_pixels=1,input_units="db",**kwargs)

    def test_classification_locations_and_nodata_are_preserved(self):
        before=np.full((10,10),-10.);after=before.copy()
        before[2:4,2:4]=-25;after[5:7,5:7]=-25
        before[8,2]=np.nan;after[8,2]=-25
        result=self.process(before,after)
        with MemoryFile(result["classified_tif"]) as mem,mem.open() as src:
            labels=src.read(1)
            self.assertEqual(src.crs.to_epsg(),4326)
            self.assertEqual(src.transform,self.transform)
        self.assertEqual(int((labels==1).sum()),4)
        self.assertEqual(int((labels==2).sum()),4)
        self.assertEqual(labels[8,2],255)
        rgba=np.array(Image.open(io.BytesIO(result["png"])))
        self.assertEqual(rgba[8,2,3],0)
        self.assertGreater(rgba[5,5,3],0)
        self.assertEqual(rgba[0,0,3],0)
        self.assertAlmostEqual(result["summary"]["validFraction"],.99,places=4)
        self.assertGreater(result["summary"]["gainedKm2"],0)

    def test_linear_and_db_inputs_agree(self):
        b=np.full((10,10),-10.);a=b.copy();a[3:6,3:6]=-25
        db=self.process(b,a)
        linear=compute_change(self.write("linear-b.tif",10**(b/10)),self.write("linear-a.tif",10**(a/10)),
                              before_label="2024-01-01",after_label="2024-02-01",input_units="linear_power",filter_size=1,min_blob_pixels=1)
        self.assertEqual(db["png"],linear["png"])

    def test_unknown_units_reversed_dates_grid_mismatch_and_empty_support_rejected(self):
        b=np.full((10,10),-10.);bp=self.write("b.tif",b);ap=self.write("a.tif",b)
        for options in ({"input_units":None},{"before_label":"2024-03-01","after_label":"2024-01-01"}):
            settings=dict(input_units="db",before_label="2024-01-01",after_label="2024-02-01");settings.update(options)
            with self.assertRaises(ValueError):compute_change(bp,ap,**settings)
        ap=self.write("shift.tif",b,from_origin(105.66,10.15,.001,.001))
        with self.assertRaises(ValueError):compute_change(bp,ap,input_units="db",before_label="2024-01-01",after_label="2024-02-01")
        with self.assertRaises(ValueError):self.process(np.full((10,10),np.nan),b)

    def test_filter_excludes_invalid_neighbourhoods_and_zero_changes_are_transparent(self):
        b=np.full((30,30),-10.);b[15,15]=np.nan
        result=compute_change(self.write("b.tif",b),self.write("a.tif",b),input_units="db",filter_size=3,
                              before_label="2024-01-01",after_label="2024-02-01",min_common_fraction=.8)
        with MemoryFile(result["classified_tif"]) as mem,mem.open() as src: labels=src.read(1)
        self.assertTrue(np.all(labels[14:17,14:17]==255))
        self.assertEqual(result["summary"]["gainedKm2"],0)
        self.assertEqual(int(np.array(Image.open(io.BytesIO(result["png"])))[...,3].sum()),0)

    def test_small_blob_filter_removes_isolated_changes(self):
        b=np.full((10,10),-10.);a=b.copy();a[4,4]=-25
        result=compute_change(self.write("b.tif",b),self.write("a.tif",a),input_units="db",filter_size=1,min_blob_pixels=2,
                              before_label="2024-01-01",after_label="2024-02-01")
        self.assertEqual(result["summary"]["gainedKm2"],0)
        self.assertGreater(result["summary"]["removedChangeKm2"],0)


if __name__ == "__main__":unittest.main()
