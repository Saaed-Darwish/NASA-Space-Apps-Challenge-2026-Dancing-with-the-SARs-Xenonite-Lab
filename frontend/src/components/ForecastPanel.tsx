import { useEffect, useMemo, useState } from "react";
import type { Region } from "../types/region";
import { sarDatasets } from "../data/sar";
import {
  forecastPlot,
  loadForecast,
  type ForecastResponse,
} from "../data/forecast";
const numeric = (v: number) =>
  v.toLocaleString(undefined, { maximumFractionDigits: 2 });

export default function ForecastPanel({ region }: { region: Region }) {
  const dataset =
    sarDatasets.find((d) => d.regionId === region.id && d.kind === "water") ??
    sarDatasets.find((d) => d.regionId === region.id);
  const [data, setData] = useState<ForecastResponse | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [fullHistory, setFullHistory] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState("");
  useEffect(() => {
    setData(null);
    setError("");
    setSelectedMonth("");
    if (!dataset) return;
    let disposed = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    loadForecast(dataset, controller.signal)
      .then((value) => {
        if (!disposed) setData(value);
      })
      .catch((e) => {
        if (!disposed)
          setError(e instanceof Error ? e.message : "Forecast could not load.");
      })
      .finally(() => window.clearTimeout(timeout));
    return () => {
      disposed = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [dataset, retry]);
  const forecast = data?.status === "available" ? data : null;
  const plot = useMemo(
    () => (forecast ? forecastPlot(forecast, fullHistory) : null),
    [forecast, fullHistory],
  );
  const selected =
    forecast?.forecast.find((r) => r.month === selectedMonth) ??
    forecast?.forecast[0];
  return (
    <section
      className="workspace-panel forecast-panel panel"
      aria-label="Water time-series forecast"
    >
      <div className="workspace-title">
        <div>
          <span className="eyebrow">MONTHLY SAR INDICATOR</span>
          <h2>Forecast</h2>
        </div>
        <span className="mock-pill">EXPLORATORY</span>
      </div>
      <div className="context-strip">
        {region.name}
        <span>{region.country}</span>
      </div>
      {!dataset && (
        <div className="forecast-empty" role="status">
          <h3>No forecast for this study area</h3>
          <p>
            Monthly forecast exports are available for Madeira River and Can
            Tho. Other regions need their own measured series and evaluated
            model.
          </p>
        </div>
      )}
      {dataset && !data && !error && (
        <p role="status">Loading monthly forecast…</p>
      )}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button
            className="text-button"
            onClick={() => setRetry((v) => v + 1)}
          >
            Retry forecast
          </button>
        </div>
      )}
      {data?.status === "unavailable" && (
        <div className="forecast-empty" role="status">
          <h3>No forecast for this dataset</h3>
          <p>{data.reason}</p>
        </div>
      )}
      {forecast && plot && selected && (
        <>
          <p className="muted">
            {forecast.target} ({forecast.unit}). {forecast.forecast.length}{" "}
            months, {forecast.forecast[0].month}–
            {forecast.forecast.at(-1)!.month}.
          </p>
          <p className="forecast-caveat">
            Research preview. Evaluation needs correction; these estimates are
            not flood warnings. Shading shows an approximate nominal 95% range
            with unverified coverage.
          </p>
          <label className="sar-field">
            Forecast month
            <select
              value={selected.month}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              {forecast.forecast.map((r) => (
                <option key={r.month} value={r.month}>
                  {r.month}
                </option>
              ))}
            </select>
          </label>
          <div className="sar-value">{numeric(selected.mean)} km²</div>
          <p className="small">
            {selected.month} · Approximate range {numeric(selected.lower)}–
            {numeric(selected.upper)} km²
          </p>
          <div className="sar-chart forecast-chart">
            <svg
              viewBox="0 0 450 185"
              role="img"
              aria-label="Monthly historical indicator and exploratory forecast with approximate ranges. Values and quality notes are available in the tables below."
            >
              <line x1="38" x2="432" y1="148" y2="148" className="sar-axis" />
              <text x="3" y="22">
                {numeric(plot.max)}
              </text>
              <text x="13" y="148">
                0
              </text>
              <polygon points={plot.band} className="forecast-band" />
              <path d={plot.observedLine} className="sar-line" />
              <path d={plot.forecastLine} className="forecast-line" />
              <line
                x1={plot.future[0].x}
                x2={plot.future[0].x}
                y1="16"
                y2="148"
                className="forecast-cutoff"
              />
              {plot.history.map((r) =>
                r.filled ? (
                  <rect
                    key={r.month}
                    x={r.x - 3}
                    y={r.y - 3}
                    width="6"
                    height="6"
                    className="forecast-imputed"
                  >
                    <title>
                      {r.month}: {numeric(r.value)} km² · interpolated; no
                      acquisitions
                    </title>
                  </rect>
                ) : (
                  <circle
                    key={r.month}
                    cx={r.x}
                    cy={r.y}
                    r={r.flagged || r.partial ? 3.5 : 1.8}
                    className={
                      r.flagged || r.partial ? "forecast-special" : "sar-dot"
                    }
                  >
                    <title>
                      {r.month}: {numeric(r.value)} km² · {r.observationCount}{" "}
                      acquisitions
                      {r.flagged ? " · flagged unusual indicator" : ""}
                      {r.partial ? " · partial month" : ""}
                    </title>
                  </circle>
                ),
              )}
              {plot.future.map((r) => (
                <circle
                  key={r.month}
                  cx={r.x}
                  cy={r.y}
                  r={r.month === selected.month ? 4.5 : 2}
                  className="forecast-dot"
                >
                  <title>
                    {r.month}: {numeric(r.mean)} ({numeric(r.lower)}–
                    {numeric(r.upper)}) km²
                  </title>
                </circle>
              ))}
              <text x="38" y="174">
                {plot.history[0].month}
              </text>
              <text x="432" y="174" textAnchor="end">
                {plot.future.at(-1)!.month}
              </text>
            </svg>
          </div>
          <p className="small forecast-legend">
            Solid: monthly history · Dashed: forecast · Shaded: approximate
            range · Squares: imputed · Rings: flagged or partial
          </p>
          <button
            className="text-button"
            aria-pressed={fullHistory}
            onClick={() => setFullHistory((v) => !v)}
          >
            {fullHistory
              ? "Show recent 36 historical months"
              : "Show all historical months"}
          </button>
          <dl className="sar-metrics">
            <div>
              <dt>History through</dt>
              <dd>{forecast.historyThrough} (partial)</dd>
            </div>
            <div>
              <dt>Last acquisition</dt>
              <dd>{forecast.lastAcquisition}</dd>
            </div>
            <div>
              <dt>Model evaluation</dt>
              <dd>Requires revalidation</dd>
            </div>
            <div>
              <dt>Interval coverage</dt>
              <dd>Not established</dd>
            </div>
          </dl>
          <p className="small muted">
            Observed history uses monthly acquisition means; imputed months have
            no observations. The final month is incomplete. The model fits a
            cleaned baseline, so unusual inundation may be suppressed.
          </p>
          <details className="sar-details" open>
            <summary>Forecast values &amp; ranges</summary>
            <div className="sar-table-wrap">
              <table>
                <caption>Exploratory monthly indicator, km²</caption>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Mean</th>
                    <th>Lower</th>
                    <th>Upper</th>
                  </tr>
                </thead>
                <tbody>
                  {forecast.forecast.map((r) => (
                    <tr key={r.month}>
                      <td>{r.month}</td>
                      <td>{numeric(r.mean)}</td>
                      <td>{numeric(r.lower)}</td>
                      <td>{numeric(r.upper)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <details className="sar-details">
            <summary>Monthly history &amp; quality</summary>
            <div className="sar-table-wrap">
              <table>
                <caption>
                  Monthly means, not sums or cumulative flood area
                </caption>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>km²</th>
                    <th>Records</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {forecast.history.map((r) => (
                    <tr key={r.month}>
                      <td>{r.month}</td>
                      <td>{numeric(r.value)}</td>
                      <td>{r.observationCount}</td>
                      <td>
                        {[
                          r.filled ? "Imputed" : "Observed",
                          r.flagged ? "Flagged unusual" : "",
                          r.partial ? "Partial" : "",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
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
              {forecast.generatedLabel}. Timezone: {forecast.generationTimezone}
              .
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
        The map remains historical optical imagery (2020–2025). A scalar monthly
        forecast cannot locate future inundation within the study area.
      </p>
    </section>
  );
}
