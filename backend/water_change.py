"""
water_change.py: SAR water change detection (before vs after) for the EarthPulse backend.

Input:  two Sentinel-1 SAR GeoTIFFs (VV backscatter, linear or dB) of the SAME area,
        same orbit, same resolution. NOT optical/Sentinel-2 imagery: the method
        detects water from radar backscatter in decibels.
Output: a dict with
        - "geojson": FeatureCollection of water_gained (light blue) / water_lost (dark blue)
                     polygons in lon/lat (EPSG:4326)
        - "summary": % and km2 gained/lost, threshold used, PNG bounds
        - "png":     bytes of a transparent PNG overlay (same grid as the input images)

Usage:
    from water_change import compute_change
    result = compute_change("before.tif", "after.tif", region="VNM_CAN_THO")

Dependencies: numpy, scipy, rasterio, matplotlib
"""
import io

import numpy as np
from scipy import ndimage
import rasterio
from rasterio.features import shapes
from rasterio.warp import transform_geom, transform_bounds
import matplotlib
matplotlib.use("Agg")                     # no screen needed on a server
import matplotlib.pyplot as plt

LIGHT_BLUE, DARK_BLUE = "#87CEFA", "#003399"


def _read(path_or_file):
    with rasterio.open(path_or_file) as src:
        return src.read(1).astype(float), src.transform, src.crs


def _to_db(a):
    """Convert linear backscatter to dB if needed (positive median = linear units)."""
    if np.nanmedian(a) > 0:
        a = np.where(a <= 0, np.nan, a)
        a = 10 * np.log10(a)
    return a


def _otsu(values, bins=256):
    values = values[np.isfinite(values)]
    hist, edges = np.histogram(values, bins=bins)
    centres = (edges[:-1] + edges[1:]) / 2
    p = hist / hist.sum()
    w0 = np.cumsum(p); w1 = 1 - w0
    m = np.cumsum(p * centres)
    mu0 = m / np.where(w0 > 0, w0, np.nan)
    mu1 = (m[-1] - m) / np.where(w1 > 0, w1, np.nan)
    return float(centres[np.nanargmax(w0 * w1 * (mu0 - mu1) ** 2)])


def _drop_small(mask, min_pixels):
    labels, n = ndimage.label(mask)
    if n == 0:
        return mask
    sizes = ndimage.sum(mask, labels, range(1, n + 1))
    return np.isin(labels, np.flatnonzero(sizes >= min_pixels) + 1)


def compute_change(before_tif, after_tif, region="REGION", before_label="before", after_label="after",
                   water_is_dark=True, threshold_db=-17.0, filter_size=5, min_blob_pixels=30):
    """
    water_is_dark : True for open water (most floods); False where flooded vegetation shows as BRIGHT.
    threshold_db  : dB cutoff for water (-17 matches the team's dataset); None = choose automatically (Otsu).
    """
    before, transform, crs = _read(before_tif)
    after, transform_a, crs_a = _read(after_tif)
    if before.shape != after.shape or transform != transform_a or crs != crs_a:
        raise ValueError("Images must cover the same grid (same area, resolution and coordinate system).")

    before_db, after_db = _to_db(before), _to_db(after)
    fill_b, fill_a = np.nanmedian(before_db), np.nanmedian(after_db)
    before_f = ndimage.median_filter(np.nan_to_num(before_db, nan=fill_b), size=filter_size)
    after_f = ndimage.median_filter(np.nan_to_num(after_db, nan=fill_a), size=filter_size)

    t = threshold_db if threshold_db is not None else _otsu(np.concatenate([before_f.ravel(), after_f.ravel()]))
    if water_is_dark:
        water_before, water_after = before_f < t, after_f < t
    else:
        water_before, water_after = before_f > t, after_f > t

    gained = _drop_small(water_after & ~water_before, min_blob_pixels)
    lost = _drop_small(water_before & ~water_after, min_blob_pixels)

    rows, cols = before_f.shape
    left, top = transform.c, transform.f
    right, bottom = left + transform.a * cols, top + transform.e * rows
    if crs.is_geographic:
        lat_mid = top + transform.e * rows / 2
        px_km2 = abs(transform.a) * 111.32 * np.cos(np.radians(lat_mid)) * abs(transform.e) * 110.57
    else:
        px_km2 = abs(transform.a * transform.e) / 1e6

    # GeoJSON polygons in lon/lat
    features = []
    for mask, kind, colour in [(gained, "water_gained", LIGHT_BLUE), (lost, "water_lost", DARK_BLUE)]:
        for geom, _ in shapes(mask.astype("uint8"), mask=mask, transform=transform):
            if crs.to_string() != "EPSG:4326":
                geom = transform_geom(crs, "EPSG:4326", geom)
            features.append({"type": "Feature", "geometry": geom,
                             "properties": {"type": kind, "color": colour, "region": region,
                                            "before": before_label, "after": after_label}})

    # Transparent PNG overlay
    overlay = np.zeros((rows, cols, 4))
    overlay[gained] = (0.53, 0.81, 0.98, 0.85)
    overlay[lost] = (0.0, 0.2, 0.6, 0.85)
    buf = io.BytesIO()
    plt.imsave(buf, overlay, format="png")

    w, s, e, n = transform_bounds(crs, "EPSG:4326", left, bottom, right, top)
    summary = {
        "region": region, "before": before_label, "after": after_label,
        "region_area_km2": round(float(before_f.size * px_km2), 2),
        "water_before_pct": round(100 * float(water_before.mean()), 2),
        "water_after_pct": round(100 * float(water_after.mean()), 2),
        "water_gained_km2": round(float(gained.sum() * px_km2), 2), "water_gained_pct": round(100 * float(gained.mean()), 2),
        "water_lost_km2": round(float(lost.sum() * px_km2), 2), "water_lost_pct": round(100 * float(lost.mean()), 2),
        "threshold_db": round(float(t), 2), "water_is_dark": water_is_dark,
        "png_bounds": [[round(s, 6), round(w, 6)], [round(n, 6), round(e, 6)]],   # [[south, west], [north, east]]
    }
    return {"geojson": {"type": "FeatureCollection", "features": features}, "summary": summary, "png": buf.getvalue()}
