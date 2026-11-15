import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  dateToTimelineTime,
  nearestObservation,
  timelineDate,
  type TimelineSelection,
} from "../data/observationTime";
import {
  loadObservations,
  observationPlot,
  type SarDataset,
  type SarObservation,
} from "../data/sar";
import { FIRST_YEAR, LAST_IMAGERY_YEAR } from "../data/imagery";
import WaterChangePanel from "./WaterChangePanel";
import type { WaterLayerSelection } from "../data/waterChanges";

interface Props {
  dataset: SarDataset;
  datasets: SarDataset[];
  basemapYear: number;
  onSelectDataset: (id: string) => void;
  onSelectObservation: (
    observation: SarObservation | null,
    syncTimeline?: boolean,
  ) => void;
  timelineSelection: TimelineSelection | null;
  onShowBasemap: (year: number) => void;
  onWaterLayer: (layer: WaterLayerSelection | null) => void;
  onCompareDate: (date: string) => void;
}
const numeric = (v: number) =>
  v.toLocaleString(undefined, { maximumFractionDigits: 2 });

export default memo(function ObservationPanel({
  dataset,
  datasets,
  basemapYear,
  onSelectDataset,
  onSelectObservation,
  onShowBasemap,
  timelineSelection,
  onWaterLayer,
  onCompareDate,
}: Props) {
  const publishRef = useRef(onSelectObservation);
  useEffect(() => {
    publishRef.current = onSelectObservation;
  }, [onSelectObservation]);
  const [pointId, setPointId] = useState(dataset.points[0]?.id ?? "");
  const [includeRejected, setIncludeRejected] = useState(false);
  const [observations, setObservations] = useState<SarObservation[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [comparisonId, setComparisonId] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    setPlaying(false);
  }, [dataset.id, pointId, includeRejected]);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    let disposed = false;
    setStatus("loading");
    setObservations([]);
    publishRef.current(null);
    loadObservations(dataset, pointId, controller.signal)
      .then((rows) => {
        if (disposed) return;
        setObservations(rows);
        setSelectedId(
          [...rows].reverse().find((r) => r.qualityPass)?.id ??
            rows[rows.length - 1]?.id ??
            "",
        );
        setStatus("ready");
      })
      .catch((e) => {
        if (!disposed) {
          setError(
            e instanceof Error ? e.message : "Could not load observations.",
          );
          setStatus("error");
        }
      })
      .finally(() => window.clearTimeout(timeout));
    return () => {
      disposed = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [dataset, pointId, retry]);
  const visible = useMemo(
    () => observations.filter((r) => includeRejected || r.qualityPass),
    [observations, includeRejected],
  );
  const selected =
    visible.find((r) => r.id === selectedId) ?? visible[visible.length - 1];
  const index = selected ? visible.indexOf(selected) : -1;
  const comparison = visible.find((r) => r.id === comparisonId) ?? visible[0];
  const plot = useMemo(() => observationPlot(visible), [visible]);
  const point = dataset.points.find((p) => p.id === pointId);
  useEffect(() => {
    onSelectObservation(selected ?? null);
  }, [selected?.id, onSelectObservation]);
  useEffect(() => {
    if (!timelineSelection || status !== "ready") return;
    setPlaying(false);
    const nearest = nearestObservation(visible, timelineSelection, selectedId);
    if (nearest) setSelectedId(nearest.id);
    // A selection command runs once; manual acquisition changes do not echo it.
  }, [timelineSelection, visible, status]);
  useEffect(() => {
    if (!playing || status !== "ready") return;
    if (index >= visible.length - 1) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setSelectedId(visible[index + 1].id);
      onSelectObservation(visible[index + 1], true);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [playing, status, index, visible, onSelectObservation]);
  function chooseObservation(id: string) {
    setPlaying(false);
    setSelectedId(id);
    const row = visible.find((r) => r.id === id);
    if (row) onSelectObservation(row, true);
  }
  const year = selected ? Number(selected.date.slice(0, 4)) : null;
  return (
    <section
      className="sar-panel"
      aria-label="SAR observations"
      aria-busy={status === "loading"}
    >
      <div className="section-label">
        OBSERVATIONS{" "}
        <span className="sar-badge">
          {dataset.kind === "subsidence" ? "EGMS POINTS" : "EXPLORATORY"}
        </span>
      </div>
      <label className="sar-field">
        Dataset
        <select
          value={dataset.id}
          onChange={(e) => onSelectDataset(e.target.value)}
        >
          {datasets.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>
      <p className="small muted">
        {dataset.observationCount.toLocaleString()} records ·{" "}
        {dataset.startDate} to {dataset.endDate}. {dataset.qualityPassedCount}{" "}
        pass source quality checks; this does not establish classification
        accuracy.
      </p>
      {dataset.points.length > 0 && (
        <label className="sar-field">
          Measurement point
          <select value={pointId} onChange={(e) => setPointId(e.target.value)}>
            {dataset.points.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} · {numeric(p.velocity)} mm/year
              </option>
            ))}
          </select>
        </label>
      )}
      {dataset.kind === "water" && (
        <WaterChangePanel
          dataset={dataset}
          observationDate={selected?.date ?? null}
          comparisonDate={
            timelineSelection
              ? timelineDate(timelineSelection.time)
              : (selected?.date ?? null)
          }
          onLayer={onWaterLayer}
          onCompareDate={onCompareDate}
        />
      )}
      {dataset.qualityPassedCount < dataset.observationCount && (
        <label className="sar-quality">
          <input
            type="checkbox"
            checked={includeRejected}
            onChange={(e) => setIncludeRejected(e.target.checked)}
          />{" "}
          Include quality-rejected observations
        </label>
      )}
      {status === "loading" && <p role="status">Loading dated observations…</p>}
      {status === "error" && (
        <div role="alert">
          <p>{error}</p>
          <button onClick={() => setRetry((v) => v + 1)}>
            Retry observations
          </button>
        </div>
      )}
      {status === "ready" && !selected && (
        <p role="status">No observations match this selection.</p>
      )}
      {status === "ready" && selected && (
        <>
          <div className="sar-value">
            {numeric(selected.value)} <span>{dataset.unit}</span>
          </div>
          <p className="small">
            {dataset.metric} · {selected.date}
            {!selected.qualityPass && (
              <strong className="sar-rejected"> · Quality rejected</strong>
            )}
          </p>
          <p className="small muted">
            SAR observation: {selected.date} · Optical basemap: {basemapYear}{" "}
            annual mosaic
          </p>
          <label className="sar-field">
            Acquisition
            <select
              value={selected.id}
              onChange={(e) => chooseObservation(e.target.value)}
            >
              {visible.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.date} · {numeric(r.value)} {dataset.unit} · row{" "}
                  {r.details.sourceRow}
                  {!r.qualityPass ? " · rejected" : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="sar-chart">
            <svg
              viewBox="0 0 450 180"
              role="img"
              aria-label={`${dataset.metric} by acquisition date. ${visible.length} observations; use the acquisition selector or slider to inspect values.`}
            >
              <line x1="38" x2="432" y1="146" y2="146" className="sar-axis" />
              <text x="3" y="19">
                {numeric(plot.max)}
              </text>
              <text x="3" y="146">
                {numeric(plot.min)}
              </text>
              {plot.paths.map((path, i) => (
                <path key={i} d={path} className="sar-line" />
              ))}
              {plot.points.map((p, i) => (
                <circle
                  key={p.id}
                  cx={p.x}
                  cy={p.y}
                  r={p.id === selected.id ? 4.5 : 1.8}
                  className={
                    visible[i].qualityPass ? "sar-dot" : "sar-dot rejected"
                  }
                >
                  <title>
                    {visible[i].date}: {numeric(visible[i].value)}{" "}
                    {dataset.unit}
                    {!visible[i].qualityPass ? " · quality rejected" : ""}
                  </title>
                </circle>
              ))}
              <text x="38" y="170">
                {visible[0].date}
              </text>
              <text x="432" y="170" textAnchor="end">
                {visible[visible.length - 1].date}
              </text>
            </svg>
          </div>
          <label className="sar-field">
            Select an observation
            <input
              type="range"
              min="0"
              max={Math.max(0, visible.length - 1)}
              step="1"
              value={index}
              aria-valuetext={`${selected.date}: ${numeric(selected.value)} ${dataset.unit}`}
              onChange={(e) =>
                chooseObservation(visible[Number(e.target.value)].id)
              }
            />
          </label>
          <div className="sar-actions">
            <button
              disabled={index <= 0}
              onClick={() => chooseObservation(visible[index - 1].id)}
            >
              ← Previous
            </button>
            <button
              aria-label={playing ? "Pause observations" : "Play observations"}
              aria-pressed={playing}
              disabled={visible.length < 2}
              onClick={() => {
                if (!playing) {
                  const row =
                    index >= visible.length - 1 ? visible[0] : selected;
                  setSelectedId(row.id);
                  onSelectObservation(row, true);
                }
                setPlaying((v) => !v);
              }}
            >
              {playing ? "Pause" : "Play"}
            </button>
            <button
              disabled={index >= visible.length - 1}
              onClick={() => chooseObservation(visible[index + 1].id)}
            >
              Next →
            </button>
          </div>
          <p className="small muted">
            Play steps through acquisitions without interpolation. The dated map
            readout is a study-area total; precise change footprints need
            georeferenced masks. Observation dates and the timeline link within
            their overlapping years; imagery is still annual optical context.
          </p>
          <button
            className="text-button"
            disabled={
              year === null || year < FIRST_YEAR || year > LAST_IMAGERY_YEAR
            }
            onClick={() => {
              const time = dateToTimelineTime(
                selected.date,
                FIRST_YEAR,
                LAST_IMAGERY_YEAR,
              );
              if (time !== null) onShowBasemap(time);
            }}
          >
            {year !== null && year >= FIRST_YEAR && year <= LAST_IMAGERY_YEAR
              ? `Show ${year} annual basemap`
              : `No ${year} annual basemap in this archive`}
          </button>
          <dl className="sar-metrics">
            {selected.coverage != null && (
              <div>
                <dt>Usable coverage</dt>
                <dd>
                  {numeric(Math.min(1, Math.max(0, selected.coverage)) * 100)}%
                </dd>
              </div>
            )}
            {typeof selected.details.baselineImages === "number" && (
              <div>
                <dt>Baseline images</dt>
                <dd>{selected.details.baselineImages}</dd>
              </div>
            )}
            {typeof selected.details.disturbancePercent === "number" && (
              <div>
                <dt>Of monitored forest</dt>
                <dd>{numeric(selected.details.disturbancePercent)}%</dd>
              </div>
            )}
            {point && (
              <>
                <div>
                  <dt>Mean velocity</dt>
                  <dd>{numeric(point.velocity)} mm/year</dd>
                </div>
                <div>
                  <dt>Time-series RMSE</dt>
                  <dd>{numeric(point.rmse)} mm</dd>
                </div>
              </>
            )}
            <div>
              <dt>Shown / fetched</dt>
              <dd>
                {visible.length} / {observations.length}
              </dd>
            </div>
          </dl>
          <details className="sar-details">
            <summary>Observation table &amp; comparison</summary>
            <label className="sar-field">
              Compare with acquisition
              <select
                value={comparison.id}
                onChange={(e) => setComparisonId(e.target.value)}
              >
                {visible.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.date} · {numeric(r.value)} {dataset.unit} · row{" "}
                    {r.details.sourceRow}
                  </option>
                ))}
              </select>
            </label>
            <p className="small">
              Change from {comparison.date}:{" "}
              {numeric(selected.value - comparison.value)} {dataset.unit}.{" "}
              {dataset.kind === "subsidence"
                ? "Difference between these two readings at the selected point."
                : "This is a net indicator difference, not newly affected area."}
            </p>
            <div className="sar-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>{dataset.unit}</th>
                    <th>Quality check</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.id}>
                      <td>{r.date}</td>
                      <td>{numeric(r.value)}</td>
                      <td>{r.qualityPass ? "Pass" : "Rejected"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
      <p className="small sar-caveat">
        {dataset.geometryStatus === "crs_unconfirmed"
          ? "Precise point mapping awaits CRS confirmation. The city marker is an approximate locator."
          : "Outline = study area, not an event boundary. Water layers, where available, use separate radar acquisitions and an experimental classification."}
      </p>
      <details className="sar-details">
        <summary>Method, validation &amp; source</summary>
        <p className="small">{dataset.method}</p>
        <p className="small">{dataset.note}</p>
        {dataset.validation.length > 0 && (
          <div className="sar-table-scroll">
            <table>
              <caption>
                {dataset.kind === "forest"
                  ? "Annual reference comparison (threshold selection)"
                  : "Provisional optical agreement"}
              </caption>
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Precision</th>
                  <th>Recall</th>
                  <th>IoU</th>
                </tr>
              </thead>
              <tbody>
                {dataset.validation.map((v) => (
                  <tr key={v.date}>
                    <td>
                      {v.date}
                      {v.referenceDate && (
                        <small>Optical: {v.referenceDate}</small>
                      )}
                    </td>
                    <td>{numeric(v.precision * 100)}%</td>
                    <td>{numeric(v.recall * 100)}%</td>
                    <td>{numeric(v.iou * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="small">
          {dataset.source.file} · {dataset.source.sheet}
        </p>
        <p className="small">{dataset.source.publisher}</p>
        <p className="small sar-hash">SHA-256: {dataset.source.sha256}</p>
        {selected?.details.sceneId && (
          <p className="small sar-hash">Scene: {selected.details.sceneId}</p>
        )}
        <p className="small">
          Repeated same-date records retain their source rows. Missing dates are
          not zero; lines break across gaps longer than 45 days. No forecast is
          inferred from this chart.
        </p>
      </details>
    </section>
  );
});
