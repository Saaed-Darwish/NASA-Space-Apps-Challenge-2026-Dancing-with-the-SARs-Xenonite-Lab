export type StoryCategory = "urban" | "fire" | "water";

export interface StorySource {
  title: string;
  publisher: string;
  url: string;
  publishedYear?: number;
}

export interface RegionStory {
  id: string;
  regionId: string;
  title: string;
  category: StoryCategory;
  firstYear: number;
  dateLabel: string;
  latitude: number;
  longitude: number;
  cameraAltitude: number;
  beforeYear: number;
  afterYear: number;
  summary: string;
  lookFor: string;
  limitation: string;
  sources: StorySource[];
}

export const storyCategories = {
  urban: { label: "Urban development", color: "#a8d6bd", symbol: "◆" },
  fire: { label: "Wildfire", color: "#ff9770", symbol: "▲" },
  water: { label: "Water & coastline change", color: "#55d9ed", symbol: "≈" },
};

/** Editorial locations are approximate locators, not measured event perimeters. */
export const stories: RegionStory[] = [
  {
    id: "manchar-floods",
    regionId: "manchar",
    title: "Lake Manchar overflows",
    category: "water",
    firstYear: 2022,
    dateLabel: "Monsoon flooding · September 2022",
    latitude: 26.42,
    longitude: 67.68,
    cameraAltitude: 125000,
    beforeYear: 2021,
    afterYear: 2023,
    summary:
      "Extreme monsoon rainfall swelled Lake Manchar during Pakistan's 2022 floods. NASA documented the overflowing lake and surrounding inundation in early September 2022.",
    lookFor:
      "Inspect the lake shoreline and surrounding floodplain. Open NASA's dated satellite comparison to see the event's flood extent, then explore the annual imagery for broader landscape context.",
    limitation:
      "Annual cloud-free mosaics combine different acquisition dates and may exclude peak flooding. The simulated water overlay is not a measured flood footprint or an inundation forecast.",
    sources: [
      {
        title: "Lake Manchar is Overflowing",
        publisher: "NASA Earth Observatory",
        publishedYear: 2022,
        url: "https://science.nasa.gov/earth/earth-observatory/lake-manchar-is-overflowing-150306/",
      },
    ],
  },
  {
    id: "nusantara-construction",
    regionId: "nusantara",
    title: "A capital emerges in Borneo",
    category: "urban",
    firstYear: 2022,
    dateLabel: "Construction began July 2022",
    latitude: -0.973,
    longitude: 116.709,
    cameraAltitude: 22000,
    beforeYear: 2020,
    afterYear: 2025,
    summary:
      "Nusantara's construction introduced new roads, cleared areas, and government facilities into a landscape of forest and plantations. NASA documents rapid changes between 2022 and 2024.",
    lookFor:
      "Follow the pale road network spreading around the government core, then compare the density of cleared sites and large structures.",
    limitation:
      "An annual mosaic combines observations from different dates. It does not identify individual construction dates or measure forest loss by itself.",
    sources: [
      {
        title: "Nusantara: A New Capital City in the Forest",
        publisher: "NASA Earth Observatory",
        publishedYear: 2024,
        url: "https://science.nasa.gov/earth/earth-observatory/nusantara-a-new-capital-city-in-the-forest-152471/",
      },
    ],
  },
  {
    id: "egypt-capital-growth",
    regionId: "egypt-capital",
    title: "From road grids to city districts",
    category: "urban",
    firstYear: 2020,
    dateLabel: "Long-term project · compare 2020–2025",
    latitude: 30.01,
    longitude: 31.73,
    cameraAltitude: 30000,
    beforeYear: 2020,
    afterYear: 2025,
    summary:
      "Egypt's New Administrative Capital is being built east of Cairo. NASA's satellite comparisons document expanding development across the desert, including government, residential, and business districts.",
    lookFor:
      "Look for planned street grids filling with buildings and large facilities. New geometry is a stronger clue than changes in overall image brightness.",
    limitation:
      "Desert mosaics can change color with acquisition conditions and processing. A darker image is not automatically evidence of urban growth.",
    sources: [
      {
        title: "Constructing Egypt's New Capital",
        publisher: "NASA Earth Observatory",
        publishedYear: 2024,
        url: "https://science.nasa.gov/earth/earth-observatory/constructing-egypts-new-capital-153237/",
      },
    ],
  },
  {
    id: "tuas-port-expansion",
    regionId: "tuas",
    title: "A new port on reclaimed land",
    category: "water",
    firstYear: 2021,
    dateLabel: "Phase 1 reclamation completed November 2021",
    latitude: 1.251,
    longitude: 103.622,
    cameraAltitude: 16000,
    beforeYear: 2020,
    afterYear: 2025,
    summary:
      "Tuas Port's first reclamation phase was completed in 2021, followed by its official opening in 2022. The project combines reclaimed land, quays, and container-terminal infrastructure.",
    lookFor:
      "Compare the shoreline, quay edges, and large paved yards. Distinguish newly formed land from facilities added on land that already existed.",
    limitation:
      "A shoreline comparison needs tidal and acquisition context. The colored water overlay here is simulated and is not a reclamation measurement.",
    sources: [
      {
        title: "First Phase of Tuas Port Reclamation Works Completes",
        publisher: "Maritime and Port Authority of Singapore",
        publishedYear: 2021,
        url: "https://www.mpa.gov.sg/media-centre/details/first-phase-of-tuas-port-reclamation-works-completes",
      },
      {
        title: "Official Opening of Tuas Port",
        publisher: "Prime Minister's Office Singapore",
        publishedYear: 2022,
        url: "https://www.pmo.gov.sg/newsroom/pm-lee-hsien-loong-at-the-official-opening-of-tuas-port/",
      },
    ],
  },
  {
    id: "jasper-wildfire",
    regionId: "alberta",
    title: "Jasper's 2024 wildfire",
    category: "fire",
    firstYear: 2024,
    dateLabel: "Wildfire began July 22, 2024",
    latitude: 52.873,
    longitude: -118.082,
    cameraAltitude: 42000,
    beforeYear: 2023,
    afterYear: 2025,
    summary:
      "The July 2024 Jasper wildfire affected the national park and townsite. Parks Canada documents the response and recovery. This marker locates the Jasper area, not the fire's full boundary.",
    lookFor:
      "Compare vegetation patterns around the town and surrounding valleys, using the official account to contextualize possible burn scars and recovery.",
    limitation:
      "The mock wildfire layer does not map this incident's damaged forest. Burn severity and damaged-building counts require separate validated datasets.",
    sources: [
      {
        title: "Jasper wildfire response and recovery",
        publisher: "Parks Canada",
        publishedYear: 2025,
        url: "https://www.canada.ca/en/parks-canada/news/2025/02/government-of-canada-funding-for-2024-wildfire-season-in-parks-canada-administered-places-including-jasper-national-park-wildfire-response-recovery.html",
      },
    ],
  },
  {
    id: "wennington-fire",
    regionId: "london",
    title: "Wennington: fire at the urban edge",
    category: "fire",
    firstYear: 2022,
    dateLabel: "Incident reported July 19, 2022",
    latitude: 51.506,
    longitude: 0.222,
    cameraAltitude: 15000,
    beforeYear: 2021,
    afterYear: 2023,
    summary:
      "London Fire Brigade reported a major fire involving houses and scrubland in Wennington in July 2022. It is a documented example of fire affecting the edge of a city.",
    lookFor:
      "Use the incident report to understand the location, then inspect the surrounding settlement and vegetation across the comparison years.",
    limitation:
      "At approximately 10-metre resolution, annual imagery may not resolve individual damaged homes. This is a sourced event locator, not a satellite damage assessment.",
    sources: [
      {
        title: "Large fire involving houses and scrubland – Wennington",
        publisher: "London Fire Brigade",
        publishedYear: 2022,
        url: "https://www.london-fire.gov.uk/incidents/2022/july/large-fire-involving-houses-and-scrubland-wennington/",
      },
    ],
  },
  {
    id: "lnu-lightning-fires",
    regionId: "sacramento",
    title: "LNU Lightning Complex",
    category: "fire",
    firstYear: 2020,
    dateLabel: "Fires began August 2020",
    latitude: 38.52,
    longitude: -122.19,
    cameraAltitude: 65000,
    beforeYear: 2020,
    afterYear: 2021,
    summary:
      "The LNU Lightning Complex affected counties west of the Sacramento Valley in August 2020. CAL FIRE lists the complex in its incident archive, and Solano County provides recovery context.",
    lookFor:
      "Inspect the hills west of the valley and use the linked incident resources to distinguish the documented event from the illustrative overlay.",
    limitation:
      "Our archive starts in 2020, the fire year. Its annual mosaic is not a guaranteed pre-fire baseline; a true before-event analysis needs imagery from before August 2020.",
    sources: [
      {
        title: "2020 Fire Season Incident Archive",
        publisher: "CAL FIRE",
        url: "https://www.fire.ca.gov/incidents/2020",
      },
      {
        title: "2020 LNU Lightning Complex recovery",
        publisher: "Solano County",
        url: "https://www.solanocounty.gov/government/office-emergency-services/recover-after-emergency/2020-lnu-lightning-complex",
      },
    ],
  },
];

export function storiesForRegion(regionId: string | undefined) {
  return regionId
    ? stories.filter((story) => story.regionId === regionId)
    : stories;
}
