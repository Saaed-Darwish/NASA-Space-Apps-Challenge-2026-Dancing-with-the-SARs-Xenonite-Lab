// Task 03

// NASA Space Apps 2026 — Dancing with the SARs
// Brazil + Vietnam: candidate inundation time series
// These are exploratory estimates, NOT validated floods.

var START = '2019-01-01';
var END = '2026-11-15'; // End date is exclusive
var THRESHOLD_DB = -17;
var MIN_COVERAGE = 0.95;

// Historical permanent-water reference (JRC).
var jrc = ee.Image('JRC/GSW1_4/GlobalSurfaceWater');

// >=90% occurrence indicates historically persistent water.
var permanentWater = jrc.select('occurrence')
  .gte(90)
  .unmask(0);

// Exclude slopes >=5 degrees.
var slope = ee.Terrain.slope(
  ee.Image('USGS/SRTMGL1_003')
);
var lowSlope = slope.lt(5);

// Process one region and one relative orbit.
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

  print(regionId + ' scenes:', images.size());

  var observations = images.map(function(img) {

    var vv = img.select('VV');
    var smoothed = vv.focal_median(
      30, 'circle', 'meters'
    );

    // Coverage within study area.
    var valid = vv.mask().gt(0);

    var coverageImage = valid.unmask(0)
      .multiply(ee.Image.pixelArea())
      .rename('covered_m2');

    var coverageStats = coverageImage.reduceRegion({
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

    // Candidate inundation:
    // radar-dark, not persistent water, low slope.
    var candidate = smoothed.lt(THRESHOLD_DB)
      .and(permanentWater.not())
      .and(lowSlope)
      .updateMask(valid);

    var areaImage = candidate
      .multiply(ee.Image.pixelArea())
      .rename('candidate_m2');

    var areaStats = areaImage.reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: aoi,
      scale: 30,
      maxPixels: 1e9,
      tileScale: 4
    });

    var areaM2 = ee.Number(
      ee.Algorithms.If(
        areaStats.get('candidate_m2'),
        areaStats.get('candidate_m2'),
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
      permanent_water_threshold: 90,
      max_slope_degrees: 5,
      method: 'VV_dark_nonpermanent_low_slope',
      validation_status: 'unvalidated',
      source: 'COPERNICUS/S1_GRD'
    });
  });

  var filtered = observations.filter(
    ee.Filter.gte('coverage_fraction', MIN_COVERAGE)
  );

  print(regionId + ' observations with >=95% coverage:',
    filtered.size());

  print(regionId + ' sample:', filtered.limit(5));

  return filtered;
}

// BRAZIL — Porto Velho, Madeira River
// Relative Orbit 156, descending
var brazilAOI = ee.Geometry.Rectangle([
  -64.10, -8.95,
  -63.75, -8.65
]);

// VIETNAM — Can Tho, Mekong Delta
// Relative Orbit 18, descending
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

// Export Brazil.
Export.table.toDrive({
  collection: brazil,
  description: 'Brazil_Candidate_Inundation_2019_2026',
  fileFormat: 'CSV'
});

// Export Vietnam.
Export.table.toDrive({
  collection: vietnam,
  description: 'Vietnam_Candidate_Inundation_2019_2026',
  fileFormat: 'CSV'
});

// Visualize study areas.
Map.centerObject(vietnamAOI, 10);
Map.addLayer(
  brazilAOI,
  {color: 'yellow'},
  'Brazil study area'
);
Map.addLayer(
  vietnamAOI,
  {color: 'cyan'},
  'Vietnam study area'
);
