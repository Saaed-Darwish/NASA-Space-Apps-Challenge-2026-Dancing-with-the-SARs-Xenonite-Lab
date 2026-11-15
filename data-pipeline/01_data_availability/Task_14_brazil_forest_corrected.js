// Task 14

/*
NASA Space Apps 2026 — Dancing with the SARs
BRAZIL — AMAZON FOREST DISTURBANCE

TEST YEAR: 2024

Method:
1. Sentinel-1 VH backscatter
2. Hansen historical forest-cover mask
3. Compare each observation with the same season
   approximately one year earlier
4. Test VH change thresholds: -2, -3, -4 dB
5. Export observations with geographic metadata

IMPORTANT:
These are potential forest disturbance indicators,
NOT confirmed deforestation estimates.
*/

// ===========================================
// 1. SETTINGS
// ===========================================

var YEAR = 2024;
var ORBIT = 156;

var TREE_COVER_MIN = 60;
var MIN_BASELINE_IMAGES = 3;
var MIN_COVERAGE = 0.95;

var SCALE = 30;

// Brazil — Porto Velho Amazon
var aoi = ee.Geometry.Rectangle([
  -64.10, -8.95,
  -63.75, -8.65
]);

Map.centerObject(aoi, 10);

Map.addLayer(
  aoi,
  {color: 'yellow'},
  'Study Area Boundary'
);


// ===========================================
// 2. HANSEN HISTORICAL FOREST MASK
// ===========================================

var hansen = ee.Image(
  'UMD/hansen/global_forest_change_2024_v1_12'
);

// IMPORTANT FIX:
// Explicitly unmask Hansen loss-year pixels.
// A value of 0 represents no recorded loss.

var treeCover = hansen
  .select('treecover2000')
  .unmask(0);

var lossYear = hansen
  .select('lossyear')
  .unmask(0);

// Forest with >=60% tree cover in 2000,
// excluding recorded loss through 2018.
//
// We retain:
// - Pixels with no recorded loss
// - Pixels with loss recorded from 2019 onward
//
// This creates a fixed starting forest population
// for the 2019–2026 time series.

var forest = treeCover.gte(TREE_COVER_MIN)
  .and(
    lossYear.eq(0)
      .or(lossYear.gt(18))
  )
  .clip(aoi)
  .rename('forest');

Map.addLayer(
  forest.selfMask(),
  {palette: ['228B22']},
  'Corrected Historical Forest Mask'
);


// ===========================================
// 3. AREA CALCULATION FUNCTION
// ===========================================

function calculateAreaKm2(mask) {

  var areaImage = ee.Image.pixelArea()
    .updateMask(mask)
    .rename('area');

  var result = areaImage.reduceRegion({
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


// ===========================================
// 4. FOREST MASK DIAGNOSTICS
// ===========================================

var originalForest = treeCover
  .gte(TREE_COVER_MIN)
  .clip(aoi);

var lossBefore2019 = originalForest.and(
  lossYear.gte(1).and(lossYear.lte(18))
);

var lossAfter2018 = originalForest.and(
  lossYear.gte(19)
);

var forestKm2 = calculateAreaKm2(forest);

print(
  'Entire study area (km2):',
  aoi.area().divide(1e6)
);

print(
  'Forest cover in 2000 (km2):',
  calculateAreaKm2(originalForest)
);

print(
  'Recorded forest loss 2001-2018 (km2):',
  calculateAreaKm2(lossBefore2019)
);

print(
  'Recorded forest loss 2019 onward (km2):',
  calculateAreaKm2(lossAfter2018)
);

print(
  'CORRECTED forest area (km2):',
  forestKm2
);

Map.addLayer(
  originalForest.selfMask(),
  {palette: ['66BB6A']},
  'Forest Cover in 2000',
  false
);

Map.addLayer(
  lossBefore2019.selfMask(),
  {palette: ['orange']},
  'Recorded Loss Before 2019',
  false
);


// ===========================================
// 5. LOAD SENTINEL-1
// ===========================================

var s1 = ee.ImageCollection(
  'COPERNICUS/S1_GRD'
)
  .filterBounds(aoi)
  .filterDate('2017-01-01', '2027-01-01')
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

print(
  'All matching Sentinel-1 scenes:',
  s1.size()
);

print(
  'Scenes in selected year:',
  current.size()
);

print(
  'First scene:',
  current.first()
);


// ===========================================
// 6. REDUCE RADAR SPECKLE
// ===========================================

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


// ===========================================
// 7. CALCULATE DISTURBANCE AREA
// ===========================================

function disturbanceArea(change, threshold) {

  var candidate = ee.Image(change)
    .lte(threshold)
    .selfMask();

  // Exclude isolated groups smaller than 8 pixels.
  var connected = candidate.connectedPixelCount(
    100,
    true
  );

  var filtered = candidate.updateMask(
    connected.gte(8)
  );

  return calculateAreaKm2(filtered);
}


// ===========================================
// 8. PROCESS EACH SATELLITE OBSERVATION
// ===========================================

function calculateObservation(image) {

  image = ee.Image(image);

  var date = image.date();

  // Historical reference from approximately
  // the same season in the previous year.

  var baseline = smoothed.filterDate(
    date.advance(-410, 'day'),
    date.advance(-320, 'day')
  );

  var baselineCount = baseline.size();

  // Safe empty baseline if no images are available.
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

  // Mean VH signal across valid forest.
  var meanVH = currentVH
    .updateMask(valid)
    .reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: aoi,
      scale: SCALE,
      maxPixels: 1e9,
      tileScale: 4
    }).get('VH');

  // Mean change relative to historical baseline.
  var meanChange = vhChange.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: aoi,
    scale: SCALE,
    maxPixels: 1e9,
    tileScale: 4
  }).get('vh_change');

  var validArea = calculateAreaKm2(valid);

  var coverage = validArea.divide(
    forestKm2.max(0.000001)
  );

  // Candidate thresholds.
  var areaMinus2 = disturbanceArea(
    vhChange, -2
  );

  var areaMinus3 = disturbanceArea(
    vhChange, -3
  );

  var areaMinus4 = disturbanceArea(
    vhChange, -4
  );

  return ee.Feature(null, {

    // Observation information
    observation_date: date.format('YYYY-MM-dd'),
    observation_timestamp: date.format(
      'YYYY-MM-dd HH:mm:ss'
    ),

    // Geographic information
    study_area_id: 'BRA_PORTO_VELHO_FOREST',
    country: 'Brazil',
    region: 'Porto Velho Amazon',

    centre_latitude: -8.800000,
    centre_longitude: -63.925000,

    south_boundary: -8.95,
    west_boundary: -64.10,
    north_boundary: -8.65,
    east_boundary: -63.75,

    // Satellite information
    satellite: 'Sentinel-1',
    relative_orbit: ORBIT,

    // Forest measurements
    mean_vh_db: meanVH,
    mean_vh_change_db: meanChange,

    // Forest area and coverage
    historical_forest_area_km2: forestKm2,
    monitored_forest_area_km2: validArea,
    forest_coverage_fraction: coverage,

    // Threshold comparison
    potential_disturbance_minus2_km2: areaMinus2,
    potential_disturbance_minus3_km2: areaMinus3,
    potential_disturbance_minus4_km2: areaMinus4,

    // Data quality
    baseline_image_count: baselineCount,

    baseline_sufficient:
      baselineCount.gte(MIN_BASELINE_IMAGES),

    coverage_sufficient:
      coverage.gte(MIN_COVERAGE)

  });
}


// ===========================================
// 9. BUILD OBSERVATION DATASET
// ===========================================

var results = ee.FeatureCollection(
  current.map(calculateObservation)
);

print(
  'Extracted observations:',
  results.size()
);

print(
  'First five observations:',
  results.limit(5)
);


// ===========================================
// 10. EXPORT CSV
// ===========================================

Export.table.toDrive({

  collection: results,

  description:
    'Brazil_Forest_Disturbance_Corrected_' + YEAR,

  fileFormat: 'CSV'

});


// ===========================================
// 11. VISUAL CHECK
// ===========================================

var example = ee.Image(current.first());

var exampleDate = example.date();

var exampleBaseline = smoothed.filterDate(
  exampleDate.advance(-410, 'day'),
  exampleDate.advance(-320, 'day')
).select('VH').median();

var exampleSmoothed = ee.Image(
  smooth(example)
);

var exampleChange = exampleSmoothed
  .select('VH')
  .subtract(exampleBaseline)
  .updateMask(forest);

Map.addLayer(
  exampleChange,
  {
    min: -5,
    max: 5,
    palette: ['red', 'white', 'blue']
  },
  'VH Change — Example Observation'
);
