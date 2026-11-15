"""
Example FastAPI routes for water_change.py: adapt to the existing backend.

Two ways to use it:
1. POST /water-change           upload two SAR GeoTIFFs, get GeoJSON + summary back
2. GET  /water-change/{region}  serve results pre-computed from GeoTIFFs stored on the server

Run locally:  uvicorn example_routes:app --reload
"""
import base64
import os
import tempfile

from fastapi import FastAPI, File, Form, HTTPException, UploadFile

from water_change import compute_change

app = FastAPI()

# Curated regions: SAR GeoTIFF pairs stored on the server (fill in the real files from Thamy)
CURATED = {
    "VNM_CAN_THO": {"before": "data/VNM_CAN_THO_before_VV.tif", "after": "data/VNM_CAN_THO_after_VV.tif",
                    "before_label": "2024-03", "after_label": "2024-10", "water_is_dark": True},
    "BRA_PORTO_VELHO": {"before": "data/BRA_PORTO_VELHO_before_VV.tif", "after": "data/BRA_PORTO_VELHO_after_VV.tif",
                        "before_label": "2024-09-17", "after_label": "2024-04-26", "water_is_dark": True},
}
_cache = {}


def _package(result):
    return {"geojson": result["geojson"], "summary": result["summary"],
            "png_base64": base64.b64encode(result["png"]).decode()}


@app.get("/water-change/{region}")
def water_change_region(region: str):
    if region not in CURATED:
        raise HTTPException(404, f"Unknown region {region}")
    if region not in _cache:                       # compute once, then reuse
        cfg = CURATED[region]
        if not (os.path.exists(cfg["before"]) and os.path.exists(cfg["after"])):
            raise HTTPException(503, f"SAR GeoTIFFs for {region} not on the server yet")
        _cache[region] = _package(compute_change(cfg["before"], cfg["after"], region=region,
                                                 before_label=cfg["before_label"], after_label=cfg["after_label"],
                                                 water_is_dark=cfg["water_is_dark"]))
    return _cache[region]


@app.post("/water-change")
async def water_change_upload(before: UploadFile = File(...), after: UploadFile = File(...),
                              region: str = Form("CUSTOM"), water_is_dark: bool = Form(True)):
    with tempfile.TemporaryDirectory() as tmp:
        paths = []
        for f in (before, after):
            p = os.path.join(tmp, f.filename or "img.tif")
            with open(p, "wb") as out:
                out.write(await f.read())
            paths.append(p)
        try:
            result = compute_change(paths[0], paths[1], region=region, water_is_dark=water_is_dark)
        except ValueError as e:
            raise HTTPException(400, str(e))
    return _package(result)
