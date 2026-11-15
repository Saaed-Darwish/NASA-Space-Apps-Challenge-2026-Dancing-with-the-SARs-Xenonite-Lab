// Task 07

// NASA Space Apps 2026 — Dancing with the SARs
// Porto Velho: Sentinel-1 vs Sentinel-2
// Provisional spatial agreement assessment

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

function assess(c) {
  var s1 = ee.Image(
    s1Collection.filterDate(
      c.s1Date,
      ee.Date(c.s1Date).advance(1, 'day')
    ).sort('system:time_start').first()
  ).select('VV');

  var s2 = ee.Image(
    s2Collection.filterDate(
      c.s2Date,
      ee.Date(c.s2Date).advance(1, 'day')
    ).sort('CLOUDY_PIXEL_PERCENTAGE').first()
  );

  // Sentinel-2 optical water indicator.
  var green = s2.select('B3').multiply(0.0001);
  var swir = s2.select('B11').multiply(0.0001);

  var mndwi = green.subtract(swir)
    .divide(green.add(swir))
    .rename('MNDWI');

  // SCL 4 vegetation, 5 bare soil,
  // 6 water, 7 unclassified.
  var scl = s2.select('SCL');

  var clear = scl.eq(4)
    .or(scl.eq(5))
    .or(scl.eq(6))
    .or(scl.eq(7));

  // Preliminary optical classification.
  var opticalWater = mndwi.gt(0.1);

  // Radar classification.
  var smoothed = s1.focal_median(
    30, 'circle', 'meters'
  );

  var radarDark = smoothed.lt(-17);
  var flat = slope.lt(5);

  var jrc90 = radarDark
    .and(jrc.lt(90).unmask(0))
    .and(flat);

  var jrc50 = radarDark
    .and(jrc.lt(50).unmask(0))
    .and(flat);

  // Shared evaluation footprint:
  // valid SAR + clear optical + observed JRC.
  var shared = s1.mask()
    .and(clear)
    .and(mndwi.mask())
    .and(jrc.mask())
    .and(slope.mask());

  // Restrict evaluation to historical
  // non-permanent water, for both methods.
  shared = shared.and(jrc.lt(90));

  var reference = opticalWater
    .updateMask(shared)
    .rename('reference');

  function metrics(prediction, label) {
    var pred = prediction
      .updateMask(shared);

    var tp = pred.and(reference);
    var fp = pred.and(reference.not());
    var fn = pred.not().and(reference);

    function count(mask) {
      var area = mask
        .unmask(0)
        .multiply(ee.Image.pixelArea())
        .rename('area');

      return ee.Number(
        area.reduceRegion({
          reducer: ee.Reducer.sum(),
          geometry: aoi,
          scale: 20,
          maxPixels: 1e9,
          tileScale: 4
        }).get('area')
      );
    }

    var TP = count(tp);
    var FP = count(fp);
    var FN = count(fn);

    var precision = TP.divide(
      TP.add(FP).max(1)
    );

    var recall = TP.divide(
      TP.add(FN).max(1)
    );

    var iou = TP.divide(
      TP.add(FP).add(FN).max(1)
    );

    return ee.Feature(null, {
      case_name: c.name,
      method: label,
      s1_date: c.s1Date,
      s2_date: c.s2Date,
      TP_km2: TP.divide(1e6),
      FP_km2: FP.divide(1e6),
      FN_km2: FN.divide(1e6),
      precision: precision,
      recall: recall,
      IoU: iou,
      reference_type: 'Sentinel2_MNDWI_0.1',
      validation_status: 'provisional'
    });
  }

  var result90 = metrics(jrc90, 'JRC90');
  var result50 = metrics(jrc50, 'JRC50');

  print(c.name + ' — comparison',
    ee.FeatureCollection([result90, result50]));

  // Visualize reference and predictions.
  Map.addLayer(
    s2.clip(aoi),
    {bands: ['B4','B3','B2'],
     min: 0, max: 3000},
    c.name + ' Sentinel-2 RGB',
    false
  );

  Map.addLayer(
    reference.selfMask().clip(aoi),
    {palette: ['00CCFF']},
    c.name + ' Optical water',
    false
  );

  Map.addLayer(
    jrc90.updateMask(shared)
      .selfMask().clip(aoi),
    {palette: ['FF8800']},
    c.name + ' JRC90',
    false
  );

  Map.addLayer(
    jrc50.updateMask(shared)
      .selfMask().clip(aoi),
    {palette: ['FF00FF']},
    c.name + ' JRC50',
    false
  );

  return ee.FeatureCollection([
    result90, result50
  ]);
}

var april = assess(cases[0]);
var september = assess(cases[1]);

var allResults = april.merge(september);

Export.table.toDrive({
  collection: allResults,
  description: 'Brazil_S1_S2_Spatial_Agreement_2024',
  fileFormat: 'CSV'
});

Map.centerObject(aoi, 10);
