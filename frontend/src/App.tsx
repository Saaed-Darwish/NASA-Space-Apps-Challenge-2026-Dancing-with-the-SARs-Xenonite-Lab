import { useState, type CSSProperties } from "react";
import EarthGlobe from "./components/EarthGlobe";
import LayerPanel from "./components/LayerPanel";
import MapCaption from "./components/MapCaption";
import RegionSidebar from "./components/RegionSidebar";
import { indicators, readings, regions, type Indicator } from "./data/demo";
import type { Region } from "./types/region";

export default function App() {
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(
    regions[0],
  );
  const [focusRequest, setFocusRequest] = useState(0);
  const [selectedIndicator, setSelectedIndicator] = useState<Indicator>("land");
  const [isOverlayVisible, setIsOverlayVisible] = useState(true);
  const [overlayOpacity, setOverlayOpacity] = useState(65);

  const activeLayer = indicators[selectedIndicator];
  const regionalReading = selectedRegion
    ? readings[selectedRegion.id][selectedIndicator]
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
        indicator={selectedIndicator}
        showOverlay={isOverlayVisible}
        opacity={overlayOpacity}
      />

      <header className="app-header">
        <a className="brand" href="./">
          <span className="brand-mark">◉</span> Earth<span>Pulse</span>
        </a>
        <div className="header-center">
          <span className="status-dot" /> SURFACE INTELLIGENCE EXPLORER
        </div>
        <span className="demo-badge">SIMULATED DATA</span>
      </header>

      <RegionSidebar
        regions={regions}
        selectedRegion={selectedRegion}
        onSelectRegion={selectRegion}
      />
      <LayerPanel
        selectedIndicator={selectedIndicator}
        onSelectIndicator={setSelectedIndicator}
        isOverlayVisible={isOverlayVisible}
        onOverlayVisibilityChange={setIsOverlayVisible}
        overlayOpacity={overlayOpacity}
        onOverlayOpacityChange={setOverlayOpacity}
        reading={regionalReading}
      />
      <MapCaption selectedRegion={selectedRegion} onRefocus={selectRegion} />

      <footer className="map-footer">
        <span>
          DRAG TO EXPLORE <b>·</b> SCROLL TO ZOOM
        </span>
        <span>DEMO OVERLAYS · NO SATELLITE MEASUREMENTS</span>
      </footer>
    </main>
  );
}
