"""Offline handoff importer. Run with the raster environment; never on API requests.

Usage: python backend/import_norilsk.py PATH_TO_FRONTEND_PACKAGE
Preserves original evidence and converts Web Mercator overlays to geographic PNGs
for Cesium SingleTileImageryProvider (which expects latitude-linear images).
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil


def import_package(package):
    import numpy as np
    from PIL import Image
    from rasterio.transform import from_bounds
    from rasterio.warp import transform_bounds, reproject, Resampling

    root = Path(__file__).resolve().parent.parent
    public = root / "frontend/public/norilsk"
    manifest = json.loads((package / "manifest.json").read_text(encoding="utf-8"))
    meta, = json.loads((package / "app/catalog_entries.json").read_text(encoding="utf-8"))
    rows = json.loads((package / "app/sar/NOR_TPP3_TANK_VERTICAL.json").read_text(encoding="utf-8"))
    source_hash = hashlib.sha256((package / "tables/tank_points_series.csv").read_bytes()).hexdigest()
    assert source_hash == meta["source"]["sha256"], "Source table hash mismatch"
    assert meta["id"] == "NOR_TPP3_TANK_VERTICAL"
    assert len(rows) == meta["observationCount"] and len({r["id"] for r in rows}) == len(rows)
    assert all(r["pointId"] in {p["id"] for p in meta["points"]} for r in rows)
    public.mkdir(parents=True, exist_ok=True)
    for folder in ("images", "tables", "vectors", "overlays"):
        shutil.copytree(package / folder, public / folder, dirs_exist_ok=True)
    for filename in ("README.md", "manifest.json", "story.json"):
        shutil.copyfile(package / filename, public / filename)
    overlays = []
    for item in manifest["files"]:
        if not item.get("overlay"):
            continue
        corners = item["overlay_corners_lonlat"]
        west, north = corners[0]
        east, south = corners[2]
        assert -180 <= west < east <= 180 and -85 < south < north < 85
        original = Image.open(package / item["overlay"]).convert("RGBA")
        array = np.array(original).transpose(2, 0, 1)
        height, width = array.shape[1:]
        destination = np.zeros_like(array)
        mercator = transform_bounds("EPSG:4326", "EPSG:3857", west, south, east, north)
        for band in range(4):
            reproject(array[band], destination[band],
                      src_transform=from_bounds(*mercator, width, height), src_crs="EPSG:3857",
                      dst_transform=from_bounds(west, south, east, north, width, height), dst_crs="EPSG:4326",
                      resampling=Resampling.nearest)
        name = Path(item["overlay"]).stem + ".png"
        Image.fromarray(destination.transpose(1, 2, 0)).save(public / "overlays" / name)
        overlays.append(dict(id=Path(item["file"]).stem, title=item["title"], description=item["description"],
                             period=item.get("period"), limit=item["overlay_colour_limit_mm"],
                             bounds=dict(west=west, south=south, east=east, north=north),
                             imageUrl="/norilsk/overlays/" + name))
    data = dict(overlays=overlays, credit=manifest["credit"])
    (root / "frontend/src/data/norilsk.json").write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    for path in (root / "backend/data/sar/catalog.json", root / "frontend/src/data/sarCatalog.json"):
        catalog = json.loads(path.read_text(encoding="utf-8"))
        catalog = [m for m in catalog if m["id"] != meta["id"]] + [meta]
        for item in catalog:
            item.setdefault("forecastAvailable", True)
            item.setdefault("pointBadge", None)
        path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    shutil.copyfile(package / "app/sar/NOR_TPP3_TANK_VERTICAL.json", root / "backend/data/sar/NOR_TPP3_TANK_VERTICAL.json")
    print(f"Imported {len(rows)} observations, {len(meta['points'])} points and {len(overlays)} overlays")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("package", type=Path)
    import_package(parser.parse_args().package)
