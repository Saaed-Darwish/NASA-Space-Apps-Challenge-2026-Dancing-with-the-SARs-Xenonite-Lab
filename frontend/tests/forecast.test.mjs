import assert from "node:assert/strict";
import test from "node:test";
import { parseForecast, forecastPlot } from "../src/data/forecast.ts";
import { sarDatasets } from "../src/data/sar.ts";
const dataset = sarDatasets.find((d) => d.id === "VNM_CAN_THO");
function fixture() {
  return {
    status: "available",
    schemaVersion: 1,
    datasetId: dataset.id,
    regionId: dataset.regionId,
    sourceSha256: dataset.source.sha256,
    artifactSha256: "a".repeat(64),
    sourceFile: "forecasts.json",
    generatedLabel: "2026-11-14 23:57",
    generationTimezone: "Not supplied",
    model: "ETS",
    target: "Cleaned monthly indicator",
    unit: "km²",
    historyThrough: "2026-11",
    lastAcquisition: dataset.endDate,
    provenanceNote: "History consistency checked",
    limitations: ["Exploratory"],
    evaluationStatus: "requires_revalidation",
    intervalStatus: "approximate_nominal_95",
    history: Array.from({ length: 24 }, (_, i) => {
      const date = new Date(Date.UTC(2024, 11 + i, 1));
      return {
        month: date.toISOString().slice(0, 7),
        value: 2,
        filled: false,
        flagged: false,
        partial: i === 23,
        observationCount: 2,
      };
    }),
    forecast: [
      { month: "2026-12", mean: 3, lower: 1, upper: 5 },
      { month: "2027-01", mean: 4, lower: 2, upper: 7 },
    ],
  };
}
test("forecast response rejects incompatible observations, reversed bands and time overlaps", () => {
  assert.equal(parseForecast(fixture(), dataset).status, "available");
  for (const mutate of [
    (v) => (v.sourceSha256 = "wrong"),
    (v) => (v.forecast[0].lower = 8),
    (v) => (v.forecast[0].month = "2026-11"),
    (v) => (v.regionId = "foreign"),
    (v) => (v.history[0].value = NaN),
  ]) {
    const data = fixture();
    mutate(data);
    assert.throws(() => parseForecast(data, dataset));
  }
  assert.equal(
    parseForecast(
      { status: "unavailable", datasetId: dataset.id, reason: "No export" },
      dataset,
    ).status,
    "unavailable",
  );
});
test("forecast plot keeps the ranges ordered and future months after observed months", () => {
  const data = parseForecast(fixture(), dataset),
    plot = forecastPlot(data, false);
  assert.equal(plot.history.length, 24);
  assert.ok(plot.future[0].x > plot.history.at(-1).x);
  assert.ok(plot.future.every((r) => r.high <= r.y && r.y <= r.low));
  assert.equal(plot.max, 7);
  assert.ok(!/NaN|Infinity/.test(plot.band + plot.forecastLine));
});
