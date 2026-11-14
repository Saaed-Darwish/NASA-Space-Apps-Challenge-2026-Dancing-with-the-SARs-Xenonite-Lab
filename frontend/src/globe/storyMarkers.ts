import {
  Cartesian2,
  Cartesian3,
  Color,
  HeightReference,
  LabelStyle,
  VerticalOrigin,
  type Entity,
  type Viewer,
} from "cesium";
import { stories, storyCategories, type RegionStory } from "../data/stories";

function markerImage(story: RegionStory) {
  const color = storyCategories[story.category].color;
  const symbol =
    story.category === "fire"
      ? '<path d="M18 10L26 25H10Z" fill="#0c1821"/>'
      : story.category === "urban"
        ? '<path d="M18 9L27 18L18 27L9 18Z" fill="#0c1821"/>'
        : '<path d="M9 16Q13 11 18 16T27 16M9 22Q13 17 18 22T27 22" fill="none" stroke="#0c1821" stroke-width="2.5"/>';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="${color}" stroke="#ffffff" stroke-width="2"/>${symbol}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Separate entity collection ownership keeps region markers and story markers independent. */
export function addStoryMarkers(viewer: Viewer): Map<string, Entity> {
  const markers = new Map<string, Entity>();
  for (const story of stories) {
    const entity = viewer.entities.add({
      id: `story/${story.id}`,
      name: story.title,
      show: false,
      position: Cartesian3.fromDegrees(story.longitude, story.latitude),
      billboard: {
        image: markerImage(story),
        width: 32,
        height: 32,
        pixelOffset: new Cartesian2(0, -36),
        heightReference: HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Infinity,
      },
      label: {
        text: story.title,
        font: "12px sans-serif",
        fillColor: Color.WHITE,
        outlineColor: Color.BLACK,
        outlineWidth: 3,
        style: LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cartesian2(0, -58),
        verticalOrigin: VerticalOrigin.BOTTOM,
        disableDepthTestDistance: Infinity,
      },
    });
    markers.set(story.id, entity);
  }
  return markers;
}

export function isStoryVisible(
  story: RegionStory,
  regionId: string | undefined,
  year: number,
  showMarkers: boolean,
) {
  return (
    showMarkers &&
    year >= story.firstYear &&
    (!regionId || story.regionId === regionId)
  );
}
