import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import EarthGlobe from "./components/EarthGlobe";
import LayerPanel from "./components/LayerPanel";
import MapCaption from "./components/MapCaption";
import RegionSidebar from "./components/RegionSidebar";
import Timeline from "./components/Timeline";
import StoryPanel from "./components/StoryPanel";
import AnalysisPanel from "./components/AnalysisPanel";
import AssistantPanel from "./components/AssistantPanel";
import ArticleSearch from "./components/ArticleSearch";
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
import { answerDemoQuestion, type AssistantMessage } from "./data/assistant";
import useTimeline from "./hooks/useTimeline";
import type { Region } from "./types/region";

type WorkspaceMode = "explore" | "analyze" | "ai";
const EMPTY_MESSAGES: AssistantMessage[] = [];

export default function App() {
  const timeline = useTimeline();
  const [mode, setMode] = useState<WorkspaceMode>("explore");
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
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(
    regions.find((region) => region.id === "nusantara") ?? regions[0],
  );
  const [selectedStory, setSelectedStory] = useState<RegionStory | null>(null);
  const [articles, setArticles] = useState<DiscoveredArticle[]>([]);
  const [selectedArticle, setSelectedArticle] =
    useState<DiscoveredArticle | null>(null);
  const [showStoryMarkers, setShowStoryMarkers] = useState(true);
  const [focusRequest, setFocusRequest] = useState(0);
  const [selectedIndicator, setSelectedIndicator] = useState<Indicator>("land");
  const [conversations, setConversations] = useState<
    Record<string, AssistantMessage[]>
  >({});
  const messageSequence = useRef(0);
  const leftDockRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<HTMLElement>(null);
  const [overlaySettings, setOverlaySettings] = useState<OverlaySettings>({
    land: { enabled: true, opacity: 65 },
    water: { enabled: true, opacity: 65 },
    fire: { enabled: true, opacity: 65 },
  });

  const activeLayer = indicators[selectedIndicator];
  const observationYear = Math.floor(timeline.time);
  const regionalReading = selectedRegion
    ? readingAtYear(
        readings[selectedRegion.id][selectedIndicator],
        selectedIndicator,
        timeline.time,
      )
    : null;
  const contextStory =
    selectedStory ??
    (selectedRegion ? storiesForRegion(selectedRegion.id)[0] : null);
  const conversationKey = selectedRegion?.id ?? "global";
  const themeStyle = { "--accent": activeLayer.color } as CSSProperties;

  const revealStories = useCallback(() => {
    setLeftCollapsed(false);
    const dock = leftDockRef.current;
    const story = dock?.querySelector<HTMLElement>(".story-panel");
    if (!dock || !story) return;
    if (window.matchMedia("(min-width: 1001px)").matches) {
      dock.scrollTo({ top: story.offsetTop, behavior: "smooth" });
    } else {
      story.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    if (selectedStory && mode === "explore") revealStories();
    if (
      mode !== "explore" &&
      window.matchMedia("(max-width: 1000px)").matches
    ) {
      appRef.current
        ?.querySelector(".workspace-panel")
        ?.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }, [selectedStory, focusRequest, mode, revealStories]);

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
    if (region?.id === "manchar") setSelectedIndicator("water");
    setSelectedRegion(region);
    setSelectedStory(null);
    setFocusRequest((previous) => previous + 1);
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
    setSelectedArticle(null);
    const region = regions.find((candidate) => candidate.id === story.regionId);
    if (!region) return;
    setSelectedRegion(region);
    setSelectedStory(story);
    setShowStoryMarkers(true);
    timeline.setComparisonRange(
      story.beforeYear,
      story.afterYear,
      story.firstYear,
    );
    setFocusRequest((previous) => previous + 1);
  }

  function compareStory(story: RegionStory) {
    selectStory(story);
    timeline.setComparisonRange(
      story.beforeYear,
      story.afterYear,
      story.beforeYear,
    );
    // A clean satellite comparison is the starting point; users can re-enable any layer.
    setOverlaySettings((previous) => ({
      land: { ...previous.land, enabled: false },
      water: { ...previous.water, enabled: false },
      fire: { ...previous.fire, enabled: false },
    }));
  }

  function askQuestion(question: string) {
    const text = question.trim().slice(0, 1000);
    if (!text) return;
    const answer = answerDemoQuestion(text, {
      region: selectedRegion,
      story: contextStory ?? null,
      startYear: timeline.startYear,
      endYear: timeline.endYear,
      year: observationYear,
      indicator: selectedIndicator,
      reading: selectedRegion
        ? readings[selectedRegion.id][selectedIndicator]
        : null,
    });
    const questionId = String(++messageSequence.current);
    const answerId = String(++messageSequence.current);
    setConversations((previous) => ({
      ...previous,
      [conversationKey]: [
        ...(previous[conversationKey] ?? []),
        { id: questionId, role: "user", text },
        { id: answerId, role: "assistant", ...answer, observationYear },
      ],
    }));
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
          {(["explore", "analyze", "ai"] as WorkspaceMode[]).map((view) => (
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
                  : "Explore"}
            </button>
          ))}
        </nav>
        <span className="demo-badge">REAL IMAGERY / DEMO ANALYSIS</span>
      </header>

      <button
        className="dock-toggle dock-toggle-left"
        aria-label={
          leftCollapsed
            ? "Show regions and stories"
            : "Hide regions and stories"
        }
        aria-expanded={!leftCollapsed}
        aria-controls="region-dock"
        title={
          leftCollapsed
            ? "Show regions and stories"
            : "Hide regions and stories"
        }
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
        <StoryPanel
          region={selectedRegion}
          year={observationYear}
          selectedStory={selectedStory}
          onSelectStory={selectStory}
          onCompare={compareStory}
          onAnalyze={() => {
            setMode("analyze");
            setRightCollapsed(false);
          }}
          onAskAI={openAssistant}
          showMarkers={showStoryMarkers}
          onShowMarkersChange={setShowStoryMarkers}
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
        {mode === "explore" && (
          <LayerPanel
            selectedIndicator={selectedIndicator}
            onSelectIndicator={setSelectedIndicator}
            overlaySettings={overlaySettings}
            onUpdateOverlay={updateOverlay}
            reading={regionalReading}
            observationYear={observationYear}
          />
        )}
        {mode === "analyze" && (
          <AnalysisPanel
            region={selectedRegion}
            story={contextStory ?? null}
            year={observationYear}
            startYear={timeline.startYear}
            endYear={timeline.endYear}
            onSelectStory={selectStory}
            onCompare={compareStory}
            onShowYear={timeline.seek}
            onAskAI={openAssistant}
          />
        )}
        {mode === "ai" && (
          <AssistantPanel
            key={conversationKey}
            region={selectedRegion}
            year={observationYear}
            startYear={timeline.startYear}
            endYear={timeline.endYear}
            messages={conversations[conversationKey] ?? EMPTY_MESSAGES}
            onAsk={askQuestion}
          />
        )}
      </div>
      <Timeline {...timeline} />
      <MapCaption selectedRegion={selectedRegion} onRefocus={selectRegion} />
      <footer className="map-footer">
        <span>
          DRAG TO EXPLORE <b>·</b> SCROLL TO ZOOM
        </span>
        <span>REAL IMAGERY · SOURCED STORIES · MOCK METRICS & AI</span>
      </footer>
    </main>
  );
}
