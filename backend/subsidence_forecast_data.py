"""Read-only, point-scoped adapter for the supplied Venice notebook export."""
from datetime import date
from hashlib import sha256
import json
from pathlib import Path
from typing import Annotated
from fastapi import HTTPException
from pydantic import BaseModel, Field, model_validator
from sar_data import CATALOG, OBSERVATIONS

ROOT = Path(__file__).resolve().parent
DATASET = "ITA_VENICE_VERTICAL"


class Reading(BaseModel):
    date: date
    mm: float = Field(allow_inf_nan=False)
    flagged: bool


class Prediction(BaseModel):
    month: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    mean: float = Field(allow_inf_nan=False)
    lower: float = Field(allow_inf_nan=False)
    upper: float = Field(allow_inf_nan=False)

    @model_validator(mode="after")
    def ordered(self):
        if not self.lower <= self.mean <= self.upper:
            raise ValueError("Invalid signed subsidence range")
        return self


class Estimate(BaseModel):
    estimate: float = Field(allow_inf_nan=False)
    ci95: list[Annotated[float, Field(allow_inf_nan=False)]] = Field(min_length=2, max_length=2)

    @model_validator(mode="after")
    def ordered(self):
        if not self.ci95[0] <= self.estimate <= self.ci95[1]:
            raise ValueError("Invalid parameter range")
        return self


class Backtest(BaseModel):
    mae_model: float = Field(ge=0, allow_inf_nan=False)
    mae_naive: float = Field(ge=0, allow_inf_nan=False)
    skill: float | None = Field(default=None, allow_inf_nan=False)


def adapt_subsidence(raw):
    if len(raw) > 1_000_000:
        raise ValueError("Subsidence forecast exceeds artifact budget")
    export = json.loads(raw)
    datasets=[m for m in CATALOG.values() if m.kind=="subsidence" and m.forecastAvailable]
    all_points={p["id"] for m in datasets for p in m.points}
    if export["units"] != "mm" or set(export["points"]) != all_points:
        raise ValueError("Subsidence export does not match Venice points")
    artifacts = {}
    for meta,point in [(m,p) for m in datasets for p in m.points]:
        pid = point["id"]
        item = export["points"][pid]
        history = [Reading.model_validate(r) for r in item["history"]]
        observed = sorted([r for r in OBSERVATIONS[meta.id] if r.pointId == pid], key=lambda r: r.date)
        if len(history) != len(observed) or any(a.date != b.date or abs(a.mm-b.value) > .005001 for a,b in zip(history,observed)):
            raise ValueError("Subsidence history differs from imported point readings")
        if len({r.date for r in history}) != len(history):
            raise ValueError("Duplicate subsidence dates")
        location = item["location"]
        if item["city"] != ("London" if meta.regionId=="london" else "Venice") or item["country"] not in (None,"United Kingdom" if meta.regionId=="london" else "Italy") or any(abs(location[k]-point[v]) > .000001 for k,v in (("lat","latitude"),("lon","longitude"))):
            raise ValueError("Subsidence forecast point location differs")
        if abs(item["egms_published_velocity"]-point["velocity"]) > .005001:
            raise ValueError("Published velocity differs from point metadata")
        future = [Prediction.model_validate(r) for r in item["forecast"]]
        cutoff = history[-1].date.year*12+history[-1].date.month
        if len(future) != 24 or any(int(r.month[:4])*12+int(r.month[5:]) != cutoff+i for i,r in enumerate(future,1)):
            raise ValueError("Invalid subsidence horizon or chronology")
        model = item["forecast_model"]
        if model not in ("trend + yearly cycle", "trend + yearly cycle + acceleration"):
            raise ValueError("Unknown subsidence model")
        test = Backtest.model_validate(item["backtest"])
        artifacts[pid] = {
            "status": "available", "schemaVersion": 1, "kind": "subsidence",
            "datasetId": meta.id, "regionId": meta.regionId, "pointId": pid, "point": point,
            "unit": "mm", "target": "Vertical displacement relative to the original EGMS reference",
            "model": model, "history": [r.model_dump(mode="json") for r in history],
            "forecast": [r.model_dump() for r in future],
            "velocity": Estimate.model_validate(item["velocity_mm_per_year"]).model_dump(),
            "acceleration": Estimate.model_validate(item["acceleration_mm_per_year2"]).model_dump(),
            "publishedVelocity": point["velocity"],
            "backtest": {**test.model_dump(), "status": "development_only", "beatNaive": test.mae_model < test.mae_naive},
            "lastAcquisition": observed[-1].date.isoformat(), "historyThrough": history[-1].date.isoformat(),
            "selectedObservation": observed[-1].model_dump(mode="json"),
            "sourceFile": "subsidence_forecast.json", "sourceSha256": meta.source["sha256"],
            "artifactSha256": sha256(raw).hexdigest(), "generatedLabel": export["generated"],
            "generationTimezone": "Not supplied in handoff", "intervalStatus": "approximate_nominal_95",
            "provenanceNote": "All source point IDs, dates, projected-grid locations and displacement values match the imported workbook to export rounding. The handoff did not record workbook hashes or a reproducible model run ID; this is a consistency check, not independent predictive validation.",
            "limitations": [
                "Selected point only, not a citywide subsidence map, building safety assessment or flood forecast.",
                "Forecast origin is November 2025. December 2025–November 2027 are predictions from that cutoff, including months that may already have passed; no newer observations are assimilated.",
                "Signed displacement keeps the original EGMS reference. Negative means downward; values are not rebased to zero at the start of the chart or forecast.",
                "Acceleration is chosen using one held-out year and then refitted on all observations. The same holdout selects and scores the model; reported errors are development results, not independent accuracy estimates.",
                "Prediction ranges use residual variance and an approximate lag-one autocorrelation inflation of coefficient uncertainty. Nominal 95% coverage is not independently established.",
                "Published EGMS velocity comes from the same observation source and is a consistency comparison, not independent validation.",
                "Forecast values are predictions for the first day of each month, not monthly displacement totals. Flags are model residual diagnostics, not confirmed ground-motion events.",
            ],
        }
    return artifacts


ARTIFACTS = adapt_subsidence((ROOT / "subsidence_forecast.json").read_bytes())


def get_subsidence_forecast(point_id=None, dataset_id=DATASET):
    meta = CATALOG[dataset_id]
    if point_id is not None and point_id not in {p["id"] for p in meta.points}:
        raise HTTPException(422, "Point does not belong to this dataset")
    if not meta.forecastAvailable:
        return {"status": "unavailable", "datasetId": dataset_id, "reason": "No forecast supplied: independently rebased radar segments cannot support a continuous trend forecast."}
    pid = point_id or meta.points[0]["id"]
    if pid not in ARTIFACTS or ARTIFACTS[pid]["datasetId"]!=dataset_id:
        raise HTTPException(422, "Point does not belong to the Venice forecast")
    return ARTIFACTS[pid]
