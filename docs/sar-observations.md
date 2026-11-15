# Integrated SAR observations

## Available datasets

| Dataset ID | App region | Records | Quality-passing |
| --- | --- | --- | --- |
| BRA_PORTO_VELHO | porto-velho | 259 | 259 |
| BRA_PORTO_VELHO_FOREST | porto-velho | 324 | 304 |
| VNM_CAN_THO | can-tho | 337 | 337 |
| VNM_BINH_PHUOC_FOREST | binh-phuoc | 456 | 257 |
| ITA_VENICE_VERTICAL | venice | 2,424 | 2,424 |

The importer retains 3,800 acquisition records. Venice has 303 observations per
point; its source provides fit-quality metadata rather than the forest coverage
and baseline pass/fail checks. A pass never represents classification confidence.

## Serving and inspecting the data

Start the existing FastAPI application as documented in the root README, or use
[the local-network launcher](../backend/serve_local.py) after a frontend build.
No Excel/scientific packages are needed by the running API.

- `GET /api/datasets` lists metadata; optional `region_id` restricts it to one exact geography.
- `GET /api/datasets/{dataset_id}` returns metadata, provenance, bounds, quality counts, point metadata and available validation.
- `GET /api/datasets/{dataset_id}/observations` returns a page with `datasetId`, `source`, `total`, `nextOffset` and `observations`.
- Optional query parameters: `start`/`end` (inclusive ISO dates), `point_id`, `quality=passing|all|rejected`, `offset`, and `limit` (1–500, default 500). The default excludes quality-rejected records.
- Example: `/api/datasets/ITA_VENICE_VERTICAL/observations?point_id=10UHIfzdmV` returns that point's 303 readings.
- Unknown IDs return 404; invalid ranges, foreign point IDs and invalid pagination return 422. Only approved artifact IDs resolve; clients cannot supply filesystem paths.

Artifacts are validated at process startup and served from memory. Restart the
backend after an import. The frontend bundles metadata only; observation histories
are loaded from the API on demand with cancellation, timeout, retry and error states.

## Reimporting the original handoff

Keep the source workbooks unchanged. From the repository root:

```powershell
backend/.venv/Scripts/python backend/import_sar.py --brazil "C:/path/Brazil_Multi_Hazard_SAR_Flood_and_Forest_2019_2026.xlsx" --vietnam "C:/path/Vietnam_Multi_Hazard_SAR_Flood_and_Forest_2019_2026.xlsx" --venice "C:/path/Venice_Land_Subsidence_8_Points_2020_2025.xlsx"
cd frontend
npm run export:ai-context
npm exec prettier -- --write src/data/sarCatalog.json
npm test
npm run build
```

The offline importer reads the reviewed workbook layouts using Python's standard
library. It exports normalized observations and metadata under
[backend/data/sar](../backend/data/sar), plus the lightweight
[frontend catalogue](../frontend/src/data/sarCatalog.json). Each dataset records its
source workbook filename, SHA-256, sheet, and source-row/scene lineage where supplied.
Runtime serving no longer depends on a user's Downloads directory.

Different workbook versions/layouts require reviewing and updating the importer,
not silently guessing column meanings. Run backend tests after regeneration:
`backend/.venv/Scripts/python -m unittest discover -s backend -v`.

## Map and Analyze behavior

- Selected water/forest datasets show their actual analysis rectangle as an outline with a study-area label. No blue footprint or synthetic water layer is substituted.
- The dataset selector switches between Madeira River's water and forest series. Stable `porto-velho` / `BRA_PORTO_VELHO*` IDs preserve the handoff provenance. Binh Phuoc and Venice have independent curated regions; Porto Alegre's stories now belong to Rio Grande do Sul.
- Acquisition controls choose real observations, including distinct same-date source rows. The chart uses elapsed date spacing and breaks connecting lines over gaps longer than 45 days. Missing acquisitions are never zero-filled or interpolated.
- Play/Pause steps through those actual acquisitions at 900 ms per record. Starting at the end restarts at the first acquisition; pausing and resuming retains the selected record. Manual selection pauses playback. A compact total and acquisition date sit just above the rectangle's northern edge; its label is simply "Study Area". Values represent the total over the outline, never a within-area event position or classified surface. Venice remains unplotted.
- Explicit region focus fits the whole study rectangle into the space between the open docks and above the imagery timeline, using measured panel bounds and camera field of view. Dock changes and window resizing refit the selected area; viewport selection alone still does not move the camera.
- Forest quality-rejected observations are available for inspection with an explicit toggle. Rejected readings have distinct markers/status and are not connected into the main trend.
- A table and selectable comparison baseline support accessible inspection. Area differences describe net indicator differences, not newly affected land; point differences preserve signed mm values.
- Observation selection/playback moves the imagery cursor to an approximate calendar position within the current selected years. Dates in the last imagery year use that final annual tick. Dates outside the selected years leave the cursor unchanged. Timeline scrubbing/playback chooses the nearest visible real acquisition inside the overlapping date range, preserving same-date scene selection on ties. Timeline-driven selections do not feed back into the cursor or stop its playback; manual observation selection pauses timeline playback. Initial dataset loading does not move the timeline.
- The timeline displays an approximate date, while SAR acquisition dates and annual optical imagery years remain explicit. The optional matching-year basemap button is unavailable for 2019/2026; the archive is not extended or substituted. Existing story first-play, resume and end-of-range replay behavior is retained.
- Venice point selection exposes individual histories, mean velocity and RMSE. Precise point positions remain unplotted until the source CRS/product/release is confirmed. Its city marker is approximate.
- The selected dataset/observation can accompany Earth AI requests. The backend verifies both ownership relationships and supplies only the actual selected reading, method, provenance and limitations. Rejected quality remains explicit.

## Interpretation and deferred work

Flood observations remain candidate-inundation indicators, forest observations are
potential radar disturbance, and Venice covers only eight sampled points. Coverage
is not confidence; the validation tables are dated comparisons rather than a global
accuracy score. Brazil/Vietnam flooding store validation fractions/percentages in
different formats; the importer normalizes them to fractions. Forest validation
applies to annual repeated detections and threshold selection, not every scene.

The Brazilian forest guide reports validation summaries, but its separate validation
table was not supplied. That distinction is visible in the method note. Repeated
acquisitions are retained and not summed. The example raster-upload app and notebook
execution remain unconnected; their evaluation/security/georeferencing requirements
are in [the handoff review](./sar-data-integration-plan.md).

## Exploratory forecasts

`GET /api/datasets/{dataset_id}/forecast` returns `status=available` for
`BRA_PORTO_VELHO` and `VNM_CAN_THO`. Known datasets without an export return
`status=unavailable` and a reason; unknown dataset IDs return 404.

[The adapter](../backend/forecast_data.py) validates a fixed, size-limited local
export at startup: typed finite nonnegative values, ordered ranges, consecutive
months, matching study bounds and observation cutoff. Every non-imputed monthly
history value must match the current imported observation means within export
rounding (0.00051 km²); imputed months must have zero source records. No inference,
upload or arbitrary artifact path is exposed. It records the forecast artifact hash
and current matching observation workbook hash, without claiming the original export
contained full training provenance. Restart the API after changing the reviewed export.

The UI shows 95 historical months (recent 36 by default) and 12 forecast months,
December 2026–November 2027. Squares distinguish imputed history; rings identify
flagged or partial history. Tables expose all values, observation counts and flags.
The last history month is incomplete; last acquisition and cutoff are shown.

These are the supplied ETS outputs, not a newly trained or repaired model. Full-series
preprocessing leaked information into the notebook's holdout, its target replaces
flagged months, and its custom nominal 95% bands have untested coverage. Accordingly
the UI labels a research preview and withholds backtest skill, accuracy and trend
significance claims. Correct time-split preprocessing, independent rolling validation
and interval coverage remain model-team work. Scalar forecasts cannot generate future
flood polygons. No forest or subsidence forecasts are supplied.
