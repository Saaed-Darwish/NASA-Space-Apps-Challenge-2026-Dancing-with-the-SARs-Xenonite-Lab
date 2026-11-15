import { memo, useEffect, useMemo, useState } from "react";
import type { SarDataset } from "../data/sar";
import {
  comparisonNearDate,
  loadWaterComparisons,
  type WaterComparison,
  type WaterLayerSelection,
} from "../data/waterChanges";

interface Props {
  dataset: SarDataset;
  observationDate: string | null;
  onLayer: (layer: WaterLayerSelection | null) => void;
  onCompareDate: (date: string) => void;
}
const number = (v: number) =>
  v.toLocaleString(undefined, { maximumFractionDigits: 2 });

export default memo(function WaterChangePanel({
  dataset,
  observationDate,
  onLayer,
  onCompareDate,
}: Props) {
  const [comparisons, setComparisons] = useState<WaterComparison[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [follow, setFollow] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [chosenId, setChosenId] = useState("");
  const [opacity, setOpacity] = useState(70);
  useEffect(() => {
    let disposed = false;
    const controller = new AbortController(),
      timer = window.setTimeout(() => controller.abort(), 15000);
    setStatus("loading");
    setComparisons([]);
    onLayer(null);
    loadWaterComparisons(dataset, controller.signal)
      .then((rows) => {
        if (!disposed) {
          setComparisons(rows);
          setStatus("ready");
        }
      })
      .catch((e) => {
        if (!disposed) {
          setError(
            e instanceof Error
              ? e.message
              : "Spatial comparisons could not load.",
          );
          setStatus("error");
        }
      })
      .finally(() => window.clearTimeout(timer));
    return () => {
      disposed = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [dataset, retry, onLayer]);
  const chosen = useMemo(
    () =>
      follow
        ? comparisonNearDate(comparisons, observationDate)
        : (comparisons.find((c) => c.id === chosenId) ??
          comparisons.at(-1) ??
          null),
    [follow, comparisons, observationDate, chosenId],
  );
  useEffect(() => {
    onLayer(
      enabled && chosen ? { comparison: chosen, opacity: opacity / 100 } : null,
    );
  }, [enabled, chosen, opacity, onLayer]);
  useEffect(() => () => onLayer(null), [onLayer]);
  function choose(id: string) {
    const row = comparisons.find((c) => c.id === id);
    if (!row) return;
    setChosenId(id);
    setFollow(false);
    setEnabled(true);
    onCompareDate(row.afterDate);
  }
  return (
    <section
      className="water-change-controls"
      aria-label="Spatial water change"
    >
      <div className="section-label">
        SPATIAL WATER CHANGE <span className="sar-badge">EXPERIMENTAL</span>
      </div>
      {status === "loading" && (
        <p role="status" className="small">
          Loading real SAR comparisons…
        </p>
      )}
      {status === "error" && (
        <div role="alert">
          <p className="small">{error}</p>
          <button
            className="text-button"
            onClick={() => setRetry((v) => v + 1)}
          >
            Retry spatial comparisons
          </button>
        </div>
      )}
      {status === "ready" && !comparisons.length && (
        <p className="small muted">
          No aligned SAR image pairs have been processed for this study area.
        </p>
      )}
      {status === "ready" && comparisons.length > 0 && (
        <>
          <label className="sar-quality">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            Show water gain/loss overlay
          </label>
          <label className="sar-quality">
            <input
              type="checkbox"
              checked={follow}
              onChange={(e) => setFollow(e.target.checked)}
            />
            Follow selected SAR acquisition
          </label>
          <label className="sar-field">
            Spatial comparison
            <select
              value={chosen?.id ?? ""}
              onChange={(e) => choose(e.target.value)}
            >
              <option value="" disabled>
                Choose an available acquisition pair
              </option>
              {comparisons.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.beforeDate} → {c.afterDate}
                </option>
              ))}
            </select>
          </label>
          {!chosen && (
            <div role="status">
              <p className="small">
                No overlay ends within 12 days of{" "}
                {observationDate ?? "the selected acquisition"}.{" "}
                {comparisons.length} real comparisons are available.
              </p>
              <button
                className="text-button"
                onClick={() => choose(comparisons.at(-1)!.id)}
              >
                View latest available comparison
              </button>
            </div>
          )}
          {chosen && (
            <>
              <p className="small water-change-legend">
                <span>
                  <i className="water-gain-swatch" />
                  Candidate water gain
                </span>
                <span>
                  <i className="water-loss-swatch" />
                  Candidate water loss
                </span>
              </p>
              <p className="small">
                Radar comparison: {chosen.beforeDate} → {chosen.afterDate}.
                Transparent pixels are unchanged or excluded.
              </p>
              {observationDate !== chosen.afterDate && (
                <p className="small muted">
                  The displayed workbook acquisition is{" "}
                  {observationDate ?? "not selected"}; this overlay ends on{" "}
                  {chosen.afterDate}.
                </p>
              )}
              <label className="sar-field">
                Water overlay opacity · {opacity}%
                <input
                  aria-label="Water overlay opacity"
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={opacity}
                  onChange={(e) => setOpacity(Number(e.target.value))}
                />
              </label>
              <dl className="sar-metrics">
                <div>
                  <dt>Candidate gain</dt>
                  <dd>{number(chosen.summary.gainedKm2)} km²</dd>
                </div>
                <div>
                  <dt>Candidate loss</dt>
                  <dd>{number(chosen.summary.lostKm2)} km²</dd>
                </div>
                <div>
                  <dt>Common usable area</dt>
                  <dd>
                    {number(chosen.summary.validAreaKm2)} km² (
                    {number(chosen.summary.validFraction * 100)}%)
                  </dd>
                </div>
                <div>
                  <dt>Small changes removed</dt>
                  <dd>{number(chosen.summary.removedChangeKm2)} km²</dd>
                </div>
              </dl>
              <details className="sar-details">
                <summary>Spatial method &amp; radar sources</summary>
                <p className="small">{chosen.method}</p>
                <p className="small">
                  Same {chosen.before.orbitState} track{" "}
                  {chosen.before.relativeOrbit}. Pixel areas use the WGS84
                  ellipsoid. Classification is independent of the workbook
                  totals.
                </p>
                <ul className="small">
                  {chosen.limitations.map((text) => (
                    <li key={text}>{text}</li>
                  ))}
                </ul>
                <p className="small">
                  <a
                    href={chosen.before.catalogUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Before: Sentinel-1 RTC source ↗
                  </a>
                  <br />
                  <a
                    href={chosen.after.catalogUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    After: Sentinel-1 RTC source ↗
                  </a>
                </p>
              </details>
            </>
          )}
        </>
      )}
    </section>
  );
});
