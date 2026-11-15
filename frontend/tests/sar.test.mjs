import assert from "node:assert/strict";
import test from "node:test";
import {
  parseObservations,
  observationPlot,
  sarDatasets,
  loadObservations,
} from "../src/data/sar.ts";

test("a different workbook release is rejected before displaying its values", async (t) => {
  t.mock.method(globalThis, "fetch", async () => ({
    ok: true,
    json: async () => ({
      datasetId: sarDatasets[0].id,
      total: 0,
      nextOffset: null,
      observations: [],
      source: { sha256: "different-version" },
    }),
  }));
  await assert.rejects(
    loadObservations(sarDatasets[0], "", new AbortController().signal),
    /version has changed/,
  );
});

test("catalogue scopes observations to measured regions and Venice to individual grid samples", () => {
  assert.equal(sarDatasets.length, 11);
  assert.equal(
    sarDatasets.find((d) => d.id === "BRA_PORTO_VELHO").regionId,
    "porto-velho",
  );
  assert.equal(sarDatasets.find((d) => d.kind === "subsidence").bounds, null);
  assert.equal(
    sarDatasets.filter((d) => d.regionId === "rio-grande-do-sul").length,
    0,
  );
});

test("observation parser retains signed displacement and rejects malformed measurements", () => {
  const row = {
    id: "one",
    date: "2025-01-01",
    value: -3.4,
    qualityPass: true,
    details: { rmse: 0.5 },
  };
  assert.equal(parseObservations([row])[0].value, -3.4);
  for (const invalid of [
    { ...row, value: NaN },
    { ...row, value: "3" },
    { ...row, date: "bad" },
    { ...row, coverage: 1.1 },
    { ...row, qualityPass: "false" },
  ])
    assert.throws(() => parseObservations([invalid]));
});

test("chart spacing uses elapsed time and breaks lines across missing periods", () => {
  const rows = [
    { id: "1", date: "2024-01-01", value: 1, qualityPass: true },
    { id: "2", date: "2024-01-13", value: 2, qualityPass: true },
    { id: "3", date: "2024-06-01", value: 3, qualityPass: true },
  ];
  const plot = observationPlot(rows);
  assert.equal(plot.paths.length, 2);
  assert.ok(
    plot.points[2].x - plot.points[1].x > plot.points[1].x - plot.points[0].x,
  );
  assert.equal(observationPlot([]).points.length, 0);
});

test("independently rebased Norilsk segments never join even across short gaps", () => {
  const rows = [
    {
      id: "a",
      date: "2019-12-06",
      value: 0,
      qualityPass: true,
      details: { segment: "winter" },
    },
    {
      id: "b",
      date: "2019-12-18",
      value: -2,
      qualityPass: true,
      details: { segment: "winter" },
    },
    {
      id: "c",
      date: "2019-12-30",
      value: 0,
      qualityPass: true,
      details: { segment: "next" },
    },
  ];
  assert.equal(observationPlot(rows).paths.length, 2);
  const meta = sarDatasets.find((d) => d.id === "NOR_TPP3_TANK_VERTICAL");
  assert.equal(meta.forecastAvailable, false);
  assert.equal(meta.points.length, 4);
  assert.ok(
    meta.points.every((p) => p.velocity === null && p.gridSizeMeters === 20),
  );
});
