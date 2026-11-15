import type { SarObservation } from "./sar.ts";

export interface TimelineSelection {
  revision: number;
  time: number;
  startYear: number;
  endYear: number;
}

/** Fractional years track calendar progress, including leap years. */
export function dateToTimelineTime(
  date: string,
  startYear: number,
  endYear: number,
): number | null {
  const stamp = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(stamp)) return null;
  const year = new Date(stamp).getUTCFullYear();
  if (year < startYear || year > endYear) return null;
  const first = Date.UTC(year, 0, 1),
    next = Date.UTC(year + 1, 0, 1);
  // The last annual-mosaic tick is the archive endpoint, not another image year.
  return Math.min(endYear, year + (stamp - first) / (next - first));
}

export function timelineDate(time: number): string {
  const year = Math.floor(time);
  const stamp =
    Date.UTC(year, 0, 1) +
    Math.round(
      (time - year) * (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)),
    );
  return new Date(stamp).toISOString().slice(0, 10);
}

/** Snap to a real acquisition only inside the overlap; never fabricate a date. */
export function nearestObservation(
  rows: SarObservation[],
  selection: TimelineSelection,
  currentId?: string,
): SarObservation | null {
  if (!Number.isFinite(selection.time)) return null;
  const eligible = rows.filter((r) => {
    const year = Number(r.date.slice(0, 4));
    return year >= selection.startYear && year <= selection.endYear;
  });
  if (!eligible.length) return null;
  const target = Date.parse(timelineDate(selection.time));
  const dates = rows.map((r) => Date.parse(r.date));
  if (target < Math.min(...dates) || target > Math.max(...dates)) return null;
  const current = eligible.find((r) => r.id === currentId);
  let best = current ?? eligible[0];
  for (const row of eligible)
    if (
      Math.abs(Date.parse(row.date) - target) <
      Math.abs(Date.parse(best.date) - target)
    )
      best = row;
  return best;
}
