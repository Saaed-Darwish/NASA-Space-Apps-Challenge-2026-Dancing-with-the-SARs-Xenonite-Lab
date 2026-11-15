// Task 09

// Brazil — JRC coverage diagnostic
// Compare original vs corrected evaluation footprint.

var aoi = ee.Geometry.Rectangle([
  -64.10, -8.95, -63.75, -8.65
]);

var jrc = ee.Image(
  'JRC/GSW1_4/GlobalSurfaceWater'
).select('occurrence');

var slope = ee.Terrain.slope(
  ee.Image('USGS/SRTMGL1_003')
);

var cases = [
  {name: 'April', s1: '2024-04-26', s2: '2024-04-22'},
  {name: 'September', s1: '2024-09-17', s2: '2024-09-14'}
];

function areaKm2(mask) {
  return ee.Number(
    ee.Image.pixelArea()
      .updateMask(mask)
      .rename('area')
      .reduceRegion({
        reducer: ee.Reducer.sum(),
        geometry: aoi,
        scale: 20,
        maxPixels: 1e9,
        tileScale: 4
      }).get('area')
  ).divide(1e6);
}

function check(c) {
  var s1 = ee.ImageCollection('COPERNICUS/S1_GRD')
    .filterBounds(aoi)
    .filterDate(c.s1, ee.Date(c.s1).advance(1, 'day'))
    .filter(ee.Filter.eq('instrumentMode', 'IW'))
    .filter(ee.Filter.eq(
      'orbitProperties_pass', 'DESCENDING'))
    .filter(ee.Filter.eq(
      'relativeOrbitNumber_start', 156))
    .filter(ee.Filter.listContains(
      'transmitterReceiverPolarisation', 'VV'))
    .sort('system:time_start')
    .first();

  var s2 = ee.ImageCollection(
    'COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(aoi)
    .filterDate(c.s2, ee.Date(c.s2).advance(1, 'day'))
    .sort('CLOUDY_PIXEL_PERCENTAGE', false)
    .mosaic();

  var scl = s2.select('SCL');

  var clear = scl.eq(4)
    .or(scl.eq(5))
    .or(scl.eq(6))
    .or(scl.eq(7));

  var valid = s1.select('VV').mask()
    .and(scl.mask())
    .and(clear)
    .and(s2.select('B3').mask())
    .and(s2.select('B11').mask())
    .and(slope.mask());

  // Original: requires JRC occurrence to be unmasked.
  var original = valid
    .and(jrc.mask())
    .and(jrc.lt(90));

  // Corrected: treat masked historical occurrence
  // as zero occurrence for this diagnostic.
  var occurrence = jrc.unmask(0);

  var corrected = valid
    .and(occurrence.lt(90));

  return ee.Feature(null, {
    period: c.name,
    sensor_valid_km2: areaKm2(valid),
    original_evaluation_km2: areaKm2(original),
    corrected_evaluation_km2: areaKm2(corrected),
    jrc_masked_within_valid_km2:
      areaKm2(valid.and(jrc.mask().not()))
  });
}

var results = ee.FeatureCollection(
  cases.map(check)
);

print('JRC MASK DIAGNOSTIC', results);

Export.table.toDrive({
  collection: results,
  description: 'Brazil_JRC_Mask_Diagnostic_2024',
  fileFormat: 'CSV'
});
