import {
  CURRENT_YEAR,
  FIRST_YEAR,
  LAST_IMAGERY_YEAR,
  YEARS,
} from "../data/imagery";
import type useTimeline from "../hooks/useTimeline";
import { timelineDate } from "../data/observationTime";

type TimelineProps = ReturnType<typeof useTimeline> & {
  linkedObservationDate?: string | null;
};

export default function Timeline({
  time,
  startYear,
  endYear,
  isPlaying,
  seek,
  togglePlayback,
  changeStartYear,
  changeEndYear,
  setComparisonRange,
  linkedObservationDate,
}: TimelineProps) {
  const previousYear = Math.floor(time);
  const nextYear = Math.min(previousYear + 1, endYear);
  const blend = Math.round((time - previousYear) * 100);
  const approximateDate = linkedObservationDate ?? timelineDate(time);

  return (
    <section className="timeline panel" aria-label="Year comparison timeline">
      <div className="timeline-heading">
        <div>
          <span className="eyebrow">
            EARTH THROUGH TIME / SATELLITE ARCHIVE
          </span>
          <p>
            <span>≈ {approximateDate} · </span>
            {blend > 0
              ? `${previousYear} → ${nextYear} · ${blend}% optical blend`
              : `${previousYear} annual mosaic`}
          </p>
        </div>
        <div className="timeline-range">
          <button
            type="button"
            className="timeline-reset"
            onClick={() =>
              setComparisonRange(FIRST_YEAR, LAST_IMAGERY_YEAR, time)
            }
            title={`Reset timeline to ${FIRST_YEAR}–${LAST_IMAGERY_YEAR}`}
            aria-label={`Reset timeline to ${FIRST_YEAR}–${LAST_IMAGERY_YEAR}`}
          >
            Reset Range
          </button>
          <label>
            From{" "}
            <select
              aria-label="Start year"
              value={startYear}
              onChange={(event) => changeStartYear(Number(event.target.value))}
            >
              {YEARS.filter((year) => year < endYear).map((year) => (
                <option key={year}>{year}</option>
              ))}
            </select>
          </label>
          <label>
            To{" "}
            <select
              aria-label="End year"
              value={endYear}
              onChange={(event) => changeEndYear(Number(event.target.value))}
            >
              {YEARS.filter((year) => year > startYear).map((year) => (
                <option key={year}>{year}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="timeline-controls">
        <button
          className="play-button"
          onClick={() => togglePlayback()}
          aria-label={isPlaying ? "Pause timeline" : "Play timeline"}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            {isPlaying ? (
              <>
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </>
            ) : (
              <path d="M8 4.8a1 1 0 0 1 1.5-.86l11 7.2a1 1 0 0 1 0 1.72l-11 7.2A1 1 0 0 1 8 19.2Z" />
            )}
          </svg>
        </button>
        <div className="timeline-track">
          <input
            aria-label="Observation year"
            type="range"
            min={startYear}
            max={endYear}
            step="0.01"
            value={time}
            onChange={(event) => seek(Number(event.target.value))}
            aria-valuetext={`Approximately ${approximateDate}; ${previousYear} annual optical imagery${blend ? ` blending into ${nextYear}` : ""}`}
          />
          <div className="year-bookmarks">
            {YEARS.filter((year) => year >= startYear && year <= endYear).map(
              (year) => (
                <button
                  key={year}
                  onClick={() => seek(year)}
                  aria-label={`View ${year}`}
                  aria-pressed={Math.abs(time - year) < 0.01}
                  className={Math.abs(time - year) < 0.01 ? "active" : ""}
                >
                  <span
                    className={
                      year === CURRENT_YEAR ? "current-year-dot" : "year-tick"
                    }
                  />
                  {year}
                </button>
              ),
            )}
          </div>
        </div>
      </div>
      <div className="timeline-note">
        <span>
          <i className="current-year-dot" /> {CURRENT_YEAR} current · imagery
          through {LAST_IMAGERY_YEAR}
        </span>
        <span>4.5 seconds / year · Real annual mosaics</span>
      </div>
    </section>
  );
}
