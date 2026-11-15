// Task 18

/*
NASA Space Apps 2026 — Dancing with the SARs

VIETNAM — FOREST DISTURBANCE VALIDATION
Study area: Dak Lak, Central Highlands
Validation year: 2023
Satellite: Sentinel-1 SAR
Descending relative orbit: 120

Compare thresholds: -2, -3, -4 dB
Reference: Hansen Global Forest Change 2023

Annual SAR detection:
At least 2 valid observations detecting the same pixel.

Outputs:
Precision, Recall, IoU, TP, FP, FN,
predicted disturbance area and reference loss area.

IMPORTANT:
SAR disturbance is not confirmed deforestation.
Hansen annual loss is an imperfect reference.
*/

// ==========================================
// 1. SETTINGS AND STUDY AREA
// ==========================================

var YEAR = 2023;
var ORBIT = 120;

var SCALE = 30;
var TREE_COVER_MIN = 60;

var MIN_BASELINE_IMAGES = 3;
var MIN_COVERAGE = 0.95;
var MIN_CONNECTED_PIXELS = 8;
var MIN_ANNUAL_DETECTIONS = 2;

var THRESHOLDS = [-2, -3, -4];

var aoi = ee.Geometry.Rectangle([
  108.10, 12.60,
  108.40, 12.90
]);

Map.centerObject(aoi, 10);
Map.addLayer(aoi, {color: 'yellow'}, 'Study area');

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

// Hansen loss codes:
// 23 = 2023, 24 = 2024.

var lossCode = YEAR - 2000;

// Eligible forest excludes Hansen loss
// before the validation year.
var eligibleForest = treeCover.gte(TREE_COVER_MIN)
  .and(
    lossYear.eq(0)
      .or(lossYear.gte(lossCode))
  )
  .clip(aoi)
  .rename('forest');

// Annual reference loss.
var referenceLoss = lossYear.eq(lossCode)
  .and(eligibleForest)
  .rename('reference_loss')
  .clip(aoi);

Map.addLayer(
  eligibleForest.selfMask(),
  {palette: ['228B22']},
  'Eligible forest'
);

Map.addLayer(
  referenceLoss.selfMask(),
  {palette: ['red']},
  'Hansen 2023 loss'
);

// ==========================================
// 3. AREA HELPER
// ==========================================

function areaKm2(mask) {

  var result = ee.Image.pixelArea()
    .updateMask(ee.Image(mask).selfMask())
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

print(
  'Eligible forest area (km2):',
  areaKm2(eligibleForest)
);

print(
  'Hansen 2023 reference loss (km2):',
  areaKm2(referenceLoss)
);

// ==========================================
// 4. SENTINEL-1 COLLECTION
// ==========================================

var s1 = ee.ImageCollection('COPERNICUS/S1_GRD')
  .filterBounds(aoi)
  .filterDate(
    (YEAR - 2) + '-01-01',
    (YEAR + 1) + '-01-01'
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

print('2023 Sentinel-1 scenes:', current.size());

// ==========================================
// 5. SPECKLE FILTER
// ==========================================

function smooth(image) {

  image = ee.Image(image);

  return image
    .select(['VH', 'VV'])
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

// ==========================================
// 6. PER-OBSERVATION DETECTION
// ==========================================

function processObservation(image) {

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

var currentVH = ee.Image(smooth(image)).select('VH');

  var valid = eligibleForest
    .and(currentVH.mask())
    .and(baselineVH.mask())
    .selfMask();

  var vhChange = currentVH
    .subtract(baselineVH)
    .rename('vh_change')
    .updateMask(valid);

  var monitoredArea = areaKm2(valid);

  var coverage = monitoredArea.divide(
    areaKm2(eligibleForest).max(0.000001)
  );

  var qualityOK = baselineCount
    .gte(MIN_BASELINE_IMAGES)
    .and(coverage.gte(MIN_COVERAGE));

  // Count valid acquisitions at each pixel.
  // Exclude observations failing scene-level
  // baseline or coverage checks.
  var validObservation = ee.Image(
    ee.Algorithms.If(
      qualityOK,
      valid.unmask(0),
      ee.Image.constant(0)
    )
  ).rename('valid_observation')
    .toByte();

  var output = validObservation;

  THRESHOLDS.forEach(function(threshold) {

    var candidate = vhChange
      .lte(threshold)
      .selfMask();

    var connected = candidate
      .connectedPixelCount(100, true);

    var detected = candidate.updateMask(
      connected.gte(MIN_CONNECTED_PIXELS)
    );

    detected = ee.Image(
      ee.Algorithms.If(
        qualityOK,
        detected.unmask(0),
        ee.Image.constant(0)
      )
    );

    output = output.addBands(
      detected.rename(
        'det_' + Math.abs(threshold)
      ).toByte()
    );
  });

  return output.copyProperties(
    image,
    ['system:time_start']
  );
}

var processed = current.map(processObservation);

print('Processed scenes:', processed.size());

// ==========================================
// 7. ANNUAL DETECTION MASKS
// ==========================================

var summed = processed.sum();

var validCount = summed
  .select('valid_observation');

// Restrict evaluation to pixels observed
// at least twice during the year.
var evaluationMask = eligibleForest
  .and(validCount.gte(MIN_ANNUAL_DETECTIONS))
  .selfMask();

print(
  'Evaluated forest area (km2):',
  areaKm2(evaluationMask)
);

var evaluatedReference = referenceLoss
  .updateMask(evaluationMask);

print(
  'Reference loss within evaluated area (km2):',
  areaKm2(evaluatedReference)
);

// ==========================================
// 8. VALIDATION METRICS
// ==========================================

var validation = ee.FeatureCollection(
  THRESHOLDS.map(function(threshold) {

    var bandName =
      'det_' + Math.abs(threshold);

    var predicted = summed
      .select(bandName)
      .gte(MIN_ANNUAL_DETECTIONS)
      .and(evaluationMask);

    var reference = referenceLoss
      .and(evaluationMask);

    var tpMask = predicted.and(reference);

    var fpMask = predicted.and(
      reference.not()
    );

    var fnMask = reference.and(
      predicted.not()
    );

    var tp = areaKm2(tpMask);
    var fp = areaKm2(fpMask);
    var fn = areaKm2(fnMask);

    var predictedArea = areaKm2(predicted);
    var referenceArea = areaKm2(reference);

    var precision = tp.divide(
      tp.add(fp).max(0.000001)
    );

    var recall = tp.divide(
      tp.add(fn).max(0.000001)
    );

    var iou = tp.divide(
      tp.add(fp).add(fn).max(0.000001)
    );

    return ee.Feature(null, {
      country: 'Vietnam',
      region: 'Dak Lak Central Highlands',
      validation_year: YEAR,
      relative_orbit: ORBIT,

      threshold_db: threshold,

      evaluated_forest_area_km2:
        areaKm2(evaluationMask),

      reference_loss_km2: referenceArea,
      predicted_area_km2: predictedArea,

      true_positive_km2: tp,
      false_positive_km2: fp,
      false_negative_km2: fn,

      precision: precision,
      recall: recall,
      iou: iou,

      minimum_annual_detections:
        MIN_ANNUAL_DETECTIONS,

      minimum_baseline_images:
        MIN_BASELINE_IMAGES,

      minimum_scene_coverage:
        MIN_COVERAGE
    });
  })
);

print('2023 threshold validation:', validation);

// ==========================================
// 9. MAP LAYERS
// ==========================================

Map.addLayer(
  evaluationMask,
  {palette: ['cyan']},
  'Evaluated forest',
  false
);

Map.addLayer(
  summed.select('det_3')
    .gte(MIN_ANNUAL_DETECTIONS)
    .selfMask()
    .updateMask(evaluationMask),
  {palette: ['yellow']},
  'SAR detections -3 dB'
);

// ==========================================
// 10. EXPORT
// ==========================================

Export.table.toDrive({
  collection: validation,
  description:
    'Vietnam_Forest_Threshold_Validation_2023',
  fileFormat: 'CSV'
});
