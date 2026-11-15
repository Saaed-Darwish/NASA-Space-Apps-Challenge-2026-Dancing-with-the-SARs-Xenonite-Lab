export interface CameraFocusCommand {
  request: number;
  layout: string;
  resize: number;
  regionId: string | null;
  areaKey: string;
  hasTarget: boolean;
}

/** Panning updates context; only explicit focus or a changed target layout flies. */
export function shouldFocusCamera(
  previous: CameraFocusCommand | null,
  next: CameraFocusCommand,
) {
  if (!previous) return next.request > 0;
  if (previous.request !== next.request) return true;
  if (previous.regionId !== next.regionId) return false;
  return (
    next.hasTarget &&
    (previous.layout !== next.layout ||
      previous.resize !== next.resize ||
      previous.areaKey !== next.areaKey)
  );
}
