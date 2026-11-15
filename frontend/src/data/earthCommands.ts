import type { DiscoveredArticle } from "./articleSearch";
import { isRecord, safeExternalUrl } from "./validation.ts";

/** Only explicit user commands trigger map actions; model output never does. */
export function placeQuery(text: string): string | null {
  const match = text
    .trim()
    .match(
      /^(?:please\s+)?(?:search(?:\s+for)?|find|locate|zoom\s+to|go\s+to)\s+(.+)$/i,
    );
  const query = match?.[1]
    .trim()
    .replace(/[?!]+$/, "")
    .trim();
  return query && query.length <= 200 ? query : null;
}

export async function searchPlaces(
  query: string,
  signal: AbortSignal,
): Promise<DiscoveredArticle[]> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    gsrsearch: query,
    gsrnamespace: "0",
    gsrlimit: "8",
    prop: "extracts|coordinates|info",
    exintro: "1",
    explaintext: "1",
    exsentences: "2",
    inprop: "url",
    colimit: "max",
    coprimary: "primary",
    redirects: "1",
  });
  const response = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
    signal,
  });
  if (!response.ok)
    throw new Error("Place search is unavailable. Please try again.");
  const data: unknown = await response.json();
  if (!isRecord(data) || data.error)
    throw new Error("Place search could not complete. Try a city and country.");
  const pages =
    isRecord(data.query) && isRecord(data.query.pages)
      ? Object.values(data.query.pages).filter(isRecord)
      : [];
  return pages
    .sort((a, b) => Number(a.index ?? 0) - Number(b.index ?? 0))
    .flatMap((page): DiscoveredArticle[] => {
      const url = safeExternalUrl(page.fullurl);
      const point = (Array.isArray(page.coordinates) ? page.coordinates : [])
        .filter(isRecord)
        .find(
          (p) =>
            p.globe === "earth" &&
            typeof p.lat === "number" &&
            Number.isFinite(p.lat) &&
            Math.abs(p.lat) <= 90 &&
            typeof p.lon === "number" &&
            Number.isFinite(p.lon) &&
            Math.abs(p.lon) <= 180,
        );
      if (
        !point ||
        !url ||
        new URL(url).hostname !== "en.wikipedia.org" ||
        !Number.isSafeInteger(page.pageid) ||
        Number(page.pageid) <= 0 ||
        typeof page.title !== "string" ||
        !page.title.trim()
      )
        return [];
      return [
        {
          id: `earth-search/${page.pageid}`,
          regionId: "earth-search",
          title: page.title.slice(0, 300),
          summary:
            typeof page.extract === "string"
              ? page.extract.slice(0, 2000)
              : "Wikipedia reference location.",
          url,
          latitude: point.lat as number,
          longitude: point.lon as number,
        },
      ];
    })
    .slice(0, 5);
}
