// Task 20

/*
NASA Space Apps 2026 — Dancing with the SARs

VIETNAM — BINH PHUOC
FOREST DISTURBANCE VALIDATION — 2024

Optimized version:
- Calculates eligible forest area once
- Uses one combined coverage + detection workflow
- Avoids expensive map rendering
- Uses batch export for validation results

Satellite: Sentinel-1 SAR
Orbit: DESCENDING 18
Reference: Hansen Global Forest Change
Thresholds: -2, -3, -4 dB

Potential forest disturbance is NOT
confirmed deforestation.
*/

// ==========================================
// 1. SETTINGS
// ==========================================

var YEAR = 2024;

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
// 2. HANSEN FOREST REFERENCE
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

var lossCode = YEAR - 2000;

// Exclude tree-cover loss before 2024.
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

// Compute forest area once.
var eligibleForestArea = areaKm2(
  eligibleForest
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
  '2024 Sentinel-1 observations:',
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

  var valid = eligibleForest
    .and(currentVH.mask())
    .and(baselineVH.mask())
    .selfMask();

  var vhChange = currentVH
    .subtract(baselineVH)
    .rename('vh_change')
    .updateMask(valid);

  // Coverage check.
  var monitoredArea = areaKm2(valid);

  var coverage = monitoredArea.divide(
    eligibleForestArea.max(0.000001)
  );

  var qualityOK = baselineCount
    .gte(MIN_BASELINE_IMAGES)
    .and(coverage.gte(MIN_COVERAGE));

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

var processed = current.map(
  processObservation
);

// ==========================================
// 7. ANNUAL DETECTION MASKS
// ==========================================

var summed = processed.sum();

var validCount = summed.select(
  'valid_observation'
);

var evaluationMask = eligibleForest
  .and(
    validCount.gte(MIN_ANNUAL_DETECTIONS)
  )
  .selfMask();

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

    var tp = areaKm2(
      predicted.and(reference)
    );

    var fp = areaKm2(
      predicted.and(reference.not())
    );

    var fn = areaKm2(
      reference.and(predicted.not())
    );

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

      reference_loss_km2:
        areaKm2(referenceLoss.and(evaluationMask)),

      predicted_area_km2:
        areaKm2(predicted),

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

// ==========================================
// 9. EXPORT
// ==========================================

// No expensive annual map layers or
// validation preview prints.

Export.table.toDrive({
  collection: validation,
  description:
    'Vietnam_Binh_Phuoc_Forest_Validation_2024',
  fileFormat: 'CSV'
});

print(
  'Export task created. Open Tasks to start.'
);

For this next one same idea. Started with 2019 and changed for each year.
