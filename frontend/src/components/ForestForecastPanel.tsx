import ChartLegend from "./ChartLegend";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import type { Region } from "../types/region";
import type { SarDataset } from "../data/sar";
import {
  forestForecastPlot,
  loadForestForecast,
  type ForestForecastResponse,
} from "../data/forestForecast";

const numeric = (v: number) =>
  v.toLocaleString(undefined, { maximumFractionDigits: 3 });
export default function ForestForecastPanel({
  region,
  dataset,
  children,
}: {
  region: Region;
  dataset: SarDataset;
  children?: ReactNode;
}) {
  const [data, setData] = useState<ForestForecastResponse | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [fullHistory, setFullHistory] = useState(false);
  const [month, setMonth] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    const timer = window.setTimeout(() => controller.abort(), 15000);
    setData(null);
    setError("");
    setMonth("");
    loadForestForecast(dataset, controller.signal)
      .then((v) => {
        if (!disposed) setData(v);
      })
      .catch((e) => {
        if (!disposed)
          setError(
            e instanceof Error ? e.message : "Forest forecast could not load.",
          );
      })
      .finally(() => window.clearTimeout(timer));
    return () => {
      disposed = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [dataset, retry]);
  const forecast = data?.status === "available" ? data : null;
  const plot = useMemo(
    () => (forecast ? forestForecastPlot(forecast, fullHistory) : null),
    [forecast, fullHistory],
  );
  const selected =
    forecast?.forecast.find((r) => r.month === month) ?? forecast?.forecast[0];
  return (
    <section
      className="workspace-panel forecast-panel panel"
      aria-label="Forest backscatter forecast"
      data-kind="forest"
    >
      <div className="workspace-title">
        <div>
          <span className="eyebrow">FOREST SAR INDICATOR</span>
          <h2>Forecast</h2>
        </div>
        <span className="mock-pill">EXPLORATORY</span>
      </div>
      <div className="context-strip">
        {region.name}
        <span>{region.country}</span>
      </div>
      {children}
      {!data && !error && <p role="status">Loading forest forecast…</p>}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button
            className="text-button"
            onClick={() => setRetry((v) => v + 1)}
          >
            Retry forest forecast
          </button>
        </div>
      )}
      {data?.status === "unavailable" && (
        <div role="status">
          <h3>No forecast for this dataset</h3>
          <p>{data.reason}</p>
        </div>
      )}
      {forecast && plot && selected && (
        <>
          <p className="muted">
            {forecast.target} (dB). {forecast.forecast.length} months,{" "}
            {forecast.forecast[0].month}–{forecast.forecast.at(-1)!.month}.
          </p>
          <p className="forecast-caveat">
            Research preview. Ranges are approximate nominal 95% prediction
            ranges with unverified coverage. Lower backscatter can be a
            candidate disturbance signal; it does not measure forest-loss area.
          </p>
          <label className="sar-field">
            Forecast month
            <select
              value={selected.month}
              onChange={(e) => setMonth(e.target.value)}
            >
              {forecast.forecast.map((r) => (
                <option key={r.month} value={r.month}>
                  {r.month}
                </option>
              ))}
            </select>
          </label>
          <div className="sar-value">{numeric(selected.mean)} dB</div>
          <p className="small">
            {selected.month} · Approximate range {numeric(selected.lower)}–
            {numeric(selected.upper)} dB
          </p>
          <div className="sar-chart forecast-chart">
            <svg
              viewBox="0 0 450 185"
              role="img"
              aria-label="Forest VH backscatter observations, fitted expected signal and forecast with approximate prediction ranges. Dates and values are in the tables below."
            >
              <line x1="42" x2="427" y1="148" y2="148" className="sar-axis" />
              <text x="0" y="20">
                {numeric(plot.max)}
              </text>
              <text x="0" y="148">
                {numeric(plot.min)}
              </text>
              <path d={plot.expectedLine} className="sar-line" />
              <line
                x1={plot.future[0].x}
                x2={plot.future[0].x}
                y1="16"
                y2="148"
                className="forecast-cutoff"
              />
              {plot.history.map((r) => (
                <circle
                  key={r.observationId}
                  cx={r.x}
                  cy={r.y}
                  r={r.flagged ? 4 : 2}
                  className={r.flagged ? "forecast-special" : "sar-dot"}
                >
                  <title>
                    {r.date}: {numeric(r.db)} dB; expected {numeric(r.expected)}
                    ; z {numeric(r.z)}
                    {r.flagged ? " · flagged candidate anomaly" : ""}
                  </title>
                </circle>
              ))}
              {plot.future.map((r) => (
                <g key={r.month}>
                  <line
                    x1={r.x}
                    x2={r.x}
                    y1={r.high}
                    y2={r.low}
                    className="forecast-line"
                  />
                  <circle
                    cx={r.x}
                    cy={r.y}
                    r={r.month === selected.month ? 4.5 : 2.5}
                    className="forecast-dot"
                  >
                    <title>
                      {r.month}: {numeric(r.mean)} dB ({numeric(r.lower)}–
                      {numeric(r.upper)})
                    </title>
                  </circle>
                </g>
              ))}
              <text x="42" y="174">
                {plot.history[0].date.slice(0, 7)}
              </text>
              <text x="427" y="174" textAnchor="end">
                {plot.future.at(-1)!.month}
              </text>
            </svg>
          </div>
          <ChartLegend kind="forest" />
          <p className="small muted">
            Calendar spacing is preserved; long gaps break the fitted line.
          </p>
          <button
            className="text-button"
            aria-pressed={fullHistory}
            onClick={() => setFullHistory((v) => !v)}
          >
            {fullHistory
              ? "Show recent 3 years"
              : "Show all historical readings"}
          </button>
          <dl className="sar-metrics">
            <div>
              <dt>Last acquisition</dt>
              <dd>{forecast.lastAcquisition} (partial month)</dd>
            </div>
            <div>
              <dt>Quality-passing readings</dt>
              <dd>{forecast.history.length}</dd>
            </div>
            <div>
              <dt>Flagged anomalies</dt>
              <dd>{forecast.history.filter((r) => r.flagged).length}</dd>
            </div>
            <div>
              <dt>Model evaluation</dt>
              <dd>Requires revalidation</dd>
            </div>
          </dl>
          <details className="sar-details" open>
            <summary>Forecast values &amp; ranges</summary>
            <div
              className="sar-table-scroll forecast-table forecast-values"
              role="region"
              aria-label="Forecast values and ranges"
              tabIndex={0}
            >
              <table>
                <caption>
                  Expected VH backscatter, dB; no area conversion
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Month</th>
                    <th scope="col" className="numeric-cell">
                      Mean
                    </th>
                    <th scope="col" className="numeric-cell">
                      Lower
                    </th>
                    <th scope="col" className="numeric-cell">
                      Upper
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {forecast.forecast.map((r) => (
                    <tr key={r.month}>
                      <td>{r.month}</td>
                      <td className="numeric-cell">{numeric(r.mean)}</td>
                      <td className="numeric-cell">{numeric(r.lower)}</td>
                      <td className="numeric-cell">{numeric(r.upper)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <details className="sar-details">
            <summary>VH history &amp; anomaly flags</summary>
            <div
              className="sar-table-scroll forecast-table forecast-history"
              role="region"
              aria-label="Observed history table"
              tabIndex={0}
            >
              <table>
                <caption>
                  Quality-passing acquisitions; flags are model diagnostics, not
                  confirmed forest loss
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col" className="numeric-cell">
                      VH dB
                    </th>
                    <th scope="col" className="numeric-cell">
                      Expected dB
                    </th>
                    <th scope="col" className="numeric-cell">
                      Robust z
                    </th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {forecast.history.map((r) => (
                    <tr key={r.observationId}>
                      <td>{r.date}</td>
                      <td className="numeric-cell">{numeric(r.db)}</td>
                      <td className="numeric-cell">{numeric(r.expected)}</td>
                      <td className="numeric-cell">{numeric(r.z)}</td>
                      <td>
                        {r.flagged
                          ? r.z < 0
                            ? "Flagged drop"
                            : "Flagged rise"
                          : "Within threshold"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <details className="sar-details">
            <summary>Model, limitations &amp; provenance</summary>
            <p className="small">{forecast.model}</p>
            <ul className="small">
              {forecast.limitations.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
            <p className="small">{forecast.provenanceNote}</p>
            <p className="small">
              Export: {forecast.sourceFile} · Generated{" "}
              {forecast.generatedLabel}. Timezone not supplied in the handoff.
            </p>
            <p className="small sar-hash">
              Forecast SHA-256: {forecast.artifactSha256}
              <br />
              Observations SHA-256: {forecast.sourceSha256}
            </p>
          </details>
        </>
      )}
      <p className="demo-explanation">
        The map remains historical imagery. This forecast describes a study-area
        radar signal and cannot locate future forest disturbance.
      </p>
    </section>
  );
}
