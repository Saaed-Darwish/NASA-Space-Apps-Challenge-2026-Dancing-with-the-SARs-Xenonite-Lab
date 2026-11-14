import {
  Cartesian2,
  Cartesian3,
  Color,
  HeightReference,
  LabelStyle,
  Math as CesiumMath,
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
