# SAR observations and forecasts

The current four-workbook release is documented in the [finalized SAR release guide](./finalized-sar-release.md), including all ten datasets, source filters, type tabs, colours, point mapping, forecast horizons and rebuild commands.

## Read-only API

- `GET /api/datasets?region_id=london` lists the region?s collected datasets.
- `GET /api/datasets/{dataset_id}` returns its source metadata, unit and geometry status.
- `GET /api/datasets/{dataset_id}/observations` accepts `point_id`, date bounds, quality filters and bounded pagination.
- `GET /api/datasets/{dataset_id}/forecast` returns the type-specific validated forecast. Subsidence accepts only point IDs owned by that dataset.
- `GET /api/datasets/{dataset_id}/water-changes` returns actual processed comparisons or an explicit unavailable status.

Frontend and backend catalogue hashes must match before values are displayed. Original acquisition records remain available; forecast aggregation and forest deduplication do not overwrite source observations. Missing dates are not zero. No uploads, request-time fitting or remote raster processing are exposed.

See [spatial water comparisons](./water-change-pipeline.md), [forest forecasting](./forest-forecast.md), [subsidence forecasting](./subsidence-forecast.md) and [point locations](./venice-points.md).
