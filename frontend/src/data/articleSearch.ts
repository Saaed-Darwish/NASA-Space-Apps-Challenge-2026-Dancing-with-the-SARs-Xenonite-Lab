import type { Region } from "../types/region";
import { isRecord, safeExternalUrl } from "./validation.ts";

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
  const data: unknown = await response.json();
  if (!isRecord(data) || data.error)
    throw new Error("The article provider could not complete this search.");
  const pages =
    isRecord(data.query) && isRecord(data.query.pages)
      ? Object.values(data.query.pages).filter(isRecord)
      : [];
  return pages
    .sort((a, b) => Number(a.index ?? 0) - Number(b.index ?? 0))
    .slice(0, 8)
    .flatMap((page): DiscoveredArticle[] => {
      const url = safeExternalUrl(page.fullurl);
      if (
        !Number.isSafeInteger(page.pageid) ||
        Number(page.pageid) <= 0 ||
        typeof page.title !== "string" ||
        !page.title.trim() ||
        !url ||
        new URL(url).hostname !== "en.wikipedia.org"
      )
        return [];
      // Related subjects can be far away; only map coordinates within 250 km.
      const location = (Array.isArray(page.coordinates) ? page.coordinates : [])
        .filter(isRecord)
        .find((point) => {
          if (typeof point.lat !== "number" || typeof point.lon !== "number")
            return false;
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
      return [
        {
          id: `${region.id}/${page.pageid}`,
          regionId: region.id,
          title: page.title.slice(0, 300),
          summary:
            typeof page.extract === "string" && page.extract
              ? page.extract.slice(0, 2000)
              : "Open the article to read more.",
          url,
          latitude: location?.lat as number | undefined,
          longitude: location?.lon as number | undefined,
        },
      ];
    });
}
