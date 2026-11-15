# Finalized forest forecasts

Four forest exports are now served: Madeira River, Binh Phuoc, Belluno and Epping
Forest under London. The original [forest notebook](../backend/Forest_Forecast.ipynb)
and [finalized JSON](../backend/forest_forecast.json) include all four areas.
The previous Belluno-only handoff and locally adapted Binh Phuoc forecast have been
superseded; the API does not read the prototype `data/forest_forecast.json`.

Analyze preserves all source acquisitions. Brazil/Vietnam observations are
potential disturbance area in km?, with VH retained in source details; Italy/London
forest observations are mean VH in dB. **Every forest forecast predicts VH in dB**,
not future forest-loss area.

The supplied notebook applies explicit quality flags where available and retains
the highest forest coverage on duplicate dates. Forests without source flags retain
their coverage variation. Forecast histories contain 303 Madeira, 257 Binh Phuoc,
201 Belluno and 198 Epping readings. Original rows are retained in Analyze.

The model is a robust two-pass regression with monthly levels and a linear trend.
It predicts the observed months of the next calendar year: Jan?Dec 2027 in Brazil
and Vietnam, May?Oct 2027 in Belluno and Epping. Seasonal gaps are not filled or
interpreted as zero. Forecast dates represent the 15th of each month.

[The adapter](../backend/forest_forecast_data.py) validates selected dates, VH
values to export rounding, source row IDs, study bounds where supplied, seasonal
horizons and ordered signed prediction ranges. Flags use unrounded |z| > 4;
values displayed as exactly 4 after rounding are not forcibly reclassified.
Source workbook and artifact hashes identify the checked release.

The notebook's test selection uses full-series fitted flags, so performance scores
remain withheld. Nominal 95% range coverage is unverified. Moisture, management,
processing and other changes affect VH; neither a drop nor an anomaly flag alone
confirms forest loss. The robust fit can suppress persistent disturbances.

Use the [finalized import/rebuild workflow](./finalized-sar-release.md), then restart
FastAPI. No notebook runs or models train in HTTP requests. Offline NumPy tests
reproduce all four exports' means from the imported quality-filtered readings.
