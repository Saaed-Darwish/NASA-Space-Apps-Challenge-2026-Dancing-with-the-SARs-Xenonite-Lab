"""Serve validated immutable water-change artifacts; no processing or uploads."""
from datetime import date
from hashlib import sha256
import json
from pathlib import Path
import struct
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import AwareDatetime, BaseModel, Field, model_validator
from sar_data import Bounds, CATALOG, dataset_or_404

ROOT = Path(__file__).resolve().parent / "data/water_layers"
router = APIRouter(tags=["Surface-water change"])
HASH_PATTERN = r"^[a-f0-9]{64}$"


class RadarComponent(BaseModel):
    itemId: str = Field(max_length=160)
    datetime: AwareDatetime
    catalogUrl: str = Field(max_length=500)
    assetUrl: str = Field(max_length=1000)
    sourceChecksum: str | None
    cropSha256: str = Field(pattern=HASH_PATTERN)
    platform: str = Field(max_length=40)
    orbitState: str = Field(pattern=r"^(ascending|descending)$")
    relativeOrbit: int = Field(ge=1, le=175)
    units: str = Field(pattern=r"^linear_power$")
    coefficient: str = Field(pattern=r"^gamma0$")
    polarization: str = Field(pattern=r"^VV$")

    @model_validator(mode="after")
    def approved_urls(self):
        catalog, asset = urlparse(self.catalogUrl), urlparse(self.assetUrl)
        if (catalog.scheme != "https" or catalog.hostname != "planetarycomputer.microsoft.com" or
            asset.scheme != "https" or not (asset.hostname or "").endswith(".blob.core.windows.net") or
            catalog.query or asset.query or catalog.username or asset.username):
            raise ValueError("Unexpected source URLs; do not persist access tokens")
        return self


class RadarSource(RadarComponent):
    components: list[RadarComponent] = Field(default_factory=list, max_length=8)

    @model_validator(mode="after")
    def same_pass_components(self):
        if self.components:
            if self.itemId != self.components[0].itemId or len({c.itemId for c in self.components}) != len(self.components):
                raise ValueError("Invalid mosaic component identities")
            for component in self.components:
                if (component.datetime.date() != self.datetime.date() or
                        abs((component.datetime-self.datetime).total_seconds()) > 120 or
                        any(getattr(component,k)!=getattr(self,k) for k in
                            ("platform","orbitState","relativeOrbit","units","coefficient","polarization"))):
                    raise ValueError("Mosaic components must belong to the same acquisition pass")
        return self


class ChangeSummary(BaseModel):
    totalAreaKm2: float = Field(gt=0, allow_inf_nan=False)
    validAreaKm2: float = Field(gt=0, allow_inf_nan=False)
    validFraction: float = Field(ge=.95, le=1, allow_inf_nan=False)
    gainedKm2: float = Field(ge=0, allow_inf_nan=False)
    lostKm2: float = Field(ge=0, allow_inf_nan=False)
    waterBeforeKm2: float = Field(ge=0, allow_inf_nan=False)
    waterAfterKm2: float = Field(ge=0, allow_inf_nan=False)
    removedChangeKm2: float = Field(ge=-1e-7, allow_inf_nan=False)
    thresholdDb: float = Field(ge=-40, le=0, allow_inf_nan=False)
    filterSize: int = Field(ge=1, le=5)
    minBlobPixels: int = Field(ge=1, le=1000)
    inputUnits: str
    areaMethod: str = Field(max_length=160)

    @model_validator(mode="after")
    def consistent_areas(self):
        if (self.validAreaKm2 > self.totalAreaKm2+1e-6 or
            abs(self.validFraction-self.validAreaKm2/self.totalAreaKm2)>1e-6 or
            self.gainedKm2+self.lostKm2 > self.validAreaKm2+1e-6 or
            max(self.waterBeforeKm2,self.waterAfterKm2)>self.validAreaKm2+1e-6):
            raise ValueError("Inconsistent common-area statistics")
        return self


class WaterLayer(BaseModel):
    id: str = Field(pattern=r"^[A-Z0-9_]{1,100}$")
    datasetId: str
    beforeDate: date
    afterDate: date
    observationSourceSha256: str = Field(pattern=HASH_PATTERN)
    bounds: Bounds
    before: RadarSource
    after: RadarSource
    summary: ChangeSummary
    pngSha256: str = Field(pattern=HASH_PATTERN)
    classifiedSha256: str = Field(pattern=HASH_PATTERN)
    pngBytes: int = Field(gt=0, le=8_000_000)
    width: int = Field(gt=0, le=4096)
    height: int = Field(gt=0, le=4096)
    schemaVersion: int = Field(ge=1, le=1)
    method: str = Field(max_length=1000)
    limitations: list[str] = Field(min_length=1, max_length=10)
    generatedAt: AwareDatetime

    @model_validator(mode="after")
    def valid_comparison(self):
        meta = CATALOG.get(self.datasetId)
        if not meta or meta.kind != "water" or self.observationSourceSha256 != meta.source["sha256"] or self.bounds != meta.bounds:
            raise ValueError("Layer must belong to the current water dataset and AOI")
        if (self.beforeDate >= self.afterDate or self.before.datetime >= self.after.datetime or
            self.before.datetime.date() != self.beforeDate or self.after.datetime.date() != self.afterDate):
            raise ValueError("Layer acquisition chronology does not match")
        for key in ("platform","orbitState","relativeOrbit","coefficient","polarization","units"):
            if getattr(self.before,key) != getattr(self.after,key): raise ValueError("Incompatible acquisition pair")
        if self.width*self.height > 2_000_000: raise ValueError("Raster exceeds display budget")
        return self


def png_path(layer):
    return ROOT/(layer.id+"_"+layer.pngSha256+".png")


def load_layers():
    path = ROOT/"catalog.json"
    if not path.exists(): return {}
    if path.stat().st_size > 2_000_000: raise ValueError("Layer catalogue too large")
    layers = {}
    for raw in json.loads(path.read_text(encoding="utf-8")):
        layer = WaterLayer.model_validate(raw)
        if layer.id in layers: raise ValueError("Duplicate layer ID")
        path = png_path(layer)
        if path.stat().st_size != layer.pngBytes: raise ValueError("Overlay size mismatch")
        png = path.read_bytes()
        if (sha256(png).hexdigest()!=layer.pngSha256 or png[:8]!=b"\x89PNG\r\n\x1a\n" or
            struct.unpack(">II",png[16:24])!=(layer.width,layer.height)):
            raise ValueError("Invalid overlay image")
        layers[layer.id] = layer
    return layers


LAYERS = load_layers()


@router.get("/api/datasets/{dataset_id}/water-changes")
def comparisons(dataset_id: str):
    dataset = dataset_or_404(dataset_id)
    layers = sorted((l for l in LAYERS.values() if l.datasetId==dataset_id),key=lambda l:l.afterDate)
    return {"status":"available" if layers else "unavailable", "datasetId":dataset_id,
            "reason":None if layers else ("No public SAR comparison has been processed for this water study area." if dataset.kind=="water" else "This dataset measures forest disturbance or ground displacement; water-change layers do not apply."),
            "comparisons":[{**l.model_dump(mode="json"),"imageUrl":f"/api/water-changes/{l.id}/{l.pngSha256}.png"} for l in layers]}


@router.get("/api/water-changes/{layer_id}/{image_hash}.png")
def overlay_image(layer_id: str, image_hash: str):
    layer = LAYERS.get(layer_id)
    if layer is None or image_hash != layer.pngSha256: raise HTTPException(404,"Overlay not found")
    return FileResponse(png_path(layer),media_type="image/png",headers={"Cache-Control":"public, max-age=31536000, immutable", "ETag":f'"{layer.pngSha256}"'})
