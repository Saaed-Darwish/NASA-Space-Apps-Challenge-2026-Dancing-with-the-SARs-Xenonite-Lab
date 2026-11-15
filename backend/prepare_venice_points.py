"""Offline EGMS grid georeferencing; run after importing the Venice workbook.

EPSG:3035 is inferred from the documented Ortho format, cross-checked against
each encoded point ID and the Venice extent. This does not confirm product release.
"""
import json
from pathlib import Path
from pyproj import Transformer

ROOT = Path(__file__).resolve().parent
IDS = ("10UHknz6we", "10UHuBJbKk", "10UIHcdpJ2", "10UHpUeM8p", "10UHIfzdmV", "10UHpUeM8O", "10UH4bzuBv", "10UIaNIo5E")


def grid_centre(point_id):
    alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
    if len(point_id) != 10 or any(c not in alphabet for c in point_id):
        raise ValueError("Invalid EGMS Ortho point identifier")
    value = 0
    for character in point_id[1:]:
        value = value * 62 + alphabet.index(character)
    return (value % 2**32)*100+50, (value // 2**32)*100+50


def georeference(points):
    if {p["id"] for p in points} != set(IDS) or len(points) != len(IDS):
        raise ValueError("Unexpected Venice point selection")
    transform = Transformer.from_crs("EPSG:3035", "EPSG:4326", always_xy=True)
    output = []
    for point in points:
        if grid_centre(point["id"]) != (point["easting"], point["northing"]):
            raise ValueError("Point ID and source grid coordinates disagree")
        longitude, latitude = transform.transform(point["easting"], point["northing"])
        if not (12.2 < longitude < 12.5 and 45.3 < latitude < 45.6):
            raise ValueError("Transformed point is outside Venice")
        output.append({**point, "name": f"Venice Point {IDS.index(point['id'])+1}",
                       "longitude": longitude, "latitude": latitude,
                       "locationStatus": "inferred_egms_grid", "gridSizeMeters": 100,
                       "sourceCrs": "EPSG:3035"})
    return output


def main():
    path = ROOT / "data/sar/catalog.json"
    catalog = json.loads(path.read_text(encoding="utf-8"))
    venice = next(d for d in catalog if d["id"] == "ITA_VENICE_VERTICAL")
    if venice["geometryStatus"] == "source_coordinates":
        checked = georeference(venice["points"])
        if any(abs(a[k]-b[k])>1e-6 for a,b in zip(checked,venice["points"]) for k in ("latitude","longitude")):
            raise ValueError("Source point coordinates disagree with the EGMS grid")
        print("Source-supplied Venice coordinates match the EGMS grid; original source coordinates retained.")
        return
    venice["points"] = georeference(venice["points"])
    venice["geometryStatus"] = "inferred_egms_grid"
    venice["note"] = "Eight selected EGMS 100 m grid samples, not individual buildings or a citywide surface. Locations use EPSG:3035 inferred from the official Ortho specification and checked against every encoded point ID and the Venice extent; the original product release remains unconfirmed. Negative values indicate downward movement relative to the source reference. RMSE is fit quality, not a per-date confidence interval."
    content = json.dumps(catalog, indent=2, ensure_ascii=False)+"\n"
    path.write_text(content, encoding="utf-8")
    (ROOT.parent / "frontend/src/data/sarCatalog.json").write_text(content, encoding="utf-8")
    print("Georeferenced eight Venice grid samples; retained source IDs and projected coordinates.")


if __name__ == "__main__":
    main()
