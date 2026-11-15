// Task 22

 // NASA 2026 Hackathon — Venice potential flooding time series
 // Paste into https://code.earthengine.google.com/ and click Run.
 // AOI is an illustrative urban Venice rectangle; refine to the intended study boundary.
 var aoi = ee.Geometry.Rectangle([12.29, 45.41, 12.38, 45.47]);
 var start = '2019-01-01';
 var end = '2026-11-15'; // exclusive end date
 var thresholdDb = -17;

 Map.centerObject(aoi, 12);
 Map.addLayer(aoi, {color: 'yellow'}, 'Venice AOI');

 var s1 = ee.ImageCollection('COPERNICUS/S1_GRD')
   .filterBounds(aoi)
   .filterDate(start, end)
   .filter(ee.Filter.eq('instrumentMode', 'IW'))
   .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
   .filter(ee.Filter.eq('orbitProperties_pass', 'DESCENDING'))
   .select('VV');

 // Inspect available relative orbits and select the most common one.
 print('Available descending relative orbits',
   s1.aggregate_histogram('relativeOrbitNumber_start'));

 var orbitHistogram = ee.Dictionary(
   s1.aggregate_histogram('relativeOrbitNumber_start')
 );
 var orbitNumbers = orbitHistogram.keys();

 var orbitFeatures = ee.FeatureCollection(orbitNumbers.map(function(key) {
   return ee.Feature(null, {
     orbit: ee.Number.parse(ee.String(key)),
     count: ee.Number(orbitHistogram.get(key))
   });
 }));

 var selectedOrbit = ee.Number(
   orbitFeatures.sort('count', false).first().get('orbit')
 );

 print('Selected relative orbit', selectedOrbit);

 s1 = s1.filter(
   ee.Filter.eq('relativeOrbitNumber_start', selectedOrbit)
 );

 // Exclude pixels classified as permanent water by JRC (>=90% occurrence).
 var occurrence = ee.Image('JRC/GSW1_4/GlobalSurfaceWater')
   .select('occurrence')
   .unmask(0);

 var notPermanent = occurrence.lt(90);
 var slope = ee.Terrain.slope(ee.Image('USGS/SRTMGL1_003'));
 var eligible = notPermanent.and(slope.lt(5)).selfMask();

 var area = ee.Image.pixelArea();

 var eligibleAreaSqm = ee.Number(
   area.updateMask(eligible).reduceRegion({
     reducer: ee.Reducer.sum(),
     geometry: aoi,
     scale: 30,
     maxPixels: 1e9,
     tileScale: 4
   }).get('area')
 );

 var series = s1.map(function(img) {
   var valid = img.mask().and(eligible);
   var flooded = img.lt(thresholdDb).and(valid);

   var floodArea = area.updateMask(flooded).reduceRegion({
     reducer: ee.Reducer.sum(),
     geometry: aoi,
     scale: 30,
     maxPixels: 1e9,
     tileScale: 4
   }).get('area');

   var coveredArea = area.updateMask(valid).reduceRegion({
     reducer: ee.Reducer.sum(),
     geometry: aoi,
     scale: 30,
     maxPixels: 1e9,
     tileScale: 4
   }).get('area');

   var covered = ee.Number(
     ee.Algorithms.If(coveredArea, coveredArea, 0)
   );

   var detected = ee.Number(
     ee.Algorithms.If(floodArea, floodArea, 0)
   );

   var coverage = covered.divide(eligibleAreaSqm);

   return ee.Feature(null, {
     date: img.date().format('YYYY-MM-dd'),
     system_time_start: img.get('system:time_start'),
     satellite: img.get('platform_number'),
     relative_orbit: img.get('relativeOrbitNumber_start'),
     pass: img.get('orbitProperties_pass'),
     potential_inundation_km2: detected.divide(1e6),
     valid_area_km2: covered.divide(1e6),
     coverage_fraction: coverage,
     vv_threshold_db: thresholdDb,
     location: 'Venice',
     country: 'Italy'
   });
 }).filter(ee.Filter.gte('coverage_fraction', 0.95));

 print('Images before coverage filtering', s1.size());
 print('Observations after >=95% coverage', series.size());
 print('First 5 records', series.limit(5));

 print(
   ui.Chart.feature.byFeature(
     series.sort('system_time_start'),
     'date',
     'potential_inundation_km2'
   ).setOptions({
     title: 'Venice potential inundation from Sentinel-1 VV',
     hAxis: {title: 'Date'},
     vAxis: {title: 'Potential inundation (km²)'}
   })
 );

 Export.table.toDrive({
   collection: series,
   description: 'Italy_Venice_S1_Potential_Flooding_2019_2026',
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
     'country'
   ]
 });
