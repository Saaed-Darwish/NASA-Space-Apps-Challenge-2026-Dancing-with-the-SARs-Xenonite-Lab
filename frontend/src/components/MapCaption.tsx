import type { DiscoveredArticle } from "../data/articleSearch";
import type { Region } from "../types/region";

interface MapCaptionProps {
  selectedRegion: Region | null;
  place?: DiscoveredArticle | null;
  onRefocusPlace?: (place: DiscoveredArticle) => void;
  onRefocus: (region: Region) => void;
}

function formatCoordinates(
  region: Pick<Region, "latitude" | "longitude">,
): string {
  const latitude = Math.abs(region.latitude).toFixed(2);
  const longitude = Math.abs(region.longitude).toFixed(2);
  const latitudeDirection = region.latitude >= 0 ? "N" : "S";
  const longitudeDirection = region.longitude >= 0 ? "E" : "W";

  return `${latitude}° ${latitudeDirection} / ${longitude}° ${longitudeDirection}`;
}

export default function MapCaption({
  selectedRegion,
  place,
  onRefocusPlace,
  onRefocus,
}: MapCaptionProps) {
  const location =
    place?.latitude !== undefined && place.longitude !== undefined
      ? { latitude: place.latitude, longitude: place.longitude }
      : selectedRegion;
  return (
    <div className="map-caption">
      <span className="eyebrow">
        {place
          ? "SEARCHED LOCATION"
          : selectedRegion
            ? "AREA IN FOCUS"
            : "GLOBAL OVERVIEW"}
      </span>
      <h1>{place?.title ?? selectedRegion?.name ?? "Our restless Earth"}</h1>
      <p>
        {location
          ? formatCoordinates(location)
          : "Select a curated region to begin"}
      </p>
      {(place || selectedRegion) && (
        <button
          className="refocus"
          onClick={() =>
            place
              ? onRefocusPlace?.(place)
              : selectedRegion && onRefocus(selectedRegion)
          }
        >
          ↗ &nbsp; {place ? "Refocus location" : "Refocus region"}
        </button>
      )}
    </div>
  );
}
