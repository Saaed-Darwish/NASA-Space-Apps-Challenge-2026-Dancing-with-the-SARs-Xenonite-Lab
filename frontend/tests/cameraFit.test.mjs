import assert from "node:assert/strict";
import test from "node:test";
import {
  pointView,
  studyAreaView,
  visibleMapViewport,
} from "../src/globe/cameraFit.ts";

test("study-area corners fit within asymmetric docks and the timeline", () => {
  const bounds = { west: 105.65, east: 105.9, south: 9.95, north: 10.15 };
  for (const v of [
    { width: 1440, height: 1000, left: 344, right: 968, top: 160, bottom: 700 },
    { width: 1100, height: 720, left: 290, right: 710, top: 160, bottom: 370 },
    { width: 1440, height: 1000, left: 48, right: 1392, top: 160, bottom: 700 },
    { width: 390, height: 520, left: 24, right: 366, top: 100, bottom: 480 },
    { width: 390, height: 752, left: 24, right: 366, top: 75, bottom: 206 },
    { width: 768, height: 932, left: 24, right: 744, top: 75, bottom: 206 },
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

test("mobile point targets sit above the panels without changing their zoom", () => {
  for (const width of [360, 390, 768]) {
    const v = {
      width,
      height: 752,
      left: 24,
      right: width - 24,
      top: 75,
      bottom: 206,
    };
    const target = { longitude: 87.95, latitude: 69.4, altitude: 100000 };
    const fovy = Math.PI / 3;
    const view = pointView(target, v, fovy);
    const mpp = (2 * view.altitude * Math.tan(fovy / 2)) / v.height;
    const y = v.height / 2 - ((target.latitude - view.latitude) * 111320) / mpp;
    assert.ok(y > v.top && y < v.bottom);
    assert.equal(view.altitude, target.altitude);
  }
});

test("mobile framing is identical at page top and when selecting from scrolled panels", (t) => {
  const previousWindow = globalThis.window;
  const previousStyle = globalThis.getComputedStyle;
  const win = { scrollY: 0, matchMedia: () => ({ matches: false }) };
  globalThis.window = win;
  globalThis.getComputedStyle = (el) => ({
    position: el.fixed ? "fixed" : "absolute",
  });
  t.after(() => {
    globalThis.window = previousWindow;
    globalThis.getComputedStyle = previousStyle;
  });
  const element = (top, bottom, fixed = false, width = 390) => ({
    fixed,
    getBoundingClientRect: () => ({
      top: top - (fixed ? 0 : win.scrollY),
      bottom: bottom - (fixed ? 0 : win.scrollY),
      width,
      height: bottom - top,
    }),
  });
  const elements = {
    ".app-header": element(0, 92, true),
    ".imagery-status": element(109, 151),
    ".map-caption": element(318, 440),
    ".timeline": element(474, 650),
    ".left-dock": element(664, 2000),
    ".right-dock": element(0, 0, false, 0), // display: contents has no box
  };
  const canvas = {
    getBoundingClientRect: () => ({ top: 92, width: 390, height: 752 }),
    closest: () => ({ querySelector: (s) => elements[s] }),
  };
  const atTop = visibleMapViewport(canvas);
  assert.equal(atTop.top, 75);
  assert.equal(atTop.bottom, 206);
  win.scrollY = 1400;
  assert.deepEqual(visibleMapViewport(canvas), atTop);
});
