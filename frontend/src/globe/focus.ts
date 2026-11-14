import type { Region } from "../types/region";

function distanceMeters(latitude: number, longitude: number, region: Region) {
  const radians = Math.PI / 180;
  const dLat = (region.latitude - latitude) * radians;
  const dLon = (region.longitude - longitude) * radians;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(latitude * radians) *
      Math.cos(region.latitude * radians) *
      Math.sin(dLon / 2) ** 2;
  return (
    6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)))
  );
}

/** Wider exit bounds prevent focus flicker; city focus takes precedence over its region. */
export function regionForView(
  regions: Region[],
  current: Region | null,
  latitude: number,
  longitude: number,
  height: number,
): Region | null {
  if (![latitude, longitude, height].every(Number.isFinite) || height < 0)
    return null;
  const candidates = regions
    .filter(
      (region) =>
        height <= Math.max(80_000, region.altitude * 2) &&
        distanceMeters(latitude, longitude, region) <=
          Math.max(12_000, Math.min(height * 0.7, region.altitude)),
    )
    .sort(
      (a, b) =>
        a.altitude - b.altitude ||
        distanceMeters(latitude, longitude, a) -
          distanceMeters(latitude, longitude, b),
    );
  const nearest = candidates[0] ?? null;
  if (
    current &&
    height <= Math.max(80_000, current.altitude * 2) * 1.6 &&
    distanceMeters(latitude, longitude, current) <=
      Math.max(20_000, Math.min(height, current.altitude * 1.4))
  ) {
    return nearest && nearest.altitude < current.altitude ? nearest : current;
  }
  return nearest;
}
