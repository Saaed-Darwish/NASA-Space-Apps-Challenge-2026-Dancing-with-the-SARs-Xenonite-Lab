// Task 21

/*
NASA Space Apps 2026 — Dancing with the SARs

VIETNAM — BINH PHUOC
FOREST DISTURBANCE HISTORICAL EXTRACTION

Period: 2019–2026
Satellite: Sentinel-1 SAR
Orbit: DESCENDING 18
Selected VH threshold: -4 dB

One row = one satellite observation.

Outputs:
- Observation timestamp
- Mean VH backscatter
- Mean VH change
- Potential forest disturbance area
- Monitored forest area
- Baseline image count
- Coverage and quality flags
- Study-area coordinates

IMPORTANT:
Potential disturbance is not confirmed
deforestation or newly cleared land.
*/

// ==========================================
// 1. SETTINGS
// ==========================================

var YEAR = 2019; // Change through 2026

var ORBIT = 18;
var SCALE = 30;

var TREE_COVER_MIN = 60;
var CHANGE_THRESHOLD = -4;

var MIN_BASELINE_IMAGES = 3;
var MIN_COVERAGE = 0.95;
var MIN_CONNECTED_PIXELS = 8;

var aoi = ee.Geometry.Rectangle([
  106.70, 11.60,
  107.00, 11.90
]);

Map.centerObject(aoi, 10);
Map.addLayer(
  aoi,
  {color: 'yellow'},
  'Binh Phuoc study area'
);

// ==========================================
// 2. HISTORICAL FOREST MASK
// ==========================================

var hansen = ee.Image(
  'UMD/hansen/global_forest_change_2024_v1_12'
);

var treeCover = hansen
  .select('treecover2000')
  .unmask(0);

var lossYear = hansen
  .select('lossyear')
  .unmask(0);

// Fixed forest eligible at start of 2019.
var forest = treeCover.gte(TREE_COVER_MIN)
  .and(
    lossYear.eq(0)
      .or(lossYear.gt(18))
  )
  .clip(aoi)
  .rename('forest');

// ==========================================
// 3. AREA HELPER
// ==========================================

function areaKm2(mask) {

  var result = ee.Image.pixelArea()
    .updateMask(
      ee.Image(mask).selfMask()
    )
    .rename('area')
    .reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: aoi,
      scale: SCALE,
      maxPixels: 1e9,
      tileScale: 16
    });

  return ee.Number(
    ee.Algorithms.If(
      result.get('area'),
      result.get('area'),
      0
    )
  ).divide(1e6);
}

var historicalForestArea = areaKm2(forest);

// ==========================================
// 4. SENTINEL-1 COLLECTION
// ==========================================

var s1 = ee.ImageCollection('COPERNICUS/S1_GRD')
  .filterBounds(aoi)
  .filterDate(
    '2017-01-01',
    '2026-11-16'
  )
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

print('Extraction year:', YEAR);
print('Available observations:', current.size());

// ==========================================
// 5. SPECKLE FILTER
// ==========================================

function smooth(image) {

  image = ee.Image(image);

  var filtered = image
    .select(['VH', 'VV'])
    .focal_median({
      radius: 30,
      units: 'meters'
    });

  return ee.Image(filtered).copyProperties(
    image,
    ['system:time_start']
  );
}

var smoothed = s1.map(smooth);

// ==========================================
// 6. PROCESS OBSERVATIONS
// ==========================================

function processObservation(image) {

  image = ee.Image(image);

  var date = image.date();

  // Same-season historical baseline.
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

  var valid = forest
    .and(currentVH.mask())
    .and(baselineVH.mask())
    .selfMask();

  var vhChange = currentVH
    .subtract(baselineVH)
    .rename('vh_change')
    .updateMask(valid);

  var monitoredArea = areaKm2(valid);

  var coverage = monitoredArea.divide(
    historicalForestArea.max(0.000001)
  );

  // Detect VH decreases of at least 4 dB.
  var candidate = vhChange
    .lte(CHANGE_THRESHOLD)
    .selfMask();

  var connected = candidate
    .connectedPixelCount(100, true);

  var disturbance = candidate.updateMask(
    connected.gte(MIN_CONNECTED_PIXELS)
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
      tileScale: 16
    }).get('VH');

  var meanBaselineVH = baselineVH
    .updateMask(valid)
    .reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: aoi,
      scale: SCALE,
      maxPixels: 1e9,
      tileScale: 16
    }).get('VH');

  var meanChange = vhChange.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: aoi,
    scale: SCALE,
    maxPixels: 1e9,
    tileScale: 16
  }).get('vh_change');

  var baselineOK = baselineCount.gte(
    MIN_BASELINE_IMAGES
  );

  var coverageOK = coverage.gte(
    MIN_COVERAGE
  );

  var qualityOK = baselineOK.and(coverageOK);

  return ee.Feature(null, {

    // Observation
    observation_date: date.format('YYYY-MM-dd'),
    observation_timestamp:
      date.format('YYYY-MM-dd HH:mm:ss'),

    // Study region
    study_area_id: 'VNM_BINH_PHUOC_FOREST',
    country: 'Vietnam',
    region: 'Binh Phuoc',

    centre_latitude: 11.75,
    centre_longitude: 106.85,

    west_boundary: 106.70,
    south_boundary: 11.60,
    east_boundary: 107.00,
    north_boundary: 11.90,

    // Satellite
    satellite: 'Sentinel-1',
    relative_orbit: ORBIT,
    orbit_pass: 'DESCENDING',

    // Radar measurements
    average_vh_backscatter_db: meanVH,
    baseline_vh_backscatter_db:
      meanBaselineVH,
    vh_change_db: meanChange,

    // Forest measurements
    historical_forest_area_km2:
      historicalForestArea,

    monitored_forest_area_km2:
      monitoredArea,

    potential_forest_disturbance_km2:
      disturbanceArea,

    disturbance_fraction_percent:
      disturbanceFraction,

    // Method
    detection_threshold_db:
      CHANGE_THRESHOLD,

    baseline_image_count: baselineCount,

    // Quality
    satellite_image_coverage_fraction:
      coverage,

    baseline_sufficient: baselineOK,
    coverage_sufficient: coverageOK,
    quality_pass: qualityOK
  });
}

// ==========================================
// 7. BUILD DATASET
// ==========================================

var results = ee.FeatureCollection(
  current.map(processObservation)
);

print(
  'Observation records:',
  results.size()
);

// ==========================================
// 8. EXPORT
// ==========================================

Export.table.toDrive({
  collection: results,
  description:
    'Vietnam_Binh_Phuoc_Forest_Final_' + YEAR,
  fileFormat: 'CSV'
});

print('Export task created for:', YEAR);
