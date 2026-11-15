// Task 19

/*
NASA Space Apps 2026 — Dancing with the SARs

VIETNAM — BINH PHUOC FOREST DISTURBANCE
THRESHOLD VALIDATION

Study area: Binh Phuoc, southeastern Vietnam
Satellite: Sentinel-1 SAR
Orbit: DESCENDING 18

Validation: Hansen Global Forest Change
Thresholds: -2, -3, -4 dB

Method:
- VH backscatter change vs previous-year baseline
- 30 m focal median
- At least 3 baseline images
- At least 95% monitored forest coverage
- Minimum 8 connected detection pixels
- At least 2 annual detections per pixel

Outputs: precision, recall, IoU, TP, FP, FN

NOTE:
Potential forest disturbance is not confirmed
deforestation. Hansen is an imperfect reference.
*/

// ==========================================
// 1. SETTINGS AND STUDY AREA
// ==========================================

var YEAR = 2023; // Change to 2024 for second test

var ORBIT = 18;
var SCALE = 30;

var TREE_COVER_MIN = 60;
var MIN_BASELINE_IMAGES = 3;
var MIN_COVERAGE = 0.95;

var MIN_CONNECTED_PIXELS = 8;
var MIN_ANNUAL_DETECTIONS = 2;

var THRESHOLDS = [-2, -3, -4];

var aoi = ee.Geometry.Rectangle([
  106.70, 11.60,
  107.00, 11.90
]);

Map.centerObject(aoi, 10);
Map.addLayer(
  aoi,
  {color: 'yellow'},
  'Binh Phuoc study boundary'
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

// Hansen loss year:
// 23 = 2023, 24 = 2024

var lossCode = YEAR - 2000;

// Eligible forest excludes loss before YEAR.
var eligibleForest = treeCover.gte(TREE_COVER_MIN)
  .and(
    lossYear.eq(0)
      .or(lossYear.gte(lossCode))
  )
  .clip(aoi)
  .rename('forest');

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
  'Hansen reference loss'
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
      tileScale: 16,
      bestEffort: true
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
  'Hansen reference loss (km2):',
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

print(
  'Sentinel-1 observations in ' + YEAR + ':',
  current.size()
);

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
// 6. PER-OBSERVATION DETECTION
// ==========================================

function processObservation(image) {

  image = ee.Image(image);

  var date = image.date();

  // Reference observations from approximately
  // one year before the current acquisition.
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

  // Require current and baseline data.
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

  // Record valid coverage per pixel.
  var validObservation = ee.Image(
    ee.Algorithms.If(
      qualityOK,
      valid.unmask(0),
      ee.Image.constant(0)
    )
  ).rename('valid_observation')
    .toByte();

  var output = validObservation;

  // Evaluate all thresholds.
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

print(
  'Processed observations:',
  processed.size()
);

// ==========================================
// 7. ANNUAL DETECTION MASKS
// ==========================================

var summed = processed.sum();

var validCount = summed.select(
  'valid_observation'
);

// Evaluate only pixels observed in at least
// two quality-passing satellite acquisitions.
var evaluationMask = eligibleForest
  .and(
    validCount.gte(MIN_ANNUAL_DETECTIONS)
  )
  .selfMask();

print(
  'Evaluated forest area (km2):',
  areaKm2(evaluationMask)
);

var evaluatedReference = referenceLoss
  .updateMask(evaluationMask);

print(
  'Reference loss in evaluated area (km2):',
  areaKm2(evaluatedReference)
);

// ==========================================
// 8. THRESHOLD VALIDATION
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
      region: 'Binh Phuoc',

      validation_year: YEAR,
      relative_orbit: ORBIT,
      orbit_pass: 'DESCENDING',

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

print(
  'Threshold validation results:',
  validation
);

// ==========================================
// 9. MAP VISUALIZATION
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
  'SAR detections at -3 dB'
);

// ==========================================
// 10. EXPORT TO GOOGLE DRIVE
// ==========================================

Export.table.toDrive({
  collection: validation,
  description:
    'Vietnam_Binh_Phuoc_Forest_Validation_' + YEAR,
  fileFormat: 'CSV'
});
