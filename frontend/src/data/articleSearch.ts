import type { Region } from "../types/region";

export type ArticleSearchArea = Pick<
  Region,
  "id" | "name" | "country" | "latitude" | "longitude"
> & { radiusKm?: number };

export function viewportSearchArea(
  latitude: number,
  longitude: number,
  height: number,
): ArticleSearchArea | null {
  if (
    ![latitude, longitude, height].every(Number.isFinite) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180 ||
    height < 0
  )
    return null;
  const lat = Number(latitude.toFixed(3));
  const lon = Number(longitude.toFixed(3));
  const radiusKm = Math.round(Math.max(5, Math.min(250, height / 2000)));
  return {
    id: `viewport/${lat}/${lon}/${radiusKm}`,
    name: `map center (${lat.toFixed(3)}°, ${lon.toFixed(3)}°)`,
    country: "",
    latitude: lat,
    longitude: lon,
    radiusKm,
  };
}

export interface DiscoveredArticle {
  id: string;
  regionId: string;
  title: string;
  summary: string;
  url: string;
  latitude?: number;
  longitude?: number;
}

/** Reference articles are context, not verified incidents or dated observations. */
export async function searchRegionArticles(
  region: ArticleSearchArea,
  topic: string,
  signal: AbortSignal,
): Promise<DiscoveredArticle[]> {
  const query = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    gsrsearch: region.radiusKm
      ? `nearcoord:${region.radiusKm}km,${region.latitude},${region.longitude} ${topic}`.trim()
      : `${region.name} ${topic}`,
    gsrnamespace: "0",
    gsrlimit: "8",
    prop: "extracts|coordinates|info",
    exintro: "1",
    explaintext: "1",
    exsentences: "2",
    inprop: "url",
    colimit: "max",
    redirects: "1",
  });
  const response = await fetch(`https://en.wikipedia.org/w/api.php?${query}`, {
    signal,
  });
  if (!response.ok)
    throw new Error("Article search is unavailable. Please try again.");
  const data = await response.json();
  if (data.error)
    throw new Error("The article provider could not complete this search.");
  const pages = Object.values(data.query?.pages ?? {}) as Array<{
    pageid: number;
    index: number;
    title: string;
    extract?: string;
    fullurl: string;
    coordinates?: Array<{ lat: number; lon: number; globe: string }>;
  }>;
  return pages
    .sort((a, b) => a.index - b.index)
    .map((page) => {
      // Related subjects can be far away; only map coordinates within 250 km.
      const location = page.coordinates?.find((point) => {
        const north = (point.lat - region.latitude) * 111.2;
        const east =
          (((point.lon - region.longitude + 540) % 360) - 180) *
          111.2 *
          Math.cos((region.latitude * Math.PI) / 180);
        return (
          point.globe === "earth" &&
          Number.isFinite(point.lat) &&
          Number.isFinite(point.lon) &&
          Math.abs(point.lat) <= 90 &&
          Math.abs(point.lon) <= 180 &&
          Math.hypot(north, east) <= 250
        );
      });
      return {
        id: `${region.id}/${page.pageid}`,
        regionId: region.id,
        title: page.title,
        summary: page.extract || "Open the article to read more.",
        url: page.fullurl,
        latitude: location?.lat,
        longitude: location?.lon,
      };
    });
}
