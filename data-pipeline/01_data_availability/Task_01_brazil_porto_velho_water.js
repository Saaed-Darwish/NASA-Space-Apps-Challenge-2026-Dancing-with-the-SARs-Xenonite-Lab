// Task 01

// NASA Space Apps 2026 — Dancing with the SARs
// Brazil: Madeira River near Porto Velho
// Exploratory Sentinel-1 open-water observations

// 1. Define a preliminary study area.
// This rectangle is NOT the exact AOI drawn in Copernicus Browser.
var aoi = ee.Geometry.Rectangle([
  -64.10, -8.95,
  -63.75, -8.65
]);

Map.centerObject(aoi, 10);
Map.addLayer(aoi, {color: 'yellow'}, 'Brazil AOI');

// 2. Load Sentinel-1 imagery.
var collection = ee.ImageCollection('COPERNICUS/S1_GRD')
  .filterBounds(aoi)
  .filterDate('2019-01-01', '2026-11-15')
  .filter(ee.Filter.eq('instrumentMode', 'IW'))
  .filter(ee.Filter.eq('orbitProperties_pass', 'DESCENDING'))
  .filter(ee.Filter.eq('relativeOrbitNumber_start', 156))
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
  .select('VV');

print('Matching Sentinel-1 scenes:', collection.size());

// 3. Calculate exploratory open-water area for each image.
// VV values in COPERNICUS/S1_GRD are in decibels.
// -17 dB is an illustrative threshold, NOT a calibrated
// flood classifier. Dark pixels can also be non-water.

var observations = collection.map(function(image) {
  var vv = image.select('VV');

  // Reduce speckle with a small neighborhood median.
  var smoothed = vv.focal_median(30, 'circle', 'meters');

  // Preliminary water classification.
  var water = smoothed.lt(-17).rename('water');

  // Mask pixels outside the actual image footprint.
  var waterArea = water
    .multiply(ee.Image.pixelArea())
    .rename('water_area_m2');

  var stats = waterArea.reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: aoi,
    scale: 30,
    maxPixels: 1e9,
    tileScale: 4
  });

  var areaKm2 = ee.Number(
    ee.Algorithms.If(
      stats.get('water_area_m2'),
      stats.get('water_area_m2'),
      0
    )
  ).divide(1e6);

  return ee.Feature(null, {
    region_id: 'BRA_PORTO_VELHO',
    date: image.date().format('YYYY-MM-dd'),
    satellite: image.get('platform_number'),
    relative_orbit: image.get('relativeOrbitNumber_start'),
    orbit_direction: image.get('orbitProperties_pass'),
    water_area_km2: areaKm2,
    threshold_db: -17,
    method: 'VV_threshold_exploratory',
    source: 'COPERNICUS/S1_GRD'
  });
});

// 4. Preview observations.
print('Brazil observations (first 10):',
  observations.limit(10));

// 5. Export CSV to Google Drive.
Export.table.toDrive({
  collection: observations,
  description: 'Brazil_Porto_Velho_SAR_2019_2026',
  fileFormat: 'CSV',
  selectors: [
    'region_id',
    'date',
    'satellite',
    'relative_orbit',
    'orbit_direction',
    'water_area_km2',
    'threshold_db',
    'method',
    'source'
  ]
});

I am going to go task by task. This is the second one
