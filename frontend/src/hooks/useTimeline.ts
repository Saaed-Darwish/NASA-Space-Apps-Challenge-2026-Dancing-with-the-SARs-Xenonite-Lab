import { useEffect, useState } from "react";

import { FIRST_YEAR, LAST_IMAGERY_YEAR } from "../data/imagery";
export { CURRENT_YEAR, FIRST_YEAR, YEARS } from "../data/imagery";

const MILLISECONDS_PER_YEAR = 4500;

export default function useTimeline() {
  const [startYear, setStartYear] = useState(FIRST_YEAR);
  const [endYear, setEndYear] = useState(LAST_IMAGERY_YEAR);
  const [time, setTime] = useState(LAST_IMAGERY_YEAR);
  const [isPlaying, setIsPlaying] = useState(false);

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

  function seek(year: number) {
    setIsPlaying(false);
    setTime(Math.max(startYear, Math.min(endYear, year)));
  }

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

  function setComparisonRange(start: number, end: number, selectedYear = end) {
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
  }

  return {
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
