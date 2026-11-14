import { indicators, type Indicator, type RegionalReading } from "../data/demo";
import RegionalSnapshot from "./RegionalSnapshot";

interface LayerPanelProps {
  selectedIndicator: Indicator;
  onSelectIndicator: (indicator: Indicator) => void;
  isOverlayVisible: boolean;
  onOverlayVisibilityChange: (isVisible: boolean) => void;
  overlayOpacity: number;
  onOverlayOpacityChange: (opacity: number) => void;
  reading: RegionalReading | null;
}

const INDICATOR_ORDER: Indicator[] = ["land", "water", "fire"];

export default function LayerPanel({
  selectedIndicator,
  onSelectIndicator,
  isOverlayVisible,
  onOverlayVisibilityChange,
  overlayOpacity,
  onOverlayOpacityChange,
  reading,
}: LayerPanelProps) {
  const activeLayer = indicators[selectedIndicator];
  const legendBackground = `linear-gradient(90deg, ${activeLayer.colors.join(",")})`;

  return (
    <section className="layer-panel panel" aria-label="Observation layers">
      <div className="eyebrow">OBSERVATION LAYERS</div>
      <h2>Read the surface</h2>
      <p className="muted">Three perspectives. One living planet.</p>

      <div className="layer-tabs">
        {INDICATOR_ORDER.map((indicator) => (
          <button
            key={indicator}
            aria-pressed={selectedIndicator === indicator}
            onClick={() => onSelectIndicator(indicator)}
            className={selectedIndicator === indicator ? "selected" : ""}
          >
            <span style={{ background: indicators[indicator].color }} />
            {indicators[indicator].short}
          </button>
        ))}
      </div>

      <div className="layer-title">
        <h3>{activeLayer.name}</h3>
        <label className="toggle">
          <input
            type="checkbox"
            checked={isOverlayVisible}
            onChange={(event) =>
              onOverlayVisibilityChange(event.target.checked)
            }
          />
          <span>Show layer</span>
        </label>
      </div>
      <p className="muted small">{activeLayer.description}</p>

      <div
        className="legend-gradient"
        style={{ background: legendBackground }}
      />
      <div className="legend-labels">
        <span>{activeLayer.low}</span>
        <span>{activeLayer.high}</span>
      </div>
      <div className="legend-ticks">
        {activeLayer.values.map((value) => (
          <span key={value}>{value}</span>
        ))}
      </div>
      <p className="unit-label">{activeLayer.unit} · illustrative scale</p>

      <label className="opacity-label" htmlFor="opacity">
        Layer opacity <span>{overlayOpacity}%</span>
      </label>
      <input
        id="opacity"
        type="range"
        min="15"
        max="90"
        value={overlayOpacity}
        onChange={(event) => onOverlayOpacityChange(Number(event.target.value))}
      />

      <RegionalSnapshot layer={activeLayer} reading={reading} />
    </section>
  );
}
