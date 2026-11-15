// Task 15

/*
NASA Space Apps 2026 — Dancing with the SARs
BRAZIL FOREST DISTURBANCE — 2024 VALIDATION

Compare three Sentinel-1 VH-change thresholds:
-2 dB, -3 dB, -4 dB

Reference: Hansen tree-cover loss during 2024.

Outputs:
- Precision
- Recall
- Intersection over Union (IoU)
- TP / FP / FN areas in km2

Important:
Agreement with annual tree-cover loss is not the
same as verified forest-disturbance accuracy.
*/

// ==========================================
// 1. SETTINGS
// ==========================================

var YEAR = 2024;
var ORBIT = 156;
var SCALE = 30;

var TREE_COVER_MIN = 60;
var MIN_BASELINE_IMAGES = 3;
var MIN_COVERAGE = 0.95;

// Require at least 2 detections at a pixel
// during 2024 to reduce one-off radar noise.
var MIN_DETECTIONS = 2;

var aoi = ee.Geometry.Rectangle([
  -64.10, -8.95,
  -63.75, -8.65
]);

Map.centerObject(aoi, 10);

Map.addLayer(
  aoi,
  {color: 'yellow'},
  'Study boundary'
);

// ==========================================
// 2. HANSEN FOREST AND LOSS REFERENCE
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

// Validation population: forest not recorded
// as lost before the beginning of 2024.
//
// This is DIFFERENT from our fixed 2019
// forest mask, deliberately, because we
// are testing loss specifically during 2024.

var forest2024 = treeCover.gte(TREE_COVER_MIN)
  .and(
    lossYear.eq(0).or(lossYear.gte(24))
  )
  .clip(aoi)
  .rename('forest');

// Hansen 2024 reference loss.
var referenceLoss = lossYear.eq(24)
  .and(forest2024)
  .rename('reference_loss')
  .clip(aoi);

// ==========================================
// 3. AREA CALCULATION
// ==========================================

function areaKm2(mask) {
  var area = ee.Image.pixelArea()
    .updateMask(ee.Image(mask))
    .rename('area');

  var result = area.reduceRegion({
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

var forestArea = areaKm2(forest2024.selfMask());

print(
  'Forest eligible at start of 2024 (km2):',
  forestArea
);

print(
  'Hansen 2024 loss area (km2):',
  areaKm2(referenceLoss.selfMask())
);

// ==========================================
// 4. SENTINEL-1 IMAGES
// ==========================================

var s1 = ee.ImageCollection(
  'COPERNICUS/S1_GRD'
)
  .filterBounds(aoi)
  .filterDate('2022-01-01', '2025-01-01')
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

function smooth(image) {
  image = ee.Image(image);

  return image
    .focal_median({
      radius: 30,
      units: 'meters'
    })
    .copyProperties(
      image,
      ['system:time_start']
    );
}

var smoothed = s1.map(smooth);

var current = s1.filterDate(
  YEAR + '-01-01',
  (YEAR + 1) + '-01-01'
);

print('2024 scenes:', current.size());

// ==========================================
// 5. PER-OBSERVATION VH CHANGE
// ==========================================

function processImage(image) {
  image = ee.Image(image);

  var date = image.date();

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

  var valid = forest2024
    .and(currentVH.mask())
    .and(baselineVH.mask())
    .selfMask();

  var validArea = areaKm2(valid);

  var coverage = validArea.divide(
    forestArea.max(0.000001)
  );

  var qualityOK = baselineCount
    .gte(MIN_BASELINE_IMAGES)
    .and(coverage.gte(MIN_COVERAGE));

  var change = currentVH
    .subtract(baselineVH)
    .updateMask(valid);

  // Same connected-pixel rule as extraction.
  function detect(threshold) {
    var candidate = change.lte(threshold)
      .selfMask();

    var connected = candidate
      .connectedPixelCount(100, true);

    return candidate
      .updateMask(connected.gte(8))
      .unmask(0)
      .updateMask(valid)
      .rename('det');
  }

  // Images failing the quality check are
  // fully masked, not counted as zero change.
  var qualityMask = ee.Image.constant(
    ee.Number(qualityOK)
  );

  var d2 = detect(-2)
    .updateMask(qualityMask)
    .rename('d2');

  var d3 = detect(-3)
    .updateMask(qualityMask)
    .rename('d3');

  var d4 = detect(-4)
    .updateMask(qualityMask)
    .rename('d4');

  var observed = ee.Image.constant(1)
    .updateMask(valid)
    .updateMask(qualityMask)
    .rename('observed');

  return ee.Image.cat([
    d2, d3, d4, observed
  ]).copyProperties(
    image,
    ['system:time_start']
  );
}

var detections = current.map(processImage);

var counts = detections.sum();

// Only evaluate pixels with at least two
// usable Sentinel-1 observations.
var evaluated = counts
  .select('observed')
  .gte(2)
  .and(forest2024)
  .selfMask();

print(
  'Evaluated forest area (km2):',
  areaKm2(evaluated)
);

print(
  'Number of valid observations per pixel:',
  counts.select('observed')
);

// ==========================================
// 6. COMPARE WITH HANSEN 2024 LOSS
// ==========================================

function validate(band, threshold) {

  var predicted = counts
    .select(band)
    .gte(MIN_DETECTIONS)
    .updateMask(evaluated)
    .unmask(0)
    .updateMask(evaluated);

  var reference = referenceLoss
    .unmask(0)
    .updateMask(evaluated);

  var tp = predicted.eq(1)
    .and(reference.eq(1))
    .selfMask();

  var fp = predicted.eq(1)
    .and(reference.eq(0))
    .selfMask();

  var fn = predicted.eq(0)
    .and(reference.eq(1))
    .selfMask();

  var tpArea = areaKm2(tp);
  var fpArea = areaKm2(fp);
  var fnArea = areaKm2(fn);

  var precision = tpArea.divide(
    tpArea.add(fpArea).max(0.000001)
  );

  var recall = tpArea.divide(
    tpArea.add(fnArea).max(0.000001)
  );

  var iou = tpArea.divide(
    tpArea.add(fpArea).add(fnArea)
      .max(0.000001)
  );

  return ee.Feature(null, {
    country: 'Brazil',
    region: 'Porto Velho Amazon',
    validation_year: YEAR,
    method: threshold,
    minimum_detection_count: MIN_DETECTIONS,
    evaluated_forest_km2: areaKm2(evaluated),
    reference_loss_km2: areaKm2(
      reference.selfMask()
    ),
    predicted_disturbance_km2: areaKm2(
      predicted.selfMask()
    ),
    TP_km2: tpArea,
    FP_km2: fpArea,
    FN_km2: fnArea,
    precision: precision,
    recall: recall,
    IoU: iou
  });
}

var validation = ee.FeatureCollection([
  validate('d2', 'VH change <= -2 dB'),
  validate('d3', 'VH change <= -3 dB'),
  validate('d4', 'VH change <= -4 dB')
]);

print('VALIDATION RESULTS:', validation);

// ==========================================
// 7. MAP COMPARISON
// ==========================================

Map.addLayer(
  referenceLoss.selfMask(),
  {palette: ['00FF00']},
  'Hansen 2024 tree-cover loss'
);

Map.addLayer(
  counts.select('d2')
    .gte(MIN_DETECTIONS)
    .updateMask(evaluated)
    .selfMask(),
  {palette: ['FFFF00']},
  'SAR disturbance -2 dB',
  false
);

Map.addLayer(
  counts.select('d3')
    .gte(MIN_DETECTIONS)
    .updateMask(evaluated)
    .selfMask(),
  {palette: ['FF9900']},
  'SAR disturbance -3 dB'
);

Map.addLayer(
  counts.select('d4')
    .gte(MIN_DETECTIONS)
    .updateMask(evaluated)
    .selfMask(),
  {palette: ['FF0000']},
  'SAR disturbance -4 dB',
  false
);

// ==========================================
// 8. EXPORT VALIDATION TABLE
// ==========================================

Export.table.toDrive({
  collection: validation,
  description:
    'Brazil_Forest_Threshold_Validation_2024',
  fileFormat: 'CSV'
});
