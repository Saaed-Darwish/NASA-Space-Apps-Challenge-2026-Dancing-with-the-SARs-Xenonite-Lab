import type { Region } from "../types/region";
import {
  storiesForRegion,
  storyCategories,
  type RegionStory,
} from "../data/stories";
import { storyTimelineLabel } from "../data/storyTimeline";
import SourceLinks, { StoryTiming } from "./SourceLinks";

interface Props {
  region: Region | null;
  story: RegionStory | null;
  time: number;
  onRefocus: (region: Region) => void;
  onSelectStory: (story: RegionStory) => void;
  onAnalyze: () => void;
}

export default function CuratedViewPanel({
  region,
  story,
  time,
  onRefocus,
  onSelectStory,
  onAnalyze,
}: Props) {
  const candidates = storiesForRegion(region?.id);
  return (
    <section
      className="layer-panel curated-view-panel panel"
      aria-label="Curated camera view and stories"
    >
      <div className="eyebrow">EXPLORE THIS PLACE</div>
      <h2>{region?.name ?? "Stories around the globe"}</h2>
      {region && (
        <div className="curated-camera">
          <span className="section-label">CURATED CAMERA VIEW</span>
          <p>{region.description}</p>
          <button className="refocus" onClick={() => onRefocus(region)}>
            Refocus curated view
          </button>
        </div>
      )}
      <div className="section-heading">{candidates.length} SOURCED STORIES</div>
      <div className="story-list">
        {candidates.map((candidate) => (
          <button
            key={candidate.id}
            className={`story-list-item ${story?.id === candidate.id ? "active" : ""}`}
            aria-pressed={story?.id === candidate.id}
            onClick={() => onSelectStory(candidate)}
          >
            <span
              style={{ color: storyCategories[candidate.category].color }}
              aria-hidden="true"
            >
              {storyCategories[candidate.category].symbol}
            </span>
            <span className="story-item-content">
              <strong>{candidate.title}</strong>
              <small>{storyTimelineLabel(candidate, time)}</small>
            </span>
          </button>
        ))}
      </div>
      {story && (
        <article className="story-preview">
          <StoryTiming story={story} year={time} />
          <h3>{story.title}</h3>
          <p>{story.summary}</p>
          <h4>What to look for</h4>
          <p>{story.lookFor}</p>
          <p className="demo-explanation">{story.limitation}</p>
          <div className="story-actions">
            <button onClick={onAnalyze}>Explore the evidence</button>
          </div>
          <SourceLinks
            sources={story.sources}
            observationYear={Math.floor(time)}
          />
        </article>
      )}
    </section>
  );
}
