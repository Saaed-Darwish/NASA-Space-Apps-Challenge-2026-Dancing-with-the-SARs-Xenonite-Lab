"""Offline adaptation of Forest_Forecast.ipynb for Binh Phuoc's VH readings.

Run in the raster environment (NumPy); the API never trains models.
The supplied Belluno JSON is reference material, never Vietnamese predictions.
"""
import argparse
from datetime import date, datetime, timezone
from hashlib import sha256
import json
from pathlib import Path

import numpy as np
from import_sar import workbook, make_dataset

ROOT = Path(__file__).resolve().parent
DATASET = "VNM_BINH_PHUOC_FOREST"


def design(dates, months, origin):
    return np.column_stack([
        *[np.array([d.month == month for d in dates], dtype=float) for month in months],
        np.array([(d - origin).days / 365.25 for d in dates]),
    ])


def fit_predict(dates, values, future):
    """Notebook's two-pass least squares, with rank/scale guards."""
    months = sorted({d.month for d in dates})
    if months != list(range(1, 13)) or len({d.year for d in dates}) < 3:
        raise ValueError("Binh Phuoc requires multi-year coverage of all twelve months")
    origin = min(dates)
    x = design(dates, months, origin)
    y = np.array(values, dtype=float)
    if not np.isfinite(y).all():
        raise ValueError("Non-finite VH reading")
    beta, _, rank, _ = np.linalg.lstsq(x, y, rcond=None)
    if rank != x.shape[1]:
        raise ValueError("Rank-deficient seasonal model")
    residual = y - x @ beta
    scale = np.median(np.abs(residual - np.median(residual))) * 1.4826
    if scale <= 1e-10:
        raise ValueError("Insufficient residual variation for prediction ranges")
    keep = np.abs((residual - np.median(residual)) / scale) <= 4
    beta, _, rank, _ = np.linalg.lstsq(x[keep], y[keep], rcond=None)
    if rank != x.shape[1]:
        raise ValueError("Outlier filtering removed required seasonal coverage")
    residual = y - x @ beta
    scale = np.median(np.abs(residual[keep] - np.median(residual[keep]))) * 1.4826
    if scale <= 1e-10:
        raise ValueError("Invalid residual scale")
    covariance = scale ** 2 * np.linalg.pinv(x[keep].T @ x[keep])
    z = (residual - np.median(residual[keep])) / scale
    xf = design(future, months, origin)
    mean = xf @ beta
    width = 1.96 * np.sqrt(scale ** 2 + np.einsum("ij,jk,ik->i", xf, covariance, xf))
    return x @ beta, z, mean, mean - width, mean + width


def build(path):
    catalogue = json.loads((ROOT / "data/sar/catalog.json").read_text(encoding="utf-8"))
    meta = next(d for d in catalogue if d["id"] == DATASET)
    if sha256(path.read_bytes()).hexdigest() != meta["source"]["sha256"]:
        raise ValueError("Workbook differs from the imported observation release")
    imported_meta, observations = make_dataset(path, workbook(path), "forest", "Vietnam")
    if imported_meta["id"] != DATASET or imported_meta["bounds"] != meta["bounds"]:
        raise ValueError("Wrong study area")
    readings = sorted([r for r in observations if r["qualityPass"]], key=lambda r: (r["date"], r["id"]))
    dates = [date.fromisoformat(r["date"]) for r in readings]
    values = [r["details"]["averageVhDb"] for r in readings]
    last = max(dates)
    index = last.year * 12 + last.month - 1
    future = [date((index+i)//12, (index+i)%12+1, 15) for i in range(1, 13)]
    expected, z, mean, lower, upper = fit_predict(dates, values, future)
    history = [{"observationId": r["id"], "date": r["date"], "db": v,
                "expected": float(e), "z": float(score), "flagged": bool(abs(score) > 4)}
               for r, v, e, score in zip(readings, values, expected, z)]
    return observations, {
        "datasetId": DATASET, "regionId": meta["regionId"], "bounds": meta["bounds"],
        "sourceSha256": meta["source"]["sha256"],
        "notebookSha256": sha256((ROOT / "Forest_Forecast.ipynb").read_bytes().replace(b"\r\n", b"\n")).hexdigest(),
        "pipelineSha256": sha256(Path(__file__).read_bytes().replace(b"\r\n", b"\n")).hexdigest(),
        "generatedLabel": datetime.now(timezone.utc).isoformat(),
        "model": "Month-of-year levels + linear trend (robust two-pass least squares; |z| > 4)",
        "history": history,
        "forecast": [{"month": d.strftime("%Y-%m"), "mean": float(m), "lower": float(lo), "upper": float(hi)}
                     for d, m, lo, hi in zip(future, mean, lower, upper)],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--vietnam", type=Path, required=True)
    args = parser.parse_args()
    observations, artifact = build(args.vietnam)
    # Preserve measured VH alongside the existing area indicator, never replace it.
    (ROOT / "data/sar" / f"{DATASET}.json").write_text(
        json.dumps(observations, separators=(",", ":"), allow_nan=False)+"\n", encoding="utf-8")
    (ROOT / "data/forest_forecast.json").write_text(
        json.dumps(artifact, indent=2, allow_nan=False)+"\n", encoding="utf-8")
    print(f"Exported {len(artifact['history'])} quality-passing readings and 12 forecast months for {DATASET}.")


if __name__ == "__main__":
    main()
