import assert from "node:assert/strict";
import test from "node:test";
import {
  configureCameraLimits,
  MAX_CAMERA_HEIGHT,
  OVERVIEW_CAMERA_HEIGHT,
} from "../src/globe/cameraLimits.ts";
import { regions } from "../src/data/demo.ts";

test("zoom-out is finite, retains the global overview and enforces Cesium limits", () => {
  const controller = {
    maximumZoomDistance: Infinity,
    enableCollisionDetection: false,
  };
  configureCameraLimits(controller);
  assert.equal(controller.maximumZoomDistance, 40_000_000);
  assert.equal(controller.enableCollisionDetection, true);
  assert.equal(OVERVIEW_CAMERA_HEIGHT, 22_000_000);
  assert.ok(MAX_CAMERA_HEIGHT > OVERVIEW_CAMERA_HEIGHT);
  assert.ok(regions.every((r) => r.altitude <= MAX_CAMERA_HEIGHT));
});
