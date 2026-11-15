import assert from "node:assert/strict";
import test from "node:test";
import { studyAreaView } from "../src/globe/cameraFit.ts";

test("study-area corners fit within asymmetric docks and the timeline", () => {
  const bounds = { west: 105.65, east: 105.9, south: 9.95, north: 10.15 };
  for (const v of [
    { width: 1440, height: 1000, left: 344, right: 968, top: 160, bottom: 700 },
    { width: 1100, height: 720, left: 290, right: 710, top: 160, bottom: 370 },
    { width: 1440, height: 1000, left: 48, right: 1392, top: 160, bottom: 700 },
    { width: 390, height: 520, left: 24, right: 366, top: 100, bottom: 480 },
  ]) {
    const fov = Math.PI / 3,
      view = studyAreaView(bounds, v, fov);
    const mpp = (2 * view.altitude * Math.tan(fov / 2)) / v.height;
    const cos = Math.cos((((bounds.north + bounds.south) / 2) * Math.PI) / 180);
    for (const lon of [bounds.west, bounds.east])
      for (const lat of [bounds.south, bounds.north]) {
        const x = v.width / 2 + ((lon - view.longitude) * 111320 * cos) / mpp;
        const y = v.height / 2 - ((lat - view.latitude) * 111320) / mpp;
        assert.ok(x > v.left && x < v.right, `longitude fits: ${x}`);
        assert.ok(y > v.top && y < v.bottom, `latitude fits: ${y}`);
      }
  }
});
