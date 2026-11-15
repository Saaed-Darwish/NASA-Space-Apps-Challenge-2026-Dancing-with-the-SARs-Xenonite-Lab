# Finalized multi-hazard SAR release

The app imports four finalized workbooks into **10 datasets / 7,705 source rows**.
There are 14 curated regions and 24 sourced stories. London upgrades the existing
Thames basin region and retains its stories; Belluno is a separate forest study
area rather than being assigned to Venice.

| Region | Dataset | Observation rows | Default usable rows | Forecast |
| --- | --- | ---: | ---: | --- |
| Madeira River | BRA_PORTO_VELHO | 259 | 259 | Water, 12 months, Dec 2026–Nov 2027 |
| Madeira River | BRA_PORTO_VELHO_FOREST | 324 | 304 | VH, 12 months, Jan–Dec 2027 |
| Can Tho | VNM_CAN_THO | 337 | 337 | Water, 12 months, Dec 2026–Nov 2027 |
| Binh Phuoc | VNM_BINH_PHUOC_FOREST | 456 | 257 | VH, 12 months, Jan–Dec 2027 |
| Venice | ITA_VENICE | 379 | 379 | Water, 12 months, Dec 2026–Nov 2027 |
| Venice | ITA_VENICE_VERTICAL | 2,424 | 2,424 | 8 points × 24 months, Dec 2025–Nov 2027 |
| Belluno forest | ITA_BELLUNO_FOREST | 202 | 202 | VH, May–Oct 2027 |
| London | GBR_EAST_LONDON | 597 | 154 | Water, 12 months, Dec 2026–Nov 2027 |
| London | GBR_EPPING_FOREST | 311 | 311 | VH, May–Oct 2027 |
| London | GBR_LONDON_VERTICAL | 2,416 | 2,416 | 8 points × 24 months, Dec 2025–Nov 2027 |

“Usable” reflects explicit source flags where provided, or the documented filter
used by that indicator. It is not an accuracy score. London water applies ≥95%
coverage; rejected scenes remain inspectable. Forest sources without an explicit
quality flag retain their varying coverage, matching the supplied forest notebook.

## Interface and geography

Analyze and Forecast share the selected data type. Multi-type regions have
keyboard-accessible **Water / Forest / Subsidence** tabs, showing only collected
types. Water is blue, forest orange and subsidence pink across tabs, values, charts
and map indicators. Dataset names distinguish East London water, Epping Forest,
Venice lagoon and Belluno. Forest observations in Brazil/Vietnam remain disturbance
area in km²; Italy/London forest observations are mean VH in dB. All forest
forecasts predict VH in dB, never forest-loss area.

Only source-supplied study rectangles are displayed. **London water and forest
boundaries are unavailable**; subsidence-point coordinates are not reused as their
area boundaries. Venice and London subsidence coordinates now come directly from
the finalized workbooks. Selected-point pins are small, pink and unlabelled; friendly
point names and original IDs remain in the panel. These represent 100 m grid samples,
not individual buildings. No unsupported continuous subsidence surface is drawn.

The six existing Madeira/Can Tho spatial comparisons remain independent experimental
radar classifications. Rebinding them to the finalized workbook hashes required
all original water IDs, dates, values, coverage, quality flags and bounds to remain
identical. The import verified this before changing their metadata. No new spatial
water layers are fabricated for London or Venice.

## Import and serve

Run the dependency-free importer with exact source paths:

```powershell
backend/.venv/Scripts/python backend/import_finalized_sar.py --brazil "C:/path/Brazil.xlsx" --vietnam "C:/path/Vietnam.xlsx" --italy "C:/path/Italy.xlsx" --london "C:/path/London_With_Coordinates.xlsx"
```

[import_sar.py](../backend/import_sar.py) also delegates to this importer when
`--italy` or `--london` is supplied. The original three-file `--venice` command is
for the earlier handoff only and does not import this complete release.

The importer preserves original row IDs, dates, values and workbook hashes; writes
the normalized observations and matching frontend/backend catalogues; retains all
duplicate acquisitions; and imports source point coordinates without runtime GIS
dependencies. Original workbooks are unchanged.

The finalized exports are [forecasts.json](../backend/forecasts.json),
[forest_forecast.json](../backend/forest_forecast.json) and
[subsidence_forecast.json](../backend/subsidence_forecast.json). The three supplied
notebooks are retained alongside them under their canonical names. API adapters
validate fixed local artifacts at startup; they do not execute notebooks or train
models in requests. The previous experimental `data/forest_forecast.json` and
`prepare_forest_forecast.py` belong to the earlier Binh Phuoc prototype and are not
used by the finalized API. Do not substitute those artifacts for the final export.

After importing, run `npm run export:ai-context` and `npm run build` in the frontend,
then restart FastAPI. Browser responses are checked against the current source
workbook hash; rebuilding both sides avoids mixed releases.

## Forecast validation and limits

- Water: validate monthly means against quality-passing acquisition values,
  missing-month flags, study-area bounds where supplied, cutoff, consecutive dates
  and ordered nonnegative ranges. Full-series preprocessing affects the notebook's
  holdout; skill claims remain withheld.
- Forest: apply source quality flags, then choose the highest forest coverage on
  duplicate dates. History counts are 303 Madeira, 257 Binh Phuoc, 201 Belluno and
  198 Epping. Each forecast uses the observed months of the next calendar year;
  absent seasons are not zero or interpolated. Validate every selected VH value,
  date, source row, signed range and seasonal horizon. Rounded z-scores around ±4
  are handled without contradicting the notebook's unrounded flags. Full-series
  flag selection affects its backtest; performance claims remain withheld.
- Subsidence: validate each point's identity, source coordinates, published velocity,
  303 Venice / 302 London history readings, signed ranges and 24-month horizon.
  Cross-city point IDs return 422. The November 2025 forecast origin is explicit;
  these are not rolling forecasts updated with current observations. Model-selection
  test errors are labelled development results; a warning appears for any point
  failing to beat the last-reading baseline.

All ranges are approximate nominal 95% prediction ranges with unverified empirical
coverage. Values are indicators, not flood warnings, confirmed deforestation or
building-safety assessments. Offline tests reproduce forest forecast means and
subsidence model choices/means from imported readings; this establishes export
consistency, not independent predictive skill. Forecasts remain outside Earth AI
context unless separately integrated.
