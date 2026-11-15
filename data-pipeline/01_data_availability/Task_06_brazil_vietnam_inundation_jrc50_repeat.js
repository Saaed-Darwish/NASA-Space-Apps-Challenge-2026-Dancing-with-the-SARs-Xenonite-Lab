// Task 06

// NASA Space Apps 2026 — Dancing with the SARs
// Brazil + Vietnam: revised candidate inundation
// Exploratory detection — NOT validated flood extent

var START = '2019-01-01';
var END = '2026-11-15';

var THRESHOLD_DB = -17;
var MIN_COVERAGE = 0.95;

// Exclude areas with historical water occurrence >= 50%.
// Previous version excluded only >= 90%.
var WATER_OCCURRENCE_LIMIT = 50;

var jrc = ee.Image('JRC/GSW1_4/GlobalSurfaceWater');
var occurrence = jrc.select('occurrence');

// Preserve historically observed non-water pixels.
// Do not treat missing JRC data as confirmed dry land.
var historicalNonWater = occurrence.lt(
  WATER_OCCURRENCE_LIMIT
).unmask(0);

var slope = ee.Terrain.slope(
  ee.Image('USGS/SRTMGL1_003')
);

var lowSlope = slope.lt(5);

function processRegion(regionId, aoi, orbit) {

  var images = ee.ImageCollection('COPERNICUS/S1_GRD')
    .filterBounds(aoi)
    .filterDate(START, END)
    .filter(ee.Filter.eq('instrumentMode', 'IW'))
    .filter(ee.Filter.eq(
      'orbitProperties_pass', 'DESCENDING'
    ))
    .filter(ee.Filter.eq(
      'relativeOrbitNumber_start', orbit
    ))
    .filter(ee.Filter.listContains(
      'transmitterReceiverPolarisation', 'VV'
    ))
    .select('VV');

  print(regionId + ' matching scenes:', images.size());

  var observations = images.map(function(img) {

    var vv = img.select('VV');

    var smoothed = vv.focal_median(
      30, 'circle', 'meters'
    );

    var valid = vv.mask().gt(0);

    var coveredArea = valid.unmask(0)
      .multiply(ee.Image.pixelArea())
      .rename('covered_m2');

    var coverageStats = coveredArea.reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: aoi,
      scale: 30,
      maxPixels: 1e9,
      tileScale: 4
    });

    var coveredM2 = ee.Number(
      coverageStats.get('covered_m2')
    );

    var coverageFraction = coveredM2.divide(aoi.area());

    // Revised candidate inundation mask.
    var candidate = smoothed.lt(THRESHOLD_DB)
      .and(historicalNonWater)
      .and(lowSlope)
      .updateMask(valid);

    var areaImage = candidate
      .multiply(ee.Image.pixelArea())
      .rename('candidate_m2');

    var stats = areaImage.reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: aoi,
      scale: 30,
      maxPixels: 1e9,
      tileScale: 4
    });

    var areaM2 = ee.Number(
      ee.Algorithms.If(
        stats.get('candidate_m2'),
        stats.get('candidate_m2'),
        0
      )
    );

    return ee.Feature(null, {
      region_id: regionId,
      date: img.date().format('YYYY-MM-dd'),
      satellite: img.get('platform_number'),
      relative_orbit: orbit,
      orbit_direction: 'DESCENDING',
      coverage_fraction: coverageFraction,
      candidate_inundation_area_km2:
        areaM2.divide(1e6),
      threshold_db: THRESHOLD_DB,
      historical_water_occurrence_limit:
        WATER_OCCURRENCE_LIMIT,
      max_slope_degrees: 5,
      method: 'VV_dark_JRC50_low_slope',
      validation_status: 'unvalidated',
      source: 'COPERNICUS/S1_GRD'
    });
  });

  var filtered = observations.filter(
    ee.Filter.gte('coverage_fraction', MIN_COVERAGE)
  );

  print(regionId + ' usable observations:',
    filtered.size());

  return filtered;
}

// Brazil: Porto Velho
var brazilAOI = ee.Geometry.Rectangle([
  -64.10, -8.95,
  -63.75, -8.65
]);

// Vietnam: Can Tho
var vietnamAOI = ee.Geometry.Rectangle([
  105.65, 9.95,
  105.90, 10.15
]);

var brazil = processRegion(
  'BRA_PORTO_VELHO', brazilAOI, 156
);

var vietnam = processRegion(
  'VNM_CAN_THO', vietnamAOI, 18
);

// Quick diagnostic: same two Brazil dates.
print('Brazil April 26, 2024:',
  brazil.filter(ee.Filter.eq(
    'date', '2024-04-26'
  )).first()
);

print('Brazil September 17, 2024:',
  brazil.filter(ee.Filter.eq(
    'date', '2024-09-17'
  )).first()
);

// Export Brazil.
Export.table.toDrive({
  collection: brazil,
  description: 'Brazil_Inundation_JRC50_2019_2026',
  fileFormat: 'CSV'
});

// Export Vietnam.
Export.table.toDrive({
  collection: vietnam,
  description: 'Vietnam_Inundation_JRC50_2019_2026',
  fileFormat: 'CSV'
});

Map.centerObject(brazilAOI, 10);
Map.addLayer(brazilAOI, {color: 'yellow'}, 'Brazil AOI');
