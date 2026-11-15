// Task 02

// NASA Space Apps 2026 — Dancing with the SARs
// VIETNAM: Can Tho, Mekong Delta
// Sentinel-1 exploratory water-area time series
// Study period: 2019-01-01 to 2026-11-14

// 1. Define a preliminary AOI near Can Tho.
// This is a rectangular study area, not an official
// administrative boundary.
var aoi = ee.Geometry.Rectangle([
  105.65, 9.95,
  105.90, 10.15
]);

Map.centerObject(aoi, 11);
Map.addLayer(aoi, {color: 'yellow'}, 'Can Tho AOI');

// 2. Load Sentinel-1 VV imagery.
var collection = ee.ImageCollection('COPERNICUS/S1_GRD')
  .filterBounds(aoi)
  .filterDate('2019-01-01', '2026-11-15')
  .filter(ee.Filter.eq('instrumentMode', 'IW'))
  .filter(ee.Filter.listContains(
    'transmitterReceiverPolarisation', 'VV'
  ))
  .select('VV');

print('Vietnam matching scenes:', collection.size());

// 3. Calculate preliminary water area and coverage.
// The -17 dB threshold is illustrative, not calibrated.
// SAR-dark pixels are not necessarily water.

var observations = collection.map(function(image) {
  var vv = image.select('VV');
  var smoothed = vv.focal_median(
    30, 'circle', 'meters'
  );

  // Valid pixels within each satellite scene.
  var valid = vv.mask().rename('valid');

  var coverageStats = valid.unmask(0).multiply(
    ee.Image.pixelArea()
  ).rename('covered_m2').reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: aoi,
    scale: 30,
    maxPixels: 1e9,
    tileScale: 4
  });

  var coveredM2 = ee.Number(
    coverageStats.get('covered_m2')
  );

  var coverage = coveredM2.divide(aoi.area());

  // Classify low-backscatter pixels.
  var water = smoothed.lt(-17)
    .updateMask(valid);

  var waterStats = water.multiply(
    ee.Image.pixelArea()
  ).rename('water_m2').reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: aoi,
    scale: 30,
    maxPixels: 1e9,
    tileScale: 4
  });

  var waterM2 = ee.Number(
    ee.Algorithms.If(
      waterStats.get('water_m2'),
      waterStats.get('water_m2'),
      0
    )
  );

  return ee.Feature(null, {
    region_id: 'VNM_CAN_THO',
    date: image.date().format('YYYY-MM-dd'),
    satellite: image.get('platform_number'),
    relative_orbit: image.get(
      'relativeOrbitNumber_start'
    ),
    orbit_direction: image.get(
      'orbitProperties_pass'
    ),
    water_area_km2: waterM2.divide(1e6),
    coverage_fraction: coverage,
    threshold_db: -17,
    method: 'VV_threshold_exploratory',
    source: 'COPERNICUS/S1_GRD'
  });
});

// 4. Keep scenes with at least 95% AOI coverage.
var filtered = observations.filter(
  ee.Filter.gte('coverage_fraction', 0.95)
);

print('Vietnam observations with >=95% coverage:',
  filtered.size());

print('First 10 observations:',
  filtered.limit(10));

// 5. Export to Google Drive.
Export.table.toDrive({
  collection: filtered,
  description: 'Vietnam_Can_Tho_SAR_2019_2026',
  fileFormat: 'CSV',
  selectors: [
    'region_id',
    'date',
    'satellite',
    'relative_orbit',
    'orbit_direction',
    'water_area_km2',
    'coverage_fraction',
    'threshold_db',
    'method',
    'source'
  ]
});
