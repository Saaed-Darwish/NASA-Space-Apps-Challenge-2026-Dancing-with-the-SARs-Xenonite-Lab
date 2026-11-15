import type { Region } from "../types/region";
export type Indicator = "water";
export type OverlaySettings = Record<
  Indicator,
  { enabled: boolean; opacity: number }
>;

export interface IndicatorDefinition {
  name: string;
  short: string;
  color: string;
  low: string;
  high: string;
  unit: string;
  description: string;
  values: number[];
  colors: string[];
}

export interface RegionalReading {
  value: string;
  unit: string;
  context: string;
  /** SVG y coordinates for the illustrative trend, not measured values. */
  trend: number[];
}

// All observations are synthetic. Region coordinates identify real places.
export const indicators: Record<Indicator, IndicatorDefinition> = {
  water: {
    name: "Water extent change",
    short: "Water",
    color: "#55d9ed",
    low: "Water loss",
    high: "Water gain",
    unit: "%",
    description: "Change in surface water extent",
    values: [-30, -15, 0, 15, 30],
    colors: ["#164e63", "#0891b2", "#a5f3fc", "#38bdf8", "#0369a1"],
  },
};
export const regions: Region[] = [
  {
    id: "porto-velho",
    name: "Madeira River",
    country: "Brazil",
    latitude: -8.8,
    longitude: -63.925,
    altitude: 85000,
    description:
      "Explore the Madeira River study area with dated candidate-inundation and forest-disturbance observations. Outlines locate the analysis area, not affected pixels. Measurements are exploratory and quality flags remain visible.",
    zoom_level: "regional",
    waterMonitoring: true,
    datasetIds: ["BRA_PORTO_VELHO", "BRA_PORTO_VELHO_FOREST"],
  },
  {
    id: "can-tho",
    name: "Can Tho",
    country: "Vietnam",
    latitude: 10.0452,
    longitude: 105.7469,
    altitude: 65000,
    description:
      "Explore Can Tho along the Hậu River. Dated candidate-inundation observations and the analysis outline are available; annual satellite mosaics provide landscape context.",
    zoom_level: "city",
    waterMonitoring: true,
    datasetIds: ["VNM_CAN_THO"],
  },
  {
    id: "binh-phuoc",
    name: "Binh Phuoc forest",
    country: "Vietnam",
    latitude: 11.75,
    longitude: 106.85,
    altitude: 85000,
    description:
      "Inspect potential forest disturbance across the Binh Phuoc study rectangle. Quality-passing observations are shown by default; these are radar indicators, not confirmed deforestation.",
    zoom_level: "regional",
    datasetIds: ["VNM_BINH_PHUOC_FOREST"],
  },
  {
    id: "venice",
    name: "Venice",
    country: "Italy",
    latitude: 45.44,
    longitude: 12.33,
    altitude: 26000,
    description:
      "Explore vertical displacement histories for eight selected EGMS points. The city marker is a locator; precise point positions await confirmation of the source coordinate reference system.",
    zoom_level: "city",
    datasetIds: ["ITA_VENICE_VERTICAL"],
  },
  {
    id: "rio-grande-do-sul",
    name: "Rio Grande do Sul",
    country: "Brazil",
    latitude: -29.75,
    longitude: -52.5,
    altitude: 480000,
    description:
      "Explore Rio Grande do Sul's flood stories and annual satellite imagery. SAR observations are not available for this region; the imagery provides landscape context, not a dated flood footprint.",
    zoom_level: "regional",
  },
  {
    id: "manchar",
    name: "Lake Manchar",
    country: "Pakistan",
    latitude: 26.42,
    longitude: 67.68,
    altitude: 125000,
    description:
      "Explore the lake and Indus floodplain affected by Pakistan's 2022 monsoon floods. Compare 2021–2023 and follow the dated flood stories. Annual mosaics may miss the September flood peak.",
    zoom_level: "regional",
  },
  {
    id: "norilsk",
    name: "Norilsk",
    country: "Russia",
    latitude: 69.4,
    longitude: 87.95,
    altitude: 100000,
    description:
      "Explore Norilsk and the river corridor affected by the May 29, 2020 diesel tank spill. Compare 2020–2025 for landscape context and open the stories for dated Sentinel-2 evidence. Annual mosaics may miss the spill; 2020 is not a guaranteed pre-spill baseline.",
    zoom_level: "regional",
  },
  {
    id: "nusantara",
    name: "Nusantara",
    country: "Indonesia",
    latitude: -0.97,
    longitude: 116.71,
    altitude: 24000,
    description:
      "Watch a new capital take shape in Borneo. Compare 2020–2025 to see roads, construction clearings, and government buildings emerge, especially after 2022. Follow the sourced construction stories for context.",
    zoom_level: "city",
  },
  {
    id: "egypt-capital",
    name: "New Administrative Capital",
    country: "Egypt",
    latitude: 30.01,
    longitude: 31.73,
    altitude: 32000,
    description:
      "Explore a city taking shape east of Cairo. Play 2020–2025 and watch planned road grids fill with large buildings and residential districts. Focus on new structures rather than overall image color; annual mosaics can differ in tone.",
    zoom_level: "city",
  },
  {
    id: "tuas",
    name: "Tuas Port",
    country: "Singapore",
    latitude: 1.255,
    longitude: 103.62,
    altitude: 18000,
    description:
      "Follow Singapore's growing port and reclaimed coastline through 2020–2025. Look for new quays, container yards, and industrial infrastructure. Use the port milestones to guide the satellite comparison.",
    zoom_level: "city",
  },
  {
    id: "alberta",
    name: "Alberta foothills",
    country: "Canada",
    latitude: 53.9333,
    longitude: -116.5765,
    altitude: 380000,
    description:
      "Boreal forests meet the Rockies. Explore sourced stories about the 2023 fire season and the 2024 Jasper wildfire.",
    zoom_level: "regional",
  },
  {
    id: "london",
    name: "Thames basin",
    country: "United Kingdom",
    latitude: 51.5074,
    longitude: -0.1278,
    altitude: 35000,
    description:
      "Compare annual satellite views of London and the Thames. Explore riverside regeneration and the documented Wennington fire.",
    zoom_level: "city",
  },
  {
    id: "sacramento",
    name: "Sacramento Valley",
    country: "United States",
    latitude: 38.65,
    longitude: -121.6,
    altitude: 170000,
    description:
      "A patchwork of farmland, wetlands, and foothills. Follow sourced fire and flood stories across the annual imagery.",
    zoom_level: "regional",
  },
];
export const readings: Record<string, Record<Indicator, RegionalReading>> = {
  manchar: {
    water: {
      value: "+24.8",
      unit: "%",
      context: "Illustrative water extent, not measured flood area",
      trend: [58, 55, 51, 43, 22, 10, 19, 29, 34, 38, 41, 44],
    },
  },
  // Construction locations use synthetic indicator fixtures, not measured project impacts.
  nusantara: {
    water: {
      value: "+4.5",
      unit: "%",
      context: "Illustrative water extent",
      trend: [52, 49, 46, 48, 41, 38, 36, 31, 28, 30, 24, 21],
    },
  },
  "egypt-capital": {
    water: {
      value: "+3.1",
      unit: "%",
      context: "Illustrative water extent",
      trend: [57, 55, 51, 49, 46, 42, 40, 37, 35, 32, 30, 27],
    },
  },
  tuas: {
    water: {
      value: "−8.4",
      unit: "%",
      context: "Illustrative water extent",
      trend: [13, 17, 21, 25, 29, 34, 38, 42, 47, 51, 55, 59],
    },
  },
  alberta: {
    water: {
      value: "+18.6",
      unit: "%",
      context: "Surface water extent",
      trend: [50, 46, 52, 42, 39, 34, 38, 26, 25, 18, 20, 12],
    },
  },
  london: {
    water: {
      value: "+6.2",
      unit: "%",
      context: "Surface water extent",
      trend: [48, 44, 49, 39, 38, 42, 32, 29, 31, 24, 23, 20],
    },
  },
  sacramento: {
    water: {
      value: "−14.3",
      unit: "%",
      context: "Surface water extent",
      trend: [10, 17, 15, 24, 30, 28, 37, 42, 49, 51, 57, 64],
    },
  },
};
