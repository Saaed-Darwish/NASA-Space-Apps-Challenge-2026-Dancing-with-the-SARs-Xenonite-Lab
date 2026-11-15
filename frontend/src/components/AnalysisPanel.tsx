import type { Region } from "../types/region";
import {
  storiesForRegion,
  storyCategories,
  type RegionStory,
} from "../data/stories";
import { storyTimelineLabel } from "../data/storyTimeline";
import type { Indicator, OverlaySettings, RegionalReading } from "../data/demo";
import SourceLinks, { StoryTiming } from "./SourceLinks";
import LayerPanel from "./LayerPanel";
import ObservationPanel from "./ObservationPanel";
import DataTypeTabs from "./DataTypeTabs";
import type { SarDataset, SarObservation } from "../data/sar";
import type { TimelineSelection } from "../data/observationTime";
import type { WaterLayerSelection } from "../data/waterChanges";

interface AnalysisPanelProps {
  region: Region | null;
  story: RegionStory | null;
  time: number;
  startYear: number;
  endYear: number;
  onSelectStory: (story: RegionStory) => void;
  onShowYear: (year: number) => void;
  onRefocus: (region: Region) => void;
  onAskAI: () => void;
  showMarkers: boolean;
  onShowMarkersChange: (show: boolean) => void;
  overlaySettings: OverlaySettings;
  onUpdateOverlay: (
    indicator: Indicator,
    changes: Partial<OverlaySettings[Indicator]>,
  ) => void;
  reading: RegionalReading | null;
  datasets: SarDataset[];
  dataset: SarDataset | null;
  onSelectDataset: (id: string) => void;
  onSelectObservation: (
    observation: SarObservation | null,
    syncTimeline?: boolean,
  ) => void;
  timelineSelection: TimelineSelection | null;
  onShowBasemap: (year: number) => void;
  onWaterLayer: (layer: WaterLayerSelection | null) => void;
  onCompareDate: (date: string) => void;
}

export default function AnalysisPanel({
  region,
  story,
  time,
  startYear,
  endYear,
  onSelectStory,
  onShowYear,
  onRefocus,
  onAskAI,
  showMarkers,
  onShowMarkersChange,
  overlaySettings,
  onUpdateOverlay,
  reading,
  datasets,
  dataset,
  onSelectDataset,
  onSelectObservation,
  onShowBasemap,
  timelineSelection,
  onWaterLayer,
  onCompareDate,
}: AnalysisPanelProps) {
  const candidates = region ? storiesForRegion(region.id) : [];
  return (
    <section
      className="workspace-panel analysis-panel panel"
      aria-label="Region analysis"
      data-kind={dataset?.kind}
    >
      <div className="workspace-title">
        <div>
          <span className="eyebrow">PLACE, TIME & EVIDENCE</span>
          <h2>Analyze</h2>
        </div>
        <span className="mock-pill">
          {dataset
            ? "SAR OBSERVATIONS"
            : region?.waterMonitoring
              ? "WATER CONTEXT"
              : "SOURCED STORIES"}
        </span>
      </div>
      <div className="context-strip">
        {region?.name ?? "Global overview"}
        <span>
          {startYear}&ndash;{endYear}
        </span>
      </div>
      {!region && (
        <div className="analysis-empty">
          <h3>Choose a place to investigate</h3>
          <p>
            Move and zoom the globe or choose a study area. Its camera view,
            stories, and year comparison will appear here.
          </p>
        </div>
      )}
      {region && (
        <>
          <div className="curated-camera">
            <span className="section-label">CURATED CAMERA VIEW</span>
            <p>{region.description}</p>
            <button className="refocus" onClick={() => onRefocus(region)}>
              Refocus curated view
            </button>
          </div>
          <div className="comparison-buttons">
            <button onClick={() => onShowYear(startYear)}>
              &larr; Before &middot; {startYear}
            </button>
            <button onClick={() => onShowYear(endYear)}>
              After &middot; {endYear} &rarr;
            </button>
          </div>
          {dataset && (
            <DataTypeTabs
              datasets={datasets}
              dataset={dataset}
              onSelect={onSelectDataset}
            />
          )}
          {dataset && (
            <ObservationPanel
              key={dataset.id}
              dataset={dataset}
              datasets={datasets.filter((d) => d.kind === dataset.kind)}
              basemapYear={Math.floor(time)}
              onSelectDataset={onSelectDataset}
              onSelectObservation={onSelectObservation}
              onShowBasemap={onShowBasemap}
              timelineSelection={timelineSelection}
              onWaterLayer={onWaterLayer}
              onCompareDate={onCompareDate}
            />
          )}
          {region.waterMonitoring && !dataset && (
            <LayerPanel
              embedded
              region={region}
              observationYear={Math.floor(time)}
              overlaySettings={overlaySettings}
              onUpdateOverlay={onUpdateOverlay}
              reading={reading}
            />
          )}
          <div className="section-heading">
            {candidates.length} SOURCED STORIES
          </div>
          <label className="story-marker-switch">
            <input
              type="checkbox"
              checked={showMarkers}
              onChange={(event) => onShowMarkersChange(event.target.checked)}
            />
            Show story markers for this region
          </label>
          <div className="story-list">
            {candidates.map((candidate) => (
              <button
                key={candidate.id}
                className={
                  "story-list-item " +
                  (story?.id === candidate.id ? "active" : "")
                }
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
            <article className="analysis-story">
              <StoryTiming story={story} year={time} />
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
                  Markers are approximate story locators, not measured event
                  boundaries.
                </p>
              </div>
              <div className="story-actions">
                <button onClick={onAskAI}>Ask Earth AI</button>
              </div>
              <h4 className="section-heading">READ THE ORIGINAL SOURCES</h4>
              <SourceLinks
                sources={story.sources}
                observationYear={Math.floor(time)}
              />
            </article>
          )}
        </>
      )}
    </section>
  );
}
