import { memo } from "react";
import type { WaterComparison } from "../data/waterChanges";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const dateLabel = (date: string) =>
  dateFormatter.format(new Date(`${date}T00:00:00Z`));
const areaLabel = (value: number) =>
  value > 0 && value < 0.01
    ? "<0.01"
    : value.toLocaleString(undefined, { maximumFractionDigits: 2 });

function WaterChangeLegend({
  comparison,
  compact = false,
}: {
  comparison: WaterComparison;
  compact?: boolean;
}) {
  return (
    <div
      className={`water-legend${compact ? " water-legend-compact" : ""}`}
      role="group"
      aria-label="Water gain and loss legend"
    >
      <div className="water-legend-heading">
        <strong>Water extent change</strong>
        <span className="experimental-tag">Experimental</span>
      </div>
      <div className="water-legend-dates" aria-label="Radar acquisition dates">
        <time dateTime={comparison.beforeDate}>
          {dateLabel(comparison.beforeDate)}
        </time>
        <span aria-label="to">&#8594;</span>
        <time dateTime={comparison.afterDate}>
          {dateLabel(comparison.afterDate)}
        </time>
      </div>
      <dl className="water-legend-values">
        <div>
          <dt>
            <i className="water-gain-swatch" aria-hidden="true" />
            Water gained
          </dt>
          <dd>
            {areaLabel(comparison.summary.gainedKm2)} <span>km&#178;</span>
          </dd>
        </div>
        <div>
          <dt>
            <i className="water-loss-swatch" aria-hidden="true" />
            Water lost
          </dt>
          <dd>
            {areaLabel(comparison.summary.lostKm2)} <span>km&#178;</span>
          </dd>
        </div>
      </dl>
      {!compact && (
        <p className="water-legend-note">
          Candidate changes between radar acquisitions. Unchanged and excluded
          pixels are transparent.
        </p>
      )}
    </div>
  );
}

export default memo(WaterChangeLegend);
