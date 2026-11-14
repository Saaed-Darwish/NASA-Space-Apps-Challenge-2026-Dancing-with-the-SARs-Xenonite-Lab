import {
  indicators,
  type Indicator,
  type RegionalReading,
  type OverlaySettings,
} from "../data/demo";
import RegionalSnapshot from "./RegionalSnapshot";

interface LayerPanelProps {
  observationYear: number;
  selectedIndicator: Indicator;
  onSelectIndicator: (indicator: Indicator) => void;
  overlaySettings: OverlaySettings;
  onUpdateOverlay: (
    indicator: Indicator,
    changes: Partial<OverlaySettings[Indicator]>,
  ) => void;
  reading: RegionalReading | null;
}

const INDICATOR_ORDER: Indicator[] = ["land", "water", "fire"];

export default function LayerPanel({
  observationYear,
  selectedIndicator,
  onSelectIndicator,
  overlaySettings,
  onUpdateOverlay,
  reading,
}: LayerPanelProps) {
  const activeLayer = indicators[selectedIndicator];
  const legendBackground = `linear-gradient(90deg, ${activeLayer.colors.join(",")})`;

  return (
    <section className="layer-panel panel" aria-label="Observation layers">
      <div className="eyebrow">OBSERVATION LAYERS</div>
      <h2>Read the surface</h2>
      <p className="muted">Three perspectives. One living planet.</p>

      <div className="overlay-toggles" aria-label="Visible overlays">
        {INDICATOR_ORDER.map((indicator) => (
          <label key={indicator}>
            <span>
              <i style={{ background: indicators[indicator].color }} />
              {indicators[indicator].name}
            </span>
            <input
              type="checkbox"
              style={{ accentColor: indicators[indicator].color }}
              aria-label={`Show ${indicators[indicator].short.toLowerCase()} overlay`}
              checked={overlaySettings[indicator].enabled}
              onChange={(event) =>
                onUpdateOverlay(indicator, { enabled: event.target.checked })
              }
            />
          </label>
        ))}
      </div>
      <p className="muted small">Combine overlays. Select a tab for details.</p>
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
        Layer opacity <span>{overlaySettings[selectedIndicator].opacity}%</span>
      </label>
      <input
        id="opacity"
        type="range"
        min="15"
        max="90"
        value={overlaySettings[selectedIndicator].opacity}
        onChange={(event) =>
          onUpdateOverlay(selectedIndicator, {
            opacity: Number(event.target.value),
          })
        }
      />

      <RegionalSnapshot
        layer={activeLayer}
        reading={reading}
        observationYear={observationYear}
      />
    </section>
  );
}
