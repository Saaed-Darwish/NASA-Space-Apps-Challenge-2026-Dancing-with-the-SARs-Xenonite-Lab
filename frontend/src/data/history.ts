import { LAST_IMAGERY_YEAR } from "./imagery";
import type { Indicator, RegionalReading } from "./demo";

/** Mock cumulative change relative to 2020; no historical measurements are implied. */
export function readingAtYear(
  reading: RegionalReading,
  indicator: Indicator,
  year: number,
): RegionalReading {
  const currentYear = LAST_IMAGERY_YEAR;
  const progress = Math.max(
    0,
    Math.min(1, (year - 2020) / Math.max(1, currentYear - 2020)),
  );
  const latestValue = Number(reading.value.replace("−", "-"));
  const factor = indicator === "fire" ? progress ** 1.3 : progress;
  const value = latestValue * factor;
  const sign = value < 0 ? "−" : value > 0 && indicator !== "fire" ? "+" : "";
  return {
    ...reading,
    value: `${sign}${Math.abs(value).toFixed(1)}`,
    context:
      indicator === "fire"
        ? "Mock affected area at selected year"
        : `${reading.context} since 2020`,
  };
}
