import { indicators, readings, type Indicator } from "../data/demo";
import { readingAtYear } from "../data/history";
import {
  storiesForRegion,
  storyCategories,
  type RegionStory,
} from "../data/stories";
import type { Region } from "../types/region";
import SourceLinks, { StoryTiming } from "./SourceLinks";

interface AnalysisPanelProps {
  region: Region | null;
  story: RegionStory | null;
  year: number;
  startYear: number;
  endYear: number;
  onSelectStory: (story: RegionStory) => void;
  onCompare: (story: RegionStory) => void;
  onShowYear: (year: number) => void;
  onAskAI: () => void;
}

export default function AnalysisPanel({
  region,
  story,
  year,
  startYear,
  endYear,
  onSelectStory,
  onCompare,
  onShowYear,
  onAskAI,
}: AnalysisPanelProps) {
  const candidates = storiesForRegion(region?.id);
  return (
    <section
      className="workspace-panel analysis-panel panel"
      aria-label="Change analysis"
    >
      <div className="workspace-title">
        <div>
          <span className="eyebrow">CHANGE INTELLIGENCE</span>
          <h2>Follow the evidence.</h2>
        </div>
        <span className="mock-pill">DEMO METRICS</span>
      </div>
      <div className="context-strip">
        {region?.name ?? "Global overview"}
        <span>
          {startYear}–{endYear}
        </span>
      </div>
      {!region && (
        <p className="muted">
          Select a study area to explore its stories and illustrative
          indicators.
        </p>
      )}
      {region && (
        <>
          <div className="comparison-buttons">
            <button onClick={() => onShowYear(startYear)}>
              ← Before · {startYear}
            </button>
            <button onClick={() => onShowYear(endYear)}>
              After · {endYear} →
            </button>
          </div>
          <div className="analysis-metrics">
            {(Object.keys(indicators) as Indicator[]).map((indicator) => {
              const before = readingAtYear(
                readings[region.id][indicator],
                indicator,
                startYear,
              );
              const after = readingAtYear(
                readings[region.id][indicator],
                indicator,
                endYear,
              );
              return (
                <div key={indicator}>
                  <span>
                    {indicators[indicator].short}
                    <small>MOCK</small>
                  </span>
                  <strong style={{ color: indicators[indicator].color }}>
                    {after.value} <small>{after.unit}</small>
                  </strong>
                  <p>
                    {before.value} → {after.value} {after.unit}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="demo-explanation">
            Illustrative snapshots at each selected year; these are not computed
            differences or measurements from the imagery.
          </p>
        </>
      )}
      {!story && (
        <div className="analysis-empty">
          <h3>Choose a story to investigate</h3>
          <p>Each story connects a place and date to a published account.</p>
          {candidates.map((candidate) => (
            <button key={candidate.id} onClick={() => onSelectStory(candidate)}>
              {storyCategories[candidate.category].symbol} {candidate.title} ↗
            </button>
          ))}
        </div>
      )}
      {story && (
        <article className="analysis-story">
          <StoryTiming story={story} year={year} />
          <h3>{story.title}</h3>
          <p className="story-date">{story.dateLabel}</p>
          <p>{story.summary}</p>
          <div className="evidence-block">
            <span className="evidence-tag sourced">SOURCED CONTEXT</span>
            <h4>What to look for</h4>
            <p>{story.lookFor}</p>
          </div>
          <div className="evidence-block">
            <span className="evidence-tag">LIMITATIONS</span>
            <p>{story.limitation}</p>
            <p>
              Marker location is approximate. No measured damage or event
              perimeter is drawn.
            </p>
          </div>
          <div className="story-actions">
            <button onClick={() => onCompare(story)}>
              View before / after
            </button>
            <button onClick={onAskAI}>Ask Earth AI ↗</button>
          </div>
          <h4 className="section-heading">READ THE ORIGINAL SOURCES</h4>
          <SourceLinks sources={story.sources} observationYear={year} />
        </article>
      )}
    </section>
  );
}
