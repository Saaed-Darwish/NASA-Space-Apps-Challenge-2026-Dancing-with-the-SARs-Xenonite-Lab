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
