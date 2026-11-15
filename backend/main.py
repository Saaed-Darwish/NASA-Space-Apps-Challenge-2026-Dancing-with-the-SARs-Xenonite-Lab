import os
from pathlib import Path
from threading import BoundedSemaphore

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from assistant import CATALOG, ChatRequest, generate_answer
from security import RequestGuard
from sar_data import router as sar_router
from forecast_data import router as forecast_router

load_dotenv(Path(__file__).parent / ".env")
allowed_origins = [origin.strip() for origin in os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174",
).split(",") if origin.strip()]
if not allowed_origins or "*" in allowed_origins or "null" in allowed_origins:
    raise ValueError("CORS_ORIGINS must contain explicit trusted browser origins")
chat_slot = BoundedSemaphore(1)
app = FastAPI(title="EarthPulse API", version="0.1.0")
app.include_router(sar_router)
app.include_router(forecast_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

app.add_middleware(RequestGuard, allowed_origins=allowed_origins)


@app.post("/api/chat")
def chat(body: ChatRequest) -> dict:
    """Use a worker thread for blocking model inference, keeping health routes responsive."""
    if not chat_slot.acquire(blocking=False):
        raise HTTPException(429, "Earth AI is answering another question. Please try again shortly.")
    try:
        return generate_answer(body)
    finally:
        chat_slot.release()


class Region(BaseModel):
    """A study area's location and preferred camera view."""

    id: str
    name: str
    country: str
    latitude: float = Field(ge=-90, le=90, allow_inf_nan=False)
    longitude: float = Field(ge=-180, le=180, allow_inf_nan=False)
    altitude: float = Field(gt=0, allow_inf_nan=False)
    description: str
    zoom_level: str
    waterMonitoring: bool = False
    floodDataStatus: str | None = None
    datasetIds: list[str] = Field(default_factory=list)


REGIONS = [Region(**region) for region in CATALOG["regions"]]


@app.get("/api/health")
def health() -> dict[str, str]:
    """Report whether the API is running."""
    return {"status": "healthy"}


@app.get("/api/regions", response_model=list[Region])
def get_regions() -> list[Region]:
    """Return the API's available study areas."""
    return REGIONS


@app.get("/api/regions/{region_id}", response_model=Region)
def get_region(region_id: str) -> Region:
    """Find a study area by its stable identifier, or return HTTP 404."""
    for region in REGIONS:
        if region.id == region_id:
            return region

    raise HTTPException(status_code=404, detail="Region not found")
