import ChartLegend from "./ChartLegend";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import type { Region } from "../types/region";
import type { SarDataset, SarObservation } from "../data/sar";
import {
  loadSubsidenceForecast,
  subsidencePlot,
  type SubsidenceForecast,
} from "../data/subsidenceForecast";

const number = (v: number) =>
  v.toLocaleString(undefined, { maximumFractionDigits: 2 });
export default function SubsidenceForecastPanel({
  region,
  dataset,
  children,
  onSelectObservation,
  initialPointId,
}: {
  region: Region;
  dataset: SarDataset;
  children?: ReactNode;
  onSelectObservation?: (row: SarObservation | null) => void;
  initialPointId?: string;
}) {
  const [pointId, setPointId] = useState(
    dataset.points.some((p) => p.id === initialPointId)
      ? initialPointId!
      : (dataset.points[0]?.id ?? ""),
  );
  const [data, setData] = useState<SubsidenceForecast | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [full, setFull] = useState(false);
  const [month, setMonth] = useState("");
  useEffect(() => {
    let disposed = false;
    const controller = new AbortController(),
      timer = window.setTimeout(() => controller.abort(), 15000);
    setData(null);
    setError("");
    setMonth("");
    onSelectObservation?.(null);
    loadSubsidenceForecast(dataset, pointId, controller.signal)
      .then((value) => {
        if (!disposed) {
          setData(value);
          onSelectObservation?.(value.selectedObservation);
        }
      })
      .catch((e) => {
        if (!disposed)
          setError(
            e instanceof Error
              ? e.message
              : "Subsidence forecast could not load.",
          );
      })
      .finally(() => window.clearTimeout(timer));
    return () => {
      disposed = true;
      controller.abort();
      window.clearTimeout(timer);
      onSelectObservation?.(null);
    };
  }, [dataset, pointId, retry, onSelectObservation]);
  const point = dataset.points.find((p) => p.id === pointId);
  const forecast = data?.pointId === pointId ? data : null;
  const selected =
    forecast?.forecast.find((r) => r.month === month) ?? forecast?.forecast[0];
  const plot = useMemo(
    () => (forecast ? subsidencePlot(forecast, full) : null),
    [forecast, full],
  );
  return (
    <section
      className="workspace-panel forecast-panel panel"
      aria-label="Subsidence forecast"
      data-kind="subsidence"
    >
      <div className="workspace-title">
        <div>
          <span className="eyebrow">POINT VERTICAL DISPLACEMENT</span>
          <h2>Forecast</h2>
        </div>
        <span className="mock-pill">EXPLORATORY</span>
      </div>
      <div className="context-strip">
        {region.name}
        <span>{region.country}</span>
      </div>
      {children}
      <label className="sar-field">
        Measurement point
        <select value={pointId} onChange={(e) => setPointId(e.target.value)}>
          {dataset.points.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name ?? p.id}
              {p.areaLabel ? ` · ${p.areaLabel}` : ""}
            </option>
          ))}
        </select>
      </label>
      <p className="small sar-hash">Original point ID: {point?.id}</p>
      {point?.areaLabel && (
        <p className="small muted">
          Source area label: {point.areaLabel}. Area names are approximate; the
          pin uses the supplied coordinates.
        </p>
      )}
      <p className="small muted">
        The pink map pin follows this measurement point. Values describe one
        EGMS grid sample.
      </p>
      {!forecast && !error && <p role="status">Loading point forecast…</p>}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button
            className="text-button"
            onClick={() => setRetry((v) => v + 1)}
          >
            Retry subsidence forecast
          </button>
        </div>
      )}
      {forecast && selected && plot && (
        <>
          <p className="muted">
            24 monthly predictions, {forecast.forecast[0].month}–
            {forecast.forecast.at(-1)!.month}. Negative millimetres mean
            downward displacement relative to the original EGMS reference.
          </p>
          <p className="forecast-caveat">
            Forecast origin: {forecast.lastAcquisition.slice(0, 7)}. This export
            has not been updated with newer observations. Shading shows
            approximate nominal 95% prediction ranges with unverified coverage.
          </p>
          {!forecast.backtest.beatNaive && (
            <p className="forecast-caveat">
              This point's selected model did not beat the “stay at the last
              reading” baseline in the notebook's development test. Interpret
              its forecast with extra caution.
            </p>
          )}
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
          <div className="sar-value">{number(selected.mean)} mm</div>
          <p className="small">
            {selected.month} · Approximate range {number(selected.lower)} to{" "}
            {number(selected.upper)} mm. Prediction for the first day of the
            month.
          </p>
          <div className="sar-chart forecast-chart">
            <svg
              viewBox="0 0 450 185"
              role="img"
              aria-label="Selected point's measured vertical displacement and forecast with approximate prediction ranges. Values are in millimetres; negative is downward. Tables below provide all values."
            >
              <line x1="42" x2="427" y1="148" y2="148" className="sar-axis" />
              <text x="0" y="20">
                {number(plot.max)}
              </text>
              <text x="0" y="148">
                {number(plot.min)}
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
              {plot.history.map((r) => (
                <circle
                  key={r.date}
                  cx={r.x}
                  cy={r.y}
                  r={r.flagged ? 4 : 1.5}
                  className={r.flagged ? "forecast-special" : "sar-dot"}
                >
                  <title>
                    {r.date}: {number(r.mm)} mm
                    {r.flagged ? " · flagged residual anomaly" : ""}
                  </title>
                </circle>
              ))}
              {plot.future.map((r) => (
                <circle
                  key={r.month}
                  cx={r.x}
                  cy={r.y}
                  r={r.month === selected.month ? 4.5 : 2}
                  className="forecast-dot"
                >
                  <title>
                    {r.month}: {number(r.mean)} mm ({number(r.lower)} to{" "}
                    {number(r.upper)})
                  </title>
                </circle>
              ))}
              <text x="42" y="174">
                {plot.history[0].date.slice(0, 7)}
              </text>
              <text x="427" y="174" textAnchor="end">
                {plot.future.at(-1)!.month}
              </text>
            </svg>
          </div>
          <ChartLegend kind="subsidence" />
          <button
            className="text-button"
            aria-pressed={full}
            onClick={() => setFull((v) => !v)}
          >
            {full ? "Show recent 3 years" : "Show all historical readings"}
          </button>
          <dl className="sar-metrics">
            <div>
              <dt>Average fitted velocity</dt>
              <dd>{number(forecast.velocity.estimate)} mm/year</dd>
            </div>
            <div>
              <dt>Published EGMS velocity</dt>
              <dd>{number(forecast.publishedVelocity)} mm/year</dd>
            </div>
            <div>
              <dt>History through</dt>
              <dd>{forecast.lastAcquisition}</dd>
            </div>
            <div>
              <dt>Flagged readings</dt>
              <dd>{forecast.history.filter((r) => r.flagged).length}</dd>
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
                  Point displacement in mm, original reference retained
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
                      <td className="numeric-cell">{number(r.mean)}</td>
                      <td className="numeric-cell">{number(r.lower)}</td>
                      <td className="numeric-cell">{number(r.upper)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <details className="sar-details">
            <summary>Observed history &amp; flags</summary>
            <div
              className="sar-table-scroll forecast-table forecast-history"
              role="region"
              aria-label="Observed history table"
              tabIndex={0}
            >
              <table>
                <caption>
                  Original point's {forecast.history.length} readings, rounded
                  to export precision
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col" className="numeric-cell">
                      mm
                    </th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {forecast.history.map((r) => (
                    <tr key={r.date}>
                      <td>{r.date}</td>
                      <td className="numeric-cell">{number(r.mm)}</td>
                      <td>{r.flagged ? "Flagged residual" : "Observed"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <details className="sar-details">
            <summary>Model &amp; development test</summary>
            <p className="small">
              {forecast.model}. Fitted average velocity range:{" "}
              {forecast.velocity.ci95.map(number).join(" to ")} mm/year.
              Acceleration estimate: {number(forecast.acceleration.estimate)}{" "}
              mm/year² ({forecast.acceleration.ci95.map(number).join(" to ")});
              this parameter is not proof of future acceleration.
            </p>
            <p className="small">
              Held-out final year: model mean absolute error{" "}
              {number(forecast.backtest.mae_model)} mm; last-reading baseline{" "}
              {number(forecast.backtest.mae_naive)} mm. The same test selected
              the model, so these are development results, not independent
              accuracy estimates. Published EGMS velocity is a consistency
              comparison using the same source.
            </p>
          </details>
          <details className="sar-details">
            <summary>Limitations &amp; provenance</summary>
            <ul className="small">
              {forecast.limitations.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
            <p className="small">{forecast.provenanceNote}</p>
            <p className="small">
              Export: {forecast.sourceFile} · Generated{" "}
              {forecast.generatedLabel}; timezone not supplied.
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
        The map remains historical imagery. Forecasting one measurement point
        does not create a citywide subsidence surface or assess building safety.
      </p>
    </section>
  );
}
