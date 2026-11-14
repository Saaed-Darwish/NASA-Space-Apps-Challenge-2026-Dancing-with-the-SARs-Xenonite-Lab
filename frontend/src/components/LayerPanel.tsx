import {
  indicators,
  type Indicator,
  type RegionalReading,
  type OverlaySettings,
} from "../data/demo";
import RegionalSnapshot from "./RegionalSnapshot";
import type { Region } from "../types/region";

interface LayerPanelProps {
  embedded?: boolean;
  observationYear: number;
  region: Region | null;
  overlaySettings: OverlaySettings;
  onUpdateOverlay: (
    indicator: Indicator,
    changes: Partial<OverlaySettings[Indicator]>,
  ) => void;
  reading: RegionalReading | null;
}

const INDICATOR_ORDER: Indicator[] = ["water"];

export default function LayerPanel({
  observationYear,
  region,
  overlaySettings,
  onUpdateOverlay,
  reading,
  embedded = false,
}: LayerPanelProps) {
  const selectedIndicator = "water";
  const activeLayer = indicators.water;
  const pending = region?.floodDataStatus === "processing";
  const legendBackground = `linear-gradient(90deg, ${activeLayer.colors.join(",")})`;

  return (
    <section
      className={embedded ? "water-analysis-section" : "layer-panel panel"}
      aria-label="Observation layers"
    >
      <div className="eyebrow">WATER & FLOOD MONITORING</div>
      <h2>Follow the water</h2>
      <p className="muted">Explore water extent and flood context.</p>

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
              disabled={pending || !region}
              checked={
                !pending && !!region && overlaySettings[indicator].enabled
              }
              onChange={(event) =>
                onUpdateOverlay(indicator, { enabled: event.target.checked })
              }
            />
          </label>
        ))}
      </div>
      {pending && (
        <div className="data-status" role="status">
          <strong>Flood data processing</strong>
          <p>
            {region.name}: the backend team is parsing flood data. Measured
            extent, dates, and statistics will appear when connected.
          </p>
          <p>
            The satellite archive remains available. No simulated flood
            footprint is shown for this region.
          </p>
        </div>
      )}
      {!pending && (
        <p className="muted small">
          Illustrative water overlay · not a measured flood boundary.
        </p>
      )}
      {!pending && region && (
        <>
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
            Layer opacity{" "}
            <span>{overlaySettings[selectedIndicator].opacity}%</span>
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
        </>
      )}
      {!region && (
        <p className="muted">
          Zoom into a study area or select a region to explore water change.
        </p>
      )}
    </section>
  );
}
