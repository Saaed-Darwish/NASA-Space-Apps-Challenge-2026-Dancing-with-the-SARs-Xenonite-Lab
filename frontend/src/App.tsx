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
import { sarDatasets, type SarObservation } from "./data/sar";
import { dateToTimelineTime } from "./data/observationTime";
import type { WaterLayerSelection } from "./data/waterChanges";
import { FIRST_YEAR, LAST_IMAGERY_YEAR } from "./data/imagery";
import { storyMarkerOpacity } from "./data/storyTimeline";
import type {
  ArticleSearchArea,
  DiscoveredArticle,
} from "./data/articleSearch";
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
import { placeQuery, searchPlaces } from "./data/earthCommands";
import { askEarthAI } from "./data/earthAI";
import useTimeline from "./hooks/useTimeline";
import type { Region } from "./types/region";

type WorkspaceMode = "analyze" | "forecast" | "ai";
const EMPTY_MESSAGES: AssistantMessage[] = [];

export default function App() {
  const timeline = useTimeline();
  const showObservationBasemap = useCallback(
    (year: number) => {
      timeline.setComparisonRange(FIRST_YEAR, LAST_IMAGERY_YEAR, year);
      timeline.syncObservationTime(year);
    },
    [timeline.setComparisonRange, timeline.syncObservationTime],
  );
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
  const [datasetId, setDatasetId] = useState<string | null>(null);
  const [observation, setObservation] = useState<SarObservation | null>(null);
  const [waterLayer, setWaterLayer] = useState<WaterLayerSelection | null>(
    null,
  );
  const showComparisonDate = useCallback(
    (date: string) => {
      setSelectedStory(null);
      const time = dateToTimelineTime(date, FIRST_YEAR, LAST_IMAGERY_YEAR);
      if (time !== null)
        timeline.setComparisonRange(FIRST_YEAR, LAST_IMAGERY_YEAR, time);
    },
    [timeline.setComparisonRange],
  );
  const observationId = observation?.id;
  const selectObservation = useCallback(
    (row: SarObservation | null, syncTimeline = false) => {
      setObservation(row);
      if (!row || !syncTimeline) return;
      timeline.pause();
      const time = dateToTimelineTime(
        row.date,
        timeline.startYear,
        timeline.endYear,
      );
      if (time !== null) timeline.syncObservationTime(time);
    },
    [
      timeline.startYear,
      timeline.endYear,
      timeline.syncObservationTime,
      timeline.pause,
    ],
  );
  const regionDatasets = useMemo(
    () => sarDatasets.filter((d) => d.regionId === selectedRegion?.id),
    [selectedRegion?.id],
  );
  const activeDataset =
    regionDatasets.find((d) => d.id === datasetId) ?? regionDatasets[0] ?? null;
  const selectDataset = useCallback((id: string) => {
    setDatasetId(id);
    setObservation(null);
  }, []);
  useEffect(() => {
    setObservation(null);
  }, [activeDataset?.id]);
  const firstStoryPlayPending = useRef(false);
  const [articles, setArticles] = useState<DiscoveredArticle[]>([]);
  const [viewportArea, setViewportArea] = useState<ArticleSearchArea | null>(
    null,
  );
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
  const conversationKey = "earth-chat";
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
    setObservation((previous) =>
      region?.datasetIds?.some((id) => previous?.id.startsWith(`${id}:`))
        ? previous
        : null,
    );
    setSelectedArticle(null);
    setSelectedRegion(region);
    setMode((previous) =>
      !region && previous === "forecast" ? "analyze" : previous,
    );
    setSelectedStory(null);
    setFocusRequest((previous) => previous + 1);
  }, []);

  const focusVisibleRegion = useCallback((region: Region | null) => {
    setObservation(null);
    setSelectedRegion(region);
    setMode((previous) =>
      !region && previous === "forecast" ? "analyze" : previous,
    );
    setSelectedArticle(null);
    setSelectedStory(null);
  }, []);

  const regionalArticles = useMemo(
    () =>
      selectedRegion
        ? articles.filter(
            (article) =>
              article.regionId === selectedRegion.id ||
              article.regionId === "earth-search",
          )
        : articles,
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

  const focusSearchPlace = useCallback(
    (place: DiscoveredArticle) => {
      setSelectedRegion(null);
      setObservation(null);
      setWaterLayer(null);
      setSelectedStory(null);
      setSelectedArticle(place);
      setFocusRequest((value) => value + 1);
      timeline.pause();
      addArticle(place);
    },
    [addArticle, timeline.pause],
  );

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
    firstStoryPlayPending.current = true;
    setShowStoryMarkers(true);
    timeline.setComparisonRange(
      story.beforeYear,
      story.afterYear,
      story.firstYear,
    );
    setFocusRequest((previous) => previous + 1);
  }

  const askQuestion = useCallback(
    async (question: string) => {
      const text = question.trim().slice(0, 1000);
      if (!text || pendingRequest.current) return;
      pendingRequest.current = true;
      setIsAsking(true);
      const key = conversationKey;
      const questionId = String(++messageSequence.current);
      const answerId = String(++messageSequence.current);
      setConversations((previous) => ({
        ...previous,
        [key]: [
          ...(previous[key] ?? []).slice(-39),
          { id: questionId, role: "user", text },
        ],
      }));
      try {
        const query = placeQuery(text);
        let answer: Omit<AssistantMessage, "id" | "role">;
        if (query) {
          const places = await searchPlaces(query, AbortSignal.timeout(15000));
          if (places[0]) focusSearchPlace(places[0]);
          answer = {
            mode: "search",
            places,
            text: places.length
              ? `Pinned and zoomed to ${places[0].title}, the top location match. Choose another result below if needed. These reference locations do not imply SAR coverage.`
              : `No mapped location found for "${query}". Try adding the province, state or country.`,
            sources: places[0]
              ? [
                  {
                    title: places[0].title,
                    publisher: "Wikipedia / CC BY-SA",
                    url: places[0].url,
                  },
                ]
              : [],
          };
        } else
          answer = await askEarthAI({
            question: text,
            region_id: selectedRegion?.id,
            story_id: contextStory?.id,
            year: observationYear,
            start_year: timeline.startYear,
            end_year: timeline.endYear,
            dataset_id: activeDataset?.id,
            observation_id: observationId ?? undefined,
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
            ...(previous[key] ?? []).slice(-39),
            { id: answerId, role: "assistant", ...answer, observationYear },
          ],
        }));
      } catch (error) {
        setConversations((previous) => ({
          ...previous,
          [key]: [
            ...(previous[key] ?? []).slice(-39),
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
    },
    [
      selectedRegion,
      conversationKey,
      contextStory,
      observationYear,
      timeline.startYear,
      timeline.endYear,
      conversations,
      activeDataset,
      observationId,
      focusSearchPlace,
    ],
  );

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
        onSearchAreaChange={setViewportArea}
        studyArea={activeDataset?.bounds ?? null}
        waterLayer={
          mode === "analyze" &&
          waterLayer?.comparison.datasetId === activeDataset?.id
            ? waterLayer
            : null
        }
        dataset={activeDataset}
        observation={
          (mode === "analyze" ||
            (mode === "forecast" && activeDataset?.kind === "subsidence")) &&
          observation?.id.startsWith(`${activeDataset?.id}:`)
            ? observation
            : null
        }
        layoutKey={`${leftCollapsed}-${rightCollapsed}-${mode}`}
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
        <a className="brand" href="./" aria-label="EarthPulse home">
          <img
            className="brand-mark"
            src="/earthpulse.svg"
            width="36"
            height="36"
            alt=""
            aria-hidden="true"
          />
          <span className="brand-name">
            Earth<span>Pulse</span>
          </span>
        </a>
        <nav className="workspace-nav" aria-label="Main navigation">
          {(["analyze", "forecast", "ai"] as WorkspaceMode[])
            .filter((view) => view !== "forecast" || !!selectedRegion)
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
        <span className="demo-badge">
          {activeDataset
            ? "OPTICAL BASEMAP / SAR DATA"
            : "REAL IMAGERY / SOURCED STORIES"}
        </span>
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
        <ArticleSearch
          key={selectedRegion?.id ?? "viewport"}
          region={selectedRegion ?? viewportArea}
          markers={regionalArticles}
          onAdd={addArticle}
          onRemove={removeArticle}
          onFocus={focusArticle}
        />
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
            datasets={regionDatasets}
            dataset={activeDataset}
            onSelectDataset={selectDataset}
            onSelectObservation={selectObservation}
            timelineSelection={timeline.selection}
            onShowBasemap={showObservationBasemap}
            onWaterLayer={setWaterLayer}
            onCompareDate={showComparisonDate}
          />
        )}
        {mode === "forecast" && selectedRegion && (
          <ForecastPanel
            key={selectedRegion.id}
            region={selectedRegion}
            dataset={activeDataset}
            datasets={regionDatasets}
            onSelectDataset={selectDataset}
            onSelectObservation={setObservation}
            initialPointId={observation?.pointId ?? undefined}
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
            isAsking={isAsking}
            onAsk={askQuestion}
            onFocusPlace={focusSearchPlace}
          />
        )}
      </div>
      <Timeline
        {...timeline}
        linkedObservationDate={
          timeline.selection === null &&
          observation &&
          dateToTimelineTime(
            observation.date,
            timeline.startYear,
            timeline.endYear,
          ) !== null
            ? observation.date
            : null
        }
        togglePlayback={() => {
          const restartFromStart =
            Boolean(selectedStory) &&
            firstStoryPlayPending.current &&
            !timeline.isPlaying;
          if (restartFromStart) firstStoryPlayPending.current = false;
          timeline.togglePlayback(restartFromStart);
        }}
      />
      <MapCaption
        selectedRegion={selectedRegion}
        place={selectedArticle}
        onRefocusPlace={focusArticle}
        onRefocus={selectRegion}
      />
      <footer className="map-footer">
        <span>
          DRAG TO EXPLORE <b>·</b> SCROLL TO ZOOM
        </span>
        <span>REAL IMAGERY · SOURCED STORIES · EARTH AI</span>
      </footer>
    </main>
  );
}
