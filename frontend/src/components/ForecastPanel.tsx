import type { Region } from "../types/region";

export default function ForecastPanel({ region }: { region: Region }) {
  return (
    <section
      className="workspace-panel forecast-panel panel"
      aria-label="Water time-series forecast"
    >
      <div className="workspace-title">
        <div>
          <span className="eyebrow">WATER TIME SERIES</span>
          <h2>Forecast</h2>
        </div>
        <span className="mock-pill">IN DEVELOPMENT</span>
      </div>
      <div className="context-strip">
        {region.name}
        <span>{region.country}</span>
      </div>
      <p className="muted">
        Model development for this water-monitoring region.
      </p>
      <div className="forecast-empty" role="status">
        <svg
          viewBox="0 0 48 48"
          width="48"
          height="48"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path d="M8 8v32h32M14 29l8-7 7 4 11-14" />
          <path d="M32 12h8v8" />
        </svg>
        <h3>Forecast data is not available yet</h3>
        <p>
          The time-series model is in development. Forecast results will appear
          here when the backend delivers them.
        </p>
      </div>
      <dl className="forecast-status">
        <div>
          <dt>Observed water series</dt>
          <dd>Awaiting processed data</dd>
        </div>
        <div>
          <dt>Forecast model</dt>
          <dd>In development</dd>
        </div>
        <div>
          <dt>Prediction horizon</dt>
          <dd>Not provided yet</dd>
        </div>
        <div>
          <dt>Forecast uncertainty</dt>
          <dd>Not provided yet</dd>
        </div>
      </dl>
      <p className="demo-explanation">
        The map timeline shows historical satellite imagery. No predictions or
        future flood boundaries are displayed.
      </p>
    </section>
  );
}
