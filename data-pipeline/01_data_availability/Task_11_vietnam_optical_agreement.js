// Task 11

// NASA Space Apps 2026 — Dancing with the SARs
// Vietnam: Sentinel-1 / Sentinel-2 spatial agreement
// Provisional optical validation

var aoi = ee.Geometry.Rectangle([
  105.65, 9.95, 105.90, 10.15
]);

var cases = [
  {name: 'Dry season',
   s1: '2024-02-16', s2: '2024-02-14'},
  {name: 'Wet season',
   s1: '2024-10-25', s2: '2024-10-21'}
];

var occurrence = ee.Image(
  'JRC/GSW1_4/GlobalSurfaceWater'
).select('occurrence').unmask(0);

var slope = ee.Terrain.slope(
  ee.Image('USGS/SRTMGL1_003')
);

function areaKm2(mask) {
  var image = ee.Image.pixelArea()
    .multiply(mask.unmask(0))
    .rename('area');

  return ee.Number(image.reduceRegion({
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
        'relativeOrbitNumber_start', 18))
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

  var clear = scl.eq(4)
    .or(scl.eq(5))
    .or(scl.eq(6))
    .or(scl.eq(7));

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

    var TP = areaKm2(
      valid.and(prediction).and(reference)
    );

    var FP = areaKm2(
      valid.and(prediction).and(reference.not())
    );

    var FN = areaKm2(
      valid.and(prediction.not()).and(reference)
    );

    return ee.Feature(null, {
      season: c.name,
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
      validation_status:
        'provisional_optical_agreement'
    });
  }

  return ee.FeatureCollection([
    score(90),
    score(50)
  ]);
}

var results = evaluate(cases[0])
  .merge(evaluate(cases[1]));

print('VIETNAM SPATIAL AGREEMENT', results);

Export.table.toDrive({
  collection: results,
  description: 'Vietnam_S1_S2_Spatial_Agreement_2024',
  fileFormat: 'CSV'
});

Map.centerObject(aoi, 11);
