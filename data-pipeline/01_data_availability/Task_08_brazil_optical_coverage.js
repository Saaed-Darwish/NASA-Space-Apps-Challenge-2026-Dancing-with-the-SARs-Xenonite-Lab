// Task 08

// NASA Space Apps 2026 — Dancing with the SARs
// Porto Velho: Sentinel-1 / Sentinel-2 coverage audit
// No classifier tuning in this experiment.

var aoi = ee.Geometry.Rectangle([
  -64.10, -8.95, -63.75, -8.65
]);

var cases = [
  {name: 'April', s1Date: '2024-04-26',
   s2Date: '2024-04-22'},
  {name: 'September', s1Date: '2024-09-17',
   s2Date: '2024-09-14'}
];

var jrc = ee.Image(
  'JRC/GSW1_4/GlobalSurfaceWater'
).select('occurrence');

var slope = ee.Terrain.slope(
  ee.Image('USGS/SRTMGL1_003')
);

var s1Collection = ee.ImageCollection(
  'COPERNICUS/S1_GRD'
).filterBounds(aoi)
 .filter(ee.Filter.eq('instrumentMode', 'IW'))
 .filter(ee.Filter.eq(
   'orbitProperties_pass', 'DESCENDING'))
 .filter(ee.Filter.eq(
   'relativeOrbitNumber_start', 156))
 .filter(ee.Filter.listContains(
   'transmitterReceiverPolarisation', 'VV'));

var s2Collection = ee.ImageCollection(
  'COPERNICUS/S2_SR_HARMONIZED'
).filterBounds(aoi);

// Calculate area of a Boolean mask in km².
function areaKm2(mask) {
  var image = ee.Image.pixelArea()
    .updateMask(mask)
    .rename('area');

  return ee.Number(image.reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: aoi,
    scale: 20,
    maxPixels: 1e9,
    tileScale: 4
  }).get('area')).divide(1e6);
}

function prepare(c) {
  var s1Images = s1Collection.filterDate(
    c.s1Date,
    ee.Date(c.s1Date).advance(1, 'day')
  );

  var s1 = ee.Image(
    s1Images.sort('system:time_start').first()
  ).select('VV');

  var s2Images = s2Collection.filterDate(
    c.s2Date,
    ee.Date(c.s2Date).advance(1, 'day')
  );

  // Mosaic all Sentinel-2 tiles on the selected day.
  // Sorting places lower-cloud-metadata scenes last,
  // so they take priority in overlapping areas.
  var s2 = s2Images
    .sort('CLOUDY_PIXEL_PERCENTAGE', false)
    .mosaic();

  var scl = s2.select('SCL');

  var clear = scl.eq(4)
    .or(scl.eq(5))
    .or(scl.eq(6))
    .or(scl.eq(7));

  var s1Valid = s1.mask().gt(0);
  var s2Valid = scl.mask().gt(0);
  var s2Clear = s2Valid.and(clear);

  var shared = s1Valid
    .and(s2Clear)
    .and(jrc.mask())
    .and(slope.mask())
    .and(jrc.lt(90));

  print(c.name + ' S1 image count:',
    s1Images.size());

  print(c.name + ' S2 tile count:',
    s2Images.size());

  print(c.name + ' S2 tile IDs:',
    s2Images.aggregate_array('system:index'));

  return {
    name: c.name,
    s1: s1,
    s2: s2,
    s1Valid: s1Valid,
    s2Valid: s2Valid,
    s2Clear: s2Clear,
    shared: shared
  };
}

var april = prepare(cases[0]);
var september = prepare(cases[1]);

// Same valid pixels across both dates.
var common = april.shared.and(september.shared);

function report(p) {
  return ee.Feature(null, {
    case_name: p.name,
    aoi_area_km2: aoi.area().divide(1e6),
    s1_covered_km2: areaKm2(p.s1Valid),
    s2_covered_km2: areaKm2(p.s2Valid),
    s2_clear_km2: areaKm2(p.s2Clear),
    evaluated_km2: areaKm2(p.shared),
    common_both_dates_km2: areaKm2(common)
  });
}

var results = ee.FeatureCollection([
  report(april),
  report(september)
]);

print('COVERAGE AUDIT RESULTS:', results);

Export.table.toDrive({
  collection: results,
  description: 'Brazil_S1_S2_Coverage_Audit_2024',
  fileFormat: 'CSV'
});

// Visual diagnostic.
Map.centerObject(aoi, 10);

Map.addLayer(
  april.s2.clip(aoi),
  {bands: ['B4', 'B3', 'B2'],
   min: 0, max: 3000},
  'April Sentinel-2 RGB',
  false
);

Map.addLayer(
  september.s2.clip(aoi),
  {bands: ['B4', 'B3', 'B2'],
   min: 0, max: 3000},
  'September Sentinel-2 RGB',
  true
);

Map.addLayer(
  april.shared.selfMask().clip(aoi),
  {palette: ['00CCFF']},
  'April evaluation footprint',
  false
);

Map.addLayer(
  september.shared.selfMask().clip(aoi),
  {palette: ['FF8800']},
  'September evaluation footprint',
  false
);

Map.addLayer(
  common.selfMask().clip(aoi),
  {palette: ['FF00FF']},
  'Common evaluation footprint',
  false
);
