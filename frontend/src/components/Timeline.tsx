import {
  CURRENT_YEAR,
  FIRST_YEAR,
  LAST_IMAGERY_YEAR,
  YEARS,
} from "../data/imagery";
import type useTimeline from "../hooks/useTimeline";

type TimelineProps = ReturnType<typeof useTimeline>;

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
}: TimelineProps) {
  const previousYear = Math.floor(time);
  const nextYear = Math.min(previousYear + 1, endYear);
  const blend = Math.round((time - previousYear) * 100);

  return (
    <section className="timeline panel" aria-label="Year comparison timeline">
      <div className="timeline-heading">
        <div>
          <span className="eyebrow">
            EARTH THROUGH TIME / SATELLITE ARCHIVE
          </span>
          <p>
            {blend > 0
              ? `${previousYear} → ${nextYear} · ${blend}% blend`
              : `${previousYear} observation`}
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
          {isPlaying ? "❚❚" : "▶︎"}
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
            aria-valuetext={`${previousYear}${blend ? ` blending into ${nextYear}` : ""}`}
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
