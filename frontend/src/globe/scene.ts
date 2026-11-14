import {
  Cartesian2,
  Cartesian3,
  Color,
  HeightReference,
  LabelStyle,
  Math as CesiumMath,
  PolygonHierarchy,
  VerticalOrigin,
  type Viewer,
} from "cesium";
import { indicators, type Indicator } from "../data/demo";
import type { Region } from "../types/region";

const GLOBAL_VIEW = { longitude: -35, latitude: 35, altitude: 22_000_000 };
const TOP_DOWN_ORIENTATION = {
  heading: 0,
  pitch: CesiumMath.toRadians(-90),
  roll: 0,
};

export function setInitialCameraView(viewer: Viewer) {
  viewer.camera.setView({
    destination: Cartesian3.fromDegrees(
      GLOBAL_VIEW.longitude,
      GLOBAL_VIEW.latitude,
      GLOBAL_VIEW.altitude,
    ),
  });
}

export function focusCamera(viewer: Viewer, region: Region | null) {
  const destination = region ?? GLOBAL_VIEW;
  viewer.camera.cancelFlight();
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(
      destination.longitude,
      destination.latitude,
      destination.altitude,
    ),
    orientation: TOP_DOWN_ORIENTATION,
    duration: region ? 2.5 : 1.8,
  });
}

export function addRegionMarkers(
  viewer: Viewer,
  regions: Region[],
  indicator: Indicator,
) {
  for (const region of regions) {
    viewer.entities.add({
      id: region.id,
      name: region.name,
      position: Cartesian3.fromDegrees(region.longitude, region.latitude),
      point: {
        pixelSize: 12,
        color: Color.fromCssColorString(indicators[indicator].color),
        outlineColor: Color.WHITE,
        outlineWidth: 2,
        heightReference: HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Infinity,
      },
      label: {
        text: region.name,
        font: "14px sans-serif",
        fillColor: Color.WHITE,
        outlineColor: Color.BLACK,
        outlineWidth: 3,
        style: LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cartesian2(0, -24),
        verticalOrigin: VerticalOrigin.BOTTOM,
        disableDepthTestDistance: Infinity,
      },
    });
  }
}

const PATCH_GRID = {
  rows: 12,
  columns: 14,
  referenceAltitude: 380_000,
  longitudeSpacing: 0.12,
  latitudeSpacing: 0.075,
  width: 0.115,
  height: 0.07,
};

export function addDemoOverlay(
  viewer: Viewer,
  region: Region,
  indicator: Indicator,
  opacity: number,
) {
  const scale = region.altitude / PATCH_GRID.referenceAltitude;
  const palette = indicators[indicator].colors;

  // Keep the mock pattern repeatable when changing layers or revisiting a region.
  for (let row = 0; row < PATCH_GRID.rows; row++) {
    for (let column = 0; column < PATCH_GRID.columns; column++) {
      const patchSeed = row * 37 + column * 19 + region.id.length * 13;
      if (patchSeed % 7 < 2) continue;

      const longitude =
        region.longitude +
        (column - PATCH_GRID.columns / 2) * PATCH_GRID.longitudeSpacing * scale;
      const latitude =
        region.latitude +
        (row - PATCH_GRID.rows / 2) * PATCH_GRID.latitudeSpacing * scale;
      const width = PATCH_GRID.width * scale;
      const height = PATCH_GRID.height * scale;
      const colorIndex =
        indicator === "fire"
          ? (row + column * 2) % palette.length
          : (Math.floor(column / 3) + Math.floor(row / 4)) % palette.length;

      // Slightly irregular corners suggest surface patches without tracing real features.
      const corners = [
        longitude,
        latitude,
        longitude + width,
        latitude + 0.009 * scale,
        longitude + width * 0.91,
        latitude + height,
        longitude - 0.008 * scale,
        latitude + height * 0.84,
      ];

      viewer.entities.add({
        polygon: {
          hierarchy: new PolygonHierarchy(Cartesian3.fromDegreesArray(corners)),
          material: Color.fromCssColorString(palette[colorIndex]).withAlpha(
            opacity / 100,
          ),
          height: 15,
          outline: false,
        },
      });
    }
  }
}
