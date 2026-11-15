import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  parseForestForecast,
  forestForecastPlot,
} from "../src/data/forestForecast.ts";
import { sarDatasets } from "../src/data/sar.ts";

const dataset = sarDatasets.find((d) => d.id === "VNM_BINH_PHUOC_FOREST");
function fixture(meta = dataset) {
  const raw = JSON.parse(
    readFileSync(
      new URL("../../backend/forest_forecast.json", import.meta.url),
      "utf8",
    ),
  );
  const rows = JSON.parse(
    readFileSync(
      new URL(`../../backend/data/sar/${meta.id}.json`, import.meta.url),
      "utf8",
    ),
  );
  const byDate = new Map();
  for (const row of rows)
    if (
      row.qualityPass &&
      (!byDate.has(row.date) || row.coverage > byDate.get(row.date).coverage)
    )
      byDate.set(row.date, row);
  const item = raw.regions[meta.id];
  return {
    ...item,
    status: "available",
    schemaVersion: 1,
    kind: "forest",
    unit: "dB",
    datasetId: meta.id,
    regionId: meta.regionId,
    sourceSha256: meta.source.sha256,
    history: item.history.map((r) => ({
      ...r,
      observationId: byDate.get(r.date).id,
    })),
    lastAcquisition: meta.endDate,
    historyThrough: item.history.at(-1).date,
    artifactSha256: "a".repeat(64),
    sourceFile: "forest_forecast.json",
    generatedLabel: raw.generated,
    evaluationStatus: "requires_revalidation",
    intervalStatus: "approximate_nominal_95",
    target: "Expected forest VH",
    provenanceNote: "Workbook checked",
    limitations: ["Exploratory"],
  };
}
test("forest forecasts accept negative VH and reject foreign datasets, area units, stale readings and bad ranges", () => {
  assert.equal(parseForestForecast(fixture(), dataset).status, "available");
  for (const mutate of [
    (v) => (v.datasetId = "ITA_BELLUNO_FOREST"),
    (v) => (v.unit = "km²"),
    (v) => (v.sourceSha256 = "stale"),
    (v) => v.history.pop(),
    (v) => (v.history[0].db = NaN),
    (v) => (v.history[1].observationId = v.history[0].observationId),
    (v) => (v.history[0].flagged = !v.history[0].flagged),
    (v) => (v.forecast[0].lower = 0),
    (v) => (v.forecast[0].month = "2026-11"),
  ]) {
    const value = fixture();
    mutate(value);
    assert.throws(() => parseForestForecast(value, dataset));
  }
});
test("forest plot scales negative dB, preserves date spacing and breaks long gaps", () => {
  const data = parseForestForecast(fixture(), dataset),
    plot = forestForecastPlot(data, true);
  assert.equal(plot.history.length, 257);
  assert.ok(plot.max < 0);
  assert.ok(plot.min < plot.max);
  assert.ok(plot.future.every((r) => r.high <= r.y && r.y <= r.low));
  assert.ok(plot.future[0].x > plot.history.at(-1).x);
  assert.ok((plot.expectedLine.match(/M/g) || []).length > 1);
  assert.ok(!/NaN|Infinity/.test(plot.expectedLine));
  assert.ok(
    forestForecastPlot(data, false).history.length < plot.history.length,
  );
});

test("all finalized forest forecasts retain their own seasonal months and source rows", () => {
  for (const meta of sarDatasets.filter((d) => d.kind === "forest")) {
    const value = parseForestForecast(fixture(meta), meta);
    assert.equal(
      value.forecast.length,
      meta.id.includes("EPPING") || meta.id.includes("BELLUNO") ? 6 : 12,
    );
    assert.ok(value.forecast.every((r) => r.month.startsWith("2027-")));
    assert.ok(
      value.history.every((r) => r.observationId.startsWith(meta.id + ":")),
    );
  }
});
