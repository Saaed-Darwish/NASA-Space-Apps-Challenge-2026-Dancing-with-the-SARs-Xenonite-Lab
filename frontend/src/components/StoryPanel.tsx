import {
  storiesForRegion,
  storyCategories,
  type RegionStory,
} from "../data/stories";
import type { Region } from "../types/region";
import SourceLinks, { StoryTiming } from "./SourceLinks";

interface StoryPanelProps {
  region: Region | null;
  year: number;
  selectedStory: RegionStory | null;
  onSelectStory: (story: RegionStory) => void;
  onCompare: (story: RegionStory) => void;
  onAnalyze: () => void;
  onAskAI: () => void;
  showMarkers: boolean;
  onShowMarkersChange: (show: boolean) => void;
}

export default function StoryPanel({
  region,
  year,
  selectedStory,
  onSelectStory,
  onCompare,
  onAnalyze,
  onAskAI,
  showMarkers,
  onShowMarkersChange,
}: StoryPanelProps) {
  const regionStories = storiesForRegion(region?.id);
  return (
    <section className="story-panel panel" aria-label="Region stories">
      <div className="section-label">
        <span>THE STORY BEHIND THE SURFACE</span>
        <span>{regionStories.length}</span>
      </div>
      <label className="story-marker-switch">
        <input
          type="checkbox"
          checked={showMarkers}
          onChange={(event) => onShowMarkersChange(event.target.checked)}
        />{" "}
        Show story markers on map
      </label>
      <div className="story-list">
        {regionStories.map((story) => (
          <button
            key={story.id}
            className={`story-list-item ${selectedStory?.id === story.id ? "active" : ""}`}
            onClick={() => onSelectStory(story)}
          >
            <span style={{ color: storyCategories[story.category].color }}>
              {storyCategories[story.category].symbol}
            </span>
            <span>
              <strong>{story.title}</strong>
              <small>
                {story.firstYear} · {storyCategories[story.category].label}
                {year < story.firstYear ? " · not yet on map" : ""}
              </small>
            </span>
            <span>↗</span>
          </button>
        ))}
      </div>
      {selectedStory && (
        <article className="story-preview">
          <StoryTiming story={selectedStory} year={year} />
          <h3>{selectedStory.title}</h3>
          <p>{selectedStory.summary}</p>
          <div className="story-actions">
            <button onClick={() => onCompare(selectedStory)}>
              View before / after
            </button>
            <button onClick={onAnalyze}>Analyze</button>
            <button onClick={onAskAI}>Ask AI ↗</button>
          </div>
          <SourceLinks sources={selectedStory.sources} observationYear={year} />
        </article>
      )}
      {!selectedStory && (
        <p className="muted small">
          Select a story here or click its colored marker on the globe.
        </p>
      )}
    </section>
  );
}
