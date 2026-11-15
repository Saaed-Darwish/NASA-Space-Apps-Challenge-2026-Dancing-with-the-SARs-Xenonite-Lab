import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  parseWaterComparisons,
  comparisonForDate,
} from "../src/data/waterChanges.ts";
import { sarDatasets } from "../src/data/sar.ts";

const catalogue = JSON.parse(
  readFileSync(
    new URL("../../backend/data/water_layers/catalog.json", import.meta.url),
    "utf8",
  ),
);
const dataset = sarDatasets.find((d) => d.id === "VNM_CAN_THO");
function payload() {
  return {
    status: "available",
    datasetId: dataset.id,
    comparisons: catalogue
      .filter((r) => r.datasetId === dataset.id)
      .map((r) => ({
        ...r,
        imageUrl: `/api/water-changes/${r.id}/${r.pngSha256}.png`,
      })),
  };
}
test("water comparisons use the correct dataset and fixed same-origin image routes", () => {
  assert.equal(parseWaterComparisons(payload(), dataset).length, 3);
  for (const mutate of [
    (v) => (v.comparisons[0].imageUrl = "https://other.test/image.png"),
    (v) => (v.comparisons[0].observationSourceSha256 = "stale"),
    (v) => (v.comparisons[0].bounds.west = 0),
    (v) => (v.comparisons[0].afterDate = "2020-01-01"),
    (v) => (v.comparisons[0].summary.validFraction = 0.2),
  ]) {
    const value = structuredClone(payload());
    mutate(value);
    assert.throws(() => parseWaterComparisons(value, dataset));
  }
});
test("following acquisitions never stretches a 2024 mask onto another year", () => {
  const rows = parseWaterComparisons(payload(), dataset);
  assert.equal(comparisonForDate(rows, "2026-11-03"), null);
  assert.equal(comparisonForDate(rows, "2019-01-01"), null);
  assert.equal(comparisonForDate(rows, "2024-11-18").afterDate, "2024-11-18");
  assert.equal(comparisonForDate(rows, "2024-11-19"), null);
  assert.equal(comparisonForDate(rows, null), null);
  assert.equal(comparisonForDate(rows, "invalid"), null);
});

test("comparison ranges include their endpoints and interiors, with no extrapolation across gaps", () => {
  const rows = parseWaterComparisons(payload(), dataset);
  assert.equal(comparisonForDate(rows, "2024-03-10"), null);
  assert.equal(comparisonForDate(rows, "2024-03-11").afterDate, "2024-06-15");
  assert.equal(comparisonForDate(rows, "2024-04-20").afterDate, "2024-06-15");
  assert.equal(comparisonForDate(rows, "2024-08-01").afterDate, "2024-09-19");
  assert.equal(comparisonForDate(rows, "2024-06-15").afterDate, "2024-06-15");
  const later = rows.find((r) => r.beforeDate === "2024-06-15");
  assert.equal(comparisonForDate(rows, "2024-06-15", later.id).id, later.id);
  assert.equal(
    comparisonForDate([...rows].reverse(), "2024-06-15").afterDate,
    "2024-06-15",
  );
  assert.equal(
    comparisonForDate(
      rows.filter((r) => r.id !== later.id),
      "2024-08-01",
    ),
    null,
  );
});
