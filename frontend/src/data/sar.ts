import catalog from "./sarCatalog.json" with { type: "json" };
import { isRecord } from "./validation.ts";

export interface StudyBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}
export interface SarDataset {
  id: string;
  regionId: string;
  name: string;
  kind: "water" | "forest" | "subsidence";
  metric: string;
  unit: "km²" | "mm" | "dB";
  bounds: StudyBounds | null;
  geometryStatus: string;
  note: string;
  method: string;
  startDate: string;
  endDate: string;
  observationCount: number;
  qualityPassedCount: number;
  source: {
    file: string;
    sha256: string;
    sheet: string;
    publisher: string;
    url: string;
  };
  validation: {
    label: string;
    date: string;
    referenceDate?: string;
    precision: number;
    recall: number;
    iou: number;
  }[];
  points: {
    id: string;
    name?: string;
    areaLabel?: string;
    latitude?: number;
    longitude?: number;
    locationStatus?: "inferred_egms_grid" | "source_coordinates";
    gridSizeMeters?: number;
    velocity: number;
    rmse: number;
    easting: number;
    northing: number;
  }[];
}
export interface SarObservation {
  id: string;
  date: string;
  value: number;
  qualityPass: boolean;
  coverage?: number | null;
  pointId?: string | null;
  details: Record<string, string | number | null>;
}
export const sarDatasets = catalog as SarDataset[];

export function parseObservations(value: unknown): SarObservation[] {
  if (!Array.isArray(value) || value.length > 500)
    throw new Error("Invalid observation response");
  return value.map((r) => {
    if (
      !isRecord(r) ||
      typeof r.id !== "string" ||
      typeof r.date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(r.date) ||
      !Number.isFinite(Date.parse(r.date)) ||
      typeof r.value !== "number" ||
      !Number.isFinite(r.value) ||
      typeof r.qualityPass !== "boolean" ||
      (r.coverage != null &&
        (typeof r.coverage !== "number" ||
          !Number.isFinite(r.coverage) ||
          r.coverage < -1e-12 ||
          r.coverage > 1 + 1e-12)) ||
      (r.pointId != null && typeof r.pointId !== "string") ||
      !isRecord(r.details)
    )
      throw new Error("Invalid observation response");
    return {
      id: r.id,
      date: r.date,
      value: r.value,
      qualityPass: r.qualityPass,
      coverage: r.coverage as number | null | undefined,
      pointId: r.pointId as string | null | undefined,
      details: Object.fromEntries(
        Object.entries(r.details).filter(
          ([, v]) =>
            v === null ||
            typeof v === "string" ||
            (typeof v === "number" && Number.isFinite(v)),
        ),
      ) as SarObservation["details"],
    };
  });
}

export async function loadObservations(
  dataset: SarDataset,
  pointId: string,
  signal: AbortSignal,
): Promise<SarObservation[]> {
  const rows: SarObservation[] = [];
  let offset = 0;
  while (true) {
    const query = new URLSearchParams({
      quality: "all",
      limit: "500",
      offset: String(offset),
    });
    if (pointId) query.set("point_id", pointId);
    const response = await fetch(
      `/api/datasets/${encodeURIComponent(dataset.id)}/observations?${query}`,
      { signal },
    );
    if (!response.ok)
      throw new Error(
        "SAR observations could not load. Check the backend connection and retry.",
      );
    const data: unknown = await response.json();
    if (
      isRecord(data) &&
      (!isRecord(data.source) || data.source.sha256 !== dataset.source.sha256)
    )
      throw new Error(
        "The dataset version has changed. Rebuild and refresh the app before inspecting these observations.",
      );
    if (
      !isRecord(data) ||
      data.datasetId !== dataset.id ||
      typeof data.total !== "number" ||
      data.total < 0 ||
      data.total > 4000
    )
      throw new Error("Invalid observation response");
    const page = parseObservations(data.observations);
    if (page.some((r) => pointId && r.pointId !== pointId))
      throw new Error("Unexpected observation point");
    rows.push(...page);
    if (data.nextOffset === null) break;
    if (
      typeof data.nextOffset !== "number" ||
      !Number.isInteger(data.nextOffset) ||
      data.nextOffset <= offset ||
      rows.length >= 4000
    )
      throw new Error("Invalid observation pagination");
    offset = data.nextOffset;
  }
  return rows.sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  );
}

/** Plot actual acquisition dates; never draw a continuous line across long gaps. */
export function observationPlot(rows: SarObservation[]) {
  if (!rows.length) return { points: [], paths: [], min: 0, max: 1 };
  const dates = rows.map((r) => Date.parse(r.date));
  const min = Math.min(0, ...rows.map((r) => r.value));
  const max = Math.max(...rows.map((r) => r.value), min + 1);
  const span = Math.max(1, dates[dates.length - 1] - dates[0]);
  const points = rows.map((r, i) => ({
    id: r.id,
    x: 38 + ((dates[i] - dates[0]) / span) * 394,
    y: 14 + ((max - r.value) / (max - min)) * 132,
  }));
  const paths: string[] = [];
  points.forEach((p, i) => {
    if (
      !i ||
      dates[i] - dates[i - 1] > 45 * 86400000 ||
      !rows[i].qualityPass ||
      !rows[i - 1].qualityPass
    )
      paths.push(`M${p.x},${p.y}`);
    else paths[paths.length - 1] += ` L${p.x},${p.y}`;
  });
  return { points, paths, min, max };
}
