import type { SarDataset, StudyBounds } from "./sar.ts";
import { isRecord } from "./validation.ts";

export interface WaterComparison {
  id: string;
  datasetId: string;
  beforeDate: string;
  afterDate: string;
  imageUrl: string;
  pngSha256: string;
  bounds: StudyBounds;
  observationSourceSha256: string;
  width: number;
  height: number;
  method: string;
  limitations: string[];
  summary: {
    totalAreaKm2: number;
    validAreaKm2: number;
    validFraction: number;
    gainedKm2: number;
    lostKm2: number;
    removedChangeKm2: number;
    thresholdDb: number;
  };
  before: {
    itemId: string;
    catalogUrl: string;
    relativeOrbit: number;
    orbitState: string;
  };
  after: {
    itemId: string;
    catalogUrl: string;
    relativeOrbit: number;
    orbitState: string;
  };
}
export interface WaterLayerSelection {
  comparison: WaterComparison;
  opacity: number;
}
const finite = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value);
const isDate = (v: unknown) =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  Number.isFinite(Date.parse(v));

export function parseWaterComparisons(
  value: unknown,
  dataset: SarDataset,
): WaterComparison[] {
  if (
    !isRecord(value) ||
    value.datasetId !== dataset.id ||
    !["available", "unavailable"].includes(String(value.status)) ||
    !Array.isArray(value.comparisons) ||
    value.comparisons.length > 100
  )
    throw new Error("Invalid spatial comparison catalogue");
  return value.comparisons.map((row) => {
    const bounds = isRecord(row) && isRecord(row.bounds) ? row.bounds : null;
    const summary = isRecord(row) && isRecord(row.summary) ? row.summary : null;
    if (
      !isRecord(row) ||
      typeof row.id !== "string" ||
      !/^[A-Z0-9_]{1,100}$/.test(row.id) ||
      row.datasetId !== dataset.id ||
      row.schemaVersion !== 1 ||
      row.observationSourceSha256 !== dataset.source.sha256 ||
      !isDate(row.beforeDate) ||
      !isDate(row.afterDate) ||
      String(row.beforeDate) >= String(row.afterDate) ||
      typeof row.pngSha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(row.pngSha256) ||
      row.imageUrl !== `/api/water-changes/${row.id}/${row.pngSha256}.png` ||
      !bounds ||
      !dataset.bounds ||
      !Object.entries(dataset.bounds).every(
        ([key, v]) =>
          finite(bounds[key]) && Math.abs((bounds[key] as number) - v) < 1e-8,
      ) ||
      !Number.isInteger(row.width) ||
      !Number.isInteger(row.height) ||
      (row.width as number) <= 0 ||
      (row.height as number) <= 0 ||
      (row.width as number) * (row.height as number) > 2_000_000 ||
      typeof row.method !== "string" ||
      !Array.isArray(row.limitations) ||
      !row.limitations.every((v) => typeof v === "string") ||
      !summary ||
      ![
        "totalAreaKm2",
        "validAreaKm2",
        "validFraction",
        "gainedKm2",
        "lostKm2",
        "removedChangeKm2",
        "thresholdDb",
      ].every((k) => finite(summary[k])) ||
      (summary.totalAreaKm2 as number) <= 0 ||
      (summary.validFraction as number) < 0.95 ||
      (summary.validFraction as number) > 1 ||
      (summary.gainedKm2 as number) < 0 ||
      (summary.lostKm2 as number) < 0
    )
      throw new Error(
        "Invalid spatial comparison metadata or observation version",
      );
    for (const source of [row.before, row.after]) {
      if (
        !isRecord(source) ||
        typeof source.itemId !== "string" ||
        typeof source.catalogUrl !== "string" ||
        !Number.isInteger(source.relativeOrbit) ||
        typeof source.orbitState !== "string"
      )
        throw new Error("Invalid radar provenance");
      const url = new URL(source.catalogUrl);
      if (
        url.protocol !== "https:" ||
        url.hostname !== "planetarycomputer.microsoft.com" ||
        url.username ||
        url.password
      )
        throw new Error("Invalid radar provenance URL");
    }
    return row as unknown as WaterComparison;
  });
}

export async function loadWaterComparisons(
  dataset: SarDataset,
  signal: AbortSignal,
) {
  const response = await fetch(
    `/api/datasets/${encodeURIComponent(dataset.id)}/water-changes`,
    { signal },
  );
  if (!response.ok)
    throw new Error(
      "Spatial comparisons could not load. Check the backend and retry.",
    );
  return parseWaterComparisons(await response.json(), dataset);
}

export function comparisonNearDate(
  comparisons: WaterComparison[],
  date: string | null,
): WaterComparison | null {
  if (!date || !comparisons.length) return null;
  const ranked = [...comparisons].sort(
    (a, b) =>
      Math.abs(Date.parse(a.afterDate) - Date.parse(date)) -
      Math.abs(Date.parse(b.afterDate) - Date.parse(date)),
  );
  return Math.abs(Date.parse(ranked[0].afterDate) - Date.parse(date)) <=
    12 * 86400000
    ? ranked[0]
    : null;
}
