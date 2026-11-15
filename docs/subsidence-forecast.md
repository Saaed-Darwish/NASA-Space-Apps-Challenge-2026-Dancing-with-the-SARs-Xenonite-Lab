# Venice and London point forecasts

Select **Venice → Forecast**. The tab keeps the currently selected Analyze point
on entry, uses **Venice Point 1–8** names, and retains each original EGMS identifier
underneath. Changing the forecast point updates the pink measurement pin using
the corresponding last historical observation; predicted values never replace map
observations or advance the optical timeline into future years.

Each of eight points has 303 historical readings (2020-12-09–2025-11-25) and 24
monthly forecasts (December 2025–November 2027). Forecast values are predictions
for the **first day** of each month. These dates come from the supplied export,
not a newly fitted model or current-date forecast. November 2025 remains the
forecast origin even after forecast months have passed.

## Sources and validation

[Subsidence_Forecast.ipynb](../backend/Subsidence_Forecast.ipynb) and
[subsidence_forecast.json](../backend/subsidence_forecast.json) are the supplied
files. Unlike the forest handoff, this export matches both Venice and London. The
[read-only adapter](../backend/subsidence_forecast_data.py) validates all sixteen
point IDs, every history date/value (within 0.005001 mm export rounding), point
locations, published velocities, finite signed ranges and consecutive future
months against the imported workbook before serving it. It does not fit models,
execute notebooks or import scientific dependencies in HTTP requests.

`GET /api/datasets/ITA_VENICE_VERTICAL/forecast?point_id=10UHknz6we` returns only
that point's forecast, history, parameters, provenance and last real observation.
Omitting the point selects Venice Point 1. Foreign point IDs return 422; unknown
dataset IDs return 404. Non-point forecasts reject the `point_id` parameter.
London uses `GET /api/datasets/GBR_LONDON_VERTICAL/forecast?point_id=40d4mz3ZFY`.
Cross-city point IDs are rejected. Water, forest and subsidence retain separate schemas and units.

The offline model test reproduces the export's model choices and predicted means
from the original imported point readings using NumPy. This checks implementation
consistency; it does not establish out-of-sample accuracy or interval coverage.

## Interpretation

- Units are **millimetres**, retaining the original EGMS displacement reference.
  Negative means downward. The chart is not rebased to zero at the cutoff, and
  there is no conversion to citywide subsidence area or building risk.
- The notebook compares a trend plus yearly cycle with a version adding
  acceleration. Acceleration is selected when its held-out-year error is at least
  10% lower than the simpler model's; the selected model is then fitted on the
  full history. All eight supplied forecasts selected acceleration.
- The final held-out year both selects the model and measures its performance.
  MAEs shown under **Model & development test** are development results, not
  independent validation. Venice Point 1's selected model did not beat the
  last-reading baseline and has a prominent caution. No “normal confidence” badge
  is inferred from the handoff's confidence field.
- Approximate nominal 95% prediction ranges combine residual variance with
  coefficient uncertainty inflated using lag-one residual correlation. Empirical
  interval coverage remains unverified.
- The average fitted velocity is from the linear seasonal model; the acceleration
  parameter is from a separate accelerated fit. Published EGMS velocity is a
  consistency comparison from the same source, not independent confirmation.
- Residual flags mark unusual model deviations, not confirmed motion events.
  The UI provides recent/all history, date-spaced signed charts, a month selector,
  prediction ranges, parameter summaries, tables and provenance hashes.

The [point locations](./venice-points.md) now use source-supplied WGS84 coordinates for EGMS grid samples. Neither
the forecast nor the pin interpolates a citywide displacement surface. To update
the forecast, supply a compatible reviewed export and restart FastAPI. These
predictions are not automatically sent to Earth AI.
