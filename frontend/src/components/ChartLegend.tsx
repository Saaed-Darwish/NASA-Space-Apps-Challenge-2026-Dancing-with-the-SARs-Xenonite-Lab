type KeyStyle = "line" | "dashed" | "band" | "square" | "ring" | "dot" | "bar";
const items: Record<string, [KeyStyle, string][]> = {
  water: [
    ["line", "Monthly history"],
    ["dashed", "Forecast"],
    ["band", "Approx. range"],
    ["square", "Imputed"],
    ["ring", "Flagged / partial"],
  ],
  forest: [
    ["dot", "Measured VH"],
    ["line", "Fitted expectation"],
    ["bar", "Approx. range"],
    ["ring", "Flagged anomaly"],
  ],
  subsidence: [
    ["line", "Measured history"],
    ["dashed", "Forecast"],
    ["band", "Approx. range"],
    ["ring", "Residual anomaly"],
  ],
};
export default function ChartLegend({
  kind,
}: {
  kind: "water" | "forest" | "subsidence";
}) {
  return (
    <ul className="chart-legend" aria-label="Chart legend">
      {items[kind].map(([style, label]) => (
        <li key={label}>
          <i className={`chart-key chart-key-${style}`} aria-hidden="true" />
          {label}
        </li>
      ))}
    </ul>
  );
}
