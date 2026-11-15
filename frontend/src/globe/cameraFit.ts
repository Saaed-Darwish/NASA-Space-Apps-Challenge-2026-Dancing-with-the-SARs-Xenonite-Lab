import type { StudyBounds } from "../data/sar.ts";

export interface MapViewport {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}
const METRES_PER_DEGREE = 111_320;

/** Top-down local fit with breathing room in the map's unobscured screen area. */
export function studyAreaView(
  bounds: StudyBounds,
  viewport: MapViewport,
  fovy: number,
) {
  const latitude = (bounds.north + bounds.south) / 2;
  const longitude = (bounds.east + bounds.west) / 2;
  const cosLat = Math.max(0.1, Math.cos((latitude * Math.PI) / 180));
  const width = (bounds.east - bounds.west) * METRES_PER_DEGREE * cosLat;
  const height = (bounds.north - bounds.south) * METRES_PER_DEGREE;
  const safeWidth = Math.max(80, viewport.right - viewport.left);
  const safeHeight = Math.max(80, viewport.bottom - viewport.top);
  const metresPerPixel =
    Math.max(width / safeWidth, height / safeHeight) * 1.25;
  const altitude =
    (metresPerPixel * viewport.height) / (2 * Math.tan(fovy / 2));
  return {
    longitude:
      longitude +
      ((viewport.width / 2 - (viewport.left + viewport.right) / 2) *
        metresPerPixel) /
        (METRES_PER_DEGREE * cosLat),
    latitude:
      latitude +
      (((viewport.top + viewport.bottom) / 2 - viewport.height / 2) *
        metresPerPixel) /
        METRES_PER_DEGREE,
    altitude,
  };
}

/** Measure actual panel geometry rather than assuming fixed sidebar widths. */
export function visibleMapViewport(canvas: HTMLCanvasElement): MapViewport {
  const box = canvas.getBoundingClientRect();
  const shell = canvas.closest(".app-shell");
  let left = 24,
    right = box.width - 24,
    top = 100,
    bottom = box.height - 40;
  const desktop = window.matchMedia("(min-width: 1001px)").matches;
  if (desktop && shell) {
    const leftBox = shell.querySelector(".left-dock")?.getBoundingClientRect();
    const rightBox = shell
      .querySelector(".right-dock")
      ?.getBoundingClientRect();
    if (!shell.classList.contains("left-collapsed") && leftBox)
      left = leftBox.right - box.left + 28;
    if (!shell.classList.contains("right-collapsed") && rightBox)
      right = rightBox.left - box.left - 28;
    const timeline = shell.querySelector(".timeline")?.getBoundingClientRect();
    if (timeline) bottom = Math.min(bottom, timeline.top - box.top - 24);
    const status = shell
      .querySelector(".imagery-status")
      ?.getBoundingClientRect();
    top = Math.max(top, (status?.bottom ?? box.top + 110) - box.top + 30);
  }
  // On compact screens the panels flow below the map, not over its sides.
  return {
    left,
    right,
    top,
    bottom: Math.max(top + 80, bottom),
    width: box.width,
    height: box.height,
  };
}
