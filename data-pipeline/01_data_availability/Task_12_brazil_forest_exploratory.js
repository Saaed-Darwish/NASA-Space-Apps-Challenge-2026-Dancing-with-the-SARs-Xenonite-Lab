// Task 12

/*
NASA 2026 — Dancing with the SARs
BRAZIL: Amazon forest disturbance — exploratory extraction

One row per usable Sentinel-1 acquisition.
VH change compared with observations from approximately
the same season in the previous year.

IMPORTANT: Potential radar disturbance, NOT confirmed deforestation.
*/

var YEAR = 2024;  // Test 2024 first; then change to 2019–2026.
var ORBIT = 156;  // Brazil flood orbit; verify VH coverage below.
var TREE_COVER_MIN = 60;
var MIN_BASELINE_IMAGES = 3;
var SCALE = 30;

var aoi = ee.Geometry.Rectangle(
  [-64.10, -8.95, -63.75, -8.65]
);

Map.centerObject(aoi, 10);
Map.addLayer(aoi, {color: 'yellow'}, 'Study boundary');

// Historical forest mask:
// Tree cover in 2000 >= 60%;
// exclude recorded tree-cover loss through 2018.
// Fixed for the entire 2019–2026 series.
var hansen = ee.Image(
  'UMD/hansen/global_forest_change_2024_v1_12'
);

var treeCover = hansen.select('treecover2000');
var lossYear = hansen.select('lossyear');

var forest = treeCover.gte(TREE_COVER_MIN)
  .and(lossYear.eq(0).or(lossYear.gt(18)))
  .unmask(0)
  .clip(aoi)
  .rename('forest');

Map.addLayer(
  forest.selfMask(),
  {palette: ['228B22']},
  'Historical forest mask'
);

// Sentinel-1: keep acquisition geometry consistent.
var s1 = ee.ImageCollection('COPERNICUS/S1_GRD')
  .filterBounds(aoi)
  .filterDate('2017-01-01', '2027-01-01')
  .filter(ee.Filter.eq('instrumentMode', 'IW'))
  .filter(ee.Filter.eq('orbitProperties_pass', 'DESCENDING'))
  .filter(ee.Filter.eq('relativeOrbitNumber_start', ORBIT))
  .filter(ee.Filter.listContains(
    'transmitterReceiverPolarisation', 'VH'
  ))
  .filter(ee.Filter.listContains(
    'transmitterReceiverPolarisation', 'VV'
  ))
  .select(['VH', 'VV']);

print('All matching Sentinel-1 scenes:', s1.size());

var current = s1.filterDate(
  YEAR + '-01-01',
  (YEAR + 1) + '-01-01'
);

print('Scenes in selected year:', current.size());
print('First scene:', current.first());

// Median filtering reduces local speckle.
// All backscatter measurements remain in dB.
function smooth(image) {
  return image.select(['VH', 'VV'])
    .focal_median({radius: 30, units: 'meters'})
    .copyProperties(image, ['system:time_start']);
}

var smoothed = s1.map(smooth);

var forestArea = ee.Image.pixelArea()
  .updateMask(forest)
  .rename('area');

var forestKm2 = ee.Number(
  forestArea.reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: aoi,
    scale: SCALE,
    maxPixels: 1e9,
    tileScale: 4
  }).get('area')
).divide(1e6);

print('Historical forest area (km2):', forestKm2);

function areaKm2(mask, validMask) {
  var area = ee.Image.pixelArea()
    .updateMask(mask)
    .updateMask(validMask)
    .rename('area');

  var result = area.reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: aoi,
    scale: SCALE,
    maxPixels: 1e9,
    tileScale: 4
  });

  return ee.Number(
    ee.Algorithms.If(result.get('area'), result.get('area'), 0)
  ).divide(1e6);
}

function calculateObservation(image) {
  var date = image.date();

  // Reference: same season, approximately one year earlier.
  // Window = 365 days earlier, plus/minus 45 days.
  var baseline = smoothed.filterDate(
    date.advance(-410, 'day'),
    date.advance(-320, 'day')
  );

  var baselineCount = baseline.size();

  // A masked placeholder keeps calculations safe if no
  // historical reference imagery is available.
  var baselineVH = ee.Image(ee.Algorithms.If(
    baselineCount.gt(0),
    baseline.select('VH').median(),
    ee.Image.constant(0).rename('VH')
      .updateMask(ee.Image.constant(0))
  ));

 var currentVH = ee.Image(smooth(ee.Image(image))).select('VH');

  var valid = forest
    .and(currentVH.mask())
    .and(baselineVH.mask())
    .selfMask();

  var vhChange = currentVH.subtract(baselineVH)
    .rename('vh_change')
    .updateMask(valid);

  // Candidate thresholds. Require clusters of at least
  // eight adjacent pixels to reduce isolated noise.
  function disturbance(threshold) {
    var candidate = vhChange.lte(threshold).selfMask();

    var connected = candidate.connectedPixelCount(100, true);
    return candidate.updateMask(connected.gte(8));
  }

  var d2 = disturbance(-2);
  var d3 = disturbance(-3);
  var d4 = disturbance(-4);

  var validArea = areaKm2(valid, valid);

  var meanVH = currentVH.updateMask(valid).reduceRegion({
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

  return ee.Feature(null, {
    observation_date: date.format('YYYY-MM-dd'),
    observation_timestamp: date.format('YYYY-MM-dd HH:mm:ss'),
    study_area_id: 'BRA_PORTO_VELHO_FOREST',
    country: 'Brazil',
    region: 'Porto Velho Amazon',
    centre_latitude: -8.800000,
    centre_longitude: -63.925000,
    south_boundary: -8.95,
    west_boundary: -64.10,
    north_boundary: -8.65,
    east_boundary: -63.75,
    satellite: 'Sentinel-1',
    relative_orbit: ORBIT,
    mean_vh_db: meanVH,
    mean_vh_change_db: meanChange,
    baseline_image_count: baselineCount,
    monitored_forest_area_km2: validArea,
    historical_forest_area_km2: forestKm2,
    forest_coverage_fraction: validArea.divide(forestKm2),
    potential_disturbance_minus2_km2: areaKm2(d2, valid),
    potential_disturbance_minus3_km2: areaKm2(d3, valid),
    potential_disturbance_minus4_km2: areaKm2(d4, valid),
    baseline_sufficient: baselineCount.gte(MIN_BASELINE_IMAGES)
  });
}

var results = ee.FeatureCollection(
  current.map(calculateObservation)
);

print('Extracted observations:', results.size());
print('First five rows:', results.limit(5));

// Export the complete diagnostic results.
// We'll filter out observations with insufficient
// baselines after checking coverage.
Export.table.toDrive({
  collection: results,
  description: 'Brazil_Forest_Disturbance_' + YEAR,
  fileFormat: 'CSV'
});

// Visual inspection of one selected observation.
var example = ee.Image(current.first());
var exampleDate = example.date();

var exampleBaseline = smoothed.filterDate(
  exampleDate.advance(-410, 'day'),
  exampleDate.advance(-320, 'day')
).select('VH').median();

var exampleSmoothed = ee.Image(smooth(example));

var exampleChange = exampleSmoothed
  .select('VH')
  .subtract(exampleBaseline)
  .updateMask(forest);
