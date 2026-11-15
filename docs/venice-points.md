# Current finalized coordinates

The finalized Italy and London workbooks now supply WGS84 coordinates directly. The app uses these source coordinates for all sixteen subsidence samples, with pink selected-point pins. Projected-coordinate transformations are checked offline in tests. The earlier inferred-coordinate workflow below is historical; re-import the current release with [the finalized importer](./finalized-sar-release.md). The legacy Venice script validates and retains source coordinates when present.

# Venice measurement-point locations

Analyze names the eight source samples **Venice Point 1–8**. The selector keeps
the original EGMS ID as its value; the chosen ID is shown below it in the panel.
The compact purple map pin has no text label, avoiding overlap with the Venice
region label. Changing the selected point loads that point's original
history and moves the purple marker after its observations load. Changing dates
does not move the location. Leaving the dataset removes the marker.

## Coordinate interpretation

The workbook supplies projected easting/northing coordinates but does not identify
the CRS or original product release. The official
[EGMS Ortho specification](https://library.land.copernicus.eu/products/European_Ground_Motion_Service_Product_Description_v3.html)
defines EPSG:3035 (ETRS89-LAEA), a 100 m grid, and the Base62 point-ID encoding.
Every one of the eight supplied IDs decodes to the supplied grid coordinates,
including the 50 m offset to the cell centre. Transforming x=easting, y=northing
from EPSG:3035 to longitude/latitude places all eight near Venice (approximately
45.429–45.447° N, 12.316–12.360° E).

For example, `10UHknz6we` agrees with grid centre (4504450, 2483350) and maps to
approximately 45.43654° N, 12.34142° E. It is displayed as **Venice Point 1**.

This is evidence for an **inferred EGMS grid location**, not confirmation of the
original source release or a claim to building-level accuracy. Metadata and the UI
retain that qualification. Samples represent 100 m cells; markers do not identify
individual physical sensors or building footprints. No surface or citywide
subsidence boundary is interpolated from them. Original point IDs, projected
coordinates, displacements, reference values, velocities and RMSE are preserved.

## Rebuilding locations after importing observations

The importer remains dependency-free. After re-importing the Venice workbook, run
the offline georeferencing step using the existing raster environment's pyproj:

```powershell
backend/.venv-raster/Scripts/python backend/prepare_venice_points.py
```

[The script](../backend/prepare_venice_points.py) checks the known eight IDs,
encoded-grid agreement and Venice extent, transforms with `always_xy=True`, and
updates both backend and frontend catalogues. Stable names are attached to IDs
rather than dependent on a dropdown's current ordering. Restart FastAPI and rebuild
the frontend after changing the catalogues. The API does not import pyproj or
transform coordinates during requests.
