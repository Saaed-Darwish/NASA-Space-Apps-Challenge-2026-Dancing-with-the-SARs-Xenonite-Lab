// Task 27

/*******************************************************
 NASA 2026 HACKATHON — DANCING WITH THE SARs

 LONDON — EPPING FOREST
 FOREST BACKSCATTER TIME SERIES

 Sentinel-1 SAR | VH polarization
 Historical period: 2019–2026

 This measures forest radar backscatter, NOT
 independently verified forest disturbance.
********************************************************/

// 1. STUDY AREA — EPPING FOREST
// Approximate southern/central forest study area.
// Review the forest mask on the map.

var aoi = ee.Geometry.Rectangle([
  0.00, 51.60,
  0.08, 51.69
]);

var startDate = '2019-01-01';
var endDate = '2026-11-15';

Map.centerObject(aoi, 12);
Map.addLayer(aoi, {color: 'yellow'}, 'Epping Forest AOI');


// 2. ESA WORLDCOVER TREE MASK
// Class 10 = tree cover, reference year 2021.

var worldCover = ee.ImageCollection(
  'ESA/WorldCover/v200'
).first();

var forestMask = worldCover
  .select('Map')
  .eq(10);

Map.addLayer(
  forestMask.selfMask().clip(aoi),
  {palette: ['228B22']},
  'Tree cover (2021)'
);


// 3. TERRAIN MASK
// Epping Forest is relatively low-relief.
// Retain slopes below 30 degrees.

var dem = ee.Image('USGS/SRTMGL1_003');
var slope = ee.Terrain.slope(dem);

var analysisMask = forestMask
  .and(slope.lt(30))
  .selfMask();

Map.addLayer(
  analysisMask.clip(aoi),
  {palette: ['00FF00']},
  'Forest analysis mask'
);


// 4. SENTINEL-1 VH COLLECTION
// Use May–October for consistency with Belluno.

var s1 = ee.ImageCollection('COPERNICUS/S1_GRD')
  .filterBounds(aoi)
  .filterDate(startDate, endDate)
  .filter(ee.Filter.eq('instrumentMode', 'IW'))
  .filter(ee.Filter.listContains(
    'transmitterReceiverPolarisation', 'VH'
  ))
  .filter(ee.Filter.eq(
    'orbitProperties_pass', 'DESCENDING'
  ))
  .filter(ee.Filter.calendarRange(
    5, 10, 'month'
  ))
  .select('VH');

print('1. Available Sentinel-1 images:', s1.size());

print(
  '2. Relative orbit counts:',
  s1.aggregate_histogram('relativeOrbitNumber_start')
);


// 5. SELECT MOST FREQUENT RELATIVE ORBIT

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


// 6. FOREST ANALYSIS AREA

var pixelArea = ee.Image.pixelArea();

var forestAreaSqm = ee.Number(
  pixelArea
    .updateMask(analysisMask)
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
  '5. Forest analysis area (km2):',
  forestAreaSqm.divide(1e6)
);


// 7. EXTRACT VH BACKSCATTER TIME SERIES

var series = s1.map(function(image) {

  var vh = image.updateMask(analysisMask);

  var stats = vh.reduceRegion({
    reducer: ee.Reducer.mean()
      .combine({
        reducer2: ee.Reducer.stdDev(),
        sharedInputs: true
      }),
    geometry: aoi,
    scale: 30,
    maxPixels: 1e9,
    tileScale: 4
  });

  var validArea = pixelArea
    .updateMask(vh.mask())
    .reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: aoi,
      scale: 30,
      maxPixels: 1e9,
      tileScale: 4
    });

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

    mean_vh_db: stats.get('VH_mean'),

    std_vh_db: stats.get('VH_stdDev'),

    valid_forest_area_km2:
      validSqm.divide(1e6),

    coverage_fraction:
      validSqm.divide(forestAreaSqm),

    location: 'Epping Forest',
    region: 'Greater London / Essex',
    country: 'United Kingdom',

    indicator_type: 'forest_backscatter'
  });

});


// 8. REMOVE MISSING MEASUREMENTS
// Retain partial-coverage observations for QC.

series = series.filter(
  ee.Filter.notNull(['mean_vh_db'])
);

print(
  '6. USABLE OBSERVATIONS:',
  series.size()
);

print(
  '7. First five records:',
  series.limit(5)
);


// 9. VISUALIZE HISTORICAL BACKSCATTER

print(
  ui.Chart.feature.byFeature(
    series.sort('system_time_start'),
    'date',
    'mean_vh_db'
  ).setOptions({
    title: 'Epping Forest VH Backscatter (2019–2026)',
    hAxis: {title: 'Date'},
    vAxis: {title: 'Mean VH Backscatter (dB)'},
    lineWidth: 1,
    pointSize: 2
  })
);


// 10. EXPORT CSV

Export.table.toDrive({

  collection: series,

  description:
    'London_Epping_Forest_S1_2019_2026',

  fileFormat: 'CSV',

  selectors: [
    'date',
    'system_time_start',
    'satellite',
    'relative_orbit',
    'pass',
    'mean_vh_db',
    'std_vh_db',
    'valid_forest_area_km2',
    'coverage_fraction',
    'location',
    'region',
    'country',
    'indicator_type'
  ]

});
