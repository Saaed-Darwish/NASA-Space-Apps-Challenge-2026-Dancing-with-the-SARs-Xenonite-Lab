import type { RegionStory } from "./stories";

export const norilskResultStories: RegionStory[] = [
  {
    id: "norilsk-permafrost-thaw",
    regionId: "norilsk",
    title: "Thawing ground: Norilsk's wetlands sink every summer",
    category: "water",
    firstYear: 2020,
    mapEndYear: 2026,
    dateLabel: "Radar summers 2017–2025 · NISAR 2026",
    latitude: 69.38,
    longitude: 87.8,
    cameraAltitude: 60000,
    beforeYear: 2020,
    afterYear: 2025,
    summary:
      "The supplied team analysis of Sentinel-1 radar reports Norilsk's herbaceous wetlands sinking a few millimetres more than the ground around them every summer, in step with accumulated thaw (Stefan's law: -0.195 ± 0.009 mm per √(°C·day), the same in all six summers 2017–2025). The same places sink every summer, NISAR's L-band radar saw it independently in 2026, and there is no sign of acceleration.",
    lookFor:
      "Wetlands and low tundra around Norilsk are where the ground sinks each summer; industrial and built-up ground does not sink more than other lowland ground.",
    limitation:
      "Motion is relative to ~2 km surroundings: whether the whole lowland sinks relative to bedrock is not measurable (atmosphere). No Sentinel-1 data over Norilsk in 2022–2024. Water-level changes in wetlands may contribute to the radar signal.",
    sources: [
      {
        title: "Sentinel-1 interferograms on demand (HyP3)",
        publisher: "Alaska Satellite Facility",
        url: "https://hyp3-docs.asf.alaska.edu/",
      },
      {
        title: "NISAR mission",
        publisher: "NASA Jet Propulsion Laboratory",
        url: "https://nisar.jpl.nasa.gov/",
      },
    ],
  },
  {
    id: "norilsk-tank5-ground",
    regionId: "norilsk",
    title: "Did sinking ground bring down tank 5?",
    category: "water",
    firstYear: 2020,
    mapEndYear: 2021,
    dateLabel: "Radar 2017–2020 · collapse May 29, 2020",
    latitude: 69.3272,
    longitude: 87.9339,
    cameraAltitude: 6000,
    beforeYear: 2020,
    afterYear: 2021,
    summary:
      "The supplied team analysis reports that tank 5 did not sink relative to the structures around it in the snow-free summers 2017–2019, when thawing ground settles and the bedrock under Norilsk (GNSS NRIL) rose slightly (+3.0 mm/yr). In its last winter, with the ground frozen, the tank alone settled about 14 mm (comparable targets +0.9 ± 5.6 mm); none of 20 other tanks did. This is consistent with the reported foundation investigation; radar alone cannot identify the cause.",
    lookFor:
      "The marker is tank 5 in the fuel-tank row north-west of TPP-3. Compare the 2020 and 2021 mosaics; inspect the dated Sentinel-2 images and segmented tank measurements in Analyze.",
    limitation:
      "Evidence of movement, not proof of its cause: snow drifts can mimic settlement in radar, one satellite track only, and 20 m pixels cannot measure tilt within the 45 m tank. Uniform settlement of a whole area would be invisible to this relative measure.",
    sources: [
      {
        title:
          "Permafrost early deformation signals before the Norilsk oil tank collapse",
        publisher: "Remote Sensing (Zhang et al.)",
        publishedYear: 2022,
        url: "https://www.mdpi.com/2072-4292/14/19/5036",
      },
      {
        title:
          "Weak tank piles named as the cause of the Norilsk TPP accident (Rostekhnadzor)",
        publisher: "Interfax",
        publishedYear: 2020,
        url: "https://www.interfax.ru/russia/737323",
      },
      {
        title: "GNSS station NRIL time series",
        publisher: "Nevada Geodetic Laboratory",
        url: "https://geodesy.unr.edu/NGLStationPages/stations/NRIL.sta",
      },
    ],
  },
];
