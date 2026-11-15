"""Offline, dependency-free import of the reviewed SAR handoff workbooks.

Example: python backend/import_sar.py --brazil <xlsx> --vietnam <xlsx> --venice <xlsx>
Original workbooks are read only. JSON exports include source hashes and scene lineage.
"""

import argparse
import hashlib
import json
import math
from pathlib import Path
import xml.etree.ElementTree as ET
from zipfile import ZipFile

NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
ROOT = Path(__file__).resolve().parent
SOURCE_URL = "https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S1_GRD"


def workbook(path):
    with ZipFile(path) as archive:
        if sum(info.file_size for info in archive.infolist()) > 50_000_000:
            raise ValueError("Workbook exceeds the offline import size limit")
        strings = ["".join(x.itertext()) for x in ET.fromstring(archive.read("xl/sharedStrings.xml")).findall("s:si", NS)] if "xl/sharedStrings.xml" in archive.namelist() else []
        links = {x.get("Id"): x.get("Target") for x in ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))}
        sheets = {}
        for sheet in ET.fromstring(archive.read("xl/workbook.xml")).find("s:sheets", NS):
            target = links[sheet.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")]
            target = target.lstrip("/") if target.startswith("/") else "xl/" + target
            rows = []
            for row in ET.fromstring(archive.read(target)).findall("s:sheetData/s:row", NS):
                values = {}
                for cell in row:
                    value = cell.find("s:v", NS)
                    value = value.text if value is not None else ""
                    if cell.get("t") == "s" and value:
                        value = strings[int(value)]
                    elif cell.get("t") == "inlineStr":
                        value = "".join(cell.find("s:is", NS).itertext())
                    if value != "":
                        values["".join(c for c in cell.get("r") if c.isalpha())] = value
                if values:
                    rows.append(values)
            header, *data = rows
            sheets[sheet.get("name")] = [{header[k]: value for k, value in r.items() if k in header} for r in data]
    return sheets


def number(value):
    result = float(value)
    if not math.isfinite(result):
        raise ValueError("Non-finite workbook measurement")
    return result


def flood_validation(rows, country):
    result = []
    for row in rows:
        if country == "Brazil" and row.get("method") == "JRC90":
            result.append(dict(label=row["period"], date=row["s1_date"], referenceDate=row["s2_date"],
                precision=number(row["precision"]), recall=number(row["recall"]), iou=number(row["IoU"])))
        elif country == "Vietnam" and row.get("Historical Water Mask") == "JRC90":
            result.append(dict(label=row["Season"], date=row["Radar Image Date"], referenceDate=row["Optical Image Date"],
                precision=number(row["Precision (%)"])/100, recall=number(row["Recall (%)"])/100, iou=number(row["Overlap / IoU (%)"])/100))
    return result


def make_dataset(path, sheets, kind, country):
    forest = kind == "forest"
    sheet = "Forest Disturbance" if forest else "Flooding"
    rows = sheets[sheet]
    region = "porto-velho" if country == "Brazil" else "binh-phuoc" if forest else "can-tho"
    dataset_id = rows[0]["Study Area ID" if forest else "Study Area"]
    if forest and country == "Brazil":
        bounds = {k:number(rows[0][k.title()+" Boundary"]) for k in ("west","south","east","north")}
    else:
        geometry = next(r for r in sheets["Map Coordinates"] if r.get("Study Area ID") == dataset_id)
        bounds = {k: number(geometry[k.title() + " Boundary"]) for k in ("west", "south", "east", "north")}
    metric = "Potential Forest Disturbance (km²)" if forest else "Potentially Flooded Area (km²)"
    observations = []
    for index, row in enumerate(rows):
        timestamp = row.get("Observation Timestamp (UTC)", row["Observation Date"])
        coverage = number(row["Forest Coverage (Fraction)" if forest else "Satellite Image Coverage (0–1)"])
        if not -1e-12 <= coverage <= 1+1e-12:
            raise ValueError("Coverage materially outside 0–1")
        quality_key = next((k for k in row if k.startswith("Quality Pass")), None)
        quality = row[quality_key].lower() in ("1", "true") if quality_key else coverage >= .95
        details = {"orbit": row.get("Relative Orbit", row.get("Satellite Orbit Number")),
            "satellite": row.get("Satellite", row.get("Satellite (Sentinel-1A/B)")),
            "sceneId": row.get("GEE Observation ID", row.get("Satellite Image ID")),
            "timestamp": timestamp, "sourceRow": index + 2}
        if forest:
            if row.get("Average VH Backscatter (dB)"):
                details["averageVhDb"] = number(row["Average VH Backscatter (dB)"])
            details.update(baselineImages=int(row["Baseline Image Count"]),
                disturbancePercent=number(row["Disturbance of Monitored Forest (%)"]),
                monitoredForestKm2=number(row["Monitored Forest Area (km²)"]),
                thresholdDb=number(row["Detection Threshold (dB)"]))
        observations.append(dict(id=f"{dataset_id}:{index+2}", date=row["Observation Date"],
            value=number(row[metric]), coverage=coverage, qualityPass=quality, details=details))
    validation = flood_validation(sheets.get("Flood Validation", []), country) if not forest else [
        dict(label=str(row["validation_year"]), date=str(row["validation_year"])+"-12-31",
            precision=number(row["precision"]), recall=number(row["recall"]), iou=number(row["iou"]))
        for row in sheets.get("Forest Validation", []) if number(row["threshold_db"]) == -4
    ]
    note = ("Potential radar disturbance, not verified deforestation. Annual Hansen comparisons were used for threshold selection, not independent per-scene validation. Never sum repeated detections as newly cleared land."
        if forest else "Candidate inundation, not confirmed flood extent. Optical comparisons are provisional agreement on specific dates, not per-observation confidence.")
    if forest and country == "Brazil":
        note += " The handoff guide reports annual IoU 9.1% (2023) and 18.9% (2024); a separate validation table was not supplied."
    meta = dict(id=dataset_id, regionId=region, name=("Madeira River" if country == "Brazil" else "Binh Phuoc" if forest else "Can Tho") + (" · forest disturbance" if forest else " · candidate inundation"),
        kind=kind, metric=metric, unit="km²", bounds=bounds,
        geometryStatus="study_area_only", validationStatus="exploratory", note=note,
        method=("VH change from a same-season prior-year baseline; ≥3 baseline images and ≥95% forest coverage. Threshold −3 dB in Brazil / −4 dB in Vietnam."
            if forest else "Sentinel-1 VV < −17 dB; 30 m focal median; exclude historical water occurrence ≥90% and slopes ≥5°. Valid coverage ≥95%."),
        source=dict(file=path.name, sha256=hashlib.sha256(path.read_bytes()).hexdigest(), sheet=sheet,
            publisher="SAR data team / Copernicus Sentinel-1", url=SOURCE_URL), validation=validation, points=[])
    return meta, observations


def venice_dataset(path, sheets):
    points = []
    for row in sheets["Point Metadata"]:
        points.append(dict(id=row["point_id"], easting=number(row["easting"]), northing=number(row["northing"]),
            velocity=number(row["mean_velocity"]), rmse=number(row["rmse_ts"])))
    meta = dict(id="ITA_VENICE_VERTICAL", regionId="venice", name="Venice · vertical displacement", kind="subsidence",
        metric="Vertical displacement", unit="mm", bounds=None, geometryStatus="crs_unconfirmed",
        validationStatus="source_quality_metadata", note="Eight selected EGMS points, not a citywide surface. Negative values indicate downward movement relative to the source reference. Projected CRS/product/release must be confirmed before mapping points. RMSE is fit quality, not a per-date confidence interval.",
        method="EGMS vertical displacement point histories; original reference values retained without rebasing or interpolation.",
        source=dict(file=path.name, sha256=hashlib.sha256(path.read_bytes()).hexdigest(), sheet="Land Subsidence",
            publisher="Copernicus European Ground Motion Service", url="https://land.copernicus.eu/en/products/european-ground-motion-service/egms-ortho"),
        validation=[], points=points)
    observations = [dict(id="ITA_VENICE_VERTICAL:"+str(i+2), date=r["date"], pointId=r["point_id"],
        value=number(r["vertical_displacement_mm"]), qualityPass=True,
        details=dict(velocity=number(r["mean_velocity_mm_per_year"]), rmse=number(r["rmse_ts_mm"]), sourceRow=i+2))
        for i,r in enumerate(sheets["Land Subsidence"])]
    return meta, observations


def main():
    import sys
    if "--italy" in sys.argv or "--london" in sys.argv:
        from import_finalized_sar import main as import_finalized
        return import_finalized()
    parser = argparse.ArgumentParser(description=__doc__)
    for country in ("brazil", "vietnam", "venice"):
        parser.add_argument("--"+country, type=Path, required=True)
    args = parser.parse_args()
    datasets = []
    for country in ("Brazil", "Vietnam"):
        path = getattr(args, country.lower()); sheets = workbook(path)
        datasets.extend(make_dataset(path,sheets,kind,country) for kind in ("water","forest"))
    datasets.append(venice_dataset(args.venice,workbook(args.venice)))
    target = ROOT / "data" / "sar"
    target.mkdir(parents=True, exist_ok=True)
    catalog = []
    for meta, observations in datasets:
        observations.sort(key=lambda r:(r["date"],r.get("pointId", ""), r["id"]))
        meta.update(startDate=min(r["date"] for r in observations), endDate=max(r["date"] for r in observations),
            observationCount=len(observations), qualityPassedCount=sum(r["qualityPass"] for r in observations), schemaVersion=1)
        catalog.append(meta)
        (target/(meta["id"]+".json")).write_text(json.dumps(observations,ensure_ascii=False,allow_nan=False,separators=(",",":"))+"\n",encoding="utf-8")
    content = json.dumps(catalog,ensure_ascii=False,allow_nan=False,indent=2)+"\n"
    (target/"catalog.json").write_text(content,encoding="utf-8")
    (ROOT.parent/"frontend"/"src"/"data"/"sarCatalog.json").write_text(content,encoding="utf-8")
    print(f"Imported {len(catalog)} datasets, {sum(m['observationCount'] for m in catalog)} observations; source files unchanged.")


if __name__ == "__main__":
    main()
