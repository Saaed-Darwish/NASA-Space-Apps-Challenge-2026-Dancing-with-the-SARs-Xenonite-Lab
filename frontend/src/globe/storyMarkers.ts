import {
  Cartesian2,
  Cartesian3,
  Color,
  HorizontalOrigin,
  LabelStyle,
  VerticalOrigin,
  type Entity,
  type Viewer,
} from "cesium";
import { stories, storyCategories, type RegionStory } from "../data/stories";
import { PIN_LABEL_BACKGROUND, PIN_LABEL_TEXT } from "./markerStyle";
export { storyMarkerVisible as isStoryVisible } from "../data/storyTimeline";

function markerImage(story: RegionStory) {
  const color = storyCategories[story.category].color;
  const symbol =
    story.category === "fire"
      ? '<path d="M18 10L26 25H10Z" fill="#0c1821"/>'
      : story.category === "urban"
        ? '<path d="M18 9L27 18L18 27L9 18Z" fill="#0c1821"/>'
        : '<path d="M9 16Q13 11 18 16T27 16M9 22Q13 17 18 22T27 22" fill="none" stroke="#0c1821" stroke-width="2.5"/>';
  // The leader ends at the real location; the callout sits below-left of the region pin.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="56" viewBox="0 0 64 56"><path d="M62 2L20 28" stroke="${color}" stroke-width="1.5"/><g transform="translate(2 10)"><circle cx="18" cy="18" r="16" fill="${color}" stroke="#ffffff" stroke-width="2"/>${symbol}</g></svg>`;
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
        width: 64,
        height: 56,
        horizontalOrigin: HorizontalOrigin.RIGHT,
        verticalOrigin: VerticalOrigin.TOP,
        disableDepthTestDistance: Infinity,
      },
      label: {
        text: story.title.replace(/(.{1,26})(?:\s+|$)/g, "$1\n").trim(),
        font: "12px sans-serif",
        fillColor: PIN_LABEL_TEXT,
        outlineColor: Color.BLACK,
        outlineWidth: 3,
        style: LabelStyle.FILL,
        pixelOffset: new Cartesian2(-68, 28),
        horizontalOrigin: HorizontalOrigin.RIGHT,
        verticalOrigin: VerticalOrigin.CENTER,
        showBackground: true,
        backgroundColor: PIN_LABEL_BACKGROUND,
        backgroundPadding: new Cartesian2(7, 5),
        disableDepthTestDistance: Infinity,
      },
    });
    markers.set(story.id, entity);
  }
  return markers;
}
