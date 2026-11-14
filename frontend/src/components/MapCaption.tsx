import type { Region } from "../types/region";

interface MapCaptionProps {
  selectedRegion: Region | null;
  onRefocus: (region: Region) => void;
}

function formatCoordinates(region: Region): string {
  const latitude = Math.abs(region.latitude).toFixed(2);
  const longitude = Math.abs(region.longitude).toFixed(2);
  const latitudeDirection = region.latitude >= 0 ? "N" : "S";
  const longitudeDirection = region.longitude >= 0 ? "E" : "W";

  return `${latitude}° ${latitudeDirection} / ${longitude}° ${longitudeDirection}`;
}

export default function MapCaption({
  selectedRegion,
  onRefocus,
}: MapCaptionProps) {
  return (
    <div className="map-caption">
      <span className="eyebrow">
        {selectedRegion ? "AREA IN FOCUS" : "GLOBAL OVERVIEW"}
      </span>
      <h1>{selectedRegion?.name ?? "Our restless Earth"}</h1>
      <p>
        {selectedRegion
          ? formatCoordinates(selectedRegion)
          : "Select a curated region to begin"}
      </p>
      {selectedRegion && (
        <button className="refocus" onClick={() => onRefocus(selectedRegion)}>
          ↗ &nbsp; Refocus region
        </button>
      )}
    </div>
  );
}
