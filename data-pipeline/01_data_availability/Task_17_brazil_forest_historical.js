// Task 17

/*
NASA Space Apps 2026 — Dancing with the SARs
BRAZIL — FOREST DISTURBANCE HISTORICAL DATASET

Period: 2019–2026
Satellite: Sentinel-1 SAR
Method: VH backscatter change <= -3 dB

One row = one satellite observation.
Potential disturbance is NOT confirmed deforestation.

Run one year at a time by changing YEAR.
*/

// =======================================
// 1. SETTINGS
// =======================================

var YEAR = 2019;  // Change to 2020, 2021 ... 2026

var ORBIT = 156;
var SCALE = 30;
var TREE_COVER_MIN = 60;
var CHANGE_THRESHOLD = -3;

var MIN_BASELINE_IMAGES = 3;
var MIN_COVERAGE = 0.95;

var aoi = ee.Geometry.Rectangle([
  -64.10, -8.95,
  -63.75, -8.65
]);

Map.centerObject(aoi, 10);
Map.addLayer(aoi, {color: 'yellow'}, 'Study boundary');

// =======================================
// 2. HISTORICAL FOREST MASK
// =======================================

var hansen = ee.Image(
  'UMD/hansen/global_forest_change_2024_v1_12'
);

var treeCover = hansen
  .select('treecover2000')
  .unmask(0);

var lossYear = hansen
  .select('lossyear')
  .unmask(0);

// Fixed starting forest population:
// >=60% tree cover in 2000,
// no recorded tree-cover loss before 2019.

var forest = treeCover.gte(TREE_COVER_MIN)
  .and(
    lossYear.eq(0).or(lossYear.gt(18))
  )
  .clip(aoi)
  .rename('forest');

Map.addLayer(
  forest.selfMask(),
  {palette: ['228B22']},
  'Historical forest mask'
);

// =======================================
// 3. AREA CALCULATION
// =======================================

function areaKm2(mask) {

  var result = ee.Image.pixelArea()
    .updateMask(ee.Image(mask))
    .rename('area')
    .reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: aoi,
      scale: SCALE,
      maxPixels: 1e9,
      tileScale: 4
    });

  return ee.Number(
    ee.Algorithms.If(
      result.get('area'),
      result.get('area'),
      0
    )
  ).divide(1e6);
}

var historicalForestArea = areaKm2(
  forest.selfMask()
);

print(
  'Historical forest area (km2):',
  historicalForestArea
);

// =======================================
// 4. SENTINEL-1 COLLECTION
// =======================================

var s1 = ee.ImageCollection('COPERNICUS/S1_GRD')
  .filterBounds(aoi)
  .filterDate('2017-01-01', '2026-11-16')
  .filter(
    ee.Filter.eq('instrumentMode', 'IW')
  )
  .filter(
    ee.Filter.eq(
      'orbitProperties_pass',
      'DESCENDING'
    )
  )
  .filter(
    ee.Filter.eq(
      'relativeOrbitNumber_start',
      ORBIT
    )
  )
  .filter(
    ee.Filter.listContains(
      'transmitterReceiverPolarisation',
      'VH'
    )
  )
  .filter(
    ee.Filter.listContains(
      'transmitterReceiverPolarisation',
      'VV'
    )
  )
  .select(['VH', 'VV']);

var current = s1.filterDate(
  YEAR + '-01-01',
  (YEAR + 1) + '-01-01'
);

print('Year:', YEAR);
print('Observations available:', current.size());

// =======================================
// 5. RADAR SPECKLE FILTER
// =======================================

function smooth(image) {

  image = ee.Image(image);

  return ee.Image(
    image.select(['VH', 'VV'])
      .focal_median({
        radius: 30,
        units: 'meters'
      })
      .copyProperties(
        image,
        ['system:time_start']
      )
  );
}

var smoothed = s1.map(smooth);

// =======================================
// 6. PROCESS OBSERVATIONS
// =======================================

function processObservation(image) {

  image = ee.Image(image);

  var date = image.date();

  // Same-season reference from ~1 year earlier.
  var baseline = smoothed.filterDate(
    date.advance(-410, 'day'),
    date.advance(-320, 'day')
  );

  var baselineCount = baseline.size();

  var emptyVH = ee.Image.constant(0)
    .rename('VH')
    .updateMask(ee.Image.constant(0));

  var baselineVH = ee.Image(
    ee.Algorithms.If(
      baselineCount.gt(0),
      baseline.select('VH').median(),
      emptyVH
    )
  );

  var currentVH = ee.Image(
    smooth(image)
  ).select('VH');

  // Pixels must belong to our historical forest
  // mask and have both current and baseline data.
  var valid = forest
    .and(currentVH.mask())
    .and(baselineVH.mask())
    .selfMask();

  var vhChange = currentVH
    .subtract(baselineVH)
    .rename('vh_change')
    .updateMask(valid);

  // Detect declines of at least 3 dB.
  var candidate = vhChange
    .lte(CHANGE_THRESHOLD)
    .selfMask();

  // Exclude isolated groups <8 pixels.
  var connected = candidate
    .connectedPixelCount(100, true);

  var disturbance = candidate.updateMask(
    connected.gte(8)
  );

  var monitoredArea = areaKm2(valid);

  var coverage = monitoredArea.divide(
    historicalForestArea.max(0.000001)
  );

  var disturbanceArea = areaKm2(disturbance);

  var disturbanceFraction = disturbanceArea
    .divide(monitoredArea.max(0.000001))
    .multiply(100);

  var meanVH = currentVH
    .updateMask(valid)
    .reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: aoi,
      scale: SCALE,
      maxPixels: 1e9,
      tileScale: 4
    }).get('VH');

  var meanBaselineVH = baselineVH
    .updateMask(valid)
    .reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: aoi,
      scale: SCALE,
      maxPixels: 1e9,
      tileScale: 4
    }).get('VH');

  var meanChange = vhChange.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: aoi,
    scale: SCALE,
    maxPixels: 1e9,
    tileScale: 4
  }).get('vh_change');

  var baselineOK = baselineCount.gte(
    MIN_BASELINE_IMAGES
  );

  var coverageOK = coverage.gte(
    MIN_COVERAGE
  );

  var qualityOK = baselineOK.and(coverageOK);

  return ee.Feature(null, {

    // Date
    observation_date: date.format('YYYY-MM-dd'),
    observation_timestamp: date.format(
      'YYYY-MM-dd HH:mm:ss'
    ),

    // Location
    study_area_id: 'BRA_PORTO_VELHO_FOREST',
    country: 'Brazil',
    region: 'Porto Velho Amazon',

    centre_latitude: -8.800000,
    centre_longitude: -63.925000,

    south_boundary: -8.95,
    west_boundary: -64.10,
    north_boundary: -8.65,
    east_boundary: -63.75,

    // Satellite
    satellite: 'Sentinel-1',
    relative_orbit: ORBIT,

    // Radar measurements
    average_vh_backscatter_db: meanVH,
    baseline_vh_backscatter_db: meanBaselineVH,
    vh_change_db: meanChange,

    // Forest measurements
    historical_forest_area_km2: historicalForestArea,
    monitored_forest_area_km2: monitoredArea,

    potential_forest_disturbance_km2:
      disturbanceArea,

    disturbance_fraction_percent:
      disturbanceFraction,

    // Method
    detection_threshold_db: CHANGE_THRESHOLD,
    baseline_image_count: baselineCount,

    // Quality
    satellite_image_coverage_fraction: coverage,
    baseline_sufficient: baselineOK,
    coverage_sufficient: coverageOK,
    quality_pass: qualityOK

  });
}

// =======================================
// 7. BUILD DATASET
// =======================================

var results = ee.FeatureCollection(
  current.map(processObservation)
);

print(
  'Extracted observations:',
  results.size()
);

print(
  'First 5 observations:',
  results.limit(5)
);

print(
  'Observations passing quality checks:',
  results.filter(
    ee.Filter.eq('quality_pass', true)
  ).size()
);

// =======================================
// 8. EXPORT TO GOOGLE DRIVE
// =======================================

Export.table.toDrive({
  collection: results,
  description:
    'Brazil_Forest_Disturbance_Final_' + YEAR,
  fileFormat: 'CSV'
});
