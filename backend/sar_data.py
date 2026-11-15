"""Validated, read-only SAR artifacts. No uploads, training or raster processing."""

from datetime import date
import json
from pathlib import Path
import re
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, model_validator

DATA_ROOT = Path(__file__).resolve().parent / "data" / "sar"
router = APIRouter(prefix="/api/datasets", tags=["SAR observations"])


class Bounds(BaseModel):
    west: float = Field(ge=-180, le=180, allow_inf_nan=False)
    east: float = Field(ge=-180, le=180, allow_inf_nan=False)
    south: float = Field(ge=-90, le=90, allow_inf_nan=False)
    north: float = Field(ge=-90, le=90, allow_inf_nan=False)

    @model_validator(mode="after")
    def ordered(self):
        if self.west >= self.east or self.south >= self.north:
            raise ValueError("Study-area bounds must be ordered")
        return self


class Observation(BaseModel):
    id: str
    date: date
    value: float = Field(allow_inf_nan=False)
    qualityPass: bool
    pointId: str | None = None
    coverage: float | None = Field(default=None, ge=-1e-12, le=1+1e-12, allow_inf_nan=False)
    details: dict = Field(default_factory=dict)


class Dataset(BaseModel):
    id: str = Field(pattern=r"^[A-Z0-9_]+$")
    regionId: str
    name: str
    kind: Literal["water", "forest", "subsidence"]
    metric: str
    unit: Literal["km²", "mm", "dB"]
    bounds: Bounds | None
    geometryStatus: Literal["study_area_only", "crs_unconfirmed", "inferred_egms_grid", "source_coordinates", "area_coordinates_unavailable"]
    validationStatus: str
    note: str
    method: str
    source: dict
    validation: list[dict]
    points: list[dict]
    startDate: date
    endDate: date
    observationCount: int = Field(gt=0)
    qualityPassedCount: int = Field(ge=0)
    schemaVersion: Literal[1]


CATALOG = {entry.id: entry for item in json.loads((DATA_ROOT/"catalog.json").read_text(encoding="utf-8"))
           for entry in [Dataset.model_validate(item)]}
OBSERVATIONS = {}
for dataset_id, meta in CATALOG.items():
    if not re.fullmatch(r"[A-Z0-9_]+", dataset_id):
        raise ValueError("Invalid dataset artifact ID")
    records = tuple(Observation.model_validate(r) for r in json.loads((DATA_ROOT/(dataset_id+".json")).read_text(encoding="utf-8")))
    if (len(records) != meta.observationCount or len({r.id for r in records}) != len(records)
            or sum(r.qualityPass for r in records) != meta.qualityPassedCount
            or min(r.date for r in records) != meta.startDate or max(r.date for r in records) != meta.endDate):
        raise ValueError(f"Invalid SAR catalogue counts/dates for {dataset_id}")
    point_ids = {p["id"] for p in meta.points}
    if any((r.pointId is not None and r.pointId not in point_ids) or
           (meta.unit == "km²" and r.value < 0) for r in records):
        raise ValueError(f"Invalid SAR measurement for {dataset_id}")
    OBSERVATIONS[dataset_id] = records


def dataset_or_404(dataset_id: str) -> Dataset:
    if dataset_id not in CATALOG:
        raise HTTPException(404, "Unknown dataset")
    return CATALOG[dataset_id]


@router.get("", response_model=list[Dataset])
def list_datasets(region_id: str | None = Query(default=None, max_length=80)):
    return [d for d in CATALOG.values() if region_id is None or d.regionId == region_id]


@router.get("/{dataset_id}", response_model=Dataset)
def get_dataset(dataset_id: str):
    return dataset_or_404(dataset_id)


@router.get("/{dataset_id}/observations")
def get_observations(dataset_id: str, start: date | None = None, end: date | None = None,
                     point_id: str | None = Query(default=None, max_length=80),
                     quality: Literal["passing", "all", "rejected"] = "passing",
                     offset: int = Query(default=0, ge=0), limit: int = Query(default=500, ge=1, le=500)):
    meta = dataset_or_404(dataset_id)
    if start and end and start > end:
        raise HTTPException(422, "Start date must not follow end date")
    if point_id is not None and not any(p["id"] == point_id for p in meta.points):
        raise HTTPException(422, "Point does not belong to this dataset")
    records = [r for r in OBSERVATIONS[dataset_id]
               if (start is None or r.date >= start) and (end is None or r.date <= end)
               and (point_id is None or r.pointId == point_id)
               and (quality == "all" or r.qualityPass == (quality == "passing"))]
    next_offset = offset + limit if offset + limit < len(records) else None
    return dict(datasetId=dataset_id, source=meta.source, total=len(records),
                nextOffset=next_offset, observations=records[offset:offset+limit])


def selected_context(region_id: str, dataset_id: str | None, observation_id: str | None):
    if dataset_id is None:
        if observation_id:
            raise HTTPException(422, "An observation requires a dataset")
        return None
    meta = dataset_or_404(dataset_id)
    if meta.regionId != region_id:
        raise HTTPException(422, "Dataset does not belong to this region")
    record = next((r for r in OBSERVATIONS[dataset_id] if r.id == observation_id), None) if observation_id else next(
        (r for r in reversed(OBSERVATIONS[dataset_id]) if r.qualityPass), None)
    if record is None:
        raise HTTPException(422, "Observation does not belong to this dataset")
    return dict(dataset=meta.model_dump(mode="json", exclude={"points"}),
                observation=record.model_dump(mode="json"),
                note="One dated regional indicator/point reading, not an observed spatial footprint. No forecasts are connected.")
