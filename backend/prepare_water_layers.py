"""Offline public Sentinel-1 RTC acquisition, AOI alignment and overlay export.

Run in .venv-raster. No remote fetching or raster processing runs in the API.
"""
import argparse
from datetime import datetime, timezone
from hashlib import sha256
import json
from pathlib import Path
import re
import time
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

import numpy as np
from pyproj import Geod
import rasterio
from rasterio.transform import from_bounds
from rasterio.vrt import WarpedVRT
from rasterio.enums import Resampling
from rasterio.features import geometry_mask
from water_change import compute_change

ROOT = Path(__file__).resolve().parent
STAC = "https://planetarycomputer.microsoft.com/api/stac/v1"
SUPPORTED = ("BRA_PORTO_VELHO", "VNM_CAN_THO", "GBR_EAST_LONDON", "ITA_VENICE")


def get_json(url):
    host = urlparse(url).hostname
    if host != "planetarycomputer.microsoft.com":
        raise ValueError("Unexpected catalogue host")
    for attempt in range(3):
        try:
            with urlopen(Request(url, headers={"User-Agent": "EarthPulse-SAR/1.0"}), timeout=60) as response:
                raw = response.read(12_000_001)
                if len(raw) > 12_000_000:
                    raise ValueError("Catalogue response too large")
                return json.loads(raw)
        except OSError:
            if attempt == 2: raise
            time.sleep(attempt+1)


def search(dataset, year, relative_orbit=None, orbit_state=None):
    bounds = dataset["bounds"]
    bbox = [bounds[k] for k in ("west", "south", "east", "north")]
    params = {"collections": "sentinel-1-rtc", "bbox": ",".join(map(str, bbox)),
              "datetime": f"{year}-01-01T00:00:00Z/{year}-12-31T23:59:59Z", "limit": 100}
    url = STAC+"/search?"+urlencode(params)
    items = []
    for _ in range(5):
        page = get_json(url)
        items.extend(page["features"])
        next_url = next((link["href"] for link in page.get("links", []) if link["rel"] == "next"), None)
        if not next_url: break
        url = next_url
    else: raise ValueError("Acquisition search exceeds page budget; narrow the date range")
    groups = {}
    for item in items:
        p = item["properties"]
        b = item["bbox"]
        if ("vv" not in item["assets"] or p.get("sar:instrument_mode") != "IW" or
            not (b[0] < bbox[2] and b[1] < bbox[3] and b[2] > bbox[0] and b[3] > bbox[1])):
            continue
        if relative_orbit is not None and p["sat:relative_orbit"] != relative_orbit:
            continue
        if orbit_state is not None and p["sat:orbit_state"] != orbit_state:
            continue
        key = (p["platform"], p["sat:orbit_state"], p["sat:relative_orbit"])
        groups.setdefault(key, []).append(item)
    return groups


def choose_scenes(groups, year, months, bounds=None):
    candidates = []
    for key, items in groups.items():
        # Adjacent GRD slices can split an AOI. Mosaic only one actual overpass,
        # never different dates, satellites or tracks to manufacture coverage.
        passes = {}
        for item in items:
            orbit = item["properties"]["sat:absolute_orbit"]
            passes.setdefault(orbit, []).append(item)
        items = []
        for slices in passes.values():
            slices.sort(key=lambda i:i["properties"]["datetime"])
            times = [datetime.fromisoformat(i["properties"]["datetime"].replace("Z", "+00:00")) for i in slices]
            if (times[-1]-times[0]).total_seconds() > 120:
                raise ValueError("Overpass slices exceed the same-acquisition time budget")
            if bounds is not None:
                # A bounding box can contain the AOI while a diagonal scene edge
                # cuts through it. Screen the union of actual slice footprints.
                transform = from_bounds(*(bounds[k] for k in ("west","south","east","north")),128,128)
                covered = geometry_mask([i["geometry"] for i in slices],out_shape=(128,128),transform=transform,invert=True)
                if covered.mean() < .99:
                    continue
            items.append({**slices[0], "components": slices})
        selected = []
        score = 0
        for month in months:
            target = datetime(year, month, 15, tzinfo=timezone.utc)
            ranked = sorted(items, key=lambda i: abs((datetime.fromisoformat(i["properties"]["datetime"].replace("Z", "+00:00"))-target).total_seconds()))
            if not ranked: break
            item = ranked[0]
            gap = abs((datetime.fromisoformat(item["properties"]["datetime"].replace("Z", "+00:00"))-target).days)
            if gap > 20: break
            selected.append(item)
            score += gap
        if len(selected) == len(months) and len({i["id"] for i in selected}) == len(months):
            candidates.append((score, str(key), selected))
    if not candidates: raise ValueError("No same-platform, same-track VV scenes cover all requested months")
    return min(candidates, key=lambda c:(c[0],c[1]))[2]


def target_grid(bounds, resolution):
    w,s,e,n = (bounds[k] for k in ("west","south","east","north"))
    geod = Geod(ellps="WGS84")
    width = int(np.ceil(geod.inv(w,(s+n)/2,e,(s+n)/2)[2]/resolution))
    height = int(np.ceil(geod.inv(w,s,w,n)[2]/resolution))
    if width*height > 2_000_000: raise ValueError("AOI exceeds pixel budget; increase resolution")
    transform = from_bounds(w,s,e,n,width,height)
    return width,height,transform


def aligned_crop(item, bounds, resolution, path):
    """Read COG windows into one north-up WGS84 grid shared by all dates."""
    asset = item["assets"]["vv"]
    href = asset["href"]
    if urlparse(href).scheme != "https" or not (urlparse(href).hostname or "").endswith(".blob.core.windows.net"):
        raise ValueError("Unexpected radar asset host")
    signed = get_json("https://planetarycomputer.microsoft.com/api/sas/v1/sign?"+urlencode({"href":href}))["href"]
    if urlparse(signed).hostname != urlparse(href).hostname: raise ValueError("Unexpected signed host")
    width,height,transform = target_grid(bounds,resolution)
    env = {"GDAL_DISABLE_READDIR_ON_OPEN":"EMPTY_DIR", "GDAL_HTTP_TIMEOUT":"60", "GDAL_HTTP_MAX_RETRY":"2",
           "GDAL_CACHEMAX":64_000_000, "CPL_VSIL_CURL_ALLOWED_EXTENSIONS":".tif,.tiff"}
    with rasterio.Env(**env), rasterio.open(signed) as src:
        if not src.crs or src.count != 1: raise ValueError("Expected a georeferenced single-band VV asset")
        with WarpedVRT(src, crs="EPSG:4326", transform=transform, width=width, height=height,
                       nodata=-32768, resampling=Resampling.average, warp_mem_limit=64) as vrt:
            values = vrt.read(1, masked=True, out_dtype="float32")
        # Product documentation declares linear gamma-0. Never infer units from a median.
        finite = values.compressed()
        if not len(finite) or np.any(finite < 0): raise ValueError("Unexpected non-linear/empty RTC input")
        profile = {"driver":"GTiff", "width":width, "height":height, "count":1, "dtype":"float32",
                   "crs":"EPSG:4326", "transform":transform, "nodata":-32768,
                   "compress":"deflate", "tiled":True}
        with rasterio.open(path, "w", **profile) as dst:
            dst.write(values.filled(-32768),1)
            dst.update_tags(units="linear_power", coefficient="gamma0", polarization="VV", source_item=item["id"])
    return {"itemId":item["id"], "datetime":item["properties"]["datetime"],
            "catalogUrl":STAC+"/collections/sentinel-1-rtc/items/"+item["id"],
            "assetUrl":href, "sourceChecksum":asset.get("file:checksum"),
            "cropSha256":sha256(path.read_bytes()).hexdigest(), "platform":item["properties"]["platform"],
            "orbitState":item["properties"]["sat:orbit_state"], "relativeOrbit":item["properties"]["sat:relative_orbit"],
            "units":"linear_power", "coefficient":"gamma0", "polarization":"VV"}


def mosaic_crops(paths, output):
    """Merge same-pass slices on the exact analysis grid, averaging overlap power."""
    total = counts = profile = transform = crs = None
    for path in paths:
        with rasterio.open(path) as src:
            if profile is None:
                profile, transform, crs = src.profile.copy(), src.transform, src.crs
                total = np.zeros((src.height,src.width), dtype="float64")
                counts = np.zeros(total.shape, dtype="uint16")
            if src.transform != transform or src.crs != crs or (src.height,src.width) != total.shape:
                raise ValueError("Same-pass slices must use an identical grid")
            values = src.read(1,masked=True)
            valid = ~np.ma.getmaskarray(values) & np.isfinite(values.data) & (values.data > 0)
            total += np.where(valid,values.data,0)
            counts += valid
    if profile is None: raise ValueError("No slices to mosaic")
    data = np.full(total.shape,-32768,dtype="float32")
    np.divide(total,counts,out=data,where=counts>0)
    profile.update(dtype="float32",nodata=-32768)
    with rasterio.open(output,"w",**profile) as dst:
        dst.write(data,1)
        dst.update_tags(units="linear_power",coefficient="gamma0",polarization="VV",mosaic="same-pass slices; mean linear power in overlaps")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", choices=(*SUPPORTED,"all"), default="all")
    parser.add_argument("--year", type=int, default=2024)
    parser.add_argument("--months", default="3,6,9,11")
    parser.add_argument("--resolution", type=int, default=30)
    parser.add_argument("--relative-orbit", type=int, choices=range(1,176), metavar="1-175",
                        help="Match the source study's track, when known")
    parser.add_argument("--orbit-state", choices=("ascending", "descending"))
    args = parser.parse_args()
    months = sorted({int(m) for m in args.months.split(",")})
    if len(months)<2 or len(months)>12 or min(months)<1 or max(months)>12 or not 10<=args.resolution<=100:
        parser.error("Supply 2–12 distinct months and a 10–100 m resolution")
    catalog = {d["id"]:d for d in json.loads((ROOT/"data/sar/catalog.json").read_text(encoding="utf-8"))}
    output = ROOT/"data/water_layers"
    output.mkdir(parents=True, exist_ok=True)
    manifest_path = output/"catalog.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else []
    for dataset_id in (SUPPORTED if args.dataset=="all" else (args.dataset,)):
        dataset = catalog[dataset_id]
        cache = ROOT/"data/rasters"/dataset_id
        cache.mkdir(parents=True, exist_ok=True)
        print(f"Searching {dataset_id} {args.year}", flush=True)
        scenes = sorted(choose_scenes(search(dataset,args.year,args.relative_orbit,args.orbit_state),args.year,months,dataset["bounds"]), key=lambda i:i["properties"]["datetime"])
        acquired = []
        for scene in scenes:
            slices = []
            for item in scene["components"]:
                if not re.fullmatch(r"[A-Za-z0-9_]{1,160}",item["id"]): raise ValueError("Invalid source item ID")
                # Keep Windows cache paths short; full IDs remain in metadata.
                scene_key = item["properties"]["datetime"][:10].replace("-", "") + "_" + sha256(item["id"].encode()).hexdigest()[:16]
                path = cache/(scene_key+".tif")
                meta_path = path.with_suffix(".json")
                use_cache = path.exists() and meta_path.exists()
                if use_cache:
                    width,height,transform = target_grid(dataset["bounds"],args.resolution)
                    with rasterio.open(path) as src:
                        use_cache = src.width==width and src.height==height and src.transform==transform and src.crs.to_epsg()==4326
                if use_cache:
                    meta = json.loads(meta_path.read_text(encoding="utf-8"))
                    if sha256(path.read_bytes()).hexdigest()!=meta["cropSha256"]: raise ValueError("Cached crop checksum mismatch")
                else:
                    print(f"Reading AOI crop {item['id']}", flush=True)
                    meta = aligned_crop(item,dataset["bounds"],args.resolution,path)
                    meta_path.write_text(json.dumps(meta,indent=2),encoding="utf-8")
                slices.append((path,meta))
            if len(slices) == 1:
                acquired.append(slices[0])
            else:
                mosaic_key = sha256("|".join(m["itemId"] for _,m in slices).encode()).hexdigest()[:16]
                path = cache/("pass_"+mosaic_key+".tif")
                mosaic_crops([p for p,_ in slices], path)
                meta = {**slices[0][1], "cropSha256":sha256(path.read_bytes()).hexdigest(),
                        "components":[m for _,m in slices]}
                path.with_suffix(".json").write_text(json.dumps(meta,indent=2),encoding="utf-8")
                acquired.append((path,meta))
        for (before,bmeta),(after,ameta) in zip(acquired,acquired[1:]):
            start,end = bmeta["datetime"][:10],ameta["datetime"][:10]
            layer_id = f"{dataset_id}_{start.replace('-','')}_{end.replace('-','')}"
            print(f"Classifying {layer_id}", flush=True)
            result = compute_change(before,after, region=dataset_id,before_label=start,after_label=end,
                                    input_units="linear_power",threshold_db=-17,filter_size=3,min_blob_pixels=9)
            png_hash = sha256(result["png"]).hexdigest()
            tif_hash = sha256(result["classified_tif"]).hexdigest()
            png_path = output/(layer_id+"_"+png_hash+".png")
            png_path.write_bytes(result["png"])
            (output/(layer_id+"_"+tif_hash+".tif")).write_bytes(result["classified_tif"])
            entry = {"id":layer_id, "datasetId":dataset_id, "beforeDate":start,"afterDate":end,
                     "observationSourceSha256":dataset["source"]["sha256"], "bounds":dataset["bounds"],
                     "before":bmeta,"after":ameta, "summary":result["summary"],
                     "pngSha256":png_hash, "classifiedSha256":tif_hash, "pngBytes":len(result["png"]),
                     "width":result["width"], "height":result["height"], "schemaVersion":1,
                     "method":f"Sentinel-1 RTC gamma-0 VV; mosaic adjacent same-pass slices (mean linear power in overlaps); average to ~{args.resolution} m common WGS84 grid; 3x3 median; < -17 dB candidate water; exclude invalid neighbourhoods; remove changes smaller than 9 pixels.",
                     "limitations":["Experimental water classification, not validated flood extent or water-flow displacement.",
                                    "RTC gamma-0, resolution and masking differ from the workbook method. Area totals are independent of workbook observations.",
                                    "Historical-water, slope, shadow and layover exclusions are not applied. Radar-dark surfaces may be misclassified.",
                                    "Grid alignment is verified; residual geolocation error and classification accuracy have not been independently validated.",
                                    "Only these real acquisition pairs are available; other dates do not have spatial masks."],
                     "generatedAt":datetime.now(timezone.utc).isoformat()}
            if dataset_id == "ITA_VENICE":
                entry["limitations"].append('Lagoon conditions: wind, tides and surface roughness can change radar backscatter and appear as water gain or loss. These exploratory layers do not measure flooded streets or water volume.')
            manifest = [m for m in manifest if m["id"]!=layer_id]+[entry]
            # Publish manifest last so interrupted processing never advertises a missing layer.
            temporary = manifest_path.with_suffix(".tmp")
            temporary.write_text(json.dumps(manifest,indent=2,allow_nan=False),encoding="utf-8")
            temporary.replace(manifest_path)
            print(json.dumps(result["summary"]),flush=True)


if __name__ == "__main__": main()
