// Task 24

 // NASA 2026 Hackathon
 // Belluno, Veneto, Italy — Sentinel-1 forest disturbance indicators
 //
 // OUTPUT: Historical VH backscatter time series, NOT confirmed
 // forest loss or independently verified disturbance events.

 // 1. STUDY AREA
 // Illustrative forested area in Belluno province.
 // Adjust after checking the map and forest mask.
 var aoi = ee.Geometry.Rectangle([
   12.05, 46.15,
   12.22, 46.27
 ]);

 var startDate = '2019-01-01';
 var endDate = '2026-11-15';

 Map.centerObject(aoi, 11);
 Map.addLayer(aoi, {color: 'yellow'}, 'Belluno study area');

 // 2. FOREST MASK
 // ESA WorldCover 2021: class 10 = tree cover.
 var worldCover = ee.ImageCollection(
   'ESA/WorldCover/v200'
 ).first();

 var forestMask = worldCover.select('Map')
   .eq(10)
   .selfMask();

 Map.addLayer(
   forestMask.clip(aoi),
   {palette: ['228B22']},
   'Tree cover (2021)'
 );

 // 3. SENTINEL-1 SAR DATA
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

 print('Available relative orbits',
   s1.aggregate_histogram('relativeOrbitNumber_start')
 );

 // 4. CHOOSE MOST FREQUENT RELATIVE ORBIT
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
   orbitFeatures.sort('count', false)
     .first().get('orbit')
 );

 print('Selected relative orbit', selectedOrbit);

 s1 = s1.filter(
   ee.Filter.eq(
     'relativeOrbitNumber_start', selectedOrbit
   )
 );

 // 5. TERRAIN MASK
 // Avoid very steep terrain where radar geometry
 // can introduce major distortions.
 var dem = ee.Image('USGS/SRTMGL1_003');
 var slope = ee.Terrain.slope(dem);

 var validTerrain = slope.lt(30);

 var analysisMask = forestMask
   .and(validTerrain)
   .selfMask();

 Map.addLayer(
   analysisMask.clip(aoi),
   {palette: ['00FF00']},
   'Analysis mask'
 );

 // 6. FOREST AREA
 var pixelArea = ee.Image.pixelArea();

 var forestAreaSqm = ee.Number(
   pixelArea.updateMask(analysisMask)
     .reduceRegion({
       reducer: ee.Reducer.sum(),
       geometry: aoi,
       scale: 30,
       maxPixels: 1e9,
       tileScale: 4
     }).get('area')
 );

 print(
   'Analysis forest area (km2)',
   forestAreaSqm.divide(1e6)
 );

 // 7. EXTRACT VH TIME SERIES
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

   var meanVH = stats.get('VH_mean');
   var stdVH = stats.get('VH_stdDev');

   return ee.Feature(null, {
     date: image.date().format('YYYY-MM-dd'),
     system_time_start: image.get('system:time_start'),
     satellite: image.get('platform_number'),
     relative_orbit: image.get('relativeOrbitNumber_start'),
     pass: image.get('orbitProperties_pass'),
     mean_vh_db: meanVH,
     std_vh_db: stdVH,
     valid_forest_area_km2: validSqm.divide(1e6),
     coverage_fraction: validSqm.divide(forestAreaSqm),
     location: 'Belluno',
     region: 'Veneto',
     country: 'Italy',
     indicator_type: 'forest_backscatter'
   });
 });

 // Keep acquisitions with at least 90% coverage.
 series = series.filter(
   ee.Filter.gte('coverage_fraction', 0.50)
 ).filter(
   ee.Filter.notNull(['mean_vh_db'])
 );

 print('Sentinel-1 images', s1.size());
 print('Usable observations', series.size());
 print('First five observations', series.limit(5));

 // 8. TIME SERIES CHART
 print(
   ui.Chart.feature.byFeature(
     series.sort('system_time_start'),
     'date',
     'mean_vh_db'
   ).setOptions({
     title: 'Belluno forest VH backscatter (May–October)',
     hAxis: {title: 'Date'},
     vAxis: {title: 'Mean VH backscatter (dB)'},
     lineWidth: 1,
     pointSize: 2
   })
 );

 // 9. EXPORT CSV
 Export.table.toDrive({
   collection: series,
   description: 'Italy_Belluno_S1_Forest_2019_2026',
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
