import {
  Cartesian2,
  Cartesian3,
  Color,
  ConstantProperty,
  EllipsoidalOccluder,
  LabelStyle,
  Math as CesiumMath,
  VerticalOrigin,
  type Viewer,
} from "cesium";
import { indicators, type Indicator } from "../data/demo";
import type { Region } from "../types/region";
import { PIN_LABEL_BACKGROUND, PIN_LABEL_TEXT } from "./markerStyle";
import { studyAreaView, visibleMapViewport } from "./cameraFit";
import type { StudyBounds } from "../data/sar";

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

export function focusCamera(
  viewer: Viewer,
  region: Region | null,
  onFlightState?: (moving: boolean) => void,
  studyArea?: StudyBounds | null,
) {
  const frustum = viewer.camera.frustum;
  const destination =
    region && studyArea && "fovy" in frustum
      ? studyAreaView(
          studyArea,
          visibleMapViewport(viewer.scene.canvas),
          frustum.fovy ?? Math.PI / 3,
        )
      : (region ?? GLOBAL_VIEW);
  viewer.camera.cancelFlight();
  onFlightState?.(true);
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(
      destination.longitude,
      destination.latitude,
      destination.altitude,
    ),
    orientation: TOP_DOWN_ORIENTATION,
    duration: region ? 2.5 : 1.8,
    complete: () => onFlightState?.(false),
    cancel: () => onFlightState?.(false),
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
        disableDepthTestDistance: Infinity,
      },
      label: {
        text: region.name,
        font: "14px sans-serif",
        fillColor: PIN_LABEL_TEXT,
        outlineColor: Color.BLACK,
        outlineWidth: 3,
        style: LabelStyle.FILL,
        pixelOffset: new Cartesian2(0, -24),
        verticalOrigin: VerticalOrigin.BOTTOM,
        showBackground: true,
        backgroundColor: PIN_LABEL_BACKGROUND,
        backgroundPadding: new Cartesian2(7, 5),
        disableDepthTestDistance: Infinity,
      },
    });
  }
}

/** Surface anchors stay fixed; horizon culling prevents back-side pins showing through Earth. */
export function trackMarkerVisibility(viewer: Viewer) {
  const occluder = new EllipsoidalOccluder(
    viewer.scene.globe.ellipsoid,
    viewer.camera.positionWC,
  );
  const visibility = new WeakMap<object, boolean>();
  return viewer.scene.preRender.addEventListener(() => {
    occluder.cameraPosition = viewer.camera.positionWC;
    for (const entity of viewer.entities.values) {
      if (!entity.show) continue;
      const position = entity.position?.getValue(viewer.clock.currentTime);
      if (!position) continue;
      const visible = occluder.isPointVisible(position);
      if (visibility.get(entity) === visible) continue;
      visibility.set(entity, visible);
      if (entity.point) entity.point.show = new ConstantProperty(visible);
      if (entity.billboard)
        entity.billboard.show = new ConstantProperty(visible);
      if (entity.label) entity.label.show = new ConstantProperty(visible);
    }
  });
}
