export interface Region {
  id: string;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  /** Camera height above the ellipsoid, in meters. */
  altitude: number;
  description: string;
  zoom_level: string;
  floodDataStatus?: "processing";
  waterMonitoring?: boolean;
}
