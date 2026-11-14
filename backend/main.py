from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="EarthPulse API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)


class Region(BaseModel):
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
def health():
    return {"status": "healthy"}


@app.get("/api/regions", response_model=list[Region])
def get_regions():
    return REGIONS


@app.get("/api/regions/{region_id}", response_model=Region)
def get_region(region_id: str):
    for region in REGIONS:
        if region.id == region_id:
            return region

    raise HTTPException(status_code=404, detail="Region not found")
