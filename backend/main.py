import os
from pathlib import Path
from threading import BoundedSemaphore

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from assistant import ChatRequest, generate_answer

load_dotenv(Path(__file__).parent / ".env")
chat_slot = BoundedSemaphore(1)
app = FastAPI(title="EarthPulse API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174").split(","),
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


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
    latitude: float
    longitude: float
    altitude: float
    description: str
    zoom_level: str


REGIONS = [
    Region(
        id="nusantara",
        name="Nusantara",
        country="Indonesia",
        latitude=-0.97,
        longitude=116.71,
        altitude=24000,
        description=(
            "Compare 2020–2025 satellite views of Borneo's new capital. "
            "Watch roads, construction clearings, and government buildings emerge."
        ),
        zoom_level="city",
    ),
    Region(
        id="egypt-capital",
        name="New Administrative Capital",
        country="Egypt",
        latitude=30.01,
        longitude=31.73,
        altitude=32000,
        description=(
            "Watch planned road grids east of Cairo fill with large buildings "
            "and residential districts between 2020 and 2025."
        ),
        zoom_level="city",
    ),
    Region(
        id="tuas",
        name="Tuas Port",
        country="Singapore",
        latitude=1.255,
        longitude=103.62,
        altitude=18000,
        description=(
            "Compare Singapore's reclaimed coastline, new quays, container yards, "
            "and port infrastructure through 2020–2025."
        ),
        zoom_level="city",
    ),
    Region(
        id="alberta",
        name="Alberta",
        country="Canada",
        latitude=53.9333,
        longitude=-116.5765,
        altitude=850000,
        description=(
            "Explore Alberta's forests, mountains, "
            "prairies, and changing landscapes."
        ),
        zoom_level="regional",
    ),
    Region(
        id="london",
        name="London",
        country="United Kingdom",
        latitude=51.5074,
        longitude=-0.1278,
        altitude=35000,
        description=(
            "Explore London's urban landscape, "
            "the River Thames, and surrounding areas."
        ),
        zoom_level="city",
    ),
]


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
