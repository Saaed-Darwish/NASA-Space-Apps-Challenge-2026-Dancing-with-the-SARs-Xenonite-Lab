// Task 10

// NASA Space Apps — Brazil corrected spatial comparison
// Provisional Sentinel-1 / Sentinel-2 water agreement

var aoi = ee.Geometry.Rectangle([
  -64.10, -8.95, -63.75, -8.65
]);

var cases = [
  {name: 'April', s1: '2024-04-26', s2: '2024-04-22'},
  {name: 'September', s1: '2024-09-17', s2: '2024-09-14'}
];

var jrcImage = ee.Image('JRC/GSW1_4/GlobalSurfaceWater');
var occurrence = jrcImage.select('occurrence').unmask(0);
var slope = ee.Terrain.slope(
  ee.Image('USGS/SRTMGL1_003')
);

var pixelArea = ee.Image.pixelArea();

function areaKm2(booleanImage) {
  var area = pixelArea.multiply(
    booleanImage.unmask(0)
  ).rename('area');

  return ee.Number(area.reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: aoi,
    scale: 20,
    maxPixels: 1e9,
    tileScale: 4
  }).get('area')).divide(1e6);
}

function evaluate(c) {
  var s1 = ee.Image(
    ee.ImageCollection('COPERNICUS/S1_GRD')
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
      .first()
  ).select('VV');

  var s2 = ee.ImageCollection(
    'COPERNICUS/S2_SR_HARMONIZED'
  ).filterBounds(aoi)
   .filterDate(c.s2, ee.Date(c.s2).advance(1, 'day'))
   .sort('CLOUDY_PIXEL_PERCENTAGE', false)
   .mosaic();

  var scl = s2.select('SCL');
  var clear = scl.eq(4).or(scl.eq(5))
    .or(scl.eq(6)).or(scl.eq(7));

  var green = s2.select('B3').multiply(0.0001);
  var swir = s2.select('B11').multiply(0.0001);
  var mndwi = green.subtract(swir)
    .divide(green.add(swir));

  var valid = s1.mask()
    .and(clear)
    .and(scl.mask())
    .and(mndwi.mask())
    .and(slope.mask())
    .and(occurrence.lt(90));

  var reference = mndwi.gt(0.1);

  var radarDark = s1.focal_median(
    30, 'circle', 'meters'
  ).lt(-17);

  var flat = slope.lt(5);

  function score(limit) {
    var prediction = radarDark
      .and(occurrence.lt(limit))
      .and(flat);

    var tp = valid.and(prediction).and(reference);
    var fp = valid.and(prediction).and(reference.not());
    var fn = valid.and(prediction.not()).and(reference);

    var TP = areaKm2(tp);
    var FP = areaKm2(fp);
    var FN = areaKm2(fn);

    return ee.Feature(null, {
      period: c.name,
      s1_date: c.s1,
      s2_date: c.s2,
      method: 'JRC' + limit,
      evaluated_km2: areaKm2(valid),
      reference_water_km2:
        areaKm2(valid.and(reference)),
      TP_km2: TP,
      FP_km2: FP,
      FN_km2: FN,
      precision: TP.divide(TP.add(FP).max(1e-9)),
      recall: TP.divide(TP.add(FN).max(1e-9)),
      IoU: TP.divide(
        TP.add(FP).add(FN).max(1e-9)
      ),
      validation_status: 'provisional_optical_agreement'
    });
  }

  return ee.FeatureCollection([
    score(90),
    score(50)
  ]);
}

var results = evaluate(cases[0])
  .merge(evaluate(cases[1]));

print('CORRECTED SPATIAL COMPARISON', results);

Export.table.toDrive({
  collection: results,
  description: 'Brazil_Corrected_Spatial_Agreement_2024',
  fileFormat: 'CSV'
});
