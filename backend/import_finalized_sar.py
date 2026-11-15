"""Import the four finalized SAR workbooks without running notebooks or modifying sources."""
import argparse
from hashlib import sha256
import json
from pathlib import Path
from import_sar import ROOT, SOURCE_URL, workbook, make_dataset, number


def pick(row, *keys, default=None):
    return next((row[k] for k in keys if row.get(k) not in (None, "")), default)


def metadata(path, dataset_id, region, name, kind, unit, bounds, sheet):
    return dict(id=dataset_id, regionId=region, name=name, kind=kind, unit=unit,
                metric="Potentially inundated area" if kind == "water" else "Mean forest VH backscatter" if kind == "forest" else "Vertical displacement",
                bounds=bounds, geometryStatus="study_area_only" if bounds else "area_coordinates_unavailable",
                validationStatus="exploratory", validation=[], points=[],
                note="Radar indicator, not confirmed flood extent or forest-loss area. Study areas are distinct from affected pixels." if bounds else "Study-area coordinates were not supplied. Values are area aggregates; EGMS point coordinates must not be assigned to this area.",
                method="Sentinel-1 VV dark-water indicator; exclude persistent water and steep slopes; minimum coverage 95%." if kind == "water" else "Mean forest VH backscatter over the source forest mask. Coverage and seasonal sampling are retained; changes are not automatically deforestation.",
                source=dict(file=path.name, sha256=sha256(path.read_bytes()).hexdigest(), sheet=sheet, publisher="SAR data team / Copernicus Sentinel-1" if kind != "subsidence" else "Copernicus European Ground Motion Service", url=SOURCE_URL if kind != "subsidence" else "https://land.copernicus.eu/en/products/european-ground-motion-service/egms-ortho"))


def aggregate(path, sheets, kind, country):
    forest = kind == "forest"
    rows = sheets["Forest Disturbance" if forest else "Flooding"]
    london = country == "United Kingdom"
    key = ("GBR_EPPING_FOREST" if forest else "GBR_EAST_LONDON") if london else ("ITA_BELLUNO_FOREST" if forest else "ITA_VENICE")
    region = "london" if london else "belluno" if forest else "venice"
    name = ("Epping Forest" if forest else "East London / Thames Barrier / Royal Docks") if london else "Belluno forest" if forest else "Venice lagoon"
    geometry = next((r for r in sheets["Map Coordinates"] if r.get("Study Area ID") == key), None)
    bounds = {k: round(number(geometry[k.title()+" Boundary"]),10) for k in ("west","south","east","north")} if geometry else None
    meta = metadata(path,key,region,name,kind,"dB" if forest else "km²",bounds,"Forest Disturbance" if forest else "Flooding")
    observations = []
    for index,row in enumerate(rows,2):
        coverage = number(pick(row,"coverage_fraction","Forest Coverage (0–1)","Satellite Image Coverage (0–1)"))
        value = number(pick(row,"mean_vh_db","Mean Forest VH Backscatter (dB)")) if forest else number(pick(row,"potential_inundation_km2","Potentially Inundated Area (km²)"))
        details = dict(sourceRow=index, satellite=pick(row,"satellite","Satellite (Sentinel-1)"), orbit=pick(row,"relative_orbit","Satellite Orbit Number"))
        if forest: details["averageVhDb"] = value
        observations.append(dict(id=f"{key}:{index}", date=pick(row,"date","Observation Date"), value=value, coverage=coverage, qualityPass=True if forest else coverage>=.95, details=details))
    return meta,observations


def subsidence(path,sheets,city):
    london=city=="London";key="GBR_LONDON_VERTICAL" if london else "ITA_VENICE_VERTICAL"
    meta=metadata(path,key,"london" if london else "venice",city+" · vertical displacement","subsidence","mm",None,"Land Subsidence")
    meta.update(geometryStatus="source_coordinates",validationStatus="source_quality_metadata",method="EGMS vertical displacement at selected 100 m grid samples; original reference retained.",note="Source-supplied WGS84 point coordinates derived from EPSG:3035. Selected 100 m grid samples, not individual buildings or a citywide surface. Negative displacement means downward; RMSE is fit quality, not per-date confidence.")
    points=[]
    for i,row in enumerate(sheets["Point Metadata"],1):
        points.append(dict(id=row["point_id"],name=f"{city} Point {i}",areaLabel=pick(row,"area_label_approx",default=city+" EGMS sample"),
            easting=number(pick(row,"easting","easting_epsg3035_m")),northing=number(pick(row,"northing","northing_epsg3035_m")),
            latitude=number(pick(row,"latitude","latitude_wgs84")),longitude=number(pick(row,"longitude","longitude_wgs84")),
            velocity=number(pick(row,"mean_velocity","mean_velocity_mm_per_year")),rmse=number(pick(row,"rmse_ts","rmse_ts_mm")),locationStatus="source_coordinates",gridSizeMeters=100,sourceCrs="EPSG:3035"))
    meta["points"]=points
    if london:
        mapped = {r["point_id_or_AOI"]: r for r in sheets["Map Coordinates"] if r.get("hazard") == "Land Subsidence"}
        if set(mapped) != {p["id"] for p in points}:
            raise ValueError("London coordinate sheets identify different points")
        for point in points:
            location = mapped[point["id"]]
            for field, source in (("latitude", "latitude_wgs84"), ("longitude", "longitude_wgs84"),
                                  ("easting", "easting_epsg3035_m"), ("northing", "northing_epsg3035_m")):
                if abs(point[field] - number(location[source])) > 1e-6:
                    raise ValueError("London Point Metadata and Map Coordinates disagree")
            if point["areaLabel"] != location["area_label"]:
                raise ValueError("London coordinate-sheet area labels disagree")
            point["coordinateNote"] = location["coordinate_notes"]
    by_id={p["id"]:p for p in points}
    observations=[]
    for i,row in enumerate(sheets["Land Subsidence"],2):
        p=by_id[row["point_id"]]
        if abs(number(pick(row,"latitude","latitude_wgs84"))-p["latitude"])>1e-6 or abs(number(pick(row,"longitude","longitude_wgs84"))-p["longitude"])>1e-6: raise ValueError("Inconsistent subsidence point coordinates")
        observations.append(dict(id=f"{key}:{i}",date=row["date"],pointId=p["id"],value=number(row["vertical_displacement_mm"]),qualityPass=True,details=dict(sourceRow=i,velocity=p["velocity"],rmse=p["rmse"])))
    return meta,observations


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    for name in ("brazil","vietnam","italy","london"):parser.add_argument("--"+name,type=Path,required=True)
    args=parser.parse_args();target=ROOT/"data/sar"
    old={p.stem:json.loads(p.read_text(encoding="utf-8")) for p in target.glob("*.json") if p.name!="catalog.json"}
    datasets=[]
    for country,arg in (("Brazil","brazil"),("Vietnam","vietnam")):
        path=getattr(args,arg);sheets=workbook(path)
        datasets.extend(make_dataset(path,sheets,kind,country) for kind in ("water","forest"))
    for country,arg,city in (("Italy","italy","Venice"),("United Kingdom","london","London")):
        path=getattr(args,arg);sheets=workbook(path)
        datasets.extend(aggregate(path,sheets,kind,country) for kind in ("water","forest"))
        datasets.append(subsidence(path,sheets,city))
    catalogue=[]
    for meta,observations in datasets:
        if meta["bounds"]:meta["bounds"]={k:round(v,10) for k,v in meta["bounds"].items()}
        observations.sort(key=lambda r:(r["date"],r.get("pointId",""),r["id"]))
        meta.update(startDate=min(r["date"] for r in observations),endDate=max(r["date"] for r in observations),observationCount=len(observations),qualityPassedCount=sum(r["qualityPass"] for r in observations),schemaVersion=1)
        catalogue.append(meta)
    # Existing independent raster comparisons survive workbook repackaging only
    # when all measured water values, dates, quality and coverage remain identical.
    layer_path=ROOT/"data/water_layers/catalog.json";layers=json.loads(layer_path.read_text())
    for meta,rows in datasets:
        linked=[r for r in layers if r["datasetId"]==meta["id"]]
        if not linked:continue
        def signature(records):return sorted((r["id"],r["date"],r["value"],r.get("coverage"),r["qualityPass"]) for r in records)
        if signature(rows)!=signature(old.get(meta["id"],[])):raise ValueError("Water observations changed; regenerate spatial comparisons before importing")
        for layer in linked:
            if layer["bounds"]!=meta["bounds"]:raise ValueError("Spatial comparison bounds changed")
            layer["observationSourceSha256"]=meta["source"]["sha256"]
    for meta,rows in datasets:(target/(meta["id"]+".json")).write_text(json.dumps(rows,ensure_ascii=False,allow_nan=False,separators=(",",":"))+"\n",encoding="utf-8")
    content=json.dumps(catalogue,ensure_ascii=False,allow_nan=False,indent=2)+"\n"
    (target/"catalog.json").write_text(content,encoding="utf-8")
    (ROOT.parent/"frontend/src/data/sarCatalog.json").write_text(content,encoding="utf-8")
    layer_path.write_text(json.dumps(layers,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    print(json.dumps([(m["id"],m["observationCount"],m["qualityPassedCount"]) for m in catalogue]))


if __name__=="__main__":main()
