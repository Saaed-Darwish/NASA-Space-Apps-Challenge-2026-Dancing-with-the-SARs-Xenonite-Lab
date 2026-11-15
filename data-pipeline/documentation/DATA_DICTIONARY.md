# Dataset data dictionary (starting point)

## Flooding (VV)

- `date`: Sentinel-1 acquisition date, YYYY-MM-DD.
- `system_time_start`: Earth Engine acquisition timestamp (milliseconds since Unix epoch).
- `potential_inundation_km2`: area of eligible observed pixels below the configured VV threshold; **not verified flooding**.
- `valid_area_km2`: eligible area with valid Sentinel-1 measurement.
- `coverage_fraction`: valid observed area / eligible analysis area (definition can vary by task).
- `vv_threshold_db`: configured VV threshold in dB.

## Forest (VH)

- `mean_vh_db`: spatial mean of Sentinel-1 VH backscatter, dB.
- `std_vh_db`: **spatial** standard deviation within an acquisition, not temporal uncertainty.
- `valid_forest_area_km2`: eligible forest area with valid VH measurement.
- `coverage_fraction`: observed eligible forest / total eligible forest.
- `potential_forest_disturbance_km2`: threshold-derived candidate area, not confirmed forest loss.
- `quality_pass`: whether specified baseline/coverage checks pass; in some annual exports, failures are **not** filtered out.

## EGMS

Preserve monitoring point ID, date, vertical displacement, units, sign convention, reference frame, quality indicators, and original source provenance. Confirm exact input field names from the original data before finalizing.
