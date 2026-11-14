import type { RegionStory } from "./stories";

export function storyMarkerVisible(
  story: RegionStory,
  regionId: string | undefined,
  time: number,
  showMarkers: boolean,
) {
  return (
    showMarkers &&
    !!regionId &&
    story.regionId === regionId &&
    storyMarkerOpacity(story, time) > 0
  );
}

/** Editorial windows follow the annual mosaic blend; they are not incident measurements. */
export function storyMarkerOpacity(story: RegionStory, time: number) {
  if (!Number.isFinite(time)) return 0;
  if (time <= story.firstYear - 0.2) return 0;
  const fadeIn = Math.max(0, Math.min(1, (time - story.firstYear + 0.2) / 0.2));
  const fadeOut =
    story.mapEndYear === undefined
      ? 1
      : Math.max(0, Math.min(1, (story.mapEndYear - time) / 0.35));
  return Math.min(fadeIn, fadeOut);
}

export function storyTimelineLabel(story: RegionStory, time: number) {
  if (time < story.firstYear)
    return `Upcoming in timeline · ${story.firstYear}`;
  if (story.mapEndYear !== undefined && time >= story.mapEndYear)
    return "Outside map window · source still available";
  if (story.mapEndYear !== undefined)
    return `On map · ${story.firstYear} event window`;
  return "Development context · visible in this timeline";
}
