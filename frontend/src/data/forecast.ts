import type { SarDataset } from "./sar.ts";
import { isRecord } from "./validation.ts";

export interface HistoryMonth {
  month: string;
  value: number;
  filled: boolean;
  flagged: boolean;
  partial: boolean;
  observationCount: number;
}
export interface ForecastMonth {
  month: string;
  mean: number;
  lower: number;
  upper: number;
}
export interface Forecast {
  status: "available";
  datasetId: string;
  regionId: string;
  sourceSha256: string;
  artifactSha256: string;
  sourceFile: string;
  generatedLabel: string;
  generationTimezone: string;
  model: string;
  target: string;
  unit: "km²";
  historyThrough: string;
  lastAcquisition: string;
  evaluationStatus: "requires_revalidation";
  intervalStatus: "approximate_nominal_95";
  provenanceNote: string;
  limitations: string[];
  history: HistoryMonth[];
  forecast: ForecastMonth[];
}
export type ForecastResponse =
  Forecast | { status: "unavailable"; reason: string };
const finiteArea = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0;
const monthIndex = (v: unknown) =>
  typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v)
    ? Number(v.slice(0, 4)) * 12 + Number(v.slice(5))
    : NaN;

export function parseForecast(
  value: unknown,
  dataset: SarDataset,
): ForecastResponse {
  if (!isRecord(value) || value.datasetId !== dataset.id)
    throw new Error("Invalid forecast response");
  if (value.status === "unavailable" && typeof value.reason === "string")
    return { status: "unavailable", reason: value.reason };
  if (value.sourceSha256 !== dataset.source.sha256)
    throw new Error(
      "Forecast and observation versions differ. Rebuild and refresh the app.",
    );
  if (
    value.status !== "available" ||
    value.schemaVersion !== 1 ||
    value.regionId !== dataset.regionId ||
    value.unit !== "km²" ||
    value.evaluationStatus !== "requires_revalidation" ||
    value.intervalStatus !== "approximate_nominal_95" ||
    !Array.isArray(value.history) ||
    value.history.length < 24 ||
    value.history.length > 240 ||
    !Array.isArray(value.forecast) ||
    !value.forecast.length ||
    value.forecast.length > 24 ||
    !Array.isArray(value.limitations) ||
    !value.limitations.every((v) => typeof v === "string") ||
    ![
      "artifactSha256",
      "sourceFile",
      "generatedLabel",
      "generationTimezone",
      "model",
      "target",
      "historyThrough",
      "lastAcquisition",
      "provenanceNote",
    ].every((k) => typeof value[k] === "string")
  )
    throw new Error("Invalid forecast response");
  for (const r of value.history)
    if (
      !isRecord(r) ||
      !Number.isFinite(monthIndex(r.month)) ||
      !finiteArea(r.value) ||
      typeof r.filled !== "boolean" ||
      typeof r.flagged !== "boolean" ||
      typeof r.partial !== "boolean" ||
      !Number.isInteger(r.observationCount) ||
      (r.observationCount as number) < 0
    )
      throw new Error("Invalid forecast history");
  for (const r of value.forecast)
    if (
      !isRecord(r) ||
      !Number.isFinite(monthIndex(r.month)) ||
      !finiteArea(r.mean) ||
      !finiteArea(r.lower) ||
      !finiteArea(r.upper) ||
      (r.lower as number) > (r.mean as number) ||
      (r.mean as number) > (r.upper as number)
    )
      throw new Error("Invalid forecast range");
  const months = [...value.history, ...value.forecast].map((r) =>
    monthIndex(r.month),
  );
  if (
    months.some((m, i) => i > 0 && m !== months[i - 1] + 1) ||
    value.historyThrough !== value.history[value.history.length - 1].month ||
    value.lastAcquisition !== dataset.endDate
  )
    throw new Error("Invalid forecast chronology");
  return value as unknown as Forecast;
}

export async function loadForecast(dataset: SarDataset, signal: AbortSignal) {
  const response = await fetch(
    `/api/datasets/${encodeURIComponent(dataset.id)}/forecast`,
    { signal },
  );
  if (!response.ok)
    throw new Error(
      "Forecast could not load. Check the backend connection and retry.",
    );
  return parseForecast(await response.json(), dataset);
}

export function forecastPlot(data: Forecast, fullHistory: boolean) {
  const history = fullHistory ? data.history : data.history.slice(-36);
  const max = Math.max(
    1,
    ...history.map((r) => r.value),
    ...data.forecast.map((r) => r.upper),
  );
  const count = history.length + data.forecast.length;
  const x = (i: number) => 38 + (i / Math.max(1, count - 1)) * 394;
  const y = (v: number) => 148 - (v / max) * 128;
  const observed = history.map((r, i) => ({ ...r, x: x(i), y: y(r.value) }));
  const future = data.forecast.map((r, i) => ({
    ...r,
    x: x(history.length + i),
    y: y(r.mean),
    low: y(r.lower),
    high: y(r.upper),
  }));
  const line = (rows: { x: number; y: number }[]) =>
    rows.map((r, i) => `${i ? "L" : "M"}${r.x},${r.y}`).join(" ");
  return {
    history: observed,
    future,
    max,
    observedLine: line(observed),
    forecastLine: line([observed[observed.length - 1], ...future]),
    band: [
      ...future.map((p) => `${p.x},${p.high}`),
      ...[...future].reverse().map((p) => `${p.x},${p.low}`),
    ].join(" "),
  };
}
