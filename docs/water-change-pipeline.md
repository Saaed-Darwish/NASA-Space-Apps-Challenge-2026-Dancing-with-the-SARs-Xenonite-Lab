# Experimental spatial water change

Real public Sentinel-1 RTC imagery now supplies six spatial comparisons for the two
water datasets. The offline pipeline discovers scenes, reads study-area COG windows,
aligns them and exports overlays. FastAPI serves validated precomputed files without
GDAL, uploads, remote fetching, or request-time processing.

## Initial imagery coverage

| Study area | Before | After | Candidate gain | Candidate loss |
| --- | --- | --- | --- | --- |
| Madeira River | 2024-03-21 | 2024-06-13 | 31.48 km² | 6.63 km² |
| Madeira River | 2024-06-13 | 2024-09-17 | 6.89 km² | 14.25 km² |
| Madeira River | 2024-09-17 | 2024-11-16 | 4.84 km² | 31.95 km² |
| Can Tho | 2024-03-11 | 2024-06-15 | 2.49 km² | 4.98 km² |
| Can Tho | 2024-06-15 | 2024-09-19 | 3.09 km² | 10.16 km² |
| Can Tho | 2024-09-19 | 2024-11-18 | 18.97 km² | 1.00 km² |

All eight source acquisitions are Sentinel-1A descending passes: relative orbit 156
for Madeira River, 18 for Can Tho. There is no spatial layer for every spreadsheet
row or every year. Forest and subsidence datasets do not inherit water layers.

## Using the app

Select Madeira River or Can Tho, open Analyze with its water dataset selected, and
find **Spatial water change**. Choose a **Spatial comparison** or **View latest
available comparison**. The latter selects its end date on the imagery timeline
where supported, while the workbook snaps to its nearest real acquisition.

Blue means candidate water gain; amber means candidate loss. Unchanged and excluded
pixels are transparent. The visibility switch and opacity slider expose the optical
background. The map key always shows the actual before/after radar dates.

The overlay follows the timeline date (or the selected workbook acquisition when
choosing observations directly). It automatically checks **Show water gain/loss
overlay** inside a processed pair's inclusive before-to-after date range, and
unchecks it outside all ranges. You can hide the layer within a range; entering
another range or leaving and returning turns it on again. At shared endpoints,
a manually selected pair takes priority; otherwise the earlier-ending pair wins.
Selecting a pair moves to its end date instead of pinning a layer onto other dates.
The optical basemap, workbook value and spatial classification are separate products.

## Acquisition and reproducibility

Source: ESA Sentinel-1, processed as the Microsoft Planetary Computer
[Sentinel-1 RTC collection](https://planetarycomputer.microsoft.com/dataset/sentinel-1-rtc).
The [public STAC catalogue](https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-1-rtc)
supplies source metadata. Read-access tokens are requested anonymously and kept in
memory; unsigned source URLs are stored in the manifest instead of expiring tokens.

From the project root in PowerShell:

```powershell
backend/.venv/Scripts/python -m venv backend/.venv-raster
backend/.venv-raster/Scripts/python -m pip install -r backend/requirements-raster.lock.txt
backend/.venv-raster/Scripts/python backend/prepare_water_layers.py --dataset all --year 2024
```

Options: `--dataset BRA_PORTO_VELHO` or `VNM_CAN_THO` for one area; `--year` to
request another year; `--months 3,6,9,11` (default) to choose 2–12 months;
`--resolution 30` (default) for approximate metre spacing. Processing rejects more
than two million destination pixels, missing compatible acquisitions, or common
usable coverage below 95%. No substitute imagery is fabricated.

Source crops and metadata under `backend/data/rasters/` are ignored by Git. Cached
crops are checked against their hash and requested grid before reuse. Small processed
PNGs, classified GeoTIFFs and the manifest under
[backend/data/water_layers](../backend/data/water_layers) are deployment artifacts.
Restart the API after exporting new comparisons.

The manifest retains original STAC IDs, unsigned asset URLs, supplied checksums,
cropped-file SHA-256, satellite/track, acquisition times, units/calibration, processing
parameters, output hashes and UTC generation time. The associated workbook hash is
a region/version check; the workbook did not generate these raster products.

## Method and limits

1. Match IW VV acquisitions by satellite, relative orbit and pass direction.
2. Average linear gamma-0 power onto one identical north-up EPSG:4326 grid at about
   30 m spacing. Reproject the pixels, not only their bounds.
3. Convert explicitly declared power to dB; exclude zero/non-finite/NoData cells.
4. Apply a 3×3 median. Exclude every output whose neighbourhood touches invalid
   data in either acquisition, then use the same support for both classifications.
5. Classify values below −17 dB as candidate open water. Gain is after-water and
   before-non-water; loss is the reverse. Remove connected changes smaller than
   nine analysis pixels. This method does not classify bright flooded vegetation.
6. Compute WGS84 ellipsoidal geodesic pixel areas. Report AOI/common area, coverage,
   gain, loss and small-change area removed by filtering.
7. Export a transparent PNG and a classified GeoTIFF: `0=unchanged`, `1=gained`,
   `2=lost`, `255=excluded`. Cesium displays the PNG on its WGS84 rectangle.

This differs from the spreadsheet processing: RTC gamma-0, analysis resolution and
filter support differ, and historical-water/slope/shadow/layover exclusions are not
applied. Radar-dark land, wet soil, vegetation, agriculture, wind and residual
geolocation error can produce apparent changes. Independent accuracy and residual
alignment validation remain outstanding. These are candidate extent changes, not
validated flood boundaries, water-flow displacement, volume, damage or forecasts.
Blob filtering means gain-minus-loss need not equal the raw water-total difference.

## API, code and checks

- `GET /api/datasets/{id}/water-changes` returns scoped metadata and fixed image URLs.
  Known unsupported datasets return `status=unavailable`; unknown IDs return 404.
- `GET /api/water-changes/{id}/{sha256}.png` serves a content-addressed PNG. Unknown
  IDs/hashes return 404; clients cannot supply paths or remote URLs.
- Startup validates ownership, bounds, chronology, same-track provenance, coverage,
  area consistency, pixel budget and image hash/signature/dimensions.

Implementation: [acquisition/alignment](../backend/prepare_water_layers.py),
[classification](../backend/water_change.py), [read-only API](../backend/water_layers.py),
and [map controls](../frontend/src/components/WaterChangePanel.tsx).
The legacy [upload example](../backend/example_routes.py) has been retired.

From the backend directory:

```powershell
.venv/Scripts/python -m unittest discover -v
.venv-raster/Scripts/python -m unittest discover -s raster_tests -v
```

Raster tests use tiny synthetic fixtures to check pixel locations, gain/loss,
transparency, excluded neighbourhoods, unit conversion, date/grid rejection and
small-blob handling. These fixtures are never published to the application.
Frontend checks prevent incompatible metadata and old layers on unrelated dates.
