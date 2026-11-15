import assert from "node:assert/strict";
import test from "node:test";
import {
  dateToTimelineTime,
  timelineDate,
  nearestObservation,
} from "../src/data/observationTime.ts";

const row = (id, date) => ({
  id,
  date,
  value: 1,
  qualityPass: true,
  details: {},
});
const selection = (time, startYear = 2020, endYear = 2025) => ({
  time,
  startYear,
  endYear,
  revision: 1,
});
test("observation dates link only inside selected years, including the final annual tick", () => {
  assert.equal(dateToTimelineTime("2019-12-30", 2020, 2025), null);
  assert.equal(dateToTimelineTime("2026-01-01", 2020, 2025), null);
  assert.equal(dateToTimelineTime("2025-11-01", 2020, 2025), 2025);
  assert.equal(dateToTimelineTime("2024-05-01", 2021, 2023), null);
  for (const date of ["2020-02-29", "2021-12-31", "2024-06-12", "2023-01-01"]) {
    assert.equal(timelineDate(dateToTimelineTime(date, 2020, 2025)), date);
  }
});
test("timeline selects the nearest real acquisition without leaving overlap or losing a same-date scene", () => {
  const rows = [
    row("old", "2019-12-30"),
    row("one", "2020-01-05"),
    row("two", "2020-01-17"),
    row("duplicate", "2020-01-17"),
    row("future", "2026-01-01"),
  ];
  assert.equal(nearestObservation(rows, selection(2020)).id, "one");
  const position = dateToTimelineTime("2020-01-15", 2020, 2025);
  assert.equal(nearestObservation(rows, selection(position)).id, "two");
  assert.equal(
    nearestObservation(rows, selection(position), "duplicate").id,
    "duplicate",
  );
  assert.equal(
    nearestObservation([row("later", "2020-12-09")], selection(2020)),
    null,
  );
  assert.equal(
    nearestObservation([row("outside", "2026-01-01")], selection(2025)),
    null,
  );
  assert.equal(nearestObservation([], selection(2025)), null);
});
