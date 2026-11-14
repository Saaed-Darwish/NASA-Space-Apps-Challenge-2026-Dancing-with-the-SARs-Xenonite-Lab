import { LAST_IMAGERY_YEAR } from "../data/imagery";
import type { IndicatorDefinition, RegionalReading } from "../data/demo";

interface RegionalSnapshotProps {
  observationYear: number;
  layer: IndicatorDefinition;
  reading: RegionalReading | null;
}

const CHART_WIDTH = 264;
const CHART_HEIGHT = 80;
const TREND_POINT_SPACING = 24;

export default function RegionalSnapshot({
  observationYear,
  layer,
  reading,
}: RegionalSnapshotProps) {
  // Demo trends contain SVG y coordinates, not physical measurements.
  const trendPoints = reading?.trend.map((height, index) => ({
    x: index * TREND_POINT_SPACING,
    y: height,
  }));
  const linePoints = trendPoints?.map(({ x, y }) => `${x},${y}`).join(" ");
  const areaPoints = trendPoints?.map(({ x, y }) => `${x} ${y}`).join(" L ");
  const areaPath = `M 0 ${CHART_HEIGHT} L ${areaPoints} L ${CHART_WIDTH} ${CHART_HEIGHT} Z`;

  return (
    <div className="reading">
      <div className="section-label">
        REGIONAL SNAPSHOT / {observationYear} <span>MOCK</span>
      </div>
      <div className="reading-value">
        {reading?.value ?? "—"} <span>{reading?.unit}</span>
      </div>
      <p>{reading?.context ?? "Select a study area"}</p>
      {reading && (
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          role="img"
          aria-label={`Illustrative ${layer.name.toLowerCase()} trend; synthetic values`}
        >
          <defs>
            <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={layer.color} stopOpacity=".3" />
              <stop offset="1" stopColor={layer.color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#chart-fill)" />
          <polyline
            points={linePoints}
            fill="none"
            stroke={layer.color}
            strokeWidth="2"
          />
        </svg>
      )}
      <div className="legend-labels">
        <span>ILLUSTRATIVE TREND</span>
        <span>2020 – {LAST_IMAGERY_YEAR}</span>
      </div>
    </div>
  );
}
