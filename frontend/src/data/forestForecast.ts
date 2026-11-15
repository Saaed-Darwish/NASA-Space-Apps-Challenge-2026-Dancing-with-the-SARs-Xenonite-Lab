import type { SarDataset } from "./sar.ts";
import { isRecord } from "./validation.ts";
import type { ForecastMonth } from "./forecast.ts";

export interface ForestReading {
  observationId: string;
  date: string;
  db: number;
  expected: number;
  z: number;
  flagged: boolean;
}
export interface ForestForecast {
  status: "available";
  kind: "forest";
  datasetId: string;
  unit: "dB";
  history: ForestReading[];
  forecast: ForecastMonth[];
  model: string;
  target: string;
  lastAcquisition: string;
  provenanceNote: string;
  limitations: string[];
  generatedLabel: string;
  sourceFile: string;
  sourceSha256: string;
  artifactSha256: string;
}
export type ForestForecastResponse =
  ForestForecast | { status: "unavailable"; reason: string };
const finite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
const stamp = (v: unknown) =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? Date.parse(v) : NaN;
const monthIndex = (v: unknown) =>
  typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v)
    ? Number(v.slice(0, 4)) * 12 + Number(v.slice(5))
    : NaN;

export function parseForestForecast(
  value: unknown,
  dataset: SarDataset,
): ForestForecastResponse {
  if (
    !isRecord(value) ||
    value.datasetId !== dataset.id ||
    dataset.kind !== "forest"
  )
    throw new Error("Invalid forest forecast response");
  if (value.status === "unavailable" && typeof value.reason === "string")
    return { status: "unavailable", reason: value.reason };
  if (
    value.status !== "available" ||
    value.schemaVersion !== 1 ||
    value.kind !== "forest" ||
    value.unit !== "dB" ||
    value.regionId !== dataset.regionId ||
    value.sourceSha256 !== dataset.source.sha256 ||
    value.lastAcquisition !== dataset.endDate ||
    value.evaluationStatus !== "requires_revalidation" ||
    value.intervalStatus !== "approximate_nominal_95" ||
    !Array.isArray(value.history) ||
    !value.history.length ||
    value.history.length > dataset.qualityPassedCount ||
    !Array.isArray(value.forecast) ||
    !value.forecast.length ||
    value.forecast.length > 12 ||
    !Array.isArray(value.limitations) ||
    !value.limitations.every((v) => typeof v === "string") ||
    ![
      "model",
      "target",
      "provenanceNote",
      "generatedLabel",
      "sourceFile",
      "artifactSha256",
    ].every((k) => typeof value[k] === "string")
  )
    throw new Error(
      "Forest forecast and observation versions differ or the response is invalid.",
    );
  const ids = new Set<string>();
  let previous = -Infinity;
  for (const row of value.history) {
    if (
      !isRecord(row) ||
      typeof row.observationId !== "string" ||
      !row.observationId.startsWith(`${dataset.id}:`) ||
      ids.has(row.observationId) ||
      !Number.isFinite(stamp(row.date)) ||
      stamp(row.date) < previous ||
      !finite(row.db) ||
      !finite(row.expected) ||
      !finite(row.z) ||
      typeof row.flagged !== "boolean" ||
      (Math.abs(row.z) < 3.995 && row.flagged) ||
      (Math.abs(row.z) > 4.005 && !row.flagged)
    )
      throw new Error("Invalid forest forecast history");
    ids.add(row.observationId);
    previous = stamp(row.date);
  }
  if (
    !value.history.length ||
    value.historyThrough !== value.history.at(-1).date ||
    previous > stamp(dataset.endDate)
  )
    throw new Error("Invalid forest forecast cutoff");
  const cutoff = monthIndex(value.history.at(-1).date.slice(0, 7));
  const seasons = [
    ...new Set(value.history.map((r) => Number(r.date.slice(5, 7)))),
  ].sort((a, b) => a - b);
  if (value.forecast.length !== seasons.length)
    throw new Error("Invalid forest season count");
  value.forecast.forEach((row, i) => {
    if (
      !isRecord(row) ||
      monthIndex(row.month) !==
        (Math.floor((cutoff - 1) / 12) + 1) * 12 + seasons[i] ||
      !finite(row.mean) ||
      !finite(row.lower) ||
      !finite(row.upper) ||
      row.lower > row.mean ||
      row.mean > row.upper
    )
      throw new Error("Invalid forest forecast range or chronology");
  });
  return value as unknown as ForestForecast;
}

export async function loadForestForecast(
  dataset: SarDataset,
  signal: AbortSignal,
) {
  const response = await fetch(
    `/api/datasets/${encodeURIComponent(dataset.id)}/forecast`,
    { signal },
  );
  if (!response.ok)
    throw new Error(
      "Forest forecast could not load. Check the backend and retry.",
    );
  return parseForestForecast(await response.json(), dataset);
}

export function forestForecastPlot(data: ForestForecast, fullHistory: boolean) {
  const last = Date.parse(data.history.at(-1)!.date);
  const history = fullHistory
    ? data.history
    : data.history.filter(
        (r) => Date.parse(r.date) >= last - 3 * 365.25 * 86400000,
      );
  const min =
    Math.min(
      ...history.flatMap((r) => [r.db, r.expected]),
      ...data.forecast.map((r) => r.lower),
    ) - 0.25;
  const max =
    Math.max(
      ...history.flatMap((r) => [r.db, r.expected]),
      ...data.forecast.map((r) => r.upper),
    ) + 0.25;
  const first = Date.parse(history[0].date),
    end = Date.parse(`${data.forecast.at(-1)!.month}-15`);
  const x = (date: string) =>
    42 + ((Date.parse(date) - first) / (end - first)) * 385;
  const y = (v: number) => 148 - ((v - min) / (max - min)) * 128;
  const observed = history.map((r) => ({
    ...r,
    x: x(r.date),
    y: y(r.db),
    expectedY: y(r.expected),
  }));
  const future = data.forecast.map((r) => ({
    ...r,
    x: x(`${r.month}-15`),
    y: y(r.mean),
    high: y(r.upper),
    low: y(r.lower),
  }));
  const expectedLine = observed
    .map(
      (r, i) =>
        `${i && Date.parse(r.date) - Date.parse(observed[i - 1].date) <= 45 * 86400000 ? "L" : "M"}${r.x},${r.expectedY}`,
    )
    .join(" ");
  return { history: observed, future, min, max, expectedLine };
}
