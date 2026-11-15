"""Offline candidate surface-water change on aligned north-up WGS84 VV rasters.

Explicit input units; shared valid support; no missing-data filling in results.
Returns a transparent PNG and classified GeoTIFF: 0 unchanged, 1 gained, 2 lost,
255 excluded. Areas use WGS84 ellipsoidal geodesic pixel areas. This is an
experimental classification, not validated flooding or water-flow displacement.
"""
import io
from datetime import date
import math

import numpy as np
from scipy import ndimage
import rasterio
from rasterio.io import MemoryFile
from pyproj import Geod
from PIL import Image

MAX_PIXELS = 2_000_000
GAIN_RGBA = (85, 217, 237, 230)
LOSS_RGBA = (255, 179, 71, 230)


def _read(path):
    with rasterio.open(path) as src:
        if src.driver != "GTiff" or src.count != 1 or not src.crs:
            raise ValueError("Require a georeferenced single-band GeoTIFF")
        if src.width*src.height > MAX_PIXELS:
            raise ValueError("Crop/reduce the raster before processing (2 million pixel budget)")
        if src.crs.to_epsg() != 4326 or src.transform.b or src.transform.d or src.transform.a <= 0 or src.transform.e >= 0:
            raise ValueError("Align both inputs to a north-up EPSG:4326 grid first")
        data = src.read(1, masked=True).astype("float32")
        return data, src.transform, src.crs, src.profile


def _drop_small(mask, min_pixels):
    labels, count = ndimage.label(mask)
    if not count: return mask
    sizes = np.bincount(labels.ravel())
    keep = sizes >= min_pixels
    keep[0] = False
    return keep[labels]


def compute_change(before_tif, after_tif, region="REGION", before_label="before", after_label="after",
                   water_is_dark=True, threshold_db=-17.0, filter_size=3, min_blob_pixels=9,
                   *, input_units=None, min_common_fraction=.95):
    if input_units not in ("linear_power", "db"):
        raise ValueError("Declare input_units as linear_power or db; units are never guessed")
    if not water_is_dark:
        raise ValueError("This open-water method does not classify bright flooded vegetation")
    if threshold_db is None or not math.isfinite(threshold_db) or not -40 <= threshold_db <= 0:
        raise ValueError("Use an explicit finite water threshold between -40 and 0 dB")
    if filter_size not in (1,3,5) or not isinstance(min_blob_pixels,int) or not 1 <= min_blob_pixels <= 1000:
        raise ValueError("Invalid filter/blob budget")
    if not 0 <= min_common_fraction <= 1:
        raise ValueError("Invalid common coverage requirement")
    if date.fromisoformat(before_label) >= date.fromisoformat(after_label):
        raise ValueError("Before date must precede after date")
    before, transform, crs, profile = _read(before_tif)
    after, other_transform, other_crs, _ = _read(after_tif)
    if before.shape != after.shape or transform != other_transform or crs != other_crs:
        raise ValueError("Images must use the same aligned grid")
    b, a = before.filled(np.nan), after.filled(np.nan)
    common = np.isfinite(b) & np.isfinite(a)
    if input_units == "linear_power":
        common &= (b > 0) & (a > 0)
        b = 10*np.log10(np.where(common,b,1))
        a = 10*np.log10(np.where(common,a,1))
    if filter_size > 1:
        # Erosion discards every output whose filter neighbourhood touches NoData.
        # Arbitrary temporary fill values therefore cannot influence retained cells.
        valid = ndimage.binary_erosion(common, structure=np.ones((filter_size,filter_size)), border_value=0)
        b = ndimage.median_filter(np.where(common,b,0), size=filter_size)
        a = ndimage.median_filter(np.where(common,a,0), size=filter_size)
    else:
        valid = common
    rows, cols = b.shape
    geod = Geod(ellps="WGS84")
    left, top, dx, dy = transform.c, transform.f, transform.a, transform.e
    areas = np.array([abs(geod.polygon_area_perimeter(
        [left,left+dx,left+dx,left], [top+r*dy,top+r*dy,top+(r+1)*dy,top+(r+1)*dy])[0])/1e6
        for r in range(rows)], dtype="float64")
    total_area = float(areas.sum()*cols)
    valid_area = float(np.sum(valid.sum(axis=1)*areas))
    if not valid_area or valid_area/total_area < min_common_fraction:
        raise ValueError(f"Insufficient common valid area: {valid_area/total_area:.1%}")
    water_before, water_after = (b < threshold_db) & valid, (a < threshold_db) & valid
    raw_gain, raw_loss = water_after & ~water_before, water_before & ~water_after
    gained, lost = _drop_small(raw_gain,min_blob_pixels), _drop_small(raw_loss,min_blob_pixels)
    area = lambda mask: float(np.sum(mask.sum(axis=1)*areas))
    summary = {
        "totalAreaKm2":total_area, "validAreaKm2":valid_area, "validFraction":valid_area/total_area,
        "waterBeforeKm2":area(water_before), "waterAfterKm2":area(water_after),
        "gainedKm2":area(gained), "lostKm2":area(lost),
        "removedChangeKm2":area(raw_gain)+area(raw_loss)-area(gained)-area(lost),
        "thresholdDb":threshold_db, "filterSize":filter_size, "minBlobPixels":min_blob_pixels,
        "inputUnits":input_units, "areaMethod":"WGS84 ellipsoidal geodesic area per pixel"
    }
    summary = {k:round(v,8) if isinstance(v,float) else v for k,v in summary.items()}
    classes = np.where(valid,0,255).astype("uint8")
    classes[gained], classes[lost] = 1, 2
    rgba = np.zeros((rows,cols,4),dtype="uint8")
    rgba[gained], rgba[lost] = GAIN_RGBA, LOSS_RGBA
    png = io.BytesIO()
    Image.fromarray(rgba).save(png,format="PNG",optimize=True)
    profile.update(driver="GTiff",dtype="uint8",nodata=255,compress="deflate",count=1)
    with MemoryFile() as memory:
        with memory.open(**profile) as dst:
            dst.write(classes,1)
            dst.update_tags(region=region,before=before_label,after=after_label,
                            classes="0=unchanged,1=water_gained,2=water_lost,255=excluded")
        tif = memory.read()
    return {"summary":summary, "png":png.getvalue(), "classified_tif":tif, "width":cols, "height":rows}
