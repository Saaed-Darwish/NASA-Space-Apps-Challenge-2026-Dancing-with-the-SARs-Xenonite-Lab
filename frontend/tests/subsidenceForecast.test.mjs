import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  parseSubsidenceForecast,
  subsidencePlot,
} from "../src/data/subsidenceForecast.ts";
import { sarDatasets } from "../src/data/sar.ts";
const dataset = sarDatasets.find((d) => d.id === "ITA_VENICE_VERTICAL"),
  pid = dataset.points[0].id;
const original = JSON.parse(
  readFileSync(
    new URL("../../backend/subsidence_forecast.json", import.meta.url),
    "utf8",
  ),
).points[pid];
const readings = JSON.parse(
  readFileSync(
    new URL("../../backend/data/sar/ITA_VENICE_VERTICAL.json", import.meta.url),
    "utf8",
  ),
);
function fixture() {
  return {
    status: "available",
    schemaVersion: 1,
    kind: "subsidence",
    datasetId: dataset.id,
    regionId: dataset.regionId,
    pointId: pid,
    unit: "mm",
    sourceSha256: dataset.source.sha256,
    lastAcquisition: dataset.endDate,
    historyThrough: dataset.endDate,
    intervalStatus: "approximate_nominal_95",
    history: structuredClone(original.history),
    forecast: structuredClone(original.forecast),
    velocity: structuredClone(original.velocity_mm_per_year),
    acceleration: structuredClone(original.acceleration_mm_per_year2),
    backtest: {
      ...original.backtest,
      status: "development_only",
      beatNaive: false,
    },
    publishedVelocity: -1.4,
    selectedObservation: readings.filter((r) => r.pointId === pid).at(-1),
    model: original.forecast_model,
    provenanceNote: "Checked",
    generatedLabel: "2026-11-15",
    sourceFile: "subsidence_forecast.json",
    artifactSha256: "a".repeat(64),
    limitations: ["Exploratory"],
  };
}
test("point forecast accepts signed displacement and rejects foreign points, stale versions and invalid chronology", () => {
  assert.equal(
    parseSubsidenceForecast(fixture(), dataset, pid).history.length,
    303,
  );
  for (const mutate of [
    (v) => (v.pointId = "foreign"),
    (v) => (v.unit = "km²"),
    (v) => (v.sourceSha256 = "wrong"),
    (v) => v.history.reverse(),
    (v) => (v.forecast[0].lower = 100),
    (v) => (v.forecast[0].month = "2025-11"),
    (v) => (v.velocity.ci95[0] = NaN),
    (v) =>
      (v.selectedObservation = {
        ...v.selectedObservation,
        pointId: "foreign",
      }),
  ]) {
    const value = fixture();
    mutate(value);
    assert.throws(() => parseSubsidenceForecast(value, dataset, pid));
  }
});
test("subsidence chart preserves negative history, ordered bands and the 2025 forecast origin", () => {
  const data = parseSubsidenceForecast(fixture(), dataset, pid),
    plot = subsidencePlot(data, true);
  assert.equal(plot.history.length, 303);
  assert.equal(plot.future.length, 24);
  assert.ok(plot.min < 0);
  assert.ok(plot.future[0].x > plot.history.at(-1).x);
  assert.ok(plot.future.every((r) => r.high <= r.y && r.y <= r.low));
  assert.ok(!/NaN|Infinity/.test(plot.band + plot.forecastLine));
  assert.equal(plot.future[0].month, "2025-12");
});
