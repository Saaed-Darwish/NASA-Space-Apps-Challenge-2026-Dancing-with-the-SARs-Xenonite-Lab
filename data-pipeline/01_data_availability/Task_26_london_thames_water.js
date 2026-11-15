// Task 26

/*******************************************************
 NASA 2026 HACKATHON — DANCING WITH THE SARs

 LONDON, UNITED KINGDOM — FLOODING

 Source: Sentinel-1 SAR, VV polarization
 Period: 2019–2026

 Output: Potential inundation indicator (km2)
 NOT independently verified flooding.
********************************************************/

// 1. STUDY AREA — EAST LONDON
// Thames Barrier / Royal Docks / surrounding urban land

var aoi = ee.Geometry.Rectangle([
  0.00, 51.48,
  0.12, 51.54
]);

var startDate = '2019-01-01';
var endDate = '2026-11-15';

// Exploratory backscatter threshold
var thresholdDb = -17;

Map.centerObject(aoi, 12);
Map.addLayer(aoi, {color: 'yellow'}, 'London AOI');


// 2. SENTINEL-1 COLLECTION

var s1 = ee.ImageCollection('COPERNICUS/S1_GRD')
  .filterBounds(aoi)
  .filterDate(startDate, endDate)
  .filter(ee.Filter.eq('instrumentMode', 'IW'))
  .filter(ee.Filter.listContains(
    'transmitterReceiverPolarisation', 'VV'
  ))
  .filter(ee.Filter.eq(
    'orbitProperties_pass', 'DESCENDING'
  ))
  .select('VV');

print('1. Available Sentinel-1 images:', s1.size());

print(
  '2. Relative orbit counts:',
  s1.aggregate_histogram('relativeOrbitNumber_start')
);


// 3. SELECT MOST FREQUENT RELATIVE ORBIT

var histogram = ee.Dictionary(
  s1.aggregate_histogram('relativeOrbitNumber_start')
);

var orbitFeatures = ee.FeatureCollection(
  histogram.keys().map(function(key) {
    return ee.Feature(null, {
      orbit: ee.Number.parse(ee.String(key)),
      count: ee.Number(histogram.get(key))
    });
  })
);

var selectedOrbit = ee.Number(
  orbitFeatures
    .sort('count', false)
    .first()
    .get('orbit')
);

print('3. Selected relative orbit:', selectedOrbit);

s1 = s1.filter(
  ee.Filter.eq(
    'relativeOrbitNumber_start',
    selectedOrbit
  )
);

print('4. Images after orbit selection:', s1.size());


// 4. PERMANENT WATER MASK
// JRC historical water occurrence >=90% excluded

var waterOccurrence = ee.Image(
  'JRC/GSW1_4/GlobalSurfaceWater'
).select('occurrence').unmask(0);

var notPermanentWater = waterOccurrence.lt(90);


// 5. TERRAIN MASK

var dem = ee.Image('USGS/SRTMGL1_003');
var slope = ee.Terrain.slope(dem);

var eligibleMask = notPermanentWater
  .and(slope.lt(5))
  .selfMask();

Map.addLayer(
  eligibleMask.clip(aoi),
  {palette: ['00FF00']},
  'Eligible analysis area'
);


// 6. ANALYSIS AREA

var pixelArea = ee.Image.pixelArea();

var eligibleAreaSqm = ee.Number(
  pixelArea
    .updateMask(eligibleMask)
    .reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: aoi,
      scale: 30,
      maxPixels: 1e9,
      tileScale: 4
    })
    .get('area')
);

print(
  '5. Eligible analysis area (km2):',
  eligibleAreaSqm.divide(1e6)
);


// 7. EXTRACT POTENTIAL INUNDATION TIME SERIES

var series = s1.map(function(image) {

  var vv = image.updateMask(eligibleMask);

  var validMask = vv.mask();

  var detectedWater = vv.lt(thresholdDb);

  var detectedArea = pixelArea
    .updateMask(detectedWater)
    .reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: aoi,
      scale: 30,
      maxPixels: 1e9,
      tileScale: 4
    });

  var validArea = pixelArea
    .updateMask(validMask)
    .reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: aoi,
      scale: 30,
      maxPixels: 1e9,
      tileScale: 4
    });

  var detectedSqm = ee.Number(
    ee.Algorithms.If(
      detectedArea.get('area'),
      detectedArea.get('area'),
      0
    )
  );

  var validSqm = ee.Number(
    ee.Algorithms.If(
      validArea.get('area'),
      validArea.get('area'),
      0
    )
  );

  return ee.Feature(null, {

    date: image.date().format('YYYY-MM-dd'),

    system_time_start:
      image.get('system:time_start'),

    satellite: image.get('platform_number'),

    relative_orbit:
      image.get('relativeOrbitNumber_start'),

    pass: image.get('orbitProperties_pass'),

    potential_inundation_km2:
      detectedSqm.divide(1e6),

    valid_area_km2:
      validSqm.divide(1e6),

    coverage_fraction:
      validSqm.divide(eligibleAreaSqm),

    vv_threshold_db: thresholdDb,

    location: 'East London',
    country: 'United Kingdom',

    indicator_type: 'potential_inundation'
  });

});


// 8. REMOVE ZERO-COVERAGE OBSERVATIONS
// Keep partial coverage for quality assessment

series = series.filter(
  ee.Filter.gt('coverage_fraction', 0)
);

print(
  '6. USABLE OBSERVATIONS:',
  series.size()
);

print(
  '7. First five records:',
  series.limit(5)
);


// 9. TIME SERIES CHART

print(
  ui.Chart.feature.byFeature(
    series.sort('system_time_start'),
    'date',
    'potential_inundation_km2'
  ).setOptions({
    title: 'East London Potential Inundation (2019–2026)',
    hAxis: {title: 'Date'},
    vAxis: {title: 'Potential Inundation (km2)'},
    lineWidth: 1,
    pointSize: 2
  })
);


// 10. EXPORT CSV

Export.table.toDrive({

  collection: series,

  description:
    'London_S1_Potential_Flooding_2019_2026',

  fileFormat: 'CSV',

  selectors: [
    'date',
    'system_time_start',
    'satellite',
    'relative_orbit',
    'pass',
    'potential_inundation_km2',
    'valid_area_km2',
    'coverage_fraction',
    'vv_threshold_db',
    'location',
    'country',
    'indicator_type'
  ]

});
