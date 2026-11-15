import type { RegionStory, StorySource } from "./stories";

function source(
  title: string,
  url: string,
  publishedYear: number,
  publisher = "NASA Earth Observatory",
): StorySource {
  return { title, url, publishedYear, publisher };
}
const brazilFloods = source(
  "Floods Engulf Porto Alegre",
  "https://science.nasa.gov/earth/earth-observatory/floods-engulf-porto-alegre-152795/",
  2024,
);
const canThoResilience = source(
  "New Infrastructure Protects Viet Nam’s Mekong Delta City from Chronic Floods",
  "https://www.worldbank.org/en/news/feature/2025/08/12/new-infrastructure-protects-viet-nam-s-mekong-delta-city-from-chronic-floods",
  2025,
  "World Bank",
);
const annualLimitation =
  "Approximate story locator, not a measured boundary. Annual mosaics can miss short events and cannot establish their cause or exact dates.";
function story(
  input: Omit<RegionStory, "limitation"> & { limitation?: string },
): RegionStory {
  return { limitation: annualLimitation, ...input };
}

export const additionalStories: RegionStory[] = [
  story({
    id: "porto-alegre-2024-flood",
    regionId: "rio-grande-do-sul",
    title: "Guaíba floodwaters reach the city",
    category: "water",
    firstYear: 2024,
    mapEndYear: 2025,
    dateLabel: "Flooding · May 2024",
    latitude: -30.03,
    longitude: -51.235,
    cameraAltitude: 55000,
    beforeYear: 2023,
    afterYear: 2025,
    summary:
      "NASA's May 2024 imagery documents water spreading into central Porto Alegre after intense rainfall across southern Brazil.",
    lookFor:
      "Compare the waterfront and low-lying districts; use the dated NASA image to locate the flood peak.",
    sources: [brazilFloods],
  }),
  story({
    id: "porto-alegre-airport-flood",
    regionId: "rio-grande-do-sul",
    title: "Flooding disrupts the airport",
    category: "water",
    firstYear: 2024,
    mapEndYear: 2025,
    dateLabel: "Airport closure · May 2024",
    latitude: -29.994,
    longitude: -51.171,
    cameraAltitude: 30000,
    beforeYear: 2023,
    afterYear: 2025,
    summary:
      "The same flood closed Porto Alegre's international airport. NASA's account places the transport disruption within the wider urban inundation.",
    lookFor:
      "Locate the runway and surrounding floodplain. Annual imagery does not establish operational status or closure duration.",
    sources: [brazilFloods],
  }),
  story({
    id: "rio-grande-2024-flood",
    regionId: "rio-grande-do-sul",
    title: "A regional flood emergency",
    category: "water",
    firstYear: 2024,
    mapEndYear: 2025,
    dateLabel: "Regional flooding · April–May 2024",
    latitude: -29.95,
    longitude: -51.65,
    cameraAltitude: 230000,
    beforeYear: 2023,
    afterYear: 2025,
    summary:
      "NASA documented extensive flooding across Rio Grande do Sul and published a separate flood-depth analysis for the May 2024 disaster.",
    lookFor:
      "Follow the connected river lowlands toward the Guaíba. Open the source's event map for the actual flood-depth product.",
    sources: [
      source(
        "Southern Brazil Submerged",
        "https://science.nasa.gov/earth/earth-observatory/southern-brazil-submerged-152880/",
        2024,
      ),
    ],
  }),
  story({
    id: "rio-grande-2023-flood",
    regionId: "rio-grande-do-sul",
    title: "Rivers rise before the 2024 disaster",
    category: "water",
    firstYear: 2023,
    mapEndYear: 2024,
    dateLabel: "Repeated flooding · November 2023",
    latitude: -29.8,
    longitude: -51.86,
    cameraAltitude: 150000,
    beforeYear: 2022,
    afterYear: 2024,
    summary:
      "NASA's November 2023 account describes flooded rivers and settlements in southern Brazil, including the Jacuí and Taquari systems.",
    lookFor:
      "Trace the river corridors. Treat this as a separate event from the May 2024 flood, even where affected places overlap.",
    sources: [
      source(
        "Flooding in Southern Brazil",
        "https://science.nasa.gov/earth/earth-observatory/flooding-in-southern-brazil-152153/",
        2023,
      ),
    ],
  }),
  story({
    id: "can-tho-flood-defenses",
    regionId: "can-tho",
    title: "Flood defenses along the urban rivers",
    category: "water",
    firstYear: 2023,
    dateLabel: "Resilience project · implemented 2016–2024",
    latitude: 10.04,
    longitude: 105.783,
    cameraAltitude: 35000,
    beforeYear: 2020,
    afterYear: 2025,
    summary:
      "The World Bank describes embankments, tidal gates, and drainage improvements protecting Can Tho's urban core, with a major test in late 2023.",
    lookFor:
      "Inspect the urban river edges. The marker describes infrastructure, not a mapped flood incident or a guarantee of protection.",
    sources: [canThoResilience],
  }),
  story({
    id: "can-tho-safer-connections",
    regionId: "can-tho",
    title: "Bridges connect higher ground",
    category: "urban",
    firstYear: 2024,
    dateLabel: "Urban connectivity · project completed in 2024",
    latitude: 10.013,
    longitude: 105.761,
    cameraAltitude: 35000,
    beforeYear: 2020,
    afterYear: 2025,
    summary:
      "Can Tho's resilience project also improved bridges and roads to connect neighborhoods and support growth in safer areas.",
    lookFor:
      "Compare broad road connections and river crossings. Satellite appearance alone cannot measure reduced flood risk.",
    sources: [canThoResilience],
  }),
  story({
    id: "mekong-adaptive-farming",
    regionId: "mekong-delta",
    title: "Farming adapts to a changing delta",
    category: "water",
    firstYear: 2021,
    dateLabel: "Climate-resilient livelihoods · reported October 2021",
    latitude: 9.8,
    longitude: 105.3,
    cameraAltitude: 180000,
    beforeYear: 2020,
    afterYear: 2025,
    summary:
      "A World Bank account describes communities diversifying livelihoods as the Mekong Delta faces changing water and environmental conditions.",
    lookFor:
      "Explore the field and canal mosaic. This regional locator does not identify the participating farms or classify their land use.",
    sources: [
      source(
        "For Mekong Delta Farmers, Diversification is the Key to Climate Resilience",
        "https://www.worldbank.org/en/news/feature/2021/10/21/for-mekong-delta-farmers-diversification-is-the-key-to-climate-resilience",
        2021,
        "World Bank",
      ),
    ],
  }),
  story({
    id: "mekong-water-efficient-rice",
    regionId: "mekong-delta",
    title: "Using water differently in rice fields",
    category: "water",
    firstYear: 2024,
    dateLabel: "Sustainable rice practices · reported May 2024",
    latitude: 10.2,
    longitude: 105.45,
    cameraAltitude: 150000,
    beforeYear: 2020,
    afterYear: 2025,
    summary:
      "The World Bank documents water-saving rice practices in the Mekong Delta as part of a sustainable agriculture program.",
    lookFor:
      "Compare the delta's agricultural landscape. Irrigation practice and water savings require field records, not RGB imagery alone.",
    sources: [
      source(
        "Greening Viet Nam's Rice Bowl: A Mekong Delta Success Story",
        "https://www.worldbank.org/en/news/feature/2024/05/14/greening-viet-nam-s-rice-bowl-a-mekong-delta-success-story",
        2024,
        "World Bank",
      ),
    ],
  }),
  story({
    id: "manchar-waterlogged-fields",
    regionId: "manchar",
    title: "Floodwater lingers across the plain",
    category: "water",
    firstYear: 2022,
    mapEndYear: 2023,
    dateLabel: "Waterlogged fields · October 2022",
    latitude: 26.65,
    longitude: 67.62,
    cameraAltitude: 125000,
    beforeYear: 2021,
    afterYear: 2023,
    summary:
      "NASA's October follow-up shows that floodwater remained in parts of Sindh weeks after the initial 2022 emergency, affecting agricultural land.",
    lookFor:
      "Look beyond the lake to the surrounding plain, and open the dated June, August, and October sequence in the source.",
    sources: [
      source(
        "Flood Woes Continue in Pakistan",
        "https://science.nasa.gov/earth/earth-observatory/flood-woes-continue-in-pakistan-150470/",
        2022,
      ),
    ],
  }),
  story({
    id: "nusantara-road-network",
    regionId: "nusantara",
    title: "Roads trace the new capital's footprint",
    category: "urban",
    firstYear: 2022,
    dateLabel: "Road construction · visible in NASA's 2022–2024 comparison",
    latitude: -0.95,
    longitude: 116.735,
    cameraAltitude: 22000,
    beforeYear: 2022,
    afterYear: 2024,
    summary:
      "NASA's paired Landsat views show exposed soil tracing new roads around Nusantara's developing government center.",
    lookFor:
      "Follow the branching pale corridors rather than overall image color. The source does not assign exact dates to each road.",
    sources: [
      source(
        "Nusantara: A New Capital City in the Forest",
        "https://science.nasa.gov/earth/earth-observatory/nusantara-a-new-capital-city-in-the-forest-152471/",
        2024,
      ),
    ],
  }),
  story({
    id: "egypt-government-district",
    regionId: "egypt-capital",
    title: "Government functions move east",
    category: "urban",
    firstYear: 2024,
    dateLabel: "Government relocation · reported August 2024",
    latitude: 30.027,
    longitude: 31.762,
    cameraAltitude: 22000,
    beforeYear: 2020,
    afterYear: 2025,
    summary:
      "NASA's 2024 account places the expanding new city alongside the relocation of ministries and parliament east of Cairo.",
    lookFor:
      "Inspect the large building complexes and planned roads. A visible building does not establish its opening or occupancy date.",
    sources: [
      source(
        "Constructing Egypt’s New Capital",
        "https://science.nasa.gov/earth/earth-observatory/constructing-egypts-new-capital-153237/",
        2024,
      ),
    ],
  }),
  story({
    id: "tuas-port-opening",
    regionId: "tuas",
    title: "From reclaimed ground to an operating port",
    category: "urban",
    firstYear: 2022,
    dateLabel: "Official opening · September 1, 2022",
    latitude: 1.275,
    longitude: 103.635,
    cameraAltitude: 18000,
    beforeYear: 2020,
    afterYear: 2025,
    summary:
      "Singapore officially opened Tuas Port in September 2022, marking the transition from reclamation works to port operations.",
    lookFor:
      "Compare terminal yards, quay outlines, and access routes. Annual mosaics cannot determine cargo throughput.",
    sources: [
      source(
        "Official Opening of Tuas Port",
        "https://www.pmo.gov.sg/newsroom/pm-lee-hsien-loong-at-the-official-opening-of-tuas-port/",
        2022,
        "Prime Minister's Office Singapore",
      ),
    ],
  }),
  story({
    id: "alberta-2023-fires",
    regionId: "alberta",
    title: "Alberta's early 2023 fire season",
    category: "fire",
    firstYear: 2023,
    mapEndYear: 2024,
    dateLabel: "Regional wildfire outbreak · May 2023",
    latitude: 54.7,
    longitude: -116.5,
    cameraAltitude: 220000,
    beforeYear: 2022,
    afterYear: 2024,
    summary:
      "NASA documented an early outbreak of fires across western Canada in May 2023, including Alberta, before the separate Jasper event in 2024.",
    lookFor:
      "Use the source's dated satellite view for smoke and active fires. This approximate regional marker is not an ignition location or burn perimeter.",
    sources: [
      source(
        "Fires Scorch Western Canada",
        "https://science.nasa.gov/earth/earth-observatory/fires-scorch-western-canada-151313/",
        2023,
      ),
    ],
  }),
  story({
    id: "london-battersea-connections",
    regionId: "london",
    title: "New connections for Battersea and Nine Elms",
    category: "urban",
    firstYear: 2021,
    dateLabel: "Northern line extension opened September 20, 2021",
    latitude: 51.48,
    longitude: -0.142,
    cameraAltitude: 20000,
    beforeYear: 2020,
    afterYear: 2025,
    summary:
      "Transport for London records the opening of two Underground stations serving the Battersea and Nine Elms regeneration area in 2021.",
    lookFor:
      "Compare the surrounding riverside development. The rail tunnels are underground and cannot be seen in the satellite basemap.",
    sources: [
      source(
        "Over five million journeys made on the Northern Line Extension in its first year",
        "https://tfl.gov.uk/info-for/media/press-releases/2022/september/over-five-million-journeys-made-on-the-northern-line-extension-in-its-first-year",
        2022,
        "Transport for London",
      ),
    ],
  }),
  story({
    id: "sacramento-2023-floods",
    regionId: "sacramento",
    title: "Stormwater spreads over the valley floor",
    category: "water",
    firstYear: 2023,
    mapEndYear: 2024,
    dateLabel: "Atmospheric-river flooding · January 2023",
    latitude: 38.25,
    longitude: -121.4,
    cameraAltitude: 140000,
    beforeYear: 2022,
    afterYear: 2024,
    summary:
      "NASA's early-January 2023 imagery documents floodwater in north-central California following powerful winter storms, including Sacramento County.",
    lookFor:
      "Inspect the low-lying agricultural landscape and use the source's dated images for the actual storm footprint.",
    sources: [
      source(
        "Floodwater Inundates North-Central California",
        "https://science.nasa.gov/earth/earth-observatory/floodwater-inundates-north-central-california-150792/",
        2023,
      ),
    ],
  }),
];
