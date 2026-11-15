"""Validate and serve the offline Binh Phuoc VH forecast without NumPy."""
from datetime import date
from hashlib import sha256
import json
from pathlib import Path

from pydantic import BaseModel, Field
from sar_data import CATALOG, OBSERVATIONS

ROOT = Path(__file__).resolve().parent
DATASET = "VNM_BINH_PHUOC_FOREST"


class ForestReading(BaseModel):
    observationId: str
    date: date
    db: float = Field(allow_inf_nan=False)
    expected: float = Field(allow_inf_nan=False)
    z: float = Field(allow_inf_nan=False)
    flagged: bool


class ForestMonth(BaseModel):
    month: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    mean: float = Field(allow_inf_nan=False)
    lower: float = Field(allow_inf_nan=False)
    upper: float = Field(allow_inf_nan=False)


def adapt_forest_forecast(raw):
    if len(raw)>1_000_000: raise ValueError("Forest export exceeds artifact budget")
    export=json.loads(raw)
    expected={k for k,v in CATALOG.items() if v.kind=="forest"}
    if export.get("units")!="dB" or set(export["regions"])!=expected: raise ValueError("Unexpected forest forecast datasets")
    artifacts={}
    for dataset_id,item in export["regions"].items():
        meta=CATALOG[dataset_id]
        location=item.get("location")
        if location and (not meta.bounds or any(abs(location["bounds"][k]-getattr(meta.bounds,k))>1e-8 for k in ("west","south","east","north"))): raise ValueError("Forest study area differs")
        # Notebook policy: quality filter, then retain the highest-coverage scene
        # on duplicate dates. Preserve every source record in Analyze.
        by_date={}
        for row in OBSERVATIONS[dataset_id]:
            if row.qualityPass and (row.date not in by_date or (row.coverage or 0)>(by_date[row.date].coverage or 0)): by_date[row.date]=row
        observed=sorted(by_date.values(),key=lambda r:r.date)
        history=[]
        if len(item["history"])!=len(observed): raise ValueError("Forest deduplicated history count differs")
        for record,source in zip(item["history"],observed):
            row=ForestReading.model_validate({**record,"observationId":source.id})
            if row.date!=source.date or abs(row.db-source.details["averageVhDb"])>.000501: raise ValueError("Forest VH history differs from source")
            # z is rounded to two decimals, so values rounding to exactly 4 may
            # legitimately be flagged by the unrounded notebook calculation.
            if (abs(row.z)<3.995 and row.flagged) or (abs(row.z)>4.005 and not row.flagged): raise ValueError("Inconsistent forest flag")
            history.append(row.model_dump(mode="json"))
        future=[ForestMonth.model_validate(r) for r in item["forecast"]]
        last=observed[-1].date
        seasons=sorted({r.date.month for r in observed})
        if [r.month for r in future]!=[f"{last.year+1}-{m:02d}" for m in seasons] or any(not r.lower<=r.mean<=r.upper for r in future): raise ValueError("Invalid forest seasonal horizon or range")
        artifacts[dataset_id]={
            "status":"available","schemaVersion":1,"kind":"forest","datasetId":dataset_id,"regionId":meta.regionId,"unit":"dB",
            "sourceSha256":meta.source["sha256"],"artifactSha256":sha256(raw).hexdigest(),"sourceFile":"forest_forecast.json",
            "generatedLabel":export["generated"],"generationTimezone":"Not supplied in handoff","model":item["model"],
            "target":"Expected mean forest VH backscatter","history":history,"forecast":[r.model_dump() for r in future],
            "lastAcquisition":meta.endDate.isoformat(),"historyThrough":history[-1]["date"],
            "evaluationStatus":"requires_revalidation","intervalStatus":"approximate_nominal_95",
            "provenanceNote":"Finalized forest export matched against quality-passing source VH readings to export rounding. Duplicate dates use the highest forest coverage. Original source rows remain available in Analyze. Forecasts follow the observed seasonal months in the next calendar year; no winter values are fabricated." + (" Study-area geometry comes from the current observation workbook; the forecast export supplies no geometry." if item.get("location") is None and meta.bounds is not None else ""),
            "limitations":[
                "Expected radar backscatter in dB, not predicted forest-loss area or confirmed deforestation.",
                "Coverage varies by acquisition. The notebook selects the highest-coverage scene on duplicate dates, after filtering provided quality flags. No additional coverage threshold is imposed where the source has no quality flag.",
                "Only the observed seasonal months are forecast; absent months are not zero and no predictions are interpolated across them.",
                "Robust two-pass regression may suppress persistent disturbances. Approximate nominal 95% prediction coverage has not been independently validated.",
                "The notebook selects test readings using flags from a full-series fit. Performance scores are withheld pending independent evaluation.",
                "Flags reflect unrounded absolute robust z above 4; displayed z is rounded. Moisture, land management and processing can change VH.",
                "Forecast points represent the 15th of each month, not monthly disturbance totals. Original workbook hashes were not recorded in the export; matching history is a consistency check."
            ]}
    return artifacts


ARTIFACTS=adapt_forest_forecast((ROOT/"forest_forecast.json").read_bytes())
ARTIFACT=ARTIFACTS[DATASET]  # Compatibility for existing local analysis scripts.
