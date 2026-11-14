"""FastAPI backend for Dancing with the SARs."""

from fastapi import FastAPI

app = FastAPI(
    title="Dancing with the SARs API",
    version="0.1.0",
    description="Backend for the SAR Explorer frontend.",
)


@app.get("/api/health", tags=["Health"])
def health() -> dict[str, str]:
    return {"status": "ok"}
