import { useState, type CSSProperties } from "react";
import EarthGlobe from "./components/EarthGlobe";
import LayerPanel from "./components/LayerPanel";
import MapCaption from "./components/MapCaption";
import RegionSidebar from "./components/RegionSidebar";
import {
  indicators,
  readings,
  regions,
  type Indicator,
  type OverlaySettings,
} from "./data/demo";
import { readingAtYear } from "./data/history";
import Timeline from "./components/Timeline";
import useTimeline from "./hooks/useTimeline";
import type { Region } from "./types/region";

export default function App() {
  const timeline = useTimeline();
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(
    regions[0],
  );
  const [focusRequest, setFocusRequest] = useState(0);
  const [selectedIndicator, setSelectedIndicator] = useState<Indicator>("land");
  const [overlaySettings, setOverlaySettings] = useState<OverlaySettings>({
    land: { enabled: true, opacity: 65 },
    water: { enabled: true, opacity: 65 },
    fire: { enabled: true, opacity: 65 },
  });

  function updateOverlay(
    indicator: Indicator,
    changes: Partial<OverlaySettings[Indicator]>,
  ) {
    setOverlaySettings((previous) => ({
      ...previous,
      [indicator]: { ...previous[indicator], ...changes },
    }));
  }

  const activeLayer = indicators[selectedIndicator];
  const regionalReading = selectedRegion
    ? readingAtYear(
        readings[selectedRegion.id][selectedIndicator],
        selectedIndicator,
        timeline.time,
      )
    : null;
  const themeStyle = { "--accent": activeLayer.color } as CSSProperties;

  function selectRegion(region: Region | null) {
    setSelectedRegion(region);
    // A separate request lets repeated clicks restore the same camera view.
    setFocusRequest((previousRequest) => previousRequest + 1);
  }

  return (
    <main className="app-shell" style={themeStyle}>
      <EarthGlobe
        regions={regions}
        selectedRegion={selectedRegion}
        onSelectRegion={selectRegion}
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
        <div className="header-center">
          <span className="status-dot" /> SURFACE INTELLIGENCE EXPLORER
        </div>
        <span className="demo-badge">HISTORICAL IMAGERY / MOCK INDICATORS</span>
      </header>

      <RegionSidebar
        regions={regions}
        selectedRegion={selectedRegion}
        onSelectRegion={selectRegion}
      />
      <LayerPanel
        selectedIndicator={selectedIndicator}
        onSelectIndicator={setSelectedIndicator}
        overlaySettings={overlaySettings}
        onUpdateOverlay={updateOverlay}
        reading={regionalReading}
        observationYear={Math.floor(timeline.time)}
      />
      <Timeline {...timeline} />
      <MapCaption selectedRegion={selectedRegion} onRefocus={selectRegion} />

      <footer className="map-footer">
        <span>
          DRAG TO EXPLORE <b>·</b> SCROLL TO ZOOM
        </span>
        <span>REAL ANNUAL IMAGERY · SIMULATED CHANGE INDICATORS</span>
      </footer>
    </main>
  );
}
