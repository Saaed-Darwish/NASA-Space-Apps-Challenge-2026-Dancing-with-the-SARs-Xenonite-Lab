"""Read-only adapter for Omar's reviewed, exploratory forecast export.

This does not run the notebook or endorse its backtest. History is checked against
the imported acquisition series before this artifact is served.
"""
from collections import defaultdict
from hashlib import sha256
import json
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, model_validator
from sar_data import CATALOG, OBSERVATIONS, dataset_or_404
from forest_forecast_data import ARTIFACTS as FOREST_ARTIFACTS
from subsidence_forecast_data import get_subsidence_forecast

router = APIRouter(prefix="/api/datasets", tags=["Exploratory forecasts"])


class HistoryMonth(BaseModel):
    month: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    value: float = Field(ge=0, allow_inf_nan=False)
    flagged: bool
    filled: bool


class ForecastMonth(BaseModel):
    month: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    mean: float = Field(ge=0, allow_inf_nan=False)
    lower: float = Field(ge=0, allow_inf_nan=False)
    upper: float = Field(ge=0, allow_inf_nan=False)

    @model_validator(mode="after")
    def ordered(self):
        if not self.lower <= self.mean <= self.upper:
            raise ValueError("Invalid forecast range")
        return self


class ForecastExport(BaseModel):
    history: list[HistoryMonth] = Field(min_length=24, max_length=240)
    forecast: list[ForecastMonth] = Field(min_length=1, max_length=24)
    model: str = Field(max_length=200)

    @model_validator(mode="after")
    def consecutive_months(self):
        months = [row.month for row in self.history + self.forecast]
        indices = [int(m[:4]) * 12 + int(m[5:]) for m in months]
        if any(b != a + 1 for a, b in zip(indices, indices[1:])):
            raise ValueError("Forecast months must be consecutive and follow history")
        return self


LIMITATIONS = [
    "Exploratory monthly candidate-inundation indicator, not a flood warning, damage estimate or future flood footprint.",
    "The notebook preprocesses the full series before its holdout split. Its reported skill is not independent evaluation; performance scores are withheld here.",
    "The model replaces flagged months during fitting. Its target is a cleaned indicator baseline and may suppress unusual inundation.",
    "Bands are approximate nominal 95% ranges from a custom residual formula. Out-of-sample interval coverage has not been established.",
    "The final historical month is partial. Future months predict monthly means, not individual acquisition values.",
    "Duplicate source rows are retained and equally weighted in monthly means; overlap/deduplication policy is not established.",
]


def adapt_forecasts(raw: bytes) -> dict:
    if len(raw) > 1_000_000:
        raise ValueError("Forecast export exceeds artifact size budget")
    export = json.loads(raw)
    if set(export["regions"]) != {k for k,v in CATALOG.items() if v.kind == "water"}:
        raise ValueError("Unexpected forecast datasets")
    artifacts = {}
    for dataset_id, item in export["regions"].items():
        data = ForecastExport.model_validate(item)
        meta = CATALOG[dataset_id]
        location = item.get("location")
        if meta.bounds is None:
            if location is not None: raise ValueError("Forecast invents study area coordinates")
        elif not location or meta.kind != "water" or meta.bounds.model_dump() != location["bounds"]:
            # Floats exported independently may differ only at machine precision.
            if not location or meta.kind != "water" or any(abs(getattr(meta.bounds, k)-v) > 1e-8 for k, v in location["bounds"].items()):
                raise ValueError("Forecast study area does not match observations")
        monthly = defaultdict(list)
        for row in OBSERVATIONS[dataset_id]:
            if row.qualityPass:
                monthly[row.date.isoformat()[:7]].append(row.value)
        history = []
        for row in data.history:
            values = monthly.get(row.month, [])
            if row.filled != (not values) or (values and abs(sum(values)/len(values)-row.value) > .00051):
                raise ValueError("Forecast history does not match this observation release")
            history.append({**row.model_dump(), "observationCount": len(values),
                            "partial": row.month == meta.endDate.isoformat()[:7]})
        if data.history[-1].month != meta.endDate.isoformat()[:7] or set(monthly) - {r.month for r in data.history}:
            raise ValueError("Forecast cutoff does not match observations")
        artifacts[dataset_id] = {
            "status": "available", "datasetId": dataset_id, "regionId": meta.regionId,
            "schemaVersion": 1, "artifactSha256": sha256(raw).hexdigest(),
            "sourceSha256": meta.source["sha256"], "sourceFile": "forecasts.json",
            "generatedLabel": str(export["generated"]),
            "generationTimezone": "Not supplied in handoff",
            "model": data.model, "unit": "km²", "target": "Monthly cleaned candidate-inundation indicator",
            "evaluationStatus": "requires_revalidation", "intervalStatus": "approximate_nominal_95",
            "history": history, "forecast": [r.model_dump() for r in data.forecast],
            "lastAcquisition": meta.endDate.isoformat(), "historyThrough": data.history[-1].month,
            "provenanceNote": "Monthly history agrees with the imported observations to export rounding. This is a consistency check; the original export did not record workbook hashes or a reproducible model run ID.",
            "limitations": LIMITATIONS,
        }
    return artifacts


ARTIFACTS = adapt_forecasts((Path(__file__).resolve().parent / "forecasts.json").read_bytes())
ARTIFACTS.update(FOREST_ARTIFACTS)


@router.get("/{dataset_id}/forecast")
def get_forecast(dataset_id: str, point_id: str | None = Query(default=None, max_length=80)):
    dataset_or_404(dataset_id)
    if CATALOG[dataset_id].kind == "subsidence":
        return get_subsidence_forecast(point_id, dataset_id)
    if point_id is not None:
        raise HTTPException(422, "This forecast does not accept a measurement point")
    return ARTIFACTS.get(dataset_id, {
        "status": "unavailable", "datasetId": dataset_id,
        "reason": "No forecast export was supplied for this dataset. Observations remain available in Analyze.",
    })
