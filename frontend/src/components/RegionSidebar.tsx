import { memo } from "react";
import type { Region } from "../types/region";
interface RegionSidebarProps {
  regions: Region[];
  selectedRegion: Region | null;
  onSelectRegion: (region: Region | null) => void;
  onViewStories: () => void;
}
export default memo(function RegionSidebar({
  regions,
  selectedRegion,
  onSelectRegion,
  onViewStories,
}: RegionSidebarProps) {
  return (
    <aside className="region-panel panel">
      <div className="eyebrow">THE OBSERVATION DESK</div>
      <h2>
        A changing planet.
        <br />
        <span>A closer look.</span>
      </h2>
      <p className="muted intro">
        Explore the signals written across Earth's surface.
      </p>
      <button className="text-button" onClick={onViewStories}>
        Stories &amp; evidence ↓
      </button>
      <div className="section-label">
        <span>CURATED STUDY AREAS</span>
        <span>{String(regions.length).padStart(2, "0")}</span>
      </div>
      <div className="region-list">
        {regions.map((region, index) => (
          <button
            key={region.id}
            className={`region-card ${selectedRegion?.id === region.id ? "active" : ""}`}
            aria-pressed={selectedRegion?.id === region.id}
            onClick={() => onSelectRegion(region)}
          >
            <span className="region-number">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span>
              <strong>{region.name}</strong>
              <small>{region.country}</small>
              {(region.datasetIds?.length || region.floodDataStatus) && (
                <small className="region-data-state">
                  {region.datasetIds?.length
                    ? "SAR observations available"
                    : "Water data pending"}
                </small>
              )}
            </span>
            <span className="region-arrow" aria-hidden="true">
              ↗
            </span>
          </button>
        ))}
      </div>
      <div className="region-detail">
        <span className="status-dot" /> CURATED CAMERA VIEW
        <p>
          {selectedRegion?.description ??
            "Choose a study area to explore its satellite views and sourced stories."}
        </p>
      </div>
      <button className="text-button" onClick={() => onSelectRegion(null)}>
        ◎ &nbsp; View the whole planet
      </button>
      <div className="sidebar-note">
        DEMO COLLECTION / 2026
        <br />
        <span>Satellite imagery, stories &amp; SAR observations.</span>
      </div>
    </aside>
  );
});
