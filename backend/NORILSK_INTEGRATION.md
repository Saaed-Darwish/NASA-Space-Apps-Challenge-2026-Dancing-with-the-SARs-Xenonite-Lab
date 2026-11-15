# Norilsk research handoff

The app includes 237 Sentinel-1 readings at four supplied measurement points,
two additional research stories, dated Sentinel-2 pictures, six research figures
and fourteen selectable ground-motion overlays. Original CSVs, vectors, images,
story text and manifest are preserved in [the public evidence folder](../frontend/public/norilsk/).

Run the offline importer with the raster environment when replacing this handoff:

```powershell
.\backend\.venv-raster\Scripts\python.exe backend/import_norilsk.py PATH_TO_PACKAGE
cd frontend
npm run export:ai-context
npm run build
```

Restart FastAPI after a catalogue update. Runtime uses ordinary static assets and
read-only observation endpoints; raster libraries are only needed for importing.
The finalized workbook importer preserves independently imported datasets.

The package's WebP overlays are Web Mercator images. The importer reprojects
them to geographic PNGs for Cesium's SingleTileImageryProvider, retaining alpha
and the supplied bounds. These products show displacement, not water change or
diesel extent. East-west NISAR products use west/east legends. Layer acquisition
periods are shown separately from the optical basemap timeline; no missing years
are interpolated. The manifest supplies no exact NISAR pair dates.

Each tank segment starts at zero. Charts break at segment changes and comparisons
across segments have no numeric delta. Mean velocities remain null. Forecast is
explicitly unavailable in the UI and API; Venice and London retain their models.
The tank's final measurement predates the collapse. Snow, reference choice and
20 m resolution limit interpretation. Team research is attributed and does not
establish the cause of the collapse or measure structural damage.

The original manifest refers to the teammates' source GeoTIFFs; these analysis
rasters are not copied into the web bundle. Use the supplied package for those
scientific source rasters; the app preserves the display assets and source tables.
