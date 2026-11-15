> Historical planning document. The implemented finalized release is described in [the finalized SAR guide](./finalized-sar-release.md).

# SAR handoff review and integration plan

Reviewed 2026-11-15. Order of inspection: `example_routes.py`, `water_change.py`, then notebook code/output and `forecasts.json`, followed by the Venice, Vietnam and Brazil workbooks. The review reads code and stored outputs; it does not execute the notebook, retrain models, or process raster data. The required scientific packages are not installed in the current backend environment, and no SAR GeoTIFFs were found under the backend directory.

## Recommendation

Integrate read-only observation series, study-area boundaries and quality information first. Add the two existing forecast artifacts as explicitly exploratory outputs after correcting their evaluation and provenance. Treat water-change raster processing and Venice point georeferencing as separate tasks with their own acceptance checks.

There are three different measurements: candidate inundation area in km², candidate forest disturbance in km²/% of monitored forest, and vertical ground displacement in mm/mm per year. They must have distinct labels, legends, sources and methods. None is interchangeable with the others or with damage/risk to people.

## 1. What the python files do

### Water-change processor

[`water_change.py`](../backend/water_change.py) compares two matched-grid VV GeoTIFFs. It classifies water before/after and returns gained/lost polygons, summary statistics and PNG bytes. It is not a forecasting model, does not consume the spreadsheets, and cannot reconstruct water footprints from area totals.

Issues to resolve before exposing it:

- `_read` does not retain the raster's NoData mask; subsequent filling/filtering can turn invalid pixels into classifications. Restrict both dates to common valid support, preserve excluded pixels, and report usable area.
- Units are inferred from the median signal. Require an explicit linear/dB input declaration and reject unsuitable bands or products. Grid matching alone does not verify polarization, orbit or acquisition compatibility.
- Its default 5-pixel median, fixed threshold and small-blob filtering do not reproduce the workbook method: the processor omits the JRC historical-water and slope exclusions. Both using −17 dB does not make their measurements comparable.
- Area calculations assume unrotated grids and projected metre units, or use an approximate geographic conversion. Use a documented equal-area/geodesic area method, correct affine handling, and a valid-pixel denominator.
- Transforming a raster's bounds does not reproject its PNG. Warp categorical masks to the intended display CRS/grid before positioning an image overlay. GeoJSON geometries are transformed separately by the existing code.
- The bright-water switch is a different classification assumption, not a general solution for flooded vegetation. Require method-specific validation.
- Empty/constant images, missing CRS, invalid thresholds, incompatible grids, resource budgets, and geometry size require explicit failure handling and tests.

[`example_routes.py`](../backend/example_routes.py) is a standalone FastAPI app, not a router installed into the protected application. Do not expose it as supplied:

- Uploaded filenames are joined directly into a temporary directory: absolute/traversal filenames can escape it, and identical before/after names overwrite one another. Use server-generated distinct filenames.
- `await f.read()` has no size bound; raster decompression, arrays and polygonization have no workload limits. CPU work runs synchronously inside the async upload handler.
- The standalone app lacks the current request guards. Uploads need a separate authenticated, rate-limited and bounded processing design; the chat JSON body cap is not an appropriate raster-upload policy.
- Curated paths are relative to the process working directory. Resolve approved files relative to a fixed data root.
- Brazil labels September 17, 2024 as before and April 26, 2024 as after. Confirm whether that reverse-chronological comparison is intentional; define dates/order explicitly so gained/lost is not misread.
- The in-memory cache has no input/version invalidation. Prefer precomputed versioned artifacts and serve PNG/tiles by URL rather than returning redundant large GeoJSON plus base64 imagery in every response.

### Monthly forecasting

[`Forecast_Pipeline.ipynb`](../backend/Forecast_Pipeline.ipynb) loads flooding rows, filters coverage, forms monthly means, fills internal missing months, flags anomalies, fits damped seasonal ETS, and exports a 12-month forecast plus historical/quality summaries.

[`forecasts.json`](../backend/forecasts.json) contains only `BRA_PORTO_VELHO` and `VNM_CAN_THO`:

| Region | Monthly history | Filled months | Forecast window | Reported model MAE | Reported naive MAE | Reported skill |
| --- | --- | --- | --- | --- | --- | --- |
| Porto Velho | 95 months, Jan 2019–Nov 2026 | Jun 2022, Feb 2024 | Dec 2026–Nov 2027 | 1.173 km² | 1.319 km² | 0.111 |
| Can Tho | 95 months, Jan 2019–Nov 2026 | Jul 2023 | Dec 2026–Nov 2027 | 2.889 km² | 3.770 km² | 0.234 |

All 93 non-filled Brazil monthly values and 94 non-filled Vietnam monthly values match arithmetic means from the supplied flooding sheets within 0.000501 km². Exported prediction intervals contain their means and have nonnegative bounds. These are consistency checks, not model validation or reproduction of the fit.

Before reporting performance as independent evaluation:

1. Split before any interpolation, baseline estimation, anomaly detection or replacement. Currently `robust_z` sees the full series, uses a centred rolling median and full-series seasonal statistics, and `clean` is created before the last 12 months are held out. Monthly interpolation also precedes the split. This permits future information to influence training transformations.
2. Score forecasts against the intended original observed monthly target; report separately any baseline/cleaned-target score. The current test target replaces flagged values, so it does not directly assess forecasting unusual inundation. Exclude imputed test targets and record their counts.
3. Use rolling-origin validation, a seasonal-naive benchmark, MAE and interval coverage. Skill is relative MAE improvement, not percentage accuracy or flood-detection confidence.
4. The seasonal branch overwrites statsmodels' interval bounds with a custom residual-MAD formula and horizon inflation. Label these approximate nominal 95% bands until out-of-sample coverage is assessed. Handle zero residual spread, failed fits and non-finite results explicitly.
5. Mark November 2026 as partial at the handoff date. Export last acquisition, month-completeness policy and observation count; do not imply a complete observed month.
6. Anomaly flags are unusual indicator values, not verified flood events. Brazil's two flags are below-normal values. Keep them separate from curated event stories and never invent within-AOI event coordinates.
7. Add schema/model versions, UTC generation time, source hashes, training cutoff, metric/unit, aggregation, duplicate policy, interpolation method, quality rules, forecast target, interval method and evaluation details.

The notebook's configured workbook names differ from the supplied filenames. Its current settings fit the Flooding sheets; forest sheets need their own column mapping, quality-pass filter and separate targets/runs. Venice needs independent point models or a suitable panel model; never apply nonnegative clipping to negative displacement. The draft severity score is not implemented or validated and should remain outside the first integration.

## 2. Dataset inventory

| Dataset | Study area | Observations | Quality handling | Spatial content |
| --- | --- | --- | --- | --- |
| Brazil Flooding | BRA_PORTO_VELHO | 259 rows / 258 dates, Jan 11 2019–Nov 13 2026 | Historical rows remain unvalidated; provisional optical comparisons provided | WGS84 centre and rectangle |
| Brazil Forest | BRA_PORTO_VELHO_FOREST | 324 rows / 313 dates, Jan 11 2019–Nov 13 2026 | 304 pass / 20 fail; failures are in 2025 | Bounds/centre in observation columns and updated guide |
| Vietnam Flooding | VNM_CAN_THO | 337 rows / 337 dates, Jan 1 2019–Nov 3 2026 | Historical rows remain unvalidated; provisional optical comparisons provided | WGS84 rectangle in Map Coordinates |
| Vietnam Forest | VNM_BINH_PHUOC_FOREST | 456 rows / 357 dates, Jan 1 2019–Nov 9 2026 | 257 pass / 199 fail | WGS84 centre and rectangle |
| Venice vertical displacement | 8 EGMS points | 2,424 rows; 303 per point, Dec 9 2020–Nov 25 2025 | Preserve RMSE, velocity and point metadata | Projected easting/northing; workbook says CRS must be verified |

Forest quality flags agree with baseline-image-count ≥3 and forest coverage ≥0.95, allowing tiny floating-point tolerances. Vietnam coverage reaches 1.0000000000000004: tolerate and clamp display roundoff, while rejecting materially invalid fractions. Retain failed observations for inspection but exclude them from primary aggregation/model fitting.

Brazil has repeated Nov 1 2026 flood observations and a repeated forest acquisition timestamp. Vietnam forest has multiple distinct acquisition timestamps on some dates. Preserve scene IDs/timestamps and confirm an overlap/deduplication policy before aggregating; do not sum overlapping scene totals. The Vietnamese forest export lacks the source-scene ID column present in the Brazilian forest data; request it.

Oil Spill sheets remain placeholders, not zero-event observations. No forest or Venice forecasts are present in the supplied JSON.

### Validation must remain specific to date and method

Selected JRC90 flood comparisons, expressed consistently as percentages:

| Comparison | Precision | Recall | IoU |
| --- | --- | --- | --- |
| Brazil April 2024 | 95.27% | 57.66% | 56.06% |
| Brazil September 2024 | 48.08% | 43.56% | 29.62% |
| Vietnam dry season 2024 | 62.13% | 14.21% | 13.08% |
| Vietnam wet season 2024 | 97.84% | 44.11% | 43.68% |

Brazil stores these metrics as fractions; Vietnam flooding stores percentages. Normalize once at import. These compare radar with optical classifications on different dates and valid footprints, not independent ground-truth flood accuracy or per-observation confidence.

Vietnam forest's selected −4 dB threshold has annual IoU approximately 35.67% in 2023 and 36.09% in 2024. Brazil's guide reports annual IoU 9.1%/18.9% for selected −3 dB, but no separate Brazil Forest Validation sheet is supplied. Request that export. These are annual repeated-detection comparisons against Hansen loss and were used for threshold selection; they are not independent held-out per-scene accuracy.

Brazil's guide retains obsolete statements that forest data are pending, Vietnam has no optical cross-check, and forest coordinates are unestablished. Updated forest rows/guide sections and Vietnam's actual validation sheet contradict them. Resolve the documentation and release/version metadata rather than propagating old prose into Earth AI.

### Venice

All eight point series contain 303 distinct dates. Metadata velocities range approximately −1.4 to −3.4 mm/year, with RMSE 0.4–1.1 mm. The latest displacement is relative to the EGMS series reference, not automatically change since the first supplied observation. RMSE is a fit-quality statistic, not a per-date confidence interval; rounded zero velocity standard deviations must not be presented as perfect certainty.

The official [EGMS product specification](https://library.land.copernicus.eu/products/European_Ground_Motion_Service_Product_Description_v3.html) identifies ETRS89-LAEA / EPSG:3035 for the European product grid. This is a strong candidate for these projected coordinates, but the workbook itself does not establish the source product/release/CRS. Confirm the original export, then transform with explicit x=easting, y=northing to WGS84 and check all eight points against Venice. Show only the sampled points, without interpolating an unsupported citywide subsidence surface.

## 3. Region mapping and capabilities

| App geography | Datasets | Change |
| --- | --- | --- |
| New Porto Velho / Madeira River | BRA_PORTO_VELHO flooding + BRA_PORTO_VELHO_FOREST | New region; shared geographic rectangle, separate dataset IDs/metrics |
| Existing Can Tho | VNM_CAN_THO flooding | Attach the exact AOI; city marker and analysis rectangle may have distinct centres |
| New Binh Phuoc forest | VNM_BINH_PHUOC_FOREST | New region, separate from Can Tho/Mekong Delta |
| New Venice | Eight subsidence point series | New region; point placement waits for CRS verification |
| Existing Porto Alegre / Rio Grande do Sul / Mekong Delta | No matching region-wide observations supplied | Do not mark as processed or attach another area's totals |

Flood AOI bounds:

- Porto Velho: west −64.10, south −8.95, east −63.75, north −8.65; centre −8.8, −63.925.
- Can Tho: west 105.65, south 9.95, east 105.90, north 10.15; centre 10.05, 105.775.
- Binh Phuoc forest: west 106.70, south 11.60, east 107.00, north 11.90; centre 11.75, 106.85.

Replace the single water-monitoring boolean/processing status as the data gate with per-dataset capabilities: observations, AOI geometry, event footprints, validation and forecast availability. An observation series can be available while its spatial footprint is absent. Processing success, observational coverage, classification validation and forecast uncertainty are separate fields.

## 4. User-facing map and panels

### Globe

- Draw one AOI marker and an outline labelled 'Study area' for each applicable rectangle; avoid filled blue rectangles implying complete inundation.
- Clicking the AOI selects its observations and charts. Anomaly badges, if used, remain attached to the AOI and say 'regional anomaly', not an exact flood location.
- Add actual gained/lost raster layers only when GeoTIFFs or precomputed classified masks arrive and pass geospatial acceptance checks.
- For Venice, color the eight verified points by vertical velocity or selected-date displacement with an explicit mm/year or mm legend.

### Analyze

For water: selected acquisition/date and candidate area, valid coverage, irregular-date scatter/line chart, two-date candidate-area difference, monthly seasonal comparison, and a validation table with acquisition dates and method. Net area difference is not a map of newly flooded pixels.

For forest: potential disturbance area and fraction of monitored forest, quality-pass/coverage/baseline indicators, a quality-filtered time series, optional rejected-observation inspection and annual validation context. Do not sum acquisitions as newly deforested area.

For Venice: selected point's signed displacement history, velocity comparison across points, fit-quality metadata, and a point selector. No blanket citywide displacement or unsupported risk score.

### Forecast

Start with only Porto Velho and Can Tho. Show observed monthly values, distinct imputed markers, a separate exploratory forecast line, a shaded approximate uncertainty band, training cutoff, partial-month status, target wording, and evaluation limitations. Do not display the current skill as independently verified accuracy until the evaluation is corrected. Flag unusual months as indicator anomalies and distinguish above/below-normal values.

Keep the annual 2020–2025 optical imagery timeline separate from observation dates (2019–2026) and forecast dates (Dec 2026–Nov 2027). Selecting a 2026 observation must not pretend the 2025 mosaic is a 2026 acquisition. Expose both dates and allow nearest-date snapping only with its offset shown. Scalar forecasts cannot generate future flood maps.

## 5. Implementation sequence and acceptance checks

1. **Versioned ingestion.** Keep source workbooks immutable, record checksums, and normalize their differently named columns into typed observation/quality/validation records. Handle narrative footer rows and booleans explicitly. Validate finite values, units, region ownership, geometry and date order. Preserve originals and flags; settle duplicate policy.
2. **Read-only backend.** Register observation and forecast routers on [the existing app](../backend/main.py), retaining guards. Serve fixed approved dataset IDs, date-filtered records, validation and versioned forecast artifacts. Example contract: `GET /api/datasets`, `/api/datasets/{id}/observations?from=...&to=...`, `/api/datasets/{id}/validation`, `/api/datasets/{id}/forecast`. Use pagination/limits. Unknown IDs return 404, unavailable footprints/forecasts return an explicit status. No arbitrary filesystem paths or notebook execution from HTTP requests.
3. **Frontend data panels and AOIs.** Extend [region capabilities](../frontend/src/types/region.ts), attach datasets to the mapped regions, and replace [Analyze](../frontend/src/components/AnalysisPanel.tsx) processing placeholders only for supplied datasets. Add a date-aware observation control and explicit basemap date. Ensure no imported data pass through synthetic reading/texture adapters.
4. **Forecast artifact adapter.** Correct and rerun the offline pipeline, then validate and version its JSON. Replace [Forecast](../frontend/src/components/ForecastPanel.tsx) placeholders only where that dataset has a supported forecast. Keep model/scientific dependencies in a separately pinned processing environment; the API only needs validated exported artifacts for this stage.
5. **Venice and actual footprints.** Confirm Venice CRS/product/release and displacement reference. Obtain source rasters or masks, harden the processor, and validate georeferencing, common valid area, chronology, masks and area statistics on small test rasters before larger data. Use tiled delivery for larger imagery and reject oversized raster/geometry workloads.
6. **Earth AI and regression checks.** Update [grounded context](../backend/assistant.py) to include only the selected dataset's real observations, method-specific validation and exploratory forecasts. Update its currently 2020–2025-bound context schema without conflating forecast dates with optical imagery. Verify metric units and region scope, imputed/failed-data visibility, date interactions, missing data, API error states, resource disposal and unchanged story playback.

## Decisions and missing inputs

- Omar: agree on the forecast target (observed monthly indicator versus a normal-condition baseline); correct time-split preprocessing and report rolling-origin interval coverage. Confirm how to treat the partial final month.
- Data team: provide GeoTIFFs/masks if footprints are required, explicit source units/CRS and masking method, scene-overlap policy, Vietnamese forest scene IDs and the Brazil forest validation export.
- Venice source: confirm EPSG/product/release, coordinate axis convention and reference epoch before mapping points or interpreting cumulative change.
- App: begin with water observations + AOI outlines + quality/validation panels for Porto Velho and Can Tho; add forest panels next. Expose forecasts as exploratory only, with evaluation status visible. Keep public uploads out of the initial integration.
