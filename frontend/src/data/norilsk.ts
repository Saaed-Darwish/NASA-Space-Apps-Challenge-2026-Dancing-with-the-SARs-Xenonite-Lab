import evidence from "./norilsk.json" with { type: "json" };
import type { StudyBounds } from "./sar";

export interface GroundMotionOverlay {
  id: string;
  title: string;
  description: string;
  period: string | null;
  limit: number;
  bounds: StudyBounds;
  imageUrl: string;
}
export interface GroundMotionSelection {
  overlay: GroundMotionOverlay;
  opacity: number;
}
export const norilskOverlays: GroundMotionOverlay[] = evidence.overlays;
export const norilskCredit = evidence.credit;
