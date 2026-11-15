import assert from "node:assert/strict";
import test from "node:test";
import { shouldFocusCamera } from "../src/globe/cameraFocus.ts";
import { studyAreaView } from "../src/globe/cameraFit.ts";
import { sarDatasets } from "../src/data/sar.ts";

const overview = {
  request: 0,
  layout: "open-analyze",
  resize: 0,
  regionId: null,
  areaKey: "none",
  hasTarget: false,
};
const madeira = {
  ...overview,
  request: 1,
  regionId: "porto-velho",
  areaKey: "madeira-bounds",
  hasTarget: true,
};

test("selecting Madeira starts one flight; automatic loss of context never flies back out", () => {
  assert.equal(shouldFocusCamera(null, overview), false);
  assert.equal(shouldFocusCamera(overview, madeira), true);
  assert.equal(shouldFocusCamera(madeira, { ...madeira }), false);
  const detectedOverview = { ...overview, request: 1 };
  assert.equal(shouldFocusCamera(madeira, detectedOverview), false);
  assert.equal(shouldFocusCamera(detectedOverview, madeira), false);
  assert.equal(shouldFocusCamera(madeira, { ...overview, request: 2 }), true);
});

test("layout, resize and data-type bounds can refit the same selected region", () => {
  for (const changes of [
    { layout: "collapsed-analyze" },
    { resize: 1 },
    { areaKey: "another-area" },
  ]) {
    assert.equal(shouldFocusCamera(madeira, { ...madeira, ...changes }), true);
  }
  assert.equal(shouldFocusCamera(overview, { ...overview, resize: 1 }), false);
  assert.equal(shouldFocusCamera(madeira, { ...madeira, request: 2 }), true);
});

test("Madeira's whole study area fits the available map at 1920 by 1080", () => {
  const bounds = sarDatasets.find((d) => d.id === "BRA_PORTO_VELHO").bounds;
  const viewport = {
    width: 1920,
    height: 1080,
    left: 376,
    right: 1470,
    top: 180,
    bottom: 820,
  };
  const fovy = 2 * Math.atan(Math.tan(Math.PI / 6) / (1920 / 1080));
  const view = studyAreaView(bounds, viewport, fovy);
  const mpp = (2 * view.altitude * Math.tan(fovy / 2)) / viewport.height;
  const cos = Math.cos((((bounds.north + bounds.south) / 2) * Math.PI) / 180);
  for (const longitude of [bounds.west, bounds.east]) {
    for (const latitude of [bounds.south, bounds.north]) {
      const x =
        viewport.width / 2 +
        ((longitude - view.longitude) * 111320 * cos) / mpp;
      const y =
        viewport.height / 2 - ((latitude - view.latitude) * 111320) / mpp;
      assert.ok(x > viewport.left && x < viewport.right);
      assert.ok(y > viewport.top && y < viewport.bottom);
    }
  }
});
