/** Camera heights in metres above the ellipsoid: overview plus bounded zoom-out room. */
export const OVERVIEW_CAMERA_HEIGHT = 22_000_000;
export const MAX_CAMERA_HEIGHT = 40_000_000;

export function configureCameraLimits(controller: {
  maximumZoomDistance: number;
  enableCollisionDetection: boolean;
}) {
  controller.maximumZoomDistance = MAX_CAMERA_HEIGHT;
  // Cesium ignores zoom limits when collision detection is disabled.
  controller.enableCollisionDetection = true;
}
