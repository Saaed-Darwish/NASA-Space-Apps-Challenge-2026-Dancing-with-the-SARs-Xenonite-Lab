import { apiFetch } from "./backend.ts";
import type { SarDataset, SarObservation } from "./sar.ts";
import { parseObservations } from "./sar.ts";
import { isRecord } from "./validation.ts";
import type { ForecastMonth } from "./forecast.ts";

export interface SubsidenceForecast {
  status: "available";
  kind: "subsidence";
  datasetId: string;
  pointId: string;
  unit: "mm";
  history: { date: string; mm: number; flagged: boolean }[];
  forecast: ForecastMonth[];
  velocity: { estimate: number; ci95: number[] };
  acceleration: { estimate: number; ci95: number[] };
  publishedVelocity: number;
  backtest: {
    mae_model: number;
    mae_naive: number;
    skill: number | null;
    status: "development_only";
    beatNaive: boolean;
  };
  selectedObservation: SarObservation;
  lastAcquisition: string;
  model: string;
  limitations: string[];
  provenanceNote: string;
  generatedLabel: string;
  sourceSha256: string;
  artifactSha256: string;
  sourceFile: string;
}
const finite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
const day = (v: unknown) =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? Date.parse(v) : NaN;
const month = (v: unknown) =>
  typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v)
    ? Number(v.slice(0, 4)) * 12 + Number(v.slice(5))
    : NaN;
export function parseSubsidenceForecast(
  value: unknown,
  dataset: SarDataset,
  pointId: string,
): SubsidenceForecast {
  if (
    !isRecord(value) ||
    dataset.kind !== "subsidence" ||
    !dataset.points.some((p) => p.id === pointId) ||
    value.status !== "available" ||
    value.kind !== "subsidence" ||
    value.schemaVersion !== 1 ||
    value.unit !== "mm" ||
    value.datasetId !== dataset.id ||
    value.regionId !== dataset.regionId ||
    value.pointId !== pointId ||
    value.sourceSha256 !== dataset.source.sha256 ||
    value.lastAcquisition !== dataset.endDate ||
    value.historyThrough !== dataset.endDate ||
    value.intervalStatus !== "approximate_nominal_95" ||
    !Array.isArray(value.history) ||
    value.history.length < 24 ||
    value.history.length > 1000 ||
    !Array.isArray(value.forecast) ||
    value.forecast.length !== 24 ||
    !Array.isArray(value.limitations) ||
    !value.limitations.every((v) => typeof v === "string") ||
    ![
      "model",
      "provenanceNote",
      "generatedLabel",
      "sourceFile",
      "artifactSha256",
    ].every((k) => typeof value[k] === "string")
  )
    throw new Error(
      "Subsidence forecast does not match this point or observation release.",
    );
  let previous = -Infinity;
  for (const row of value.history) {
    if (
      !isRecord(row) ||
      !Number.isFinite(day(row.date)) ||
      day(row.date) <= previous ||
      !finite(row.mm) ||
      typeof row.flagged !== "boolean"
    )
      throw new Error("Invalid subsidence history");
    previous = day(row.date);
  }
  if (
    value.history[0].date !== dataset.startDate ||
    value.history.at(-1).date !== dataset.endDate
  )
    throw new Error("Invalid subsidence cutoff");
  const cutoff = month(dataset.endDate.slice(0, 7));
  value.forecast.forEach((r, i) => {
    if (
      !isRecord(r) ||
      month(r.month) !== cutoff + i + 1 ||
      !finite(r.mean) ||
      !finite(r.lower) ||
      !finite(r.upper) ||
      r.lower > r.mean ||
      r.mean > r.upper
    )
      throw new Error("Invalid subsidence range or chronology");
  });
  for (const key of ["velocity", "acceleration"]) {
    const r = value[key];
    if (
      !isRecord(r) ||
      !finite(r.estimate) ||
      !Array.isArray(r.ci95) ||
      r.ci95.length !== 2 ||
      !r.ci95.every(finite) ||
      r.ci95[0] > r.estimate ||
      r.estimate > r.ci95[1]
    )
      throw new Error("Invalid subsidence model parameters");
  }
  const test = value.backtest;
  if (
    !isRecord(test) ||
    test.status !== "development_only" ||
    !finite(test.mae_model) ||
    !finite(test.mae_naive) ||
    test.mae_model < 0 ||
    test.mae_naive < 0 ||
    (test.skill !== null && !finite(test.skill)) ||
    test.beatNaive !== test.mae_model < test.mae_naive ||
    !finite(value.publishedVelocity)
  )
    throw new Error("Invalid subsidence development results");
  const observed = parseObservations([value.selectedObservation])[0];
  if (
    observed.pointId !== pointId ||
    !observed.id.startsWith(`${dataset.id}:`) ||
    observed.date !== dataset.endDate ||
    Math.abs(observed.value - value.history.at(-1).mm) > 0.005001
  )
    throw new Error("Invalid selected subsidence observation");
  return value as unknown as SubsidenceForecast;
}
export async function loadSubsidenceForecast(
  dataset: SarDataset,
  pointId: string,
  signal: AbortSignal,
) {
  const response = await apiFetch(
    `/api/datasets/${encodeURIComponent(dataset.id)}/forecast?point_id=${encodeURIComponent(pointId)}`,
    { signal },
  );
  if (!response.ok)
    throw new Error(
      "Subsidence forecast could not load. Check the backend and retry.",
    );
  return parseSubsidenceForecast(await response.json(), dataset, pointId);
}
export function subsidencePlot(data: SubsidenceForecast, full: boolean) {
  const last = Date.parse(data.lastAcquisition);
  const history = full
    ? data.history
    : data.history.filter(
        (r) => Date.parse(r.date) >= last - 3 * 365.25 * 86400000,
      );
  const min =
    Math.min(
      ...history.map((r) => r.mm),
      ...data.forecast.map((r) => r.lower),
    ) - 0.5;
  const max =
    Math.max(
      ...history.map((r) => r.mm),
      ...data.forecast.map((r) => r.upper),
    ) + 0.5;
  const first = Date.parse(history[0].date),
    end = Date.parse(`${data.forecast.at(-1)!.month}-01`);
  const x = (date: string) =>
    42 + ((Date.parse(date) - first) / (end - first)) * 385;
  const y = (v: number) => 148 - ((v - min) / (max - min)) * 128;
  const observed = history.map((r) => ({ ...r, x: x(r.date), y: y(r.mm) }));
  const future = data.forecast.map((r) => ({
    ...r,
    x: x(`${r.month}-01`),
    y: y(r.mean),
    high: y(r.upper),
    low: y(r.lower),
  }));
  const line = (rows: { x: number; y: number }[]) =>
    rows.map((r, i) => `${i ? "L" : "M"}${r.x},${r.y}`).join(" ");
  return {
    history: observed,
    future,
    min,
    max,
    observedLine: observed
      .map(
        (r, i) =>
          `${i && Date.parse(r.date) - Date.parse(observed[i - 1].date) <= 45 * 86400000 ? "L" : "M"}${r.x},${r.y}`,
      )
      .join(" "),
    forecastLine: line([observed.at(-1)!, ...future]),
    band: [
      ...future.map((r) => `${r.x},${r.high}`),
      ...[...future].reverse().map((r) => `${r.x},${r.low}`),
    ].join(" "),
  };
}
