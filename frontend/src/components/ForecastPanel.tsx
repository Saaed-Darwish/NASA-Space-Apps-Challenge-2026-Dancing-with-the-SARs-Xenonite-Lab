import type { Region } from "../types/region";
<<<<<<< HEAD

export default function ForecastPanel({ region }: { region: Region }) {
=======
import type { SarDataset } from "../data/sar";
import type { ReactNode } from "react";
import DataTypeTabs from "./DataTypeTabs";
import ForestForecastPanel from "./ForestForecastPanel";
import SubsidenceForecastPanel from "./SubsidenceForecastPanel";
import type { SarObservation } from "../data/sar";
import {
  forecastPlot,
  loadForecast,
  type ForecastResponse,
} from "../data/forecast";
const numeric = (v: number) =>
  v.toLocaleString(undefined, { maximumFractionDigits: 2 });

function WaterForecastPanel({
  region,
  dataset,
  children,
}: {
  region: Region;
  dataset: SarDataset | null;
  children?: ReactNode;
}) {
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
>>>>>>> integrating-backend-data
  return (
    <section
      className="workspace-panel forecast-panel panel"
      aria-label="Water time-series forecast"
      data-kind="water"
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
<<<<<<< HEAD
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
=======
      {children}
      {!dataset && (
        <div className="forecast-empty" role="status">
          <h3>No forecast for this study area</h3>
          <p>
            Forecasts are available for study areas with matching observation
            series and supplied model exports. This region has no matching
            dataset.
          </p>
>>>>>>> integrating-backend-data
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

export default function ForecastPanel({
  region,
  dataset,
  datasets,
  onSelectDataset,
  onSelectObservation,
  initialPointId,
}: {
  region: Region;
  dataset: SarDataset | null;
  datasets: SarDataset[];
  onSelectDataset: (id: string) => void;
  onSelectObservation?: (row: SarObservation | null) => void;
  initialPointId?: string;
}) {
  const tabs = dataset ? (
    <DataTypeTabs
      datasets={datasets}
      dataset={dataset}
      onSelect={onSelectDataset}
    />
  ) : null;
  if (dataset?.kind === "subsidence")
    return (
      <SubsidenceForecastPanel
        key={dataset.id}
        region={region}
        dataset={dataset}
        onSelectObservation={onSelectObservation}
        initialPointId={initialPointId}
      >
        {tabs}
      </SubsidenceForecastPanel>
    );
  if (dataset?.kind === "forest")
    return (
      <ForestForecastPanel key={dataset.id} region={region} dataset={dataset}>
        {tabs}
      </ForestForecastPanel>
    );
  return (
    <WaterForecastPanel key={dataset?.id} region={region} dataset={dataset}>
      {tabs}
    </WaterForecastPanel>
  );
}
