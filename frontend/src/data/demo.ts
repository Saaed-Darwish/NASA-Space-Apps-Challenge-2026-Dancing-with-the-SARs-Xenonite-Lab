import type { Region } from "../types/region";
export type Indicator = "land" | "water" | "fire";
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
  land: {
    name: "Land displacement",
    short: "Land",
    color: "#b49aff",
    low: "Subsidence",
    high: "Uplift",
    unit: "mm",
    description: "Vertical surface movement",
    values: [-24, -12, 0, 12, 24],
    colors: ["#7052cf", "#a891ed", "#e4dcff", "#f2cf89", "#edab53"],
  },
  water: {
    name: "Water extent change",
    short: "Water",
    color: "#55d9ed",
    low: "Water loss",
    high: "Water gain",
    unit: "%",
    description: "Change in surface water extent",
    values: [-30, -15, 0, 15, 30],
    colors: ["#be985d", "#dbc8a1", "#d1edf0", "#59c9df", "#168db9"],
  },
  fire: {
    name: "Wildfire impact",
    short: "Wildfire",
    color: "#ff9770",
    low: "Low impact",
    high: "High impact",
    unit: "index",
    description: "Simulated burn severity",
    values: [0, 0.25, 0.5, 0.75, 1],
    colors: ["#f9d68b", "#f7b45c", "#f18b46", "#de5940", "#a92c42"],
  },
};
export const regions: Region[] = [
  {
    id: "nusantara",
    name: "Nusantara",
    country: "Indonesia",
    latitude: -0.97,
    longitude: 116.71,
    altitude: 24000,
    description:
      "Watch a new capital take shape in Borneo. Compare 2020–2025 to see roads, construction clearings, and government buildings emerge, especially after 2022. Turn off the simulated overlays for the clearest satellite comparison.",
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
      "Follow Singapore's growing port and reclaimed coastline through 2020–2025. Look for new quays, container yards, and industrial infrastructure. Turn off simulated overlays to inspect the real shoreline and construction changes.",
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
      "Boreal forests meet the Rockies. Explore a simulated mosaic of ground movement, shifting water, and wildfire scars.",
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
      "Compare annual satellite views of London and the Thames. Turn off the simulated overlays to inspect larger developments and urban land-use changes.",
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
      "A patchwork of farmland, wetlands, and foothills. Examine simulated groundwater-driven movement and seasonal water changes.",
    zoom_level: "regional",
  },
];
export const readings: Record<string, Record<Indicator, RegionalReading>> = {
  // Construction locations use synthetic indicator fixtures, not measured project impacts.
  nusantara: {
    land: {
      value: "−6.2",
      unit: "mm",
      context: "Illustrative vertical movement",
      trend: [12, 14, 17, 21, 27, 32, 39, 45, 49, 52, 57, 60],
    },
    water: {
      value: "+4.5",
      unit: "%",
      context: "Illustrative water extent",
      trend: [52, 49, 46, 48, 41, 38, 36, 31, 28, 30, 24, 21],
    },
    fire: {
      value: "1.2",
      unit: "km²",
      context: "Illustrative affected area",
      trend: [62, 61, 59, 56, 54, 51, 48, 47, 44, 42, 39, 37],
    },
  },
  "egypt-capital": {
    land: {
      value: "−4.8",
      unit: "mm",
      context: "Illustrative vertical movement",
      trend: [15, 18, 20, 24, 28, 31, 35, 38, 44, 48, 50, 54],
    },
    water: {
      value: "+3.1",
      unit: "%",
      context: "Illustrative water extent",
      trend: [57, 55, 51, 49, 46, 42, 40, 37, 35, 32, 30, 27],
    },
    fire: {
      value: "0.3",
      unit: "km²",
      context: "Illustrative affected area",
      trend: [65, 65, 64, 63, 61, 60, 59, 57, 56, 55, 53, 52],
    },
  },
  tuas: {
    land: {
      value: "−9.6",
      unit: "mm",
      context: "Illustrative vertical movement",
      trend: [9, 13, 18, 25, 29, 34, 39, 43, 48, 53, 57, 63],
    },
    water: {
      value: "−8.4",
      unit: "%",
      context: "Illustrative water extent",
      trend: [13, 17, 21, 25, 29, 34, 38, 42, 47, 51, 55, 59],
    },
    fire: {
      value: "0.4",
      unit: "km²",
      context: "Illustrative affected area",
      trend: [64, 63, 62, 61, 59, 58, 56, 54, 52, 51, 49, 48],
    },
  },
  alberta: {
    land: {
      value: "−12.4",
      unit: "mm",
      context: "Mean vertical movement",
      trend: [8, 12, 11, 20, 25, 23, 34, 38, 46, 52, 58, 64],
    },
    water: {
      value: "+18.6",
      unit: "%",
      context: "Surface water extent",
      trend: [50, 46, 52, 42, 39, 34, 38, 26, 25, 18, 20, 12],
    },
    fire: {
      value: "142",
      unit: "km²",
      context: "Illustrative affected area",
      trend: [65, 65, 64, 62, 58, 35, 21, 14, 12, 11, 10, 9],
    },
  },
  london: {
    land: {
      value: "−3.8",
      unit: "mm",
      context: "Mean vertical movement",
      trend: [15, 18, 16, 22, 26, 25, 34, 37, 39, 45, 48, 51],
    },
    water: {
      value: "+6.2",
      unit: "%",
      context: "Surface water extent",
      trend: [48, 44, 49, 39, 38, 42, 32, 29, 31, 24, 23, 20],
    },
    fire: {
      value: "2.1",
      unit: "km²",
      context: "Illustrative affected area",
      trend: [60, 60, 59, 58, 55, 53, 50, 49, 46, 43, 41, 40],
    },
  },
  sacramento: {
    land: {
      value: "−21.7",
      unit: "mm",
      context: "Mean vertical movement",
      trend: [5, 10, 14, 18, 22, 27, 34, 40, 46, 53, 61, 68],
    },
    water: {
      value: "−14.3",
      unit: "%",
      context: "Surface water extent",
      trend: [10, 17, 15, 24, 30, 28, 37, 42, 49, 51, 57, 64],
    },
    fire: {
      value: "86.5",
      unit: "km²",
      context: "Illustrative affected area",
      trend: [65, 64, 62, 61, 52, 38, 29, 22, 18, 16, 14, 12],
    },
  },
};
