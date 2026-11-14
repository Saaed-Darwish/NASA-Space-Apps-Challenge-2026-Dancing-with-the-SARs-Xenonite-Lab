import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import EarthGlobe from "./components/EarthGlobe";
import MapCaption from "./components/MapCaption";
import RegionSidebar from "./components/RegionSidebar";
import Timeline from "./components/Timeline";
import AnalysisPanel from "./components/AnalysisPanel";
import AssistantPanel from "./components/AssistantPanel";
import ArticleSearch from "./components/ArticleSearch";
import ForecastPanel from "./components/ForecastPanel";
import { storyMarkerOpacity } from "./data/storyTimeline";
import type { DiscoveredArticle } from "./data/articleSearch";
import {
  indicators,
  readings,
  regions,
  type Indicator,
  type OverlaySettings,
} from "./data/demo";
import { readingAtYear } from "./data/history";
import { storiesForRegion, type RegionStory } from "./data/stories";
import type { AssistantMessage } from "./data/assistant";
import { askEarthAI } from "./data/earthAI";
import useTimeline from "./hooks/useTimeline";
import type { Region } from "./types/region";

type WorkspaceMode = "analyze" | "forecast" | "ai";
const EMPTY_MESSAGES: AssistantMessage[] = [];

export default function App() {
  const timeline = useTimeline();
  const [mode, setMode] = useState<WorkspaceMode>("analyze");
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [isDesktop, setIsDesktop] = useState(
    () => window.matchMedia("(min-width: 1001px)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1001px)");
    const update = () => setIsDesktop(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [selectedStory, setSelectedStory] = useState<RegionStory | null>(null);
  const [articles, setArticles] = useState<DiscoveredArticle[]>([]);
  const [selectedArticle, setSelectedArticle] =
    useState<DiscoveredArticle | null>(null);
  const [showStoryMarkers, setShowStoryMarkers] = useState(true);
  const [focusRequest, setFocusRequest] = useState(0);
  const selectedIndicator: Indicator = "water";
  const [conversations, setConversations] = useState<
    Record<string, AssistantMessage[]>
  >({});
  const messageSequence = useRef(0);
  const pendingRequest = useRef(false);
  const [isAsking, setIsAsking] = useState(false);
  const leftDockRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<HTMLElement>(null);
  const [overlaySettings, setOverlaySettings] = useState<OverlaySettings>({
    water: { enabled: true, opacity: 65 },
  });

  const activeLayer = indicators[selectedIndicator];
  const observationYear = Math.floor(timeline.time);
  const waterReading = selectedRegion
    ? readings[selectedRegion.id]?.water
    : null;
  const regionalReading = waterReading
    ? readingAtYear(waterReading, selectedIndicator, timeline.time)
    : null;
  const contextStory =
    selectedStory ??
    (selectedRegion
      ? (storiesForRegion(selectedRegion.id).find(
          (story) => storyMarkerOpacity(story, timeline.time) > 0,
        ) ?? storiesForRegion(selectedRegion.id)[0])
      : null);
  const conversationKey = selectedRegion?.id ?? "global";
  const themeStyle = { "--accent": activeLayer.color } as CSSProperties;

  const revealStories = useCallback(() => {
    setMode("analyze");
    setRightCollapsed(false);
  }, []);

  useEffect(() => {
    if (selectedStory && mode === "analyze") setRightCollapsed(false);
    if (window.matchMedia("(max-width: 1000px)").matches) {
      appRef.current
        ?.querySelector(".workspace-panel")
        ?.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }, [selectedStory, focusRequest, mode]);

  function updateOverlay(
    indicator: Indicator,
    changes: Partial<OverlaySettings[Indicator]>,
  ) {
    setOverlaySettings((previous) => ({
      ...previous,
      [indicator]: { ...previous[indicator], ...changes },
    }));
  }

  const selectRegion = useCallback((region: Region | null) => {
    setSelectedArticle(null);
    setSelectedRegion(region);
    setMode((previous) =>
      previous === "forecast" && !region?.waterMonitoring
        ? "analyze"
        : previous,
    );
    setSelectedStory(null);
    setFocusRequest((previous) => previous + 1);
  }, []);

  const focusVisibleRegion = useCallback((region: Region | null) => {
    setSelectedRegion(region);
    setMode((previous) =>
      previous === "forecast" && !region?.waterMonitoring
        ? "analyze"
        : previous,
    );
    setSelectedArticle(null);
    setSelectedStory(null);
  }, []);

  const regionalArticles = useMemo(
    () => articles.filter((article) => article.regionId === selectedRegion?.id),
    [articles, selectedRegion?.id],
  );
  const addArticle = useCallback((article: DiscoveredArticle) => {
    setArticles((previous) =>
      previous.some((item) => item.id === article.id)
        ? previous
        : [...previous, article],
    );
  }, []);
  const removeArticle = useCallback((id: string) => {
    setArticles((previous) => previous.filter((article) => article.id !== id));
    setSelectedArticle((previous) => (previous?.id === id ? null : previous));
  }, []);
  const focusArticle = useCallback((article: DiscoveredArticle) => {
    setSelectedArticle(article);
    setSelectedStory(null);
    setFocusRequest((value) => value + 1);
  }, []);

  function selectStory(story: RegionStory) {
    setMode("analyze");
    setRightCollapsed(false);
    setSelectedArticle(null);
    const region = regions.find((candidate) => candidate.id === story.regionId);
    if (!region) return;
    setSelectedRegion(region);
    setMode((previous) =>
      previous === "forecast" && !region?.waterMonitoring
        ? "analyze"
        : previous,
    );
    setSelectedStory(story);
    setShowStoryMarkers(true);
    timeline.setComparisonRange(
      story.beforeYear,
      story.afterYear,
      story.firstYear,
    );
    setFocusRequest((previous) => previous + 1);
  }

  async function askQuestion(question: string) {
    const text = question.trim().slice(0, 1000);
    if (!text || !selectedRegion || pendingRequest.current) return;
    pendingRequest.current = true;
    setIsAsking(true);
    const key = conversationKey;
    const questionId = String(++messageSequence.current);
    const answerId = String(++messageSequence.current);
    setConversations((previous) => ({
      ...previous,
      [key]: [...(previous[key] ?? []), { id: questionId, role: "user", text }],
    }));
    try {
      const answer = await askEarthAI({
        question: text,
        region_id: selectedRegion.id,
        story_id: contextStory?.id,
        year: observationYear,
        start_year: timeline.startYear,
        end_year: timeline.endYear,
        history: (conversations[key] ?? [])
          .filter((message) => !message.error)
          .slice(-8)
          .map((message) => ({
            role: message.role,
            content: message.text.slice(0, 4000),
          })),
      });
      setConversations((previous) => ({
        ...previous,
        [key]: [
          ...(previous[key] ?? []),
          { id: answerId, role: "assistant", ...answer, observationYear },
        ],
      }));
    } catch (error) {
      setConversations((previous) => ({
        ...previous,
        [key]: [
          ...(previous[key] ?? []),
          {
            id: answerId,
            role: "assistant",
            error: true,
            text:
              error instanceof Error
                ? error.message
                : "Earth AI is unavailable. Please try again.",
          },
        ],
      }));
    } finally {
      pendingRequest.current = false;
      setIsAsking(false);
    }
  }

  function openAssistant() {
    setRightCollapsed(false);
    setMode("ai");
    askQuestion("Explain what changed here and which evidence supports it.");
  }

  return (
    <main
      ref={appRef}
      className={`app-shell workspace-${mode}${leftCollapsed ? " left-collapsed" : ""}${rightCollapsed ? " right-collapsed" : ""}`}
      style={themeStyle}
    >
      <EarthGlobe
        articles={articles}
        selectedArticle={selectedArticle}
        onSelectArticle={focusArticle}
        regions={regions}
        selectedRegion={selectedRegion}
        onSelectRegion={selectRegion}
        onViewportFocus={focusVisibleRegion}
        selectedStory={selectedStory}
        onSelectStory={selectStory}
        showStoryMarkers={showStoryMarkers}
        focusRequest={focusRequest}
        time={timeline.time}
        indicator={selectedIndicator}
        isPlaying={timeline.isPlaying}
        overlaySettings={overlaySettings}
      />
      <header className="app-header">
        <a className="brand" href="./">
          <span className="brand-mark">◉</span> Earth<span>Pulse</span>
        </a>
        <nav className="workspace-nav" aria-label="Main navigation">
          {(["analyze", "forecast", "ai"] as WorkspaceMode[])
            .filter(
              (view) => view !== "forecast" || selectedRegion?.waterMonitoring,
            )
            .map((view) => (
              <button
                key={view}
                aria-current={mode === view ? "page" : undefined}
                onClick={() => {
                  setMode(view);
                  setRightCollapsed(false);
                }}
              >
                {view === "ai"
                  ? "✦ Earth AI"
                  : view === "analyze"
                    ? "Analyze"
                    : "Forecast"}
              </button>
            ))}
        </nav>
        <span className="demo-badge">REAL IMAGERY / DEMO ANALYSIS</span>
      </header>

      <button
        className="dock-toggle dock-toggle-left"
        aria-label={leftCollapsed ? "Show regions" : "Hide regions"}
        aria-expanded={!leftCollapsed}
        aria-controls="region-dock"
        title={leftCollapsed ? "Show regions" : "Hide regions"}
        onClick={() => setLeftCollapsed((previous) => !previous)}
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          aria-hidden="true"
        >
          <path d={leftCollapsed ? "m9 6 6 6-6 6" : "m15 6-6 6 6 6"} />
        </svg>
      </button>
      <div
        className="left-dock"
        id="region-dock"
        ref={leftDockRef}
        inert={isDesktop && leftCollapsed}
      >
        <RegionSidebar
          regions={regions}
          selectedRegion={selectedRegion}
          onSelectRegion={selectRegion}
          onViewStories={revealStories}
        />
        {selectedRegion && (
          <ArticleSearch
            key={selectedRegion.id}
            region={selectedRegion}
            markers={regionalArticles}
            onAdd={addArticle}
            onRemove={removeArticle}
            onFocus={focusArticle}
          />
        )}
      </div>
      <button
        className="dock-toggle dock-toggle-right"
        aria-label={
          rightCollapsed ? "Show workspace panel" : "Hide workspace panel"
        }
        aria-expanded={!rightCollapsed}
        aria-controls="workspace-dock"
        title={rightCollapsed ? "Show workspace panel" : "Hide workspace panel"}
        onClick={() => setRightCollapsed((previous) => !previous)}
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          aria-hidden="true"
        >
          <path d={rightCollapsed ? "m15 6-6 6 6 6" : "m9 6 6 6-6 6"} />
        </svg>
      </button>
      <div
        className="right-dock"
        id="workspace-dock"
        inert={isDesktop && rightCollapsed}
      >
        {mode === "analyze" && (
          <AnalysisPanel
            region={selectedRegion}
            story={contextStory ?? null}
            time={timeline.time}
            startYear={timeline.startYear}
            endYear={timeline.endYear}
            onSelectStory={selectStory}
            onShowYear={timeline.seek}
            onRefocus={selectRegion}
            onAskAI={openAssistant}
            showMarkers={showStoryMarkers}
            onShowMarkersChange={setShowStoryMarkers}
            overlaySettings={overlaySettings}
            onUpdateOverlay={updateOverlay}
            reading={regionalReading}
          />
        )}
        {mode === "forecast" && selectedRegion?.waterMonitoring && (
          <ForecastPanel region={selectedRegion} />
        )}
        {mode === "ai" && (
          <AssistantPanel
            key={conversationKey}
            region={selectedRegion}
            year={observationYear}
            startYear={timeline.startYear}
            endYear={timeline.endYear}
            messages={conversations[conversationKey] ?? EMPTY_MESSAGES}
            isAsking={isAsking}
            onAsk={askQuestion}
          />
        )}
      </div>
      <Timeline
        {...timeline}
        togglePlayback={() => timeline.togglePlayback(Boolean(contextStory))}
      />
      <MapCaption selectedRegion={selectedRegion} onRefocus={selectRegion} />
      <footer className="map-footer">
        <span>
          DRAG TO EXPLORE <b>·</b> SCROLL TO ZOOM
        </span>
        <span>REAL IMAGERY · SOURCED STORIES · EARTH AI</span>
      </footer>
    </main>
  );
}
