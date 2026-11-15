import { useCallback, useEffect, useMemo, useState } from "react";
import type { TimelineSelection } from "../data/observationTime";

import { FIRST_YEAR, LAST_IMAGERY_YEAR } from "../data/imagery";
export { CURRENT_YEAR, FIRST_YEAR, YEARS } from "../data/imagery";

const MILLISECONDS_PER_YEAR = 4500;

export default function useTimeline() {
  const [startYear, setStartYear] = useState(FIRST_YEAR);
  const [endYear, setEndYear] = useState(LAST_IMAGERY_YEAR);
  const [cursor, setCursor] = useState({
    time: LAST_IMAGERY_YEAR,
    revision: 0,
    origin: "observation",
  });
  const time = cursor.time;
  const setTime = (next: number | ((previous: number) => number)) =>
    setCursor((previous) => ({
      time: typeof next === "function" ? next(previous.time) : next,
      revision: previous.revision + 1,
      origin: "timeline",
    }));
  const [isPlaying, setIsPlaying] = useState(false);
  const pause = useCallback(() => setIsPlaying(false), []);

  useEffect(() => {
    if (!isPlaying) return;
    let frame: number;
    let previousTimestamp: number | null = null;
    let elapsed = 0;

    function advance(timestamp: number) {
      if (previousTimestamp !== null)
        elapsed += Math.min(timestamp - previousTimestamp, 100);
      previousTimestamp = timestamp;
      // Limit React updates while retaining a smooth crossfade on the globe.
      if (elapsed >= 33) {
        const step = elapsed / MILLISECONDS_PER_YEAR;
        setTime((previous) => Math.min(endYear, previous + step));
        elapsed = 0;
      }
      frame = requestAnimationFrame(advance);
    }
    frame = requestAnimationFrame(advance);
    return () => cancelAnimationFrame(frame);
  }, [isPlaying, endYear]);

  useEffect(() => {
    if (time >= endYear) setIsPlaying(false);
  }, [time, endYear]);

  const seek = useCallback(
    (year: number) => {
      setIsPlaying(false);
      setTime(Math.max(startYear, Math.min(endYear, year)));
    },
    [startYear, endYear],
  );

  const syncObservationTime = useCallback((time: number) => {
    setIsPlaying(false);
    setCursor((previous) => ({
      time,
      revision: previous.revision + 1,
      origin: "observation",
    }));
  }, []);

  const selection = useMemo<TimelineSelection | null>(
    () =>
      cursor.origin === "timeline"
        ? { revision: cursor.revision, time, startYear, endYear }
        : null,
    [cursor.origin, cursor.revision, time, startYear, endYear],
  );

  function togglePlayback(restartFromStart = false) {
    if (!isPlaying && (restartFromStart || time >= endYear)) setTime(startYear);
    setIsPlaying((previous) => !previous);
  }

  function changeStartYear(year: number) {
    setStartYear(year);
    setIsPlaying(false);
    setTime(year);
  }

  function changeEndYear(year: number) {
    setEndYear(year);
    setIsPlaying(false);
    setTime((previous) => Math.min(previous, year));
  }

  const setComparisonRange = useCallback(
    (start: number, end: number, selectedYear = end) => {
      const boundedStart = Math.max(
        FIRST_YEAR,
        Math.min(LAST_IMAGERY_YEAR - 1, start),
      );
      const boundedEnd = Math.max(
        boundedStart + 1,
        Math.min(LAST_IMAGERY_YEAR, end),
      );
      setIsPlaying(false);
      setStartYear(boundedStart);
      setEndYear(boundedEnd);
      setTime(Math.max(boundedStart, Math.min(boundedEnd, selectedYear)));
    },
    [],
  );

  return {
    pause,
    selection,
    syncObservationTime,
    setComparisonRange,
    time,
    startYear,
    endYear,
    isPlaying,
    seek,
    togglePlayback,
    changeStartYear,
    changeEndYear,
  };
}
